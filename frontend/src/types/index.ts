/** 与后端统一响应体 Result<T> 对齐的骨架类型 */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 与后端内置模板 JSON 对齐的模板类型（字段为 docs/template-schema.json 白名单） */
export interface ResumeTemplate {
  code: string
  name: string
  description: string
  schema: Record<string, unknown>
  html: string
  css: string
}
