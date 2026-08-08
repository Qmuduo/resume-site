import http from './http'
import type { ApiResult, ResumeTemplate } from '@/types'

export async function fetchTemplates(): Promise<ResumeTemplate[]> {
  const response = await http.get<ApiResult<ResumeTemplate[]>>('/templates')
  return response.data.data
}
