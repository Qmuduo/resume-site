<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchResume } from '@/api/resume'
import { fetchTemplates } from '@/api/template'
import { renderTemplate, sanitizeCss } from '@/template-engine'
import { usePageScale } from '@/composables/usePageScale'
import type { ResumeRecord, ResumeTemplate } from '@/types'

const route = useRoute()
const router = useRouter()

const resumeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const resume = ref<ResumeRecord | null>(null)
const template = ref<ResumeTemplate | null>(null)
const loading = ref(true)
const stageRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
let styleEl: HTMLStyleElement | null = null

const { viewportStyle, scalerStyle } = usePageScale(stageRef, contentRef)

const previewHtml = computed(() => {
  if (!resume.value || !template.value) return ''
  return renderTemplate(template.value, parseData(resume.value.data))
})

onMounted(async () => {
  document.body.classList.add('preview-mode')
  await load()
})

onBeforeUnmount(() => {
  document.body.classList.remove('preview-mode')
  styleEl?.remove()
  styleEl = null
})

async function load() {
  loading.value = true
  try {
    const [res, templates] = await Promise.all([fetchResume(resumeId.value), fetchTemplates()])
    resume.value = res
    template.value = templates.find((tpl) => tpl.code === res.templateCode) ?? null
    document.title = `${res.title} - 简历预览`
    if (template.value) {
      styleEl = document.createElement('style')
      styleEl.textContent = sanitizeCss(template.value.css)
      document.head.appendChild(styleEl)
    }
  } catch {
    ElMessage.error('简历加载失败')
  } finally {
    loading.value = false
  }
}

function parseData(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function saveAsPdf() {
  window.print()
}
</script>

<template>
  <main class="preview-page">
    <div class="print-toolbar">
      <el-button @click="router.push('/resumes')">返回列表</el-button>
      <h1 class="preview-title">{{ resume?.title ?? '简历预览' }}</h1>
      <el-button type="primary" @click="saveAsPdf">保存为 PDF</el-button>
    </div>

    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="!template" class="hint">该简历未关联模板，无法预览</p>
    <div v-else ref="stageRef" class="preview-stage">
      <div class="preview-viewport" :style="viewportStyle">
        <div ref="contentRef" class="preview-scaler" :style="scalerStyle">
          <div class="preview-html" v-html="previewHtml"></div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.preview-page {
  min-height: calc(100vh - 64px);
  padding: 24px;
  background: var(--color-bg-soft);
}

.print-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto 20px;
}

.preview-title {
  margin: 0;
  font-size: 18px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 48px 0;
}
</style>
