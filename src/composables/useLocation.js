import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { reportLocation as reportLocationApi, reportLocationBatch as reportLocationBatchApi, getActiveDispatchIds as getActiveDispatchIdsApi } from '@/api/delivery'

/**
 * 配送员位置管理 composable
 * 统一管理位置获取、上报逻辑
 * 
 * 参考京东/美团配送端设计：
 * - 打开App自动定位
 * - 接单后自动开始位置上报（每30秒）
 * - GPS失败自动降级到高德IP定位
 */
export function useLocation() {
  const userStore = useUserStore()

  // 当前位置响应式数据
  const currentLng = ref(null)
  const currentLat = ref(null)
  const hasLocation = ref(false)

  // 位置上报定时器
  let reportTimer = null
  let currentDispatchId = null
  // 全局位置上报定时器
  let globalReportTimer = null
  let activeDispatchIds = []

  /**
   * 获取当前位置（GPS + 高德IP定位备选）
   * @returns {Promise<boolean>} 是否成功获取位置
   */
  const fetchLocation = () => {
    return new Promise((resolve) => {
      // 优先用浏览器 GPS
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            _setLocation(pos.coords.longitude, pos.coords.latitude)
            console.log('[useLocation] GPS定位成功:', pos.coords.longitude, pos.coords.latitude)
            resolve(true)
          },
          () => {
            // GPS失败，尝试高德 IP 定位
            console.warn('[useLocation] GPS失败，尝试高德IP定位')
            _amapGeolocation(resolve)
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
        )
      } else {
        _amapGeolocation(resolve)
      }
    })
  }

  /**
   * 高德地图定位插件（支持 IP 定位备选）
   */
  const _amapGeolocation = (callback) => {
    if (typeof AMap === 'undefined') {
      console.warn('[useLocation] 高德地图API未加载')
      callback(false)
      return
    }
    AMap.plugin('AMap.Geolocation', () => {
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 8000
      })
      geolocation.getCurrentPosition((status, result) => {
        if (status === 'complete' && result.position) {
          _setLocation(result.position.lng, result.position.lat)
          console.log('[useLocation] 高德定位成功:', result.position.lng, result.position.lat)
          callback(true)
        } else {
          console.warn('[useLocation] 高德定位失败:', status, result)
          callback(false)
        }
      })
    })
  }

  /**
   * 设置位置（内部方法）
   */
  const _setLocation = (lng, lat) => {
    currentLng.value = lng
    currentLat.value = lat
    hasLocation.value = true
    // 同步到全局 store
    userStore.setCurrentLocation(lng, lat)
  }

  /**
   * 启动位置上报（每30秒上报一次）
   * @param {number} dispatchId 派单ID
   */
  const startReport = (dispatchId) => {
    if (reportTimer) {
      console.warn('[useLocation] 位置上报已在运行')
      return
    }
    currentDispatchId = dispatchId
    console.log('[useLocation] 启动位置上报, dispatchId:', dispatchId)
    
    // 立即上报一次
    _doReport()
    
    // 每30秒上报
    reportTimer = setInterval(_doReport, 30000)
  }

  /**
   * 停止位置上报
   */
  const stopReport = () => {
    if (reportTimer) {
      clearInterval(reportTimer)
      reportTimer = null
    }
    currentDispatchId = null
    console.log('[useLocation] 停止位置上报')
  }

  /**
   * 执行位置上报（内部方法）
   * 优先级：GPS → 高德IP定位 → 缓存位置
   */
  const _doReport = () => {
    if (!currentDispatchId) return
    
    // 获取最新位置并上报
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lng = pos.coords.longitude
          const lat = pos.coords.latitude
          _setLocation(lng, lat)
          _sendReport(currentDispatchId, lng, lat)
        },
        (err) => {
          console.warn('[useLocation] 上报时GPS获取失败:', err.message)
          // GPS失败，尝试高德IP定位
          _amapGeolocationForReport()
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else {
      // 无GPS能力，尝试高德IP定位
      _amapGeolocationForReport()
    }
  }

  /**
   * 上报时的高德定位回退（内部方法）
   * 先尝试高德IP定位，失败则用缓存位置
   */
  const _amapGeolocationForReport = () => {
    if (typeof AMap === 'undefined') {
      // 高德API未加载，用缓存位置
      _reportWithCachedLocation()
      return
    }
    AMap.plugin('AMap.Geolocation', () => {
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 8000
      })
      geolocation.getCurrentPosition((status, result) => {
        if (status === 'complete' && result.position) {
          const lng = result.position.lng
          const lat = result.position.lat
          _setLocation(lng, lat)
          _sendReport(currentDispatchId, lng, lat)
          console.log('[useLocation] 上报时使用高德IP定位成功:', lng, lat)
        } else {
          console.warn('[useLocation] 上报时高德定位也失败，使用缓存')
          _reportWithCachedLocation()
        }
      })
    })
  }

  /**
   * 使用缓存位置上报（最后手段）
   */
  const _reportWithCachedLocation = () => {
    if (currentLng.value && currentLat.value) {
      _sendReport(currentDispatchId, currentLng.value, currentLat.value)
      console.log('[useLocation] 使用缓存位置上报:', currentLng.value, currentLat.value)
    } else {
      console.warn('[useLocation] 无可用位置，本次上报跳过')
    }
  }

  /**
   * 发送单条位置上报请求（用于单个派单的场景）
   */
  const _sendReport = (dispatchId, lng, lat) => {
    reportLocationApi({
      dispatchId: dispatchId,
      longitude: lng,
      latitude: lat
    }).catch(err => {
      console.error('[useLocation] 位置上报失败:', err)
    })
  }

  /**
   * 启动全局位置上报（上线即上报模式，参考美团骑手设计）
   * 自动获取所有在途派单ID，定时上报位置到每个在途派单
   */
  const startGlobalReport = async () => {
    if (globalReportTimer) {
      console.warn('[useLocation] 全局位置上报已在运行')
      return
    }
    console.log('[useLocation] 启动全局位置上报')

    // 获取在途派单ID列表
    try {
      const res = await getActiveDispatchIdsApi()
      activeDispatchIds = res.data || []
      console.log('[useLocation] 当前在途派单:', activeDispatchIds)

      if (activeDispatchIds.length === 0) {
        console.log('[useLocation] 无在途派单，无需全局上报')
        return
      }
    } catch (error) {
      console.error('[useLocation] 获取在途派单ID失败:', error)
      return
    }

    // 立即上报一次
    _doGlobalReport()

    // 每30秒上报
    globalReportTimer = setInterval(_doGlobalReport, 30000)

    // 每5分钟刷新在途派单列表（可能接新单或完成旧单）
    setInterval(_refreshActiveDispatchIds, 300000)
  }

  /**
   * 停止全局位置上报
   */
  const stopGlobalReport = () => {
    if (globalReportTimer) {
      clearInterval(globalReportTimer)
      globalReportTimer = null
    }
    activeDispatchIds = []
    console.log('[useLocation] 停止全局位置上报')
  }

  /**
   * 执行全局位置上报
   * 优先级：GPS → 高德IP定位 → 缓存位置
   */
  const _doGlobalReport = () => {
    if (activeDispatchIds.length === 0) {
      // 刷新派单列表
      _refreshActiveDispatchIds()
      return
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lng = pos.coords.longitude
          const lat = pos.coords.latitude
          _setLocation(lng, lat)
          _sendGlobalReport(lng, lat)
        },
        () => {
          console.warn('[useLocation] 全局上报时GPS失败，尝试高德IP')
          _amapGeolocationForGlobalReport()
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else {
      _amapGeolocationForGlobalReport()
    }
  }

  /**
   * 全局上报时的高德定位回退
   */
  const _amapGeolocationForGlobalReport = () => {
    if (typeof AMap === 'undefined') {
      _globalReportWithCachedLocation()
      return
    }
    AMap.plugin('AMap.Geolocation', () => {
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 8000
      })
      geolocation.getCurrentPosition((status, result) => {
        if (status === 'complete' && result.position) {
          const lng = result.position.lng
          const lat = result.position.lat
          _setLocation(lng, lat)
          _sendGlobalReport(lng, lat)
          console.log('[useLocation] 全局上报使用高德IP定位成功:', lng, lat)
        } else {
          console.warn('[useLocation] 全局上报时高德定位也失败，使用缓存')
          _globalReportWithCachedLocation()
        }
      })
    })
  }

  /**
   * 使用缓存位置进行全局上报
   */
  const _globalReportWithCachedLocation = () => {
    if (currentLng.value && currentLat.value) {
      _sendGlobalReport(currentLng.value, currentLat.value)
      console.log('[useLocation] 使用缓存位置全局上报:', currentLng.value, currentLat.value)
    } else {
      console.warn('[useLocation] 无可用位置，本次全局上报跳过')
    }
  }

  /**
   * 发送全局位置上报请求（批量）
   */
  const _sendGlobalReport = (lng, lat) => {
    if (activeDispatchIds.length === 0) return
    reportLocationBatchApi({
      dispatchIds: activeDispatchIds,
      longitude: lng,
      latitude: lat
    }).catch(err => {
      console.error('[useLocation] 全局位置上报失败:', err)
    })
  }

  /**
   * 刷新在途派单ID列表
   */
  const _refreshActiveDispatchIds = async () => {
    try {
      const res = await getActiveDispatchIdsApi()
      activeDispatchIds = res.data || []
      console.log('[useLocation] 刷新在途派单:', activeDispatchIds)

      // 如果没有在途派单了，停止全局上报
      if (activeDispatchIds.length === 0 && globalReportTimer) {
        stopGlobalReport()
      }
    } catch (error) {
      console.error('[useLocation] 刷新在途派单ID失败:', error)
    }
  }

  /**
   * 获取当前位置（非响应式，用于地图等需要即时值的场景）
   */
  const getLocation = () => {
    return {
      lng: currentLng.value,
      lat: currentLat.value
    }
  }

  return {
    // 响应式数据
    currentLng,
    currentLat,
    hasLocation,
    
    // 方法
    fetchLocation,
    startReport,
    stopReport,
    startGlobalReport,
    stopGlobalReport,
    getLocation
  }
}
