export type UserRole = 'USER' | 'ADMIN'

/** 用户信息（后端 UserVO，永不包含密码） */
export interface UserInfo {
  id: number
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
