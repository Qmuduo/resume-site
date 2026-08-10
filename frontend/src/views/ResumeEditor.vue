<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import CommonForm from '@/components/CommonForm.vue'
import TemplateFieldsForm from '@/components/TemplateFieldsForm.vue'
import TemplateSwitcher from '@/components/TemplateSwitcher.vue'
import { fetchTemplates } from '@/api/template'
import { buildViewModel, renderStaticTemplate, renderTemplate, sanitizeCss } from '@/template-engine'
import { usePageScale } from '@/composables/usePageScale'
import { useResumeStore } from '@/stores/resumeStore'
import type { ResumeTemplate } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useResumeStore()

const templates = ref<ResumeTemplate[]>([])
const loading = ref(false)
const previewRef = ref<HTMLElement | null>(null)
const previewContentRef = ref<HTMLElement | null>(null)
let previewStyleEl: HTMLStyleElement | null = null

const { viewportStyle, scalerStyle } = usePageScale(previewRef, previewContentRef)

const editId = computed(() => (typeof route.params.id === 'string' ? route.params.id : undefined))

const selectedTemplate = computed(
  () => templates.value.find((tpl) => tpl.code === store.currentTemplateId) ?? null
)

const currentTemplateId = computed({
  get: () => store.currentTemplateId ?? '',
  set: () => {
    // 切换经 TemplateSwitcher 的确认流程处理
  }
})

const previewHtml = computed(() => {
  const tpl = selectedTemplate.value
  if (!tpl) return ''
  const manifest = tpl.manifest
  if (manifest?.renderMode === 'static') {
    return renderStaticTemplate(tpl, store.commonData, store.extendedData)
  }
  return renderTemplate(tpl, buildViewModel(store.commonData, store.extendedData, manifest), {
    resumeTitle: store.title
  })
})

const previewCss = computed(() => sanitizeCss(selectedTemplate.value?.css ?? ''))

watchEffect(syncPreviewStyle)

onMounted(() => {
  previewStyleEl = document.createElement('style')
  syncPreviewStyle()
  init()
})

watch(previewRef, async (el) => {
  if (el && previewStyleEl && !previewStyleEl.isConnected) {
    el.appendChild(previewStyleEl)
    await nextTick()
    syncPreviewStyle()
  }
})

onBeforeUnmount(() => {
  previewStyleEl?.remove()
  previewStyleEl = null
})

function syncPreviewStyle() {
  if (previewStyleEl) {
    previewStyleEl.textContent = previewCss.value
  }
}

async function init() {
  loading.value = true
  try {
    templates.value = await fetchTemplates()
    if (editId.value) {
      await store.load(editId.value)
      if (!store.currentTemplateId && templates.value.length > 0) {
        store.currentTemplateId = templates.value[0].code
      }
    } else {
      const fromQuery = typeof route.query.template === 'string' ? route.query.template : ''
      const initial = templates.value.some((tpl) => tpl.code === fromQuery)
        ? fromQuery
        : templates.value[0]?.code ?? ''
      store.reset()
      store.title = ''
      store.currentTemplateId = initial
    }
  } catch {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

async function onSwitchTemplate(newTemplateId: string) {
  try {
    await store.switchTemplate(newTemplateId)
    ElMessage.success('已切换模板，数据已保留')
  } catch (error) {
    ElMessage.error('切换模板失败')
  }
}

async function save() {
  if (!store.title.trim()) {
    ElMessage.warning('请填写简历标题')
    return
  }
  if (!store.currentTemplateId) {
    ElMessage.warning('请先选择模板')
    return
  }
  try {
    await store.save()
    ElMessage.success('已保存')
    await router.replace('/resumes')
  } catch {
    ElMessage.error('保存失败')
  }
}
</script>

<template>
  <main class="editor">
    <p v-if="loading" class="editor-loading">加载中…</p>
    <template v-else>
      <header class="editor-header">
        <h1>{{ editId ? '编辑简历' : '新建简历' }}</h1>
        <TemplateSwitcher
          v-model="currentTemplateId"
          :templates="templates"
          :loading="store.switching"
          @switch="onSwitchTemplate"
        />
        <el-input v-model="store.title" class="title-input" placeholder="简历标题" />
        <el-button type="primary" :loading="store.saving" @click="save">保存</el-button>
        <el-button @click="router.push('/resumes')">返回列表</el-button>
      </header>
      <div v-if="selectedTemplate" class="editor-body">
        <section class="editor-form">
          <CommonForm :model="store.commonData" />
          <TemplateFieldsForm
            :manifest="selectedTemplate.manifest ?? null"
            :model="store.extendedData"
          />
        </section>
        <section ref="previewRef" class="editor-preview">
          <div class="preview-viewport" :style="viewportStyle">
            <div ref="previewContentRef" class="preview-scaler" :style="scalerStyle">
              <div class="preview-html" v-html="previewHtml"></div>
            </div>
          </div>
        </section>
      </div>
      <p v-else>暂无可选模板</p>
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
  flex-wrap: wrap;
}

.title-input {
  width: 240px;
}

.editor-body {
  display: grid;
  grid-template-columns: 440px 1fr;
  gap: 16px;
  align-items: start;
}

.editor-form {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  max-height: calc(100vh - 140px);
  overflow: auto;
}

.editor-preview {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  min-height: 600px;
  padding: 24px;
}
</style>
