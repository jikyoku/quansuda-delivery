import request from '@/utils/request'

// 上报配送员位置（单单）
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
