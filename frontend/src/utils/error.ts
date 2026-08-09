import { AxiosError } from 'axios'
import type { ApiResult } from '@/types'

/** 从后端 Result<T> 中提取错误提示，拿不到时回退默认文案 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiResult<unknown> | undefined
    if (data?.message) return data.message
  }
  return fallback
}
