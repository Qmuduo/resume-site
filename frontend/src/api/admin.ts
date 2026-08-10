import http from './http'
import type { ApiResult } from '@/types'
import type { UserInfo, UserRole } from '@/types/user'

export async function fetchAdminUsers(): Promise<UserInfo[]> {
  const response = await http.get<ApiResult<UserInfo[]>>('/v1/admin/users')
  return response.data.data
}

export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  await http.put<ApiResult<unknown>>(`/v1/admin/users/${id}/role`, { role })
}
