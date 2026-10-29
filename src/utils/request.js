import axios from 'axios'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { expireSession } from '@/utils/session'

/**
 * 统一请求层（与后端定版契约对齐，见 XS-04 / BUG-03）：
 * - 安全错误：真实 HTTP 401/403；业务错误：HTTP 200 + body code 非 200。
 * - HTTP 401 与 body code 401 同等对待：先走 refresh 轮换（若有 refreshToken），
 *   刷新成功重放原请求；刷新失败或无 refreshToken → 清会话跳登录。
 * - 403：提示无权限，不跳登录。
 * - 业务错误：提示后端 message；网络/超时：给中文兜底文案，绝不透出英文原始报错。
 * - blob 响应：先看 Content-Type，若是 JSON 错误体则按上面的规则解析处理，
 *   不再把错误 JSON 当图片数据交出去（BUG-03）。
 */

const request = axios.create({
  timeout: 10000
})

// 不参与 refresh 重试的接口（登录、刷新本身）
const NO_RETRY_URLS = ['/delivery/login', '/delivery/refresh']

// 刷新单飞：并发 401 只发一次刷新请求，其余等待同一个 Promise
let refreshPromise = null

function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  const userStore = useUserStore()
  const currentRefreshToken = userStore.refreshToken
  if (!currentRefreshToken) {
    return Promise.reject(new Error('no refresh token'))
  }
  // 用裸 axios 调刷新接口，避免走本拦截器造成递归
  refreshPromise = axios
    .post('/delivery/refresh', { refreshToken: currentRefreshToken }, { timeout: 10000 })
    .then((res) => {
      const body = res.data
      if (!body || body.code !== 200 || !body.data?.token) {
        throw new Error(body?.message || 'refresh failed')
      }
      userStore.setToken(body.data.token)
      // refresh 轮换：后端返回新 refreshToken 时一并替换，旧的立即弃用
      if (body.data.refreshToken) {
        userStore.setRefreshToken(body.data.refreshToken)
      }
      return body.data.token
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

// 401 统一处理：尝试刷新并重放；不可恢复则清会话跳登录
async function handleUnauthorized(config) {
  const isNoRetryUrl = NO_RETRY_URLS.some((u) => config?.url?.includes(u))
  if (!config || config.__authRetried || isNoRetryUrl) {
    await expireSession()
    throw new Error('登录已过期，请重新登录')
  }
  config.__authRetried = true
  try {
    await refreshAccessToken()
  } catch (e) {
    await expireSession()
    throw new Error('登录已过期，请重新登录')
  }
  // 用新 access token 重放原请求
  return request(config)
}

function httpErrorMessage(error) {
  const status = error.response?.status
  const serverMessage = error.response?.data?.message
  if (serverMessage) return serverMessage
  if (error.code === 'ECONNABORTED') return '请求超时，请稍后重试'
  if (!error.response) return '网络异常，请检查网络连接'
  switch (status) {
    case 400:
      return '请求参数不正确'
    case 403:
      return '无权限执行此操作'
    case 404:
      return '请求的资源不存在'
    case 500:
      return '服务器异常，请稍后重试'
    default:
      return `请求失败（${status}）`
  }
}

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  async (response) => {
    const config = response.config

    // blob 响应：可能是文件流，也可能是被序列化成 blob 的 JSON 错误体，必须先甄别
    if (config.responseType === 'blob') {
      const contentType = response.headers?.['content-type'] || response.data?.type || ''
      if (contentType.includes('application/json')) {
        let body = null
        try {
          body = JSON.parse(await response.data.text())
        } catch (e) {
          /* 解析失败按一般错误处理 */
        }
        if (body?.code === 401) {
          return handleUnauthorized(config)
        }
        const message = body?.message || '请求失败'
        showToast(message)
        throw Object.assign(new Error(message), { code: body?.code })
      }
      return response.data
    }

    const res = response.data
    if (res.code !== 200) {
      // body code 401 与 HTTP 401 同等处理
      if (res.code === 401) {
        return handleUnauthorized(config)
      }
      if (res.code === 403) {
        showToast(res.message || '无权限执行此操作')
      } else {
        showToast(res.message || '请求失败')
      }
      throw Object.assign(new Error(res.message || '请求失败'), { code: res.code })
    }
    return res
  },
  async (error) => {
    const status = error.response?.status
    const config = error.config
    if (status === 401) {
      // 真实 HTTP 401：清 token 跳登录（先走刷新），不再卡在“已登录”假状态（BUG-03）
      try {
        return await handleUnauthorized(config)
      } catch (e) {
        throw Object.assign(new Error('登录已过期，请重新登录'), { code: 401 })
      }
    }
    if (status === 403) {
      showToast(error.response?.data?.message || '无权限执行此操作')
      throw Object.assign(new Error('无权限执行此操作'), { code: 403 })
    }
    const message = httpErrorMessage(error)
    showToast(message)
    throw Object.assign(new Error(message), { code: status, cause: error })
  }
)

export default request
