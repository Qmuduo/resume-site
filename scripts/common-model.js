/**
 * 公共数据模型共享工具：字段别名 -> 公共模型路径 映射表 + Schema 路径校验。
 * 与后端 TemplateConfigService.resolveCommonPath() 保持一致。
 */
'use strict'

const fs = require('fs')
const path = require('path')

const COMMON_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'docs', 'resume-common.schema.json'), 'utf8')
)

/** 模板字段别名 -> 公共模型路径（点路径） */
const COMMON_ALIASES = {
  name: 'basic.name',
  fullName: 'basic.name',
  full_name: 'basic.name',
  candidateName: 'basic.name',
  title: 'basic.title',
  jobTitle: 'basic.title',
  job_title: 'basic.title',
  headline: 'basic.title',
  position: 'basic.title',
  phone: 'basic.phone',
  mobile: 'basic.phone',
  tel: 'basic.phone',
  telephone: 'basic.phone',
  cell: 'basic.phone',
  email: 'basic.email',
  mail: 'basic.email',
  address: 'basic.address',
  addr: 'basic.address',
  location: 'basic.location',
  city: 'basic.location',
  region: 'basic.location',
  basedIn: 'basic.location',
  avatar: 'basic.avatar',
  photo: 'basic.avatar',
  headshot: 'basic.avatar',
  profileImage: 'basic.avatar',
  summary: 'summary',
  about: 'summary',
  profile: 'summary',
  intro: 'summary',
  objective: 'summary',
  bio: 'summary',
  experiences: 'experiences',
  experience: 'experiences',
  work: 'experiences',
  workExperiences: 'experiences',
  career: 'experiences',
  employment: 'experiences',
  education: 'education',
  educations: 'education',
  edu: 'education',
  skills: 'skills',
  skill: 'skills',
  technologies: 'skills',
  techStack: 'skills',
  socials: 'socials',
  social: 'socials',
  links: 'socials',
  profiles: 'socials',
  contactLinks: 'socials',
  projects: 'projects',
  project: 'projects',
  portfolio: 'projects',
  certifications: 'certifications',
  certification: 'certifications',
  certs: 'certifications',
  certificates: 'certifications',
  languages: 'languages',
  language: 'languages',
  awards: 'awards',
  honors: 'awards',
  honorsAwards: 'awards',
  interests: 'interests',
  hobbies: 'interests',
  activities: 'interests'
}

/** 字段名归一化：去空格/连字符/下划线，转小驼峰 */
function normalizeKey(key) {
  if (!key) return ''
  return key
    .replace(/[\s_\-./]+/g, ' ')
    .trim()
    .replace(/\s+([a-zA-Z0-9])/g, (_, ch) => ch.toUpperCase())
    .replace(/\s+/g, '')
}

/** 把任意模板字段名解析为公共模型路径；解析不到返回 null */
function resolveCommonPath(key) {
  if (!key) return null
  const normalized = normalizeKey(key)
  if (COMMON_ALIASES[normalized]) return COMMON_ALIASES[normalized]
  if (COMMON_ALIASES[key]) return COMMON_ALIASES[key]
  const lower = key.toLowerCase()
  if (COMMON_ALIASES[lower]) return COMMON_ALIASES[lower]
  return null
}

/** 校验点路径是否存在于公共 Schema */
function pathExistsInSchema(schema, dotPath) {
  if (!dotPath) return false
  const parts = dotPath.split('.')
  let node = schema
  for (const part of parts) {
    if (!node || typeof node !== 'object') return false
    if (node.type === 'array') node = node.items
    node = node.properties ? node.properties[part] : undefined
    if (!node) return false
  }
  return true
}

/** HTML 工具 */
function stripTags(text) {
  return String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function collapse(text) {
  return stripTags(text).replace(/[\s\u00a0]+/g, ' ').trim()
}

module.exports = {
  COMMON_SCHEMA,
  COMMON_ALIASES,
  normalizeKey,
  resolveCommonPath,
  pathExistsInSchema,
  stripTags,
  collapse
}
