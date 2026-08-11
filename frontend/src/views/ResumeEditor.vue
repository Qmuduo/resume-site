<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'

import BuilderDesignPane from '@/components/builder/BuilderDesignPane.vue'
import BuilderFormPane from '@/components/builder/BuilderFormPane.vue'
import BuilderPreviewPane from '@/components/builder/BuilderPreviewPane.vue'
import BuilderSectionSidebar from '@/components/builder/BuilderSectionSidebar.vue'
import { fetchTemplates } from '@/api/template'
import { useResumeDraft } from '@/composables/useResumeDraft'
import { useResumeStore } from '@/stores/resumeStore'
import type { ResumeTemplate } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useResumeStore()
const { data } = storeToRefs(store)

const templates = ref<ResumeTemplate[]>([])
const loading = ref(false)
const selectedSection = ref('basics')
const designVisible = ref(false)
const draft = useResumeDraft(data)

const editId = computed(() => (typeof route.params.id === 'string' ? route.params.id : undefined))

const selectedTemplate = computed(
  () => templates.value.find((tpl) => tpl.code === store.data.metadata.template) ?? null
)

function undo() {
  draft.undo()
}

function redo() {
  draft.redo()
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
    draft.snapshot()
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

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const key = e.key.toLowerCase()
  if (key === 's') {
    e.preventDefault()
    void save()
  } else if (key === 'z' && e.shiftKey) {
    e.preventDefault()
    redo()
  } else if (key === 'z') {
    e.preventDefault()
    undo()
  } else if (key === 'p') {
    e.preventDefault()
    window.print()
  }
}

window.addEventListener('keydown', onKeydown)
</script>

<template>
  <main class="editor">
    <p
      v-if="loading"
      class="editor-loading"
    >
      加载中…
    </p>
    <template v-else>
      <header class="editor-header">
        <h1>{{ editId ? '编辑简历' : '新建简历' }}</h1>
        <el-select
          v-model="store.data.metadata.template"
          class="template-select"
          placeholder="选择模板"
        >
          <el-option
            v-for="tpl in templates"
            :key="tpl.code"
            :label="tpl.name"
            :value="tpl.code"
          />
        </el-select>
        <el-input
          v-model="store.title"
          class="title-input"
          placeholder="简历标题"
        />
        <el-button @click="designVisible = true">
          设计
        </el-button>
        <el-button
          :disabled="!draft.canUndo.value"
          @click="undo"
        >
          撤销
        </el-button>
        <el-button
          :disabled="!draft.canRedo.value"
          @click="redo"
        >
          重做
        </el-button>
        <el-button
          type="primary"
          :loading="store.saving"
          @click="save"
        >
          保存
        </el-button>
        <el-button @click="router.push('/resumes')">
          返回列表
        </el-button>
      </header>
      <div
        v-if="selectedTemplate"
        class="editor-body"
      >
        <BuilderSectionSidebar
          v-model:selected="selectedSection"
          :data="store.data"
          @change="draft.snapshot()"
        />
        <BuilderFormPane
          :section="selectedSection"
          :data="store.data"
          @change="draft.snapshot()"
        />
        <div class="builder-preview">
          <BuilderPreviewPane
            :template="selectedTemplate"
            :data="store.data"
          />
        </div>
      </div>
      <p
        v-else
        class="hint"
      >
        暂无可选模板
      </p>
    </template>

    <el-drawer
      v-model="designVisible"
      title="设计设置"
      size="380px"
    >
      <BuilderDesignPane
        :template="selectedTemplate"
        :templates="templates"
        :data="store.data"
        @change="draft.snapshot()"
      />
    </el-drawer>
  </main>
</template>

<style scoped>
.editor {
  max-width: 1680px;
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

.template-select {
  width: 200px;
}

.title-input {
  width: 220px;
}

.editor-body {
  display: grid;
  grid-template-columns: 280px minmax(360px, 1fr) 480px;
  gap: 16px;
  align-items: start;
}

.builder-preview {
  min-width: 0;
}

.hint {
  color: var(--color-text-secondary);
  text-align: center;
  padding: 48px 0;
}
</style>
