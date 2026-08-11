<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import TemplateSwitcher from '@/components/TemplateSwitcher.vue'
import { fetchTemplates } from '@/api/template'
import { useResumeStore } from '@/stores/resumeStore'
import { renderTemplate } from '@/template-engine'
import type { ResumeTemplate } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useResumeStore()

const templates = ref<ResumeTemplate[]>([])
const loading = ref(false)

const editId = computed(() => (typeof route.params.id === 'string' ? route.params.id : undefined))

const selectedTemplate = computed(
  () => templates.value.find((tpl) => tpl.code === store.data.metadata.template) ?? null
)

const previewHtml = computed(() => {
  const tpl = selectedTemplate.value
  if (!tpl) return ''
  return renderTemplate(tpl, store.data, { resumeTitle: store.title })
})

function onSwitchTemplate(newTemplateId: string) {
  store.data.metadata.template = newTemplateId
}

async function save() {
  if (!store.title.trim()) {
    ElMessage.warning('请填写简历标题')
    return
  }
  if (!store.data.metadata.template) {
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

onMounted(async () => {
  loading.value = true
  try {
    templates.value = await fetchTemplates()
    if (editId.value) {
      await store.load(editId.value)
      if (!store.data.metadata.template && templates.value.length > 0) {
        store.data.metadata.template = templates.value[0].code
      }
    } else {
      store.reset()
      store.data.metadata.template = templates.value[0]?.code ?? ''
    }
  } catch {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="editor">
    <p v-if="loading" class="editor-loading">加载中…</p>
    <template v-else>
      <header class="editor-header">
        <h1>{{ editId ? '编辑简历' : '新建简历' }}</h1>
        <TemplateSwitcher
          v-model="store.data.metadata.template"
          :templates="templates"
          @switch="onSwitchTemplate"
        />
        <el-input v-model="store.title" class="title-input" placeholder="简历标题" />
        <el-button type="primary" :loading="store.saving" @click="save">保存</el-button>
        <el-button @click="router.push('/resumes')">返回列表</el-button>
      </header>
      <div class="editor-body">
        <section class="editor-preview">
          <p v-if="!selectedTemplate" class="hint">暂无可选模板</p>
          <div v-else class="preview-html" v-html="previewHtml"></div>
        </section>
      </div>
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
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}

.editor-preview {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  min-height: 600px;
  padding: 24px;
}

.hint {
  color: var(--color-text-secondary);
  text-align: center;
  padding: 48px 0;
}

.json-preview {
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
