import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { createResume, fetchResume, switchResumeTemplate, updateResume } from '@/api/resume'
import type {
  ResumeCommonData,
  ResumeExtendedData,
  ResumeVO,
  SwitchTemplatePayload
} from '@/types'

/** 生成空公共数据对象（结构与 docs/resume-common.schema.json 一致） */
export function emptyCommonData(): ResumeCommonData {
  return {
    basic: {},
    summary: '',
    experiences: [],
    education: [],
    skills: [],
    socials: [],
    projects: [],
    certifications: [],
    languages: [],
    awards: [],
    interests: []
  }
}

function parseObject(raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * 简历数据状态：公共数据 + 模板专属数据 + 当前模板ID。
 * 保存时三者一并提交；切换模板时调用后端接口，用返回结果整体替换本地状态。
 */
export const useResumeStore = defineStore('resume', () => {
  const id = ref<string | null>(null)
  const title = ref('')
  const commonData = ref<ResumeCommonData>(emptyCommonData())
  const extendedData = ref<ResumeExtendedData>({})
  const currentTemplateId = ref<string | null>(null)
  const status = ref(0)
  const saving = ref(false)
  const switching = ref(false)

  const hasChanges = computed(() => true)

  function applyVO(vo: ResumeVO) {
    id.value = vo.id
    title.value = vo.title ?? ''
    status.value = vo.status ?? 0
    currentTemplateId.value = vo.currentTemplateId ?? vo.templateCode ?? null
    commonData.value = normalizeCommon(vo.commonData)
    extendedData.value = normalizeExtended(vo.extendedData)
  }

  function normalizeCommon(raw: unknown): ResumeCommonData {
    const parsed = parseObject(raw)
    const base = emptyCommonData()
    return {
      basic: { ...base.basic, ...(isObject(parsed.basic) ? parsed.basic : {}) },
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      socials: Array.isArray(parsed.socials) ? parsed.socials : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      awards: Array.isArray(parsed.awards) ? parsed.awards : [],
      interests: Array.isArray(parsed.interests) ? parsed.interests : []
    }
  }

  function normalizeExtended(raw: unknown): ResumeExtendedData {
    return parseObject(raw) as ResumeExtendedData
  }

  async function load(resumeId: string) {
    const vo = await fetchResume(resumeId)
    applyVO(vo)
  }

  async function save(): Promise<ResumeVO> {
    saving.value = true
    try {
      const payload = {
        title: title.value.trim(),
        currentTemplateId: currentTemplateId.value ?? undefined,
        commonData: JSON.stringify(commonData.value),
        extendedData: JSON.stringify(extendedData.value),
        status: status.value
      }
      const vo = id.value
        ? await updateResume(id.value, payload)
        : await createResume(payload)
      applyVO(vo)
      return vo
    } finally {
      saving.value = false
    }
  }

  async function switchTemplate(newTemplateId: string): Promise<ResumeVO> {
    if (!id.value) {
      // 新建中的简历切换模板：仅更新本地当前模板，保存时落库
      currentTemplateId.value = newTemplateId
      return {
        id: '',
        userId: '',
        templateId: null,
        templateCode: newTemplateId,
        currentTemplateId: newTemplateId,
        title: title.value,
        commonData: commonData.value,
        extendedData: extendedData.value,
        status: status.value
      }
    }
    switching.value = true
    try {
      const payload: SwitchTemplatePayload = { newTemplateId }
      const vo = await switchResumeTemplate(id.value, payload)
      applyVO(vo)
      return vo
    } finally {
      switching.value = false
    }
  }

  function reset() {
    id.value = null
    title.value = ''
    commonData.value = emptyCommonData()
    extendedData.value = {}
    currentTemplateId.value = null
    status.value = 0
  }

  return {
    id,
    title,
    commonData,
    extendedData,
    currentTemplateId,
    status,
    saving,
    switching,
    hasChanges,
    applyVO,
    load,
    save,
    switchTemplate,
    reset
  }
})

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
