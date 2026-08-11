import type { TemplateManifest, TemplateManifestV2 } from './resume'

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
  id?: string
  code: string
  name: string
  description: string
  category?: string | null
  tags?: string[] | null
  schema?: SchemaNode
  html: string
  css: string
  builtin?: number
  userId?: string | null
  manifest?: TemplateManifestV2 | TemplateManifest | null
}

export type {
  ResumeBasics,
  ResumeCustomSection,
  ResumeData,
  ResumeMetadata,
  ResumePayload,
  ResumeRecord,
  ResumeSection,
  ResumeSectionItem,
  ResumeSections,
  ResumeVO,
  SwitchTemplatePayload
} from './resume'

export type {
  TemplateBlock,
  TemplateManifestV2,
  TemplateRegion,
  TemplateThemeVar
} from './resume'

export type {
  ResumeAward,
  ResumeBasicInfo,
  ResumeCertification,
  ResumeCommonData,
  ResumeEducation,
  ResumeExperience,
  ResumeExtendedData,
  ResumeLanguage,
  ResumeProject,
  ResumeSkill,
  ResumeSocial,
  TemplateFieldDef,
  TemplateManifest,
  TemplateMapping
} from './resume'
