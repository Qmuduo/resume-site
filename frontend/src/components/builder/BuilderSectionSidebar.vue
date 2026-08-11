<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { ElMessageBox } from 'element-plus'

import type { ResumeCustomSection, ResumeData, ResumeSection } from '@/types'

const props = defineProps<{ selected: string; data: ResumeData }>()
const emit = defineEmits<{
  (e: 'update:selected', value: string): void
  (e: 'change'): void
}>()

interface SidebarItem {
  key: string
  label: string
  hidden: boolean
  custom: boolean
}

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

const dragList = ref<SidebarItem[]>([])
const pendingStandard = ref('')

function rebuild() {
  const list: SidebarItem[] = [
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
  dragList.value = list
}

watch(() => props.data, rebuild, { deep: true })
onMounted(rebuild)

const availableStandard = computed(() => {
  const existing = new Set([
    ...props.data.metadata.layout.main,
    ...props.data.metadata.layout.sidebar,
    'basics',
    'summary'
  ])
  return Object.entries(STANDARD_LABELS).filter(([key]) => !existing.has(key))
})

function onAddStandard(key: string) {
  pendingStandard.value = ''
  if (!key) return
  const label = STANDARD_LABELS[key]
  if (!props.data.sections[key]) {
    const section: ResumeSection = { title: label, columns: 1, hidden: false, items: [] }
    props.data.sections[key] = section
  }
  if (!props.data.metadata.layout.main.includes(key)) {
    props.data.metadata.layout.main.push(key)
  }
  emit('update:selected', key)
  emit('change')
}

function syncOrder() {
  const layout = props.data.metadata.layout
  const standard = dragList.value.filter((item) => !item.custom).map((item) => item.key)
  const main = standard.filter((key) => key !== 'basics' && key !== 'summary')
  layout.main.splice(0, layout.main.length, ...main)
  const customOrder = dragList.value.filter((item) => item.custom).map((item) => item.key)
  const byId = new Map(props.data.customSections.map((cs) => [cs.id, cs]))
  props.data.customSections.splice(0, props.data.customSections.length, ...customOrder.map((id) => byId.get(id)).filter(Boolean) as ResumeCustomSection[])
  emit('change')
}

function toggleHidden(item: SidebarItem, value: boolean) {
  if (item.custom) {
    const cs = props.data.customSections.find((c) => c.id === item.key)
    if (cs) cs.hidden = value
  } else if (item.key === 'summary') {
    props.data.summary.hidden = value
  } else {
    const section = props.data.sections[item.key]
    if (section) section.hidden = value
  }
  emit('change')
}

async function addCustom() {
  const { value } = await ElMessageBox.prompt('区块名称', '新建自定义区块')
  if (!value) return
  const cs: ResumeCustomSection = { id: crypto.randomUUID(), title: value, columns: 1, hidden: false, items: [] }
  props.data.customSections.push(cs)
  emit('update:selected', cs.id)
  emit('change')
}

async function removeCustom(item: SidebarItem) {
  const index = props.data.customSections.findIndex((c) => c.id === item.key)
  if (index < 0) return
  await ElMessageBox.confirm('删除该自定义区块（数据不可恢复）？', '删除区块', { type: 'warning' })
  props.data.customSections.splice(index, 1)
  emit('update:selected', 'basics')
  emit('change')
}
</script>

<template>
  <aside class="builder-sidebar">
    <div class="sidebar-head">
      <span>区块</span>
      <el-button
        size="small"
        type="primary"
        plain
        @click="addCustom"
      >
        + 自定义区块
      </el-button>
    </div>
    <el-select
      v-model="pendingStandard"
      size="small"
      class="add-standard"
      placeholder="+ 添加标准区块"
      @update:model-value="onAddStandard"
    >
      <el-option
        v-for="[key, label] in availableStandard"
        :key="key"
        :label="label"
        :value="key"
      />
    </el-select>
    <draggable
      :list="dragList"
      item-key="key"
      handle=".drag-handle"
      class="section-list"
      @end="syncOrder"
    >
      <template #item="{ element }">
        <div
          class="section-row"
          :class="{ active: element.key === selected }"
          @click="$emit('update:selected', element.key)"
        >
          <span class="drag-handle">⠿</span>
          <span class="section-label">{{ element.label }}</span>
          <el-switch
            size="small"
            :model-value="element.hidden"
            @update:model-value="toggleHidden(element, $event as boolean)"
            @click.stop
          />
          <el-button
            v-if="element.custom"
            size="small"
            text
            type="danger"
            @click.stop="removeCustom(element)"
          >
            删
          </el-button>
        </div>
      </template>
    </draggable>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
}

.add-standard {
  width: 100%;
  margin-bottom: 8px;
}

.section-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.drag-handle {
  cursor: grab;
  color: var(--color-text-secondary);
  user-select: none;
}

.section-label {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
