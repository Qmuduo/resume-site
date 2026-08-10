<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { AxiosError } from 'axios'
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
/** 加载出错时的错误信息，非空表示请求层面失败（区别于"无模板"场景） */
const loadError = ref('')
const stageRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
let styleEl: HTMLStyleElement | null = null

const { viewportStyle, scalerStyle } = usePageScale(stageRef, contentRef)

const previewHtml = computed(() => {
  if (!resume.value || !template.value) return ''
  return renderTemplate(template.value, parseData(resume.value.data), {
    resumeTitle: resume.value.title
  })
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
  loadError.value = ''
  try {
    // 分开请求，方便定位是简历接口还是模板接口失败
    let res: ResumeRecord
    try {
      res = await fetchResume(resumeId.value)
    } catch (e) {
      const status = (e as AxiosError)?.response?.status
      if (status === 403 || status === 404) {
        loadError.value = '简历不存在或无权访问'
      } else if (status === 401) {
        // 401 由 http 拦截器处理刷新/跳登录，这里只提示
        loadError.value = '登录已过期，请重新登录'
      } else {
        loadError.value = '简历数据加载失败，请稍后重试'
      }
      return
    }

    // 模板接口失败时用空数组兜底，不阻断预览
    let templates: ResumeTemplate[] = []
    try {
      templates = await fetchTemplates()
    } catch {
      ElMessage.warning('模板列表加载失败，预览可能不完整')
    }

    resume.value = res

    // 优先按 templateCode 精确匹配；找不到时回退到第一个可用模板
    const matched = res.templateCode
      ? (templates.find((tpl) => tpl.code === res.templateCode) ?? null)
      : null
    template.value = matched ?? templates[0] ?? null

    if (!matched && template.value) {
      ElMessage.warning(`该简历未保存模板信息，已自动使用「${template.value.name}」预览，如需修正请点击编辑`)
    }

    document.title = `${res.title} - 简历预览`
    if (template.value) {
      styleEl = document.createElement('style')
      styleEl.textContent = sanitizeCss(template.value.css)
      document.head.appendChild(styleEl)
    }
  } finally {
    loading.value = false
  }
}

/**
 * 将简历 data 字段转为对象。
 * 兼容两种情况：
 *   1. 后端返回字符串（正常情况）→ JSON.parse
 *   2. 后端直接返回反序列化后的 Object（Jackson 把 MySQL JSON 列解成 Map）→ 直接用
 */
function parseData(raw: unknown): Record<string, unknown> {
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
    <div v-else-if="loadError" class="hint-empty">
      <p class="hint">{{ loadError }}</p>
      <el-button size="small" @click="router.push('/resumes')">返回列表</el-button>
    </div>
    <div v-else-if="!template" class="hint-empty">
      <p class="hint">该简历未关联任何模板，暂时无法预览</p>
      <el-button type="primary" size="small" @click="router.push(`/editor/${resumeId}`)">
        去编辑并关联模板
      </el-button>
    </div>
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
  padding: 48px 0 12px;
}

.hint-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
}
</style>
