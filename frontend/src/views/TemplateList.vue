<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { fetchTemplates } from '@/api/template'
import { renderStaticTemplate, renderTemplate, sanitizeCss } from '@/template-engine'
import { useUserStore } from '@/stores/userStore'
import type { ResumeTemplate, SchemaNode, TemplateManifestV2 } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const templates = ref<ResumeTemplate[]>([])
const loading = ref(false)
const keyword = ref('')
const category = ref('')
const selectedTags = ref<string[]>([])

const previewVisible = ref(false)
const previewTpl = ref<ResumeTemplate | null>(null)
const previewRef = ref<HTMLElement | null>(null)
let previewStyleEl: HTMLStyleElement | null = null

const NEUTRAL_COLORS = new Set([
  '#ffffff', '#fff', '#000000', '#000', '#f7f8fa', '#f5f7fa', '#fafafa', '#f8f9fa',
  '#eef2f5', '#eef2f6', '#f2f4f6', '#e5e7eb', '#f5f5f5', '#f9fafb', '#f3f4f6',
  '#e2e8f0', '#f1f5f9', '#f8fafc', '#f6f7f9'
])

const CATEGORY_PALETTES: Record<string, [string, string]> = {
  金融: ['#1e3a5f', '#c9a227'],
  咨询: ['#1a3c34', '#b8864a'],
  互联网技术: ['#0f172a', '#334155'],
  设计创意: ['#7c3aed', '#f59e0b'],
  学术科研: ['#0e7490', '#164e63'],
  市场营销: ['#be123c', '#f97316'],
  销售服务: ['#b45309', '#fcd34d'],
  政府行政: ['#334155', '#64748b'],
  法律合规: ['#1e293b', '#94a3b8'],
  通用商务: ['#4f46e5', '#818cf8']
}

const KEY_SAMPLES: Record<string, string> = {
  name: '李白',
  email: 'libai@example.com',
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

onMounted(async () => {
  keyword.value = typeof route.query.search === 'string' ? route.query.search : ''
  category.value = typeof route.query.category === 'string' ? route.query.category : ''
  const tagsQuery = route.query.tags
  if (typeof tagsQuery === 'string' && tagsQuery) {
    selectedTags.value = tagsQuery.split(',').filter(Boolean)
  }
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

const categories = computed(() => {
  const counts = new Map<string, number>()
  for (const tpl of templates.value) {
    const cat = tpl.category?.trim()
    if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
})

const allTags = computed(() => {
  const counts = new Map<string, number>()
  for (const tpl of templates.value) {
    for (const tag of tpl.tags ?? []) {
      const t = tag.trim()
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
})

const filteredTemplates = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const activeTags = selectedTags.value.filter(Boolean)
  return templates.value.filter((tpl) => {
    if (category.value && tpl.category !== category.value) return false
    if (activeTags.length > 0) {
      const tplTags = tpl.tags ?? []
      if (!activeTags.some((tag) => tplTags.includes(tag))) return false
    }
    if (!kw) return true
    return [tpl.name, tpl.code, tpl.description, tpl.category, ...(tpl.tags ?? [])].some((text) =>
      (text ?? '').toLowerCase().includes(kw)
    )
  })
})

function syncFiltersToUrl() {
  const query: Record<string, string> = {}
  if (keyword.value.trim()) query.search = keyword.value.trim()
  if (category.value) query.category = category.value
  if (selectedTags.value.length) query.tags = selectedTags.value.join(',')
  router.replace({ path: '/templates', query })
}

function pickCategory(value: string) {
  category.value = value
  syncFiltersToUrl()
}

function toggleTag(tag: string) {
  const index = selectedTags.value.indexOf(tag)
  if (index >= 0) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
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

/** 从模板 CSS 中提取 2-3 个非中性主色，用于卡片封面 */
function templateColors(css: string): string[] {
  const re = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
  const colors: string[] = []
  for (const match of css.matchAll(re)) {
    const color = match[0]
    if (NEUTRAL_COLORS.has(color.toLowerCase())) continue
    if (!colors.includes(color)) colors.push(color)
    if (colors.length >= 3) break
  }
  return colors
}

function coverStyle(tpl: ResumeTemplate) {
  const primary = primaryColor(tpl)
  const colors = templateColors(tpl.css ?? '').filter((c) => c.toLowerCase() !== primary.toLowerCase())
  const palette = CATEGORY_PALETTES[tpl.category ?? ''] ?? CATEGORY_PALETTES['通用商务']
  const c0 = primary
  const c1 = colors[0] ?? palette[1]
  return { background: `linear-gradient(135deg, ${c0} 0%, ${c1} 100%)` }
}

/** 主色优先取 manifest v2 theme 里 --color-primary 的默认值 */
function primaryColor(tpl: ResumeTemplate): string {
  const manifest = tpl.manifest
  if (manifest && 'theme' in manifest && Array.isArray(manifest.theme)) {
    const primary = (manifest as TemplateManifestV2).theme.find((t) => t.key === '--color-primary')
    if (primary?.default) return primary.default
  }
  return '#4F46E5'
}

function layoutVibe(tpl: ResumeTemplate): 'split' | 'terminal' | 'single' {
  const css = (tpl.css ?? '').toLowerCase()
  if (/grid-template-columns\s*:\s*[^;]*\b2\b|\bfloat\s*:\s*left\b|sidebar|aside/.test(css)) {
    return 'split'
  }
  if (/monospace|consolas|menlo|jetbrains|courier/.test(css)) {
    return 'terminal'
  }
  return 'single'
}

function fontVibe(tpl: ResumeTemplate): 'mono' | 'serif' | 'sans' {
  const css = (tpl.css ?? '').toLowerCase()
  if (/monospace|consolas|menlo|jetbrains|courier/.test(css)) return 'mono'
  if (/georgia|times new roman|serif|宋体|songti|楷体/.test(css)) return 'serif'
  return 'sans'
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

function sampleDataFor(tpl: ResumeTemplate): Record<string, unknown> {
  const sample = tpl.manifest?.sampleData
  if (sample && Object.keys(sample).length > 0) {
    return sample as Record<string, unknown>
  }
  return buildSampleData(tpl.schema ?? {})
}

const previewHtml = computed(() =>
  previewTpl.value
    ? previewTpl.value.manifest?.renderMode === 'static'
      ? renderStaticTemplate(previewTpl.value)
      : renderTemplate(previewTpl.value, sampleDataFor(previewTpl.value))
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
        <p class="page-subtitle">按行业与风格筛选模板，选择喜欢的模板创建你的简历</p>
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
      </div>
    </header>

    <div class="filter-panels">
      <div class="filter-row">
        <span class="filter-label">分类</span>
        <button
          type="button"
          :class="['chip', { 'chip-active': category === '' }]"
          @click="pickCategory('')"
        >
          全部
        </button>
        <button
          v-for="[cat, count] in categories"
          :key="cat"
          type="button"
          :class="['chip', { 'chip-active': category === cat }]"
          @click="pickCategory(cat)"
        >
          {{ cat }}<span class="chip-count">{{ count }}</span>
        </button>
      </div>
      <div v-if="allTags.length" class="filter-row tag-row">
        <span class="filter-label">标签</span>
        <button
          v-for="[tag, count] in allTags"
          :key="tag"
          type="button"
          :class="['chip', 'chip-tag', { 'chip-active': selectedTags.includes(tag) }]"
          @click="toggleTag(tag)"
        >
          {{ tag }}<span class="chip-count">{{ count }}</span>
        </button>
        <button
          v-if="selectedTags.length"
          type="button"
          class="chip chip-clear"
          @click="selectedTags = []; syncFiltersToUrl()"
        >
          清空标签
        </button>
      </div>
    </div>

    <div v-loading="loading" class="market-grid">
      <p v-if="!loading && filteredTemplates.length === 0" class="empty">没有匹配的模板</p>
      <article
        v-for="tpl in filteredTemplates"
        :key="tpl.code"
        class="market-card hover-lift"
        @click="useTemplate(tpl)"
      >
        <div
          class="market-cover"
          :class="[`vibe-${layoutVibe(tpl)}`, `font-${fontVibe(tpl)}`]"
          :style="coverStyle(tpl)"
        >
          <div class="cover-shade"></div>
          <span class="market-cover-name">{{ tpl.name }}</span>
          <span v-if="tpl.category" class="cover-category">{{ tpl.category }}</span>
        </div>
        <div class="market-body">
          <div class="market-title-row">
            <h3 class="market-title">{{ tpl.name }}</h3>
            <span class="market-tag">{{ tpl.code }}</span>
          </div>
          <div v-if="tpl.tags?.length" class="market-tags">
            <span v-for="tag in tpl.tags.slice(0, 4)" :key="tag" class="card-tag">{{ tag }}</span>
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
  width: 240px;
}

.filter-panels {
  margin: 4px 0 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-right: 4px;
  flex-shrink: 0;
}

.chip {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-radius: var(--radius-full);
  padding: 5px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease-out;
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

.chip-count {
  margin-left: 4px;
  font-size: 11px;
  opacity: 0.75;
}

.chip-clear {
  color: var(--color-accent);
  border-style: dashed;
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
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.market-cover-name {
  position: relative;
  z-index: 2;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  padding: 0 16px;
  text-align: center;
}

.cover-category {
  position: relative;
  z-index: 2;
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.35);
  padding: 2px 12px;
  border-radius: var(--radius-full);
  backdrop-filter: blur(2px);
}

/* 双栏版式：右侧半透明栏 */
.vibe-split .cover-shade {
  position: absolute;
  inset: 0 auto 0 0;
  width: 34%;
  background: rgba(255, 255, 255, 0.16);
  border-right: 1px solid rgba(255, 255, 255, 0.3);
}

/* 终端/等宽风格：底部提示符条 */
.vibe-terminal .cover-shade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 22%;
  background: rgba(0, 0, 0, 0.35);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
}

.font-mono .market-cover-name {
  font-family: 'Consolas', 'Menlo', monospace;
  letter-spacing: 0.02em;
}

.font-serif .market-cover-name {
  font-family: 'Georgia', 'Times New Roman', 'Songti SC', serif;
  font-weight: 600;
}

.market-body {
  padding: 16px;
}

.market-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
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

.market-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.card-tag {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  padding: 2px 8px;
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
