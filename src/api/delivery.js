import request from '@/utils/request'

// 配送员登录
export function deliveryLogin(data) {
  return request.post('/delivery/login', data)
}

// 今日统计数据
export function getTodayStats() {
  return request.get('/delivery/today-stats')
}

// 获取订单列表
export function getOrderList(params) {
  return request.get('/delivery/orders', { params })
}

// 订单详情
export function getOrderDetail(id) {
  return request.get(`/delivery/orders/${id}`)
}

// 接单
export function acceptOrder(id) {
  return request.post(`/delivery/orders/${id}/accept`)
}

// 拒单
export function rejectOrder(id, data) {
  return request.post(`/delivery/orders/${id}/reject`, data)
}

// 开始配送
export function startDelivery(id) {
  return request.post(`/delivery/orders/${id}/start-delivery`)
}

// 确认送达
export function completeOrder(id, borrowBucketCount, returnBucketCount) {
  return request.post(`/delivery/orders/${id}/complete`, {
    borrowBucketCount,
    returnBucketCount
  })
}

// 获取个人信息
export function getProfile() {
  return request.get('/delivery/profile')
}

// 修改密码（入参 { oldPassword, newPassword }；后端按此路径补齐，见 XS-06）
export function changePassword(data) {
  return request.put('/delivery/profile/password', data)
}

// 配送员登出（服务端吊销 token；调用方应 best-effort 调用，无论成败都清本地会话，见 XS-08）
export function deliveryLogout() {
  return request.post('/delivery/logout')
}

// 更新在线状态
export function updateOnlineStatus(onlineStatus) {
  return request.put('/delivery/online-status', null, { params: { onlineStatus } })
}

// 位置相关接口已收敛到 @/api/location，这里保留 re-export 兼容旧引用
export { reportLocation, reportLocationBatch, getActiveDispatchIds } from './location'

// 获取配送轨迹
export function getDeliveryTrack(dispatchId) {
  return request.get(`/delivery/location/track/${dispatchId}`)
}

// 获取配送员最新位置
export function getCurrentLocation(dispatchId) {
  return request.get(`/delivery/location/current/${dispatchId}`)
}

// 上传配送完成凭证（照片）
export function uploadProofPhoto(dispatchId, file) {
  const formData = new FormData()
  formData.append('file', file)
  // 移动网络下大图上传较慢，超时放宽到60秒
  return request.post(`/delivery/orders/${dispatchId}/proof-photo`, formData, {
    timeout: 60000
  })
}

// 加载配送完成凭证图片（二进制，需带认证头）
export function fetchProofPhoto(attachmentId) {
  return request.get(`/delivery/attachments/${attachmentId}/preview`, {
    responseType: 'blob',
    timeout: 30000
  })
}

// 获取配送完成凭证列表
export function getProofPhotos(dispatchId) {
  return request.get(`/delivery/orders/${dispatchId}/proof-photos`)
}

// 删除配送完成凭证
export function deleteProofPhoto(attachmentId) {
  return request.delete(`/delivery/proof-photos/${attachmentId}`)
}
