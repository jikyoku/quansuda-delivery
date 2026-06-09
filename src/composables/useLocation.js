import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { reportLocation as reportLocationApi } from '@/api/delivery'

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
          console.warn('[useLocation] GPS获取失败，使用缓存位置上报:', err.message)
          // GPS失败时使用缓存位置上报
          if (currentLng.value && currentLat.value) {
            _sendReport(currentDispatchId, currentLng.value, currentLat.value)
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else if (currentLng.value && currentLat.value) {
      _sendReport(currentDispatchId, currentLng.value, currentLat.value)
    }
  }

  /**
   * 发送位置上报请求
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
    getLocation
  }
}
