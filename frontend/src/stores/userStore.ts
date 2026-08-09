import { defineStore } from 'pinia'
import {
  changePassword,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister
} from '@/api/user'
import type {
  ChangePasswordPayload,
  LoginPayload,
  LoginResult,
  RegisterPayload,
  UserInfo
} from '@/types/user'
import {
  ACCESS_TOKEN_KEY,
  clearAuthStorage,
  readAccessToken,
  readRefreshToken,
  readStoredUser,
  REFRESH_TOKEN_KEY,
  USER_KEY
} from '@/utils/auth-storage'

export const useUserStore = defineStore('user', {
  state: () => ({
    accessToken: readAccessToken(),
    refreshToken: readRefreshToken(),
    user: readStoredUser()
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.accessToken),
    isAdmin: (state) => state.user?.role === 'ADMIN',
    displayName: (state) => state.user?.nickname || state.user?.username || ''
  },
  actions: {
    async login(payload: LoginPayload): Promise<void> {
      this.applyAuth(await apiLogin(payload))
    },
    async register(payload: RegisterPayload): Promise<UserInfo> {
      return apiRegister(payload)
    },
    /** 应用启动时恢复登录态：有 token 但无用户信息则拉取 /me */
    async init(): Promise<void> {
      if (this.accessToken && !this.user) {
        try {
          this.user = await fetchMe()
          localStorage.setItem(USER_KEY, JSON.stringify(this.user))
        } catch {
          // 401 已由 http 拦截器处理：刷新重试或清空登录态
        }
      }
    },
    async logout(): Promise<void> {
      try {
        if (this.refreshToken) {
          await apiLogout({ refreshToken: this.refreshToken })
        }
      } catch {
        // 注销接口异常不阻断本地清理
      } finally {
        this.clearAuth()
      }
    },
    async changePassword(payload: ChangePasswordPayload): Promise<void> {
      await changePassword(payload)
      this.clearAuth()
    },
    applyAuth(result: LoginResult): void {
      this.accessToken = result.accessToken
      this.refreshToken = result.refreshToken
      this.user = result.user
      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(result.user))
    },
    clearAuth(): void {
      this.accessToken = ''
      this.refreshToken = ''
      this.user = null
      clearAuthStorage()
    }
  }
})
