<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { AxiosError } from 'axios'

import { fetchResume } from '@/api/resume'
import { fetchTemplates } from '@/api/template'
import { emptyResumeData, parseData } from '@/stores/resumeStore'
import { renderTemplate } from '@/template-engine'
import type { ResumeData, ResumeTemplate, ResumeVO } from '@/types'

const route = useRoute()
const router = useRouter()

const resumeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const resume = ref<ResumeVO | null>(null)
const template = ref<ResumeTemplate | null>(null)
const missingTemplateId = ref('')
const data = ref<ResumeData>(emptyResumeData())
const loading = ref(true)
const loadError = ref('')

const previewHtml = computed(() => {
  if (!template.value) return ''
  return renderTemplate(template.value, data.value)
})

onMounted(load)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    let res: ResumeVO
    try {
      res = await fetchResume(resumeId.value)
    } catch (e) {
      const status = (e as AxiosError)?.response?.status
      if (status === 403 || status === 404) {
        loadError.value = '简历不存在或无权限访问'
      } else if (status === 401) {
        loadError.value = '登录已过期，请重新登录'
      } else {
        loadError.value = '简历数据加载失败，请稍后重试'
      }
      return
    }

    let templates: ResumeTemplate[] = []
    try {
      templates = await fetchTemplates()
    } catch {
      ElMessage.warning('模板列表加载失败，预览可能不完整')
    }

    resume.value = res
    data.value = parseData(res.data)

    const templateId = data.value.metadata.template
    const matched = templateId ? (templates.find((tpl) => tpl.code === templateId) ?? null) : null
    missingTemplateId.value = templateId && !matched ? templateId : ''
    template.value = matched ?? (templateId ? null : (templates[0] ?? null))

    if (missingTemplateId.value) {
      ElMessage.warning(`该简历使用的模板「${missingTemplateId.value}」已下架或不存在，请重新选择模板（数据已保留）`)
    } else if (!matched && template.value) {
      ElMessage.warning(`该简历未保存模板信息，已自动使用「${template.value.name}」预览`)
    }
  } finally {
    loading.value = false
  }
}

function saveAsPdf() {
  window.print()
}
</script>

<template>
  <main class="preview-page">
    <div class="print-toolbar">
      <el-button @click="router.push('/resumes')">
        返回列表
      </el-button>
      <h1 class="preview-title">
        {{ resume?.title ?? '简历预览' }}
      </h1>
      <el-button
        type="primary"
        @click="saveAsPdf"
      >
        保存为 PDF
      </el-button>
    </div>

    <p
      v-if="loading"
      class="hint"
    >
      加载中…
    </p>
    <div
      v-else-if="loadError"
      class="hint-empty"
    >
      <p class="hint">
        {{ loadError }}
      </p>
      <el-button
        size="small"
        @click="router.push('/resumes')"
      >
        返回列表
      </el-button>
    </div>
    <div
      v-else-if="missingTemplateId"
      class="hint-empty"
    >
      <p class="hint">
        该简历使用的模板「{{ missingTemplateId }}」已下架或不存在，请重新选择模板。数据已完整保留。
      </p>
      <el-button
        type="primary"
        size="small"
        @click="router.push(`/editor/${resumeId}`)"
      >
        重新选择模板
      </el-button>
    </div>
    <div
      v-else-if="!template"
      class="hint-empty"
    >
      <p class="hint">
        该简历未关联任何模板，暂时无法预览
      </p>
      <el-button
        type="primary"
        size="small"
        @click="router.push(`/editor/${resumeId}`)"
      >
        去编辑并关联模板
      </el-button>
    </div>
    <div
      v-else
      class="preview-stage"
    >
      <div
        class="preview-html"
        v-html="previewHtml"
      />
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

.preview-stage {
  max-width: 900px;
  margin: 0 auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  min-height: 600px;
}

.json-preview {
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

@media print {
  .print-toolbar {
    display: none;
  }

  .preview-page {
    padding: 0;
    background: #fff;
  }

  .preview-stage {
    border: none;
    box-shadow: none;
    padding: 0;
    max-width: none;
  }
}
</style>
