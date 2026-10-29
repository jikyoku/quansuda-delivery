import { reactive } from 'vue'
import { useUserStore } from '@/stores/user'
import {
  reportLocation as reportLocationApi,
  reportLocationBatch as reportLocationBatchApi,
  getActiveDispatchIds as getActiveDispatchIdsApi
} from '@/api/location'

/**
 * 配送员位置服务（全局单例）
 *
 * 设计要点（BUG-02 / BUG-04 / BUG-05 / BUG-06 的统一重构）：
 * - 全 App 只有这一个实例、只有一组定时器，句柄全部集中保存在实例字段中，
 *   任何页面进出都不会新建/遗忘定时器；登出时 stopAll() 一次清干净。
 * - 两级定时器：
 *   1) 监视定时器（60s）：仅负责刷新"在途派单集合"，运行条件 = 已登录 && 在线。
 *      即使当前 0 个在途单它也在跑，所以"先上线、后接单"能自动开始上报（修 BUG-04）。
 *   2) 上报定时器（30s）：运行条件 = 监视开启 && 在途单 > 0，随集合增减自动启停；
 *      集合变空自动停、变非空自动启，不存在"停了就再也起不来"。
 * - 启停全部是同步操作，先改状态位再动定时器，不存在 async 守卫窗口（修 BUG-05）。
 * - 在途集合刷新带序号，旧响应回来直接丢弃；在飞刷新合并为"飞完补一次"，不并发。
 * - 所有上报在发送瞬间对派单ID集合做快照拷贝；单单即时上报的 ID 来自调用参数
 *   （值拷贝），不存在读取可变共享变量的回调（修 BUG-06，杜绝串单与 dispatchId=null）。
 * - 回前台（visibilitychange）与网络恢复（online）时：立即刷新集合并补报一次；
 *   断网（offline）时 tick 自动跳过发送，不产生无意义的失败请求。
 */

const REPORT_INTERVAL = 30000 // 上报间隔 30s
const WATCH_INTERVAL = 60000 // 在途集合监视刷新间隔 60s

class LocationService {
  constructor() {
    // 对外共享的响应式定位状态（useLocation 与页面共用同一份）
    this.state = reactive({
      currentLng: null,
      currentLat: null,
      hasLocation: false,
      activeDispatchIds: [],
      reporting: false, // 上报定时器是否在跑
      watching: false // 监视定时器是否在跑
    })

    this._reportTimer = null
    this._watchTimer = null
    this._trackedId = null // 详情页关注的派单ID（即时上报用）
    this._listenersRegistered = false
    this._refreshSeq = 0 // 刷新序号，防旧响应覆盖新状态
    this._refreshInFlight = false
    this._refreshPending = false
    this._networkOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false
  }

  /* ---------------- 对外状态读取 ---------------- */

  get _userStore() {
    return useUserStore()
  }

  _isLoggedIn() {
    return !!this._userStore.token
  }

  _isOnline() {
    return this._userStore.userInfo?.onlineStatus === 1
  }

  /* ---------------- 生命周期入口 ---------------- */

  /**
   * 会话级启动：登录成功 / App 冷启动恢复会话 / 进入工作台时调用，幂等。
   * 只注册一次全局监听，并按当前状态同步定时器。
   */
  bootstrap() {
    this._registerListenersOnce()
    this._syncWatching()
    if (this.state.watching) {
      this.refreshActiveDispatches()
    }
  }

  /** 在线开关变化（工作台切换上线/离线后调用） */
  setOnline(online) {
    // userInfo.onlineStatus 已由调用方先更新到 store，这里只做同步
    this._syncWatching()
    if (online && this.state.watching) {
      this.refreshActiveDispatches()
    }
    if (!online) {
      this._stopReporting()
    }
  }

  /**
   * 登出 / 会话失效时调用：停掉全部定时器、清空全部状态。
   * 全局监听保留注册（回调内有登录态守卫），下个会话 bootstrap 可直接复用，
   * 不会重复注册。
   */
  stopAll() {
    this._stopWatching()
    this._stopReporting()
    this.state.activeDispatchIds = []
    this.state.currentLng = null
    this.state.currentLat = null
    this.state.hasLocation = false
    this._trackedId = null
    this._refreshSeq++ // 让在飞的刷新响应作废
    this._refreshPending = false
    console.log('[LocationService] 已停止全部位置上报并清空状态')
  }

  /* ---------------- 在途集合与定时器同步 ---------------- */

  _syncWatching() {
    const shouldWatch = this._isLoggedIn() && this._isOnline()
    if (shouldWatch && !this._watchTimer) {
      this._watchTimer = setInterval(() => {
        this.refreshActiveDispatches()
      }, WATCH_INTERVAL)
      this.state.watching = true
      console.log('[LocationService] 监视定时器启动')
    } else if (!shouldWatch && this._watchTimer) {
      this._stopWatching()
      this._stopReporting()
    }
  }

  _stopWatching() {
    if (this._watchTimer) {
      clearInterval(this._watchTimer)
      this._watchTimer = null
    }
    this.state.watching = false
  }

  _syncReporting() {
    const shouldReport = this.state.watching && this.state.activeDispatchIds.length > 0
    if (shouldReport && !this._reportTimer) {
      // 立即补报一次，再进入周期上报
      this._doReportTick()
      this._reportTimer = setInterval(() => this._doReportTick(), REPORT_INTERVAL)
      this.state.reporting = true
      console.log('[LocationService] 上报定时器启动, 在途单:', [...this.state.activeDispatchIds])
    } else if (!shouldReport && this._reportTimer) {
      this._stopReporting()
    }
  }

  _stopReporting() {
    if (this._reportTimer) {
      clearInterval(this._reportTimer)
      this._reportTimer = null
    }
    this.state.reporting = false
  }

  /**
   * 刷新在途派单集合（接单/开始配送/完成/回前台/网络恢复时调用）。
   * 带序号与在飞合并：并发调用不会打出并发请求，旧响应不会覆盖新状态。
   */
  async refreshActiveDispatches() {
    if (!this._isLoggedIn()) return
    if (this._refreshInFlight) {
      this._refreshPending = true
      return
    }
    this._refreshInFlight = true
    const seq = ++this._refreshSeq
    try {
      const res = await getActiveDispatchIdsApi()
      if (seq !== this._refreshSeq || !this._isLoggedIn()) return // 已有更新的刷新或已登出，丢弃
      const ids = Array.isArray(res.data) ? [...res.data] : []
      this.state.activeDispatchIds = ids
      this._syncWatching()
      this._syncReporting()
    } catch (error) {
      // 401 等会话错误由请求层统一处理；这里只记录，不动现有集合与定时器
      console.error('[LocationService] 刷新在途派单失败:', error)
    } finally {
      this._refreshInFlight = false
      if (this._refreshPending) {
        this._refreshPending = false
        this.refreshActiveDispatches()
      }
    }
  }

  /* ---------------- 详情页单单即时上报 ---------------- */

  /**
   * 详情页进入配送中订单时调用：以参数 ID 的快照立即上报一次，
   * 并触发在途集合刷新（持续上报由全局批量定时器接管，该单必在集合内）。
   * 不再有 per-order 定时器，天然不存在回调串单。
   */
  trackOrder(dispatchId) {
    if (dispatchId == null) return
    const idSnapshot = dispatchId // 值快照，后续任何状态变化都不影响本次上报
    this._trackedId = idSnapshot
    this._fetchPosition().then((pos) => {
      if (!pos || this._trackedId !== idSnapshot || !this._isLoggedIn()) return
      reportLocationApi({
        dispatchId: idSnapshot,
        longitude: pos.lng,
        latitude: pos.lat
      }).catch((err) => console.error('[LocationService] 即时位置上报失败:', err))
    })
    this.refreshActiveDispatches()
  }

  /** 详情页离开 / 订单完成时调用 */
  untrackOrder() {
    this._trackedId = null
  }

  /* ---------------- 上报执行 ---------------- */

  _doReportTick() {
    if (!this._networkOnline) {
      console.log('[LocationService] 当前离线，跳过本次上报')
      return
    }
    // 发送瞬间对集合做快照，发送过程中集合变化不影响本次请求内容
    const idsSnapshot = [...this.state.activeDispatchIds]
    if (idsSnapshot.length === 0) {
      this._syncReporting()
      return
    }
    this._fetchPosition().then((pos) => {
      if (!pos || !this._isLoggedIn()) return
      reportLocationBatchApi({
        dispatchIds: idsSnapshot,
        longitude: pos.lng,
        latitude: pos.lat
      }).catch((err) => console.error('[LocationService] 批量位置上报失败:', err))
    })
  }

  /** 立即上报一次（回前台/网络恢复时补报） */
  reportNow() {
    if (this.state.reporting) {
      this._doReportTick()
    }
  }

  /* ---------------- 定位获取（GPS → 高德 → 缓存） ---------------- */

  _setLocation(lng, lat) {
    this.state.currentLng = lng
    this.state.currentLat = lat
    this.state.hasLocation = true
    this._userStore.setCurrentLocation(lng, lat)
  }

  /**
   * 获取当前位置，成功返回 {lng, lat}，失败返回 null（内部已做多级降级）。
   */
  _fetchPosition() {
    return new Promise((resolve) => {
      const done = (lng, lat) => {
        this._setLocation(lng, lat)
        resolve({ lng, lat })
      }
      const fallbackToCache = () => {
        if (this.state.currentLng != null && this.state.currentLat != null) {
          resolve({ lng: this.state.currentLng, lat: this.state.currentLat })
        } else {
          resolve(null)
        }
      }
      const tryAmap = () => {
        if (typeof AMap === 'undefined') {
          fallbackToCache()
          return
        }
        AMap.plugin('AMap.Geolocation', () => {
          const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 8000
          })
          geolocation.getCurrentPosition((status, result) => {
            if (status === 'complete' && result.position) {
              done(result.position.lng, result.position.lat)
            } else {
              fallbackToCache()
            }
          })
        })
      }

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => done(pos.coords.longitude, pos.coords.latitude),
          () => tryAmap(),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
        )
      } else {
        tryAmap()
      }
    })
  }

  /** 页面主动定位（如工作台、详情页绘制路线），返回是否定位成功 */
  async fetchLocation() {
    const pos = await this._fetchPosition()
    return !!pos
  }

  getLocation() {
    return {
      lng: this.state.currentLng,
      lat: this.state.currentLat
    }
  }

  /** 供详情页后端兜底位置回填（后端最后已知位置）使用 */
  setKnownLocation(lng, lat) {
    this._setLocation(lng, lat)
  }

  /* ---------------- 全局监听（只注册一次） ---------------- */

  _registerListenersOnce() {
    if (this._listenersRegistered || typeof window === 'undefined') return
    this._listenersRegistered = true

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      if (!this._isLoggedIn()) return
      // 回前台：刷新在途集合（集合变化会自动启停上报），并补报一次最新位置
      this.refreshActiveDispatches()
      this.reportNow()
    })

    window.addEventListener('online', () => {
      this._networkOnline = true
      if (!this._isLoggedIn()) return
      console.log('[LocationService] 网络恢复，刷新在途集合并补报')
      this.refreshActiveDispatches()
      this.reportNow()
    })

    window.addEventListener('offline', () => {
      this._networkOnline = false
      console.log('[LocationService] 网络断开，上报 tick 将跳过发送')
    })
  }
}

// 全局单例：整个 App 生命周期内只有这一个实例
export const locationService = new LocationService()
