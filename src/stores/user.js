import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('delivery_token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('delivery_userInfo') || '{}'))
  // 配送员当前位置
  const currentLng = ref(null)
  const currentLat = ref(null)
  // 配送员车辆类型（用于路线规划默认交通工具）
  const vehicleType = ref(userInfo.value?.vehicleType || '')

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('delivery_token', newToken)
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
    userInfo.value = {}
    currentLng.value = null
    currentLat.value = null
    localStorage.removeItem('delivery_token')
    localStorage.removeItem('delivery_userInfo')
  }

  return {
    token,
    userInfo,
    currentLng,
    currentLat,
    vehicleType,
    setToken,
    setUserInfo,
    setCurrentLocation,
    clearUser
  }
})
