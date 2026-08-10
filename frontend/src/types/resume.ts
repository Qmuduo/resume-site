/**
 * 简历公共数据模型（与 docs/resume-common.schema.json 保持一致）。
 *
 * 分层约定：
 * - commonData：所有模板共用的数据，结构与 ResumeCommonData 一致；
 * - extendedData：模板专属字段，key-value 形式，切模板时按 manifest 映射、无法映射的暂存保留；
 * - currentTemplateId：当前模板标识（template_code）。
 */

/** 基本信息 */
export interface ResumeBasicInfo {
  name: string
  title: string
  phone: string
  email: string
  address: string
  location: string
  avatar: string
}

/** 工作经历单条 */
export interface ResumeExperience {
  company: string
  position: string
  start: string
  end: string
  description: string
}

/** 教育背景单条 */
export interface ResumeEducation {
  school: string
  degree: string
  major: string
  start: string
  end: string
  description: string
}

/** 技能单条 */
export interface ResumeSkill {
  name: string
  level: string
}

/** 社交链接单条 */
export interface ResumeSocial {
  platform: string
  url: string
}

/** 项目经验单条 */
export interface ResumeProject {
  name: string
  role: string
  start: string
  end: string
  description: string
  link: string
}

/** 证书单条 */
export interface ResumeCertification {
  name: string
  issuer: string
  date: string
}

/** 语言能力单条 */
export interface ResumeLanguage {
  name: string
  level: string
}

/** 荣誉奖项单条 */
export interface ResumeAward {
  name: string
  date: string
  description: string
}

/** 公共数据模型根对象 */
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

/** 模板专属数据：key-value 形式 */
export type ResumeExtendedData = Record<string, unknown>

/** 模板 manifest 中的字段定义 */
export interface TemplateFieldDef {
  /** 字段名（模板内部使用） */
  name: string
  /** 展示名 */
  label: string
  /** string | number | boolean | string[] | object | object[] */
  type: string
  /** 映射到的公共模型路径，如 basic.name；null 表示模板专属字段 */
  commonPath: string | null
  /** 是否自动识别 */
  autoDetected: boolean
  /** 取值时的可选项转换，如 skills 取 name */
  transform?: string
}

/** 模板 manifest 中的 DOM 映射 */
export interface TemplateMapping {
  /** 公共模型路径 */
  commonPath: string
  /** 模板专属字段名（commonPath 为空时使用） */
  field?: string
  /** CSS 选择器（仅静态模板使用） */
  selector: string
  /** textContent | href | src 等 */
  attribute: string
  /** 列表项选择器（attribute=children 时使用） */
  itemSelector?: string
  /** 区块标题（无 selector 时按标题定位区块） */
  sectionTitle?: string
  /** 同选择器命中多个元素时取第几个（1 基） */
  index?: number
  /** 是否自动识别 */
  autoDetected: boolean
}

/** 模板 manifest：docs/template/<name>.manifest.json */
export interface TemplateManifest {
  templateId: string
  name: string
  sourceFile: string
  /** static=静态 HTML（含示例数据）；placeholder={{}} 占位符模板 */
  renderMode: 'static' | 'placeholder'
  fields: TemplateFieldDef[]
  mappings: TemplateMapping[]
  /** 静态模板自动提取的示例数据（预览时用于还原原版效果） */
  sampleData?: Record<string, unknown>
  /** 无法自动识别、等待人工确认的字段 */
  pendingManual?: TemplateFieldDef[]
}

/** 简历完整信息（后端 ResumeVO / 新 resume 表结构） */
export interface ResumeVO {
  id: string
  userId: string
  templateId: string | null
  templateCode: string | null
  /** 当前使用的模板标识（template_code） */
  currentTemplateId: string | null
  title: string
  /** 公共数据（可能与旧 data 字段混用，兼容解析） */
  commonData: ResumeCommonData | string | Record<string, unknown>
  extendedData: ResumeExtendedData | string | null
  status: number
  createdAt?: string
  updatedAt?: string
}

/** 兼容旧列表接口：旧字段 data 仍可能出现在 list 响应中 */
export interface ResumeRecord extends ResumeVO {
  /** 旧版单列数据，迁移后可不再使用 */
  data?: string | Record<string, unknown>
}

/** 创建/更新简历请求体 */
export interface ResumePayload {
  title: string
  currentTemplateId?: string
  commonData?: string | ResumeCommonData
  extendedData?: string | ResumeExtendedData
  status?: number
}

/** 切换模板请求体 */
export interface SwitchTemplatePayload {
  newTemplateId: string
}
