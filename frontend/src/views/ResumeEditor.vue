<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import SchemaForm from '@/components/SchemaForm.vue'
import { fetchTemplates } from '@/api/template'
import { createResume, fetchResume, updateResume } from '@/api/resume'
import { renderTemplate, sanitizeCss } from '@/template-engine'
import type { ResumeTemplate, SchemaNode } from '@/types'

const route = useRoute()
const router = useRouter()

const templates = ref<ResumeTemplate[]>([])
const selectedCode = ref('')
const title = ref('')
const form = ref<Record<string, unknown>>({})
const loading = ref(false)
const saving = ref(false)
const previewRef = ref<HTMLElement | null>(null)
let previewStyleEl: HTMLStyleElement | null = null

const editId = computed(() => (typeof route.params.id === 'string' ? route.params.id : undefined))

const selectedTemplate = computed(
  () => templates.value.find((tpl) => tpl.code === selectedCode.value) ?? null
)

const previewHtml = computed(() =>
  selectedTemplate.value ? renderTemplate(selectedTemplate.value, form.value) : ''
)

const previewCss = computed(() => sanitizeCss(selectedTemplate.value?.css ?? ''))

watchEffect(syncPreviewStyle)

onMounted(() => {
  previewStyleEl = document.createElement('style')
  if (previewRef.value) {
    previewRef.value.appendChild(previewStyleEl)
  }
  syncPreviewStyle()
})

onBeforeUnmount(() => {
  previewStyleEl?.remove()
  previewStyleEl = null
})

onMounted(init)

function syncPreviewStyle() {
  if (previewStyleEl) {
    previewStyleEl.textContent = previewCss.value
  }
}

async function init() {
  loading.value = true
  try {
    templates.value = await fetchTemplates()
    if (templates.value.length > 0 && !selectedCode.value) {
      selectedCode.value = templates.value[0].code
    }
    if (editId.value) {
      const resume = await fetchResume(editId.value)
      title.value = resume.title
      if (resume.templateCode) {
        selectedCode.value = resume.templateCode
      }
      form.value = mergeDefaults(selectedTemplate.value?.schema ?? {}, parseData(resume.data))
    } else {
      const fromQuery = typeof route.query.template === 'string' ? route.query.template : ''
      if (fromQuery && templates.value.some((tpl) => tpl.code === fromQuery)) {
        selectedCode.value = fromQuery
      }
      form.value = mergeDefaults(selectedTemplate.value?.schema ?? {}, {})
    }
  } catch {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

function onTemplateChange() {
  const tpl = selectedTemplate.value
  if (tpl) {
    form.value = mergeDefaults(tpl.schema, form.value)
  }
}

async function save() {
  if (!title.value.trim()) {
    ElMessage.warning('请填写简历标题')
    return
  }
  if (!selectedCode.value) {
    ElMessage.warning('请先选择模板')
    return
  }
  saving.value = true
  try {
    const payload = {
      title: title.value.trim(),
      templateCode: selectedCode.value,
      data: JSON.stringify(form.value)
    }
    if (editId.value) {
      await updateResume(editId.value, payload)
      ElMessage.success('已保存')
    } else {
      await createResume(payload)
      ElMessage.success('已保存')
    }
    await router.replace('/resumes')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
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

function mergeDefaults(schema: SchemaNode, base: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    const current = base[key]
    if (sub.type === 'object') {
      const nested =
        current !== null && typeof current === 'object' && !Array.isArray(current)
          ? (current as Record<string, unknown>)
          : {}
      result[key] = mergeDefaults(sub, nested)
    } else if (sub.type === 'array') {
      result[key] = Array.isArray(current) ? current : []
    } else {
      result[key] = typeof current === 'string' ? current : ''
    }
  }
  return result
}
</script>

<template>
  <main class="editor">
    <p v-if="loading" class="editor-loading">加载中…</p>
    <template v-else>
      <header class="editor-header">
        <h1>{{ editId ? '编辑简历' : '新建简历' }}</h1>
        <el-select
          v-model="selectedCode"
          class="template-select"
          placeholder="选择模板"
          @change="onTemplateChange"
        >
          <el-option v-for="tpl in templates" :key="tpl.code" :label="tpl.name" :value="tpl.code" />
        </el-select>
        <el-input v-model="title" class="title-input" placeholder="简历标题" />
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        <el-button @click="router.push('/resumes')">返回列表</el-button>
      </header>
      <div v-if="selectedTemplate" class="editor-body">
        <section class="editor-form">
          <SchemaForm :schema="selectedTemplate.schema" :model="form" />
        </section>
        <section ref="previewRef" class="editor-preview">
          <div class="preview-html" v-html="previewHtml"></div>
        </section>
      </div>
      <p v-else>暂无可用模板</p>
    </template>
  </main>
</template>

<style scoped>
.editor {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.editor-loading {
  padding: 24px;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.template-select {
  width: 180px;
}

.title-input {
  width: 240px;
}

.editor-body {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 16px;
  align-items: start;
}

.editor-form {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
}

.editor-preview {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  min-height: 600px;
  padding: 24px;
  background: #fff;
}
</style>
