export type UserRole = 'USER' | 'ADMIN'

/**
 * 用户信息（后端 UserVO，永不包含密码）。
 * id 为字符串：后端 Long 通过 Jackson 序列化为字符串，避免 JS 精度丢失。
 */
export interface UserInfo {
  id: string
  username: string
  nickname: string | null
  email: string | null
  role: UserRole
  createdAt: string | null
}

/** 登录/刷新成功后的双 token 响应（后端 LoginVO） */
export interface LoginResult {
  accessToken: string
  expiresIn: number
  tokenType: string
  refreshToken: string
  user: UserInfo
}

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  username: string
  password: string
  email?: string
  nickname?: string
}

export interface ChangePasswordPayload {
  oldPassword: string
  newPassword: string
}
