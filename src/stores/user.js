import { defineStore } from 'pinia'
import { ref } from 'vue'

// 安全解析本地存储的 JSON（V-4）：存储内容损坏/被篡改时 JSON.parse 会抛错
// 导致 store 初始化失败、App 启动即崩；解析失败或结果非对象时回退默认值。
const parseStoredJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('delivery_token') || '')
  const refreshToken = ref(localStorage.getItem('delivery_refreshToken') || '')
  const userInfo = ref(parseStoredJson('delivery_userInfo', {}))
  // 配送员当前位置
  const currentLng = ref(null)
  const currentLat = ref(null)
  // 配送员车辆类型（用于路线规划默认交通工具）
  const vehicleType = ref(userInfo.value?.vehicleType || '')

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('delivery_token', newToken)
  }

  function setRefreshToken(newToken) {
    refreshToken.value = newToken || ''
    if (newToken) {
      localStorage.setItem('delivery_refreshToken', newToken)
    } else {
      localStorage.removeItem('delivery_refreshToken')
    }
  }

  function setUserInfo(info) {
    userInfo.value = info
    localStorage.setItem('delivery_userInfo', JSON.stringify(info))
    // 同步车辆类型
    if (info.vehicleType) {
      vehicleType.value = info.vehicleType
    }
  }

  function setCurrentLocation(lng, lat) {
    currentLng.value = lng
    currentLat.value = lat
  }

  function clearUser() {
    token.value = ''
    refreshToken.value = ''
    userInfo.value = {}
    vehicleType.value = ''
    currentLng.value = null
    currentLat.value = null
    localStorage.removeItem('delivery_token')
    localStorage.removeItem('delivery_refreshToken')
    localStorage.removeItem('delivery_userInfo')
  }

  return {
    token,
    refreshToken,
    userInfo,
    currentLng,
    currentLat,
    vehicleType,
    setToken,
    setRefreshToken,
    setUserInfo,
    setCurrentLocation,
    clearUser
  }
})
