import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import router from '@/router'

let expiring = false

/**
 * 会话失效统一处理：停掉位置服务全部定时器 → 清本地会话 → 跳登录。
 * 由请求层在 HTTP 401 / body code 401 且刷新失败时调用；
 * 并发触发时只执行一次，避免重复 toast 与重复跳转。
 * 位置服务用动态 import 加载，避免与请求层形成静态循环依赖。
 */
export async function expireSession(message = '登录已过期，请重新登录') {
  if (expiring) return
  expiring = true
  try {
    const { locationService } = await import('@/services/locationService')
    locationService.stopAll()

    const userStore = useUserStore()
    const hadSession = !!userStore.token
    userStore.clearUser()
    if (hadSession) {
      showToast(message)
    }
    if (router.currentRoute.value.path !== '/login') {
      await router.replace('/login')
    }
  } finally {
    // 跳转完成后释放标记，允许下一次会话失效时再次处理
    setTimeout(() => {
      expiring = false
    }, 1000)
  }
}
