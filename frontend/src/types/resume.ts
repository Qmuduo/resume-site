/**
 * 简历数据模型：ResumeData v1.0 单文档（与 docs/resume.schema.json 对齐）。
 * 旧 CommonData/ExtendedData 类型保留至阶段二/三组件移除后删除。
 */

/** 基本信息（新模型） */
export interface ResumeBasics {
  name: string
  headline: string
  email: string
  phone: string
  location: string
  website: { url: string; label: string }
  customFields: { id: string; icon: string; text: string; link: string }[]
}

export interface ResumeSectionItem {
  id: string
  hidden: boolean
  [key: string]: unknown
}

export interface ResumeSection {
  title: string
  columns: number
  hidden: boolean
  items: ResumeSectionItem[]
}

export interface ResumeCustomSection extends ResumeSection {
  id: string
}

export interface ResumeSections {
  profiles?: ResumeSection
  experience?: ResumeSection
  education?: ResumeSection
  projects?: ResumeSection
  skills?: ResumeSection
  languages?: ResumeSection
  interests?: ResumeSection
  awards?: ResumeSection
  certifications?: ResumeSection
  publications?: ResumeSection
  volunteer?: ResumeSection
  references?: ResumeSection
  [key: string]: ResumeSection | undefined
}

export interface ResumeMetadata {
  template: string
  layout: { main: string[]; sidebar: string[]; sidebarWidth: number }
  page: { format: 'A4' | 'Letter'; margin: number }
  design: {
    colors: {
      primary: string
      text: string
      background: string
      sidebarBackground?: string
      sidebarForeground?: string
    }
  }
  typography: { headingFont: string; bodyFont: string; fontSize: number }
  notes: string
  stylesheet: string
}

/** ResumeData v1.0 单文档 */
export interface ResumeData {
  version: '1.0'
  picture: { hidden: boolean; url: string; size: number; borderRadius: number }
  basics: ResumeBasics
  summary: { title: string; columns: number; hidden: boolean; content: string }
  sections: ResumeSections
  customSections: ResumeCustomSection[]
  metadata: ResumeMetadata
}

/** 列表/详情响应：元数据 + data 单文档 */
export interface ResumeVO {
  id: string
  userId: string
  title: string
  data: ResumeData | string | Record<string, unknown>
  status: number
  createdAt?: string
  updatedAt?: string
}

/** 创建/更新请求体 */
export interface ResumePayload {
  title: string
  data: ResumeData | string
  status?: number
}

export interface SwitchTemplatePayload {
  newTemplateId: string
}

/** 兼容旧列表响应：旧字段仅作类型兼容，运行期以 data 单文档为准 */
export interface ResumeRecord extends ResumeVO {
  templateCode?: string | null
  commonData?: unknown
  extendedData?: unknown
}

// ============ 旧模型（阶段二/三移除旧组件后删除） ============

/** 基本信息（旧模型） */
export interface ResumeBasicInfo {
  name: string
  title: string
  phone: string
  email: string
  address: string
  location: string
  avatar: string
}

export interface ResumeExperience {
  company: string
  position: string
  start: string
  end: string
  description: string
}

export interface ResumeEducation {
  school: string
  degree: string
  major: string
  start: string
  end: string
  description: string
}

export interface ResumeSkill {
  name: string
  level: string
}

export interface ResumeSocial {
  platform: string
  url: string
}

export interface ResumeProject {
  name: string
  role: string
  start: string
  end: string
  description: string
  link: string
}

export interface ResumeCertification {
  name: string
  issuer: string
  date: string
}

export interface ResumeLanguage {
  name: string
  level: string
}

export interface ResumeAward {
  name: string
  date: string
  description: string
}

export interface ResumeCommonData {
  basic: Partial<ResumeBasicInfo>
  summary: string
  experiences: ResumeExperience[]
  education: ResumeEducation[]
  skills: ResumeSkill[]
  socials: ResumeSocial[]
  projects: ResumeProject[]
  certifications: ResumeCertification[]
  languages: ResumeLanguage[]
  awards: ResumeAward[]
  interests: string[]
}

export type ResumeExtendedData = Record<string, unknown>

/** 模板 manifest 字段定义（旧模型，阶段二替换为 v2） */
export interface TemplateFieldDef {
  name: string
  label: string
  type: string
  commonPath: string | null
  autoDetected: boolean
  transform?: string
}

export interface TemplateMapping {
  commonPath: string
  field?: string
  selector: string
  attribute: string
  itemSelector?: string
  sectionTitle?: string
  index?: number
  autoDetected: boolean
}

export interface TemplateManifest {
  templateId: string
  name: string
  sourceFile: string
  renderMode: 'static' | 'placeholder'
  fields: TemplateFieldDef[]
  mappings: TemplateMapping[]
  sampleData?: Record<string, unknown>
  pendingManual?: TemplateFieldDef[]
}
