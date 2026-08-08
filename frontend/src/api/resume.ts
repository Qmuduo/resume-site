import http from './http'
import type { ApiResult, ResumePayload, ResumeRecord } from '@/types'

export async function fetchResumes(): Promise<ResumeRecord[]> {
  const response = await http.get<ApiResult<ResumeRecord[]>>('/resumes')
  return response.data.data
}

export async function fetchResume(id: string | number): Promise<ResumeRecord> {
  const response = await http.get<ApiResult<ResumeRecord>>(`/resumes/${id}`)
  return response.data.data
}

export async function createResume(payload: ResumePayload): Promise<ResumeRecord> {
  const response = await http.post<ApiResult<ResumeRecord>>('/resumes', payload)
  return response.data.data
}

export async function updateResume(id: string | number, payload: ResumePayload): Promise<ResumeRecord> {
  const response = await http.put<ApiResult<ResumeRecord>>(`/resumes/${id}`, payload)
  return response.data.data
}

export async function deleteResume(id: string | number): Promise<void> {
  await http.delete<ApiResult<unknown>>(`/resumes/${id}`)
}
