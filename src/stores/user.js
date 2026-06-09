import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('delivery_token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('delivery_userInfo') || '{}'))
  // 配送员当前位置
  const currentLng = ref(null)
  const currentLat = ref(null)

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('delivery_token', newToken)
  }

  function setUserInfo(info) {
    userInfo.value = info
    localStorage.setItem('delivery_userInfo', JSON.stringify(info))
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
    setToken,
    setUserInfo,
    setCurrentLocation,
    clearUser
  }
})
