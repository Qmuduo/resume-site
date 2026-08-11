import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { createResume, fetchResume, updateResume } from '@/api/resume'
import type { ResumeCommonData, ResumeData, ResumeVO } from '@/types'

/** 旧模型空公共数据（阶段二/三移除旧组件后删除） */
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

export function emptyResumeData(): ResumeData {
  return {
    version: '1.0',
    picture: { hidden: true, url: '', size: 128, borderRadius: 50 },
    basics: { name: '', headline: '', email: '', phone: '', location: '', website: { url: '', label: '' }, customFields: [] },
    summary: { title: '个人简介', columns: 1, hidden: false, content: '' },
    sections: {},
    customSections: [],
    metadata: {
      template: '',
      layout: { main: [], sidebar: [], sidebarWidth: 30 },
      page: { format: 'A4', margin: 48 },
      design: { colors: { primary: '#4F46E5', text: '#1A1A1A', background: '#FFFFFF' } },
      typography: { headingFont: 'sans-serif', bodyFont: 'sans-serif', fontSize: 12 },
      notes: '',
      stylesheet: ''
    }
  }
}

export function parseData(raw: unknown): ResumeData {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...emptyResumeData(), ...(raw as Partial<ResumeData>) } as ResumeData
  }
  if (typeof raw === 'string') {
    try {
      return parseData(JSON.parse(raw))
    } catch {
      return emptyResumeData()
    }
  }
  return emptyResumeData()
}

export const useResumeStore = defineStore('resume', () => {
  const id = ref<string | null>(null)
  const title = ref('')
  const data = ref<ResumeData>(emptyResumeData())
  const status = ref(0)
  const saving = ref(false)
  const hasChanges = computed(() => true)

  function applyVO(vo: ResumeVO) {
    id.value = vo.id
    title.value = vo.title ?? ''
    status.value = vo.status ?? 0
    data.value = parseData(vo.data)
  }

  async function load(resumeId: string) {
    applyVO(await fetchResume(resumeId))
  }

  async function save(): Promise<ResumeVO> {
    saving.value = true
    try {
      const payload = {
        title: title.value.trim(),
        data: JSON.stringify(data.value),
        status: status.value
      }
      const vo = id.value ? await updateResume(id.value, payload) : await createResume(payload)
      applyVO(vo)
      return vo
    } finally {
      saving.value = false
    }
  }

  function reset() {
    id.value = null
    title.value = ''
    data.value = emptyResumeData()
    status.value = 0
  }

  return { id, title, data, status, saving, hasChanges, applyVO, load, save, reset }
})
