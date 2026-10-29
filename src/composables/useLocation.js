import { toRef } from 'vue'
import { locationService } from '@/services/locationService'

/**
 * 位置管理 composable（兼容层）
 *
 * 历史实现把定时器句柄放在每次调用新建的闭包里，导致多实例叠加、
 * 句柄丢失、登出不停等一系列问题（BUG-02/04/05/06）。
 * 现在全部状态与定时器收敛到全局单例 locationService，本 composable
 * 只转发其共享状态与方法，任何页面、任何次数调用都指向同一份状态。
 */
export function useLocation() {
  const state = locationService.state

  return {
    // 响应式数据（与 LocationService 单例共享同一份）
    currentLng: toRef(state, 'currentLng'),
    currentLat: toRef(state, 'currentLat'),
    hasLocation: toRef(state, 'hasLocation'),

    // 主动定位
    fetchLocation: () => locationService.fetchLocation(),
    getLocation: () => locationService.getLocation(),

    // 详情页单单即时上报（无 per-order 定时器，持续上报由全局批量接管）
    startReport: (dispatchId) => locationService.trackOrder(dispatchId),
    stopReport: () => locationService.untrackOrder(),

    // 全局上报生命周期（幂等，由服务按 登录 && 在线 && 在途单 驱动）
    startGlobalReport: () => locationService.bootstrap(),
    stopGlobalReport: () => locationService.setOnline(false)
  }
}
