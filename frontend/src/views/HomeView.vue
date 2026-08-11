<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/userStore'

const router = useRouter()
const userStore = useUserStore()

const keyword = ref('')
const activeCategory = ref('')

const chips = [
  { label: '全部', value: '' },
  { label: '金融', value: '金融' },
  { label: '互联网技术', value: '互联网技术' },
  { label: '设计创意', value: '设计创意' },
  { label: '咨询', value: '咨询' },
  { label: '通用商务', value: '通用商务' }
]

function goMarket() {
  const query: Record<string, string> = {}
  if (keyword.value.trim()) query.search = keyword.value.trim()
  if (activeCategory.value) query.category = activeCategory.value
  if (Object.keys(query).length === 0) {
    ElMessage.info('请选择分类或输入关键词')
    return
  }
  router.push({ path: '/templates', query })
}

function pickCategory(value: string) {
  activeCategory.value = value
  const query: Record<string, string> = {}
  if (keyword.value.trim()) query.search = keyword.value.trim()
  if (value) query.category = value
  router.push({ path: '/templates', query })
}
</script>

<template>
  <main class="hero">
    <div class="hero-inner">
      <h1 class="hero-title">
        用模板快速生成专业简历
      </h1>
      <p class="hero-subtitle">
        挑选心仪模板，在线编辑并保存你的简历；登录后随时回来管理。
      </p>

      <div class="hero-search">
        <el-input
          v-model="keyword"
          size="large"
          placeholder="搜索模板，如：现代、经典…"
          clearable
          @keyup.enter="goMarket"
        />
        <el-button
          type="primary"
          size="large"
          @click="goMarket"
        >
          搜索
        </el-button>
      </div>

      <div class="hero-chips">
        <button
          v-for="chip in chips"
          :key="chip.value"
          type="button"
          :class="['chip', { 'chip-active': activeCategory === chip.value }]"
          @click="pickCategory(chip.value)"
        >
          {{ chip.label }}
        </button>
      </div>

      <div class="hero-actions">
        <RouterLink
          class="hero-cta"
          to="/templates"
        >
          浏览全部模板
        </RouterLink>
        <RouterLink
          v-if="userStore.isLoggedIn"
          class="hero-cta ghost"
          to="/resumes"
        >
          我的简历
        </RouterLink>
        <RouterLink
          v-else
          class="hero-cta ghost"
          to="/login"
        >
          登录开始创作
        </RouterLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.hero {
  background: var(--color-bg-soft);
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.hero-inner {
  max-width: 720px;
  width: 100%;
  text-align: center;
}

.hero-title {
  margin: 0 0 12px;
  font-size: clamp(28px, 4vw, 48px);
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

.hero-subtitle {
  margin: 0 0 28px;
  color: var(--color-text-secondary);
  font-weight: 400;
  font-size: 16px;
}

.hero-search {
  display: flex;
  gap: 12px;
  max-width: 480px;
  margin: 0 auto 20px;
}

.hero-search :deep(.el-input__wrapper) {
  border-radius: var(--radius-lg);
  box-shadow: 0 0 0 1px var(--color-border);
  background: var(--color-surface);
}

.hero-search :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1.5px var(--color-accent);
}

.hero-search .el-button {
  border-radius: var(--radius-lg);
}

.hero-chips {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 32px;
}

.chip {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-radius: var(--radius-full);
  padding: 7px 18px;
  font-size: 14px;
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

.hero-actions {
  display: flex;
  justify-content: center;
  gap: 14px;
}

.hero-cta {
  display: inline-block;
  padding: 10px 22px;
  border-radius: var(--radius-lg);
  background: var(--color-accent);
  color: #fff;
  font-weight: 500;
}

.hero-cta:hover {
  background: var(--color-accent-dark);
  transform: translateY(-1px);
}

.hero-cta.ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.hero-cta.ghost:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
}
</style>
