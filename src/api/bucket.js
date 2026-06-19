import request from '@/utils/request'

/**
 * 借桶（订单同步时调用）
 */
export function borrowBucket(data) {
  return request({
    url: '/api/bucket/borrow',
    method: 'post',
    data
  })
}

/**
 * 还桶（配送员配送完成时调用）
 */
export function returnBucket(data) {
  return request({
    url: '/api/bucket/return',
    method: 'post',
    data
  })
}
