import http from './http'
import type { ApiResult } from '@/types'
import type {
  ChangePasswordPayload,
  LoginPayload,
  LoginResult,
  RegisterPayload,
  UserInfo
} from '@/types/user'

export async function register(payload: RegisterPayload): Promise<UserInfo> {
  const response = await http.post<ApiResult<UserInfo>>('/v1/auth/register', payload)
  return response.data.data
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  const response = await http.post<ApiResult<LoginResult>>('/v1/auth/login', payload)
  return response.data.data
}

export async function fetchMe(): Promise<UserInfo> {
  const response = await http.get<ApiResult<UserInfo>>('/v1/auth/me')
  return response.data.data
}

export async function logout(payload: { refreshToken: string }): Promise<void> {
  await http.post<ApiResult<unknown>>('/v1/auth/logout', payload)
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await http.put<ApiResult<unknown>>('/v1/auth/password', payload)
}
