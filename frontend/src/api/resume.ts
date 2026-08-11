import http from './http'
import type { ApiResult, ResumePayload, ResumeRecord, ResumeVO } from '@/types'

export async function fetchResumes(): Promise<ResumeRecord[]> {
  const response = await http.get<ApiResult<ResumeRecord[]>>('/resumes')
  return response.data.data
}

export async function fetchResume(id: string | number): Promise<ResumeVO> {
  const response = await http.get<ApiResult<ResumeVO>>(`/resumes/${id}`)
  return response.data.data
}

export async function createResume(payload: ResumePayload): Promise<ResumeVO> {
  const response = await http.post<ApiResult<ResumeVO>>('/resumes', payload)
  return response.data.data
}

export async function updateResume(id: string | number, payload: ResumePayload): Promise<ResumeVO> {
  const response = await http.put<ApiResult<ResumeVO>>(`/resumes/${id}`, payload)
  return response.data.data
}

export async function deleteResume(id: string | number): Promise<void> {
  await http.delete<ApiResult<unknown>>(`/resumes/${id}`)
}
