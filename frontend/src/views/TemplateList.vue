<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { fetchTemplates } from '@/api/template'
import { renderStaticTemplate, renderTemplate, sanitizeCss } from '@/template-engine'
import { useUserStore } from '@/stores/userStore'
import { emptyCommonData } from '@/stores/resumeStore'
import type { ResumeTemplate, SchemaNode } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const templates = ref<ResumeTemplate[]>([])
const loading = ref(false)
const keyword = ref('')
const category = ref('')

const previewVisible = ref(false)
const previewTpl = ref<ResumeTemplate | null>(null)
const previewRef = ref<HTMLElement | null>(null)
let previewStyleEl: HTMLStyleElement | null = null

const categories = [
  { label: '全部', value: '' },
  { label: '现代', value: 'modern' },
  { label: '经典', value: 'classic' },
  { label: '极简', value: 'minimal' }
]

const KEY_SAMPLES: Record<string, string> = {
  name: '张三',
  email: 'zhangsan@example.com',
  phone: '138-0000-0000',
  summary: '热爱技术的前端工程师，3 年 Vue 与全栈开发经验。',
  company: '示例科技',
  title: '前端工程师',
  start: '2023-01',
  end: '至今',
  school: '示例大学',
  degree: '本科',
  year: '2022'
}

const TYPE_SAMPLES: Record<string, string> = {
  string: '示例内容',
  number: '0',
  boolean: 'true'
}

const COVER_GRADIENTS: Record<string, string> = {
  modern: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
  classic: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
  minimal: 'linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 100%)'
}

onMounted(async () => {
  keyword.value = typeof route.query.search === 'string' ? route.query.search : ''
  category.value = typeof route.query.category === 'string' ? route.query.category : ''
  await loadTemplates()
})

async function loadTemplates() {
  loading.value = true
  try {
    templates.value = await fetchTemplates()
  } catch {
    ElMessage.error('模板列表加载失败')
  } finally {
    loading.value = false
  }
}

const filteredTemplates = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return templates.value.filter((tpl) => {
    if (category.value && tpl.code !== category.value) return false
    if (!kw) return true
    return [tpl.name, tpl.code, tpl.description].some((text) =>
      text.toLowerCase().includes(kw)
    )
  })
})

function syncFiltersToUrl() {
  const query: Record<string, string> = {}
  if (keyword.value.trim()) query.search = keyword.value.trim()
  if (category.value) query.category = category.value
  router.replace({ path: '/templates', query })
}

function pickCategory(value: string) {
  category.value = value
  syncFiltersToUrl()
}

function useTemplate(tpl: ResumeTemplate) {
  if (userStore.isLoggedIn) {
    router.push({ path: '/editor', query: { template: tpl.code } })
  } else {
    ElMessage.info('请先登录后使用模板')
    router.push({ path: '/login', query: { redirect: `/editor?template=${tpl.code}` } })
  }
}

function coverStyle(tpl: ResumeTemplate) {
  return { background: COVER_GRADIENTS[tpl.code] ?? COVER_GRADIENTS.modern }
}

function openPreview(tpl: ResumeTemplate) {
  previewTpl.value = tpl
  previewVisible.value = true
}

function onPreviewOpened() {
  const tpl = previewTpl.value
  if (!tpl || !previewRef.value) return
  previewStyleEl = document.createElement('style')
  previewRef.value.appendChild(previewStyleEl)
  syncPreviewStyle()
}

function syncPreviewStyle() {
  if (previewTpl.value && previewStyleEl) {
    previewStyleEl.textContent = sanitizeCss(previewTpl.value.css)
  }
}

function onPreviewClosed() {
  previewStyleEl?.remove()
  previewStyleEl = null
}

const previewHtml = computed(() =>
  previewTpl.value
    ? previewTpl.value.manifest?.renderMode === 'static'
      ? renderStaticTemplate(previewTpl.value, emptyCommonData(), {})
      : renderTemplate(previewTpl.value, buildSampleData(previewTpl.value.schema ?? {}))
    : ''
)

function buildSampleData(schema: SchemaNode): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    result[key] = buildSample(sub, key)
  }
  return result
}

function buildSample(schema: SchemaNode, key?: string): unknown {
  if (schema.type === 'array') {
    const item = schema.items
    if (item?.type === 'object') return [buildSample(item)]
    return ['示例 1', '示例 2']
  }
  if (schema.type === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      result[k] = buildSample(sub, k)
    }
    return result
  }
  if (key && KEY_SAMPLES[key]) return KEY_SAMPLES[key]
  return TYPE_SAMPLES[schema.type ?? 'string'] ?? ''
}
</script>

<template>
  <main class="page-container">
    <header class="page-header market-header">
      <div>
        <h1 class="page-title">模板市场</h1>
        <p class="page-subtitle">公开模板浏览，选择喜欢的模板创建你的简历</p>
      </div>
      <div class="market-filters">
        <el-input
          v-model="keyword"
          class="filter-search"
          placeholder="搜索模板…"
          clearable
          @keyup.enter="syncFiltersToUrl"
          @clear="syncFiltersToUrl"
        />
        <div class="chips">
          <button
            v-for="c in categories"
            :key="c.value"
            type="button"
            :class="['chip', { 'chip-active': category === c.value }]"
            @click="pickCategory(c.value)"
          >
            {{ c.label }}
          </button>
        </div>
      </div>
    </header>

    <div v-loading="loading" class="market-grid">
      <p v-if="!loading && filteredTemplates.length === 0" class="empty">没有匹配的模板</p>
      <article
        v-for="tpl in filteredTemplates"
        :key="tpl.code"
        class="market-card hover-lift"
        @click="useTemplate(tpl)"
      >
        <div class="market-cover" :style="coverStyle(tpl)">
          <span class="market-cover-name">{{ tpl.name }}</span>
        </div>
        <div class="market-body">
          <div class="market-title-row">
            <h3 class="market-title">{{ tpl.name }}</h3>
            <span class="market-tag">{{ tpl.code }}</span>
          </div>
          <p class="market-desc">{{ tpl.description }}</p>
        </div>
        <button class="preview-btn" type="button" @click.stop="openPreview(tpl)">预览</button>
      </article>
    </div>

    <el-dialog
      v-model="previewVisible"
      :title="previewTpl?.name ?? '模板预览'"
      width="720px"
      @open="onPreviewOpened"
      @closed="onPreviewClosed"
    >
      <div ref="previewRef" class="preview-pane">
        <div class="preview-html" v-html="previewHtml"></div>
      </div>
    </el-dialog>
  </main>
</template>

<style scoped>
.market-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.market-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-search {
  width: 220px;
}

.chips {
  display: flex;
  gap: 8px;
}

.chip {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-radius: var(--radius-full);
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
}

.chip:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.chip-active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.market-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  min-height: 120px;
}

.empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--color-text-secondary);
  padding: 48px 0;
}

.market-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
}

.market-cover {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.market-cover-name {
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

.market-body {
  padding: 16px;
}

.market-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.market-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
}

.market-tag {
  font-size: 12px;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  padding: 2px 10px;
  border-radius: var(--radius-full);
}

.market-desc {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-accent);
  border-radius: var(--radius-full);
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  opacity: 0;
  box-shadow: var(--shadow-card);
}

.market-card:hover .preview-btn {
  opacity: 1;
}

.preview-pane {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: #fff;
  padding: 24px;
  min-height: 320px;
  max-height: 60vh;
  overflow: auto;
}
</style>
