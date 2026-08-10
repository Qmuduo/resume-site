import type { TemplateManifest } from './resume'

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


/** 模板类型：含 manifest（字段定义与映射），字段为 docs/template-schema.json 白名单 */
export interface ResumeTemplate {
  /** 数据库主键（字符串，避免精度丢失）；内置模板在启动时种子进库后也有该值 */
  id?: string
  code: string
  name: string
  description: string
  schema?: SchemaNode
  html: string
  css: string
  /** 1=内置模板（系统种子，不可修改/删除），0=用户自定义 */
  builtin?: number
  /** 创建者；null 表示系统内置 */
  userId?: string | null
  /** 模板 manifest（字段定义、公共字段映射、示例数据） */
  manifest?: TemplateManifest | null
}

export type {
  ResumeBasicInfo,
  ResumeCommonData,
  ResumeEducation,
  ResumeExperience,
  ResumeExtendedData,
  ResumeProject,
  ResumeSkill,
  ResumeSocial,
  ResumeVO,
  ResumeRecord,
  ResumePayload,
  SwitchTemplatePayload,
  TemplateFieldDef,
  TemplateManifest,
  TemplateMapping
} from './resume'
