import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiResult } from '@/types'
import type { LoginResult } from '@/types/user'
import {
  ACCESS_TOKEN_KEY,
  clearAuthStorage,
  readAccessToken,
  readRefreshToken,
  REFRESH_TOKEN_KEY
} from '@/utils/auth-storage'

const http = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 无拦截器的裸实例，仅用于 refresh，避免 401 递归
const bareHttp = axios.create({
  baseURL: '/api',
  timeout: 10000
})

http.interceptors.request.use((config) => {
  const token = readAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshPromise: Promise<string | null> | null = null

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false
  return (
    url.includes('/v1/auth/login') ||
    url.includes('/v1/auth/register') ||
    url.includes('/v1/auth/refresh')
  )
}

/** 用 refreshToken 换新 token 对；并发请求共享同一个刷新 Promise */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = readRefreshToken()
  if (!refreshToken) return null
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const response = await bareHttp.post<ApiResult<LoginResult>>('/v1/auth/refresh', {
        refreshToken
      })
      const data = response.data.data
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
      return data.accessToken
    } catch {
      clearAuthStorage()
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

function redirectToLogin(): void {
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResult<unknown>>) => {
    const config = error.config as RetriableConfig | undefined
    const status = error.response?.status
    // 仅对已携带 token 的普通接口做 401 自动刷新；登录/注册/刷新本身失败直接抛给页面
    if (status === 401 && config && !config._retry && !isAuthEndpoint(config.url)) {
      config._retry = true
      const newToken = await refreshAccessToken()
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`
        return http(config)
      }
      redirectToLogin()
    }
    return Promise.reject(error)
  }
)

export default http
