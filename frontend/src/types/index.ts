/** 与后端统一响应体 Result<T> 对齐的骨架类型 */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 受控 schema 节点：用于表单生成与模板渲染字段白名单 */
export interface SchemaNode {
  type?: string
  properties?: Record<string, SchemaNode>
  items?: SchemaNode
}

/** 与后端内置模板 JSON 对齐的模板类型（字段为 docs/template-schema.json 白名单） */
export interface ResumeTemplate {
  code: string
  name: string
  description: string
  schema: SchemaNode
  html: string
  css: string
}

/**
 * 简历记录（后端 Resume 实体）。
 * 注意：id/userId/templateId 后端通过 Jackson 序列化为字符串（避免 JS Number 精度丢失），
 * 因此前端类型为 string 而非 number。
 */
export interface ResumeRecord {
  id: string
  userId: string
  templateId: string | null
  templateCode: string | null
  title: string
  /** data 字段为 MySQL JSON 列，后端可能返回 string 或已反序列化的 object */
  data: string | Record<string, unknown>
  status: number
  createdAt?: string
  updatedAt?: string
}

/** 创建/更新简历的请求体 */
export interface ResumePayload {
  title: string
  templateCode: string
  data: string
  status?: number
}
