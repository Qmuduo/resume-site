<script setup lang="ts">
import { computed } from 'vue'

import type { ResumeData } from '@/types'

const props = defineProps<{ selected: string; data: ResumeData }>()
const emit = defineEmits<{
  (e: 'update:selected', value: string): void
  (e: 'change'): void
}>()

const STANDARD_LABELS: Record<string, string> = {
  basics: '基本信息',
  summary: '个人简介',
  profiles: '社交链接',
  experience: '工作经历',
  education: '教育背景',
  projects: '项目经验',
  skills: '技能清单',
  languages: '语言能力',
  interests: '兴趣爱好',
  awards: '荣誉奖项',
  certifications: '证书',
  publications: '发表',
  volunteer: '志愿经历',
  references: '推荐人'
}

const orderedKeys = computed(() => {
  const list: { key: string; label: string; hidden: boolean; custom: boolean }[] = [
    { key: 'basics', label: '基本信息', hidden: false, custom: false },
    { key: 'summary', label: '个人简介', hidden: props.data.summary.hidden, custom: false }
  ]
  const layout = props.data.metadata.layout
  for (const key of [...layout.main, ...layout.sidebar]) {
    const section = props.data.sections[key]
    if (section) list.push({ key, label: section.title || STANDARD_LABELS[key] || key, hidden: section.hidden, custom: false })
  }
  for (const cs of props.data.customSections) {
    list.push({ key: cs.id, label: cs.title, hidden: cs.hidden, custom: true })
  }
  return list
})

function select(key: string) {
  emit('update:selected', key)
}
</script>

<template>
  <aside class="builder-sidebar">
    <div class="sidebar-head"><span>区块</span></div>
    <div class="section-list">
      <div
        v-for="item in orderedKeys"
        :key="item.key"
        class="section-row"
        :class="{ active: item.key === selected }"
        @click="select(item.key)"
      >
        <span class="section-label">{{ item.label }}</span>
        <span v-if="item.custom" class="custom-badge">自定义</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.builder-sidebar {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px;
  max-height: 70vh;
  overflow: auto;
}

.sidebar-head {
  font-weight: 600;
  margin-bottom: 8px;
}

.section-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid transparent;
}

.section-row:hover {
  background: var(--color-bg-soft);
}

.section-row.active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.section-label {
  flex: 1;
  font-size: 13px;
}

.custom-badge {
  font-size: 11px;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 0 6px;
}
</style>
