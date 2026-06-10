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
export function completeOrder(id) {
  return request.post(`/delivery/orders/${id}/complete`)
}

// 获取个人信息
export function getProfile() {
  return request.get('/delivery/profile')
}

// 修改密码
export function changePassword(data) {
  return request.put('/delivery/profile/password', data)
}

// 更新在线状态
export function updateOnlineStatus(onlineStatus) {
  return request.put('/delivery/online-status', null, { params: { onlineStatus } })
}

// 上报配送员位置
export function reportLocation(data) {
  return request.post('/delivery/location/report', data)
}

// 配送员批量上报位置（全局上报模式）
export function reportLocationBatch(data) {
  return request.post('/delivery/location/report-batch', data)
}

// 获取配送员当前在途派单ID列表
export function getActiveDispatchIds() {
  return request.get('/delivery/location/active-dispatch-ids')
}

// 获取配送轨迹
export function getDeliveryTrack(dispatchId) {
  return request.get(`/delivery/location/track/${dispatchId}`)
}

// 获取配送员最新位置
export function getCurrentLocation(dispatchId) {
  return request.get(`/delivery/location/current/${dispatchId}`)
}
