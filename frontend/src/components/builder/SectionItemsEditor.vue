<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSortableList } from '@/composables/useSortableList'
import type { ResumeSectionItem } from '@/types'

const props = defineProps<{
  modelValue: ResumeSectionItem[]
  fields: { key: string; label: string; type?: 'input' | 'textarea' }[]
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: ResumeSectionItem[]): void
  (e: 'change'): void
}>()

const items = computed(() => props.modelValue)
const listEl = ref<HTMLElement | null>(null)

function setField(index: number, key: string, value: unknown) {
  const list = [...items.value]
  list[index] = { ...list[index], [key]: value }
  emit('update:modelValue', list)
  emit('change')
}

function addItem() {
  emit('update:modelValue', [...items.value, { id: crypto.randomUUID(), hidden: false }])
  emit('change')
}

function removeItem(index: number) {
  const list = [...items.value]
  list.splice(index, 1)
  emit('update:modelValue', list)
  emit('change')
}

function handleDragEnd(evt: { oldIndex?: number; newIndex?: number }) {
  const { oldIndex, newIndex } = evt
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
  const list = [...items.value]
  const [moved] = list.splice(oldIndex, 1)
  list.splice(newIndex, 0, moved)
  emit('update:modelValue', list)
  emit('change')
}

useSortableList(listEl, { handle: '.drag-handle', onEnd: handleDragEnd })

function titleOf(item: ResumeSectionItem): string {
  return String(item['name'] ?? item['company'] ?? item['school'] ?? item['position'] ?? '')
}

function valueOf(item: ResumeSectionItem, key: string): string | undefined {
  const value = item[key]
  return typeof value === 'string' ? value : undefined
}
</script>

<template>
  <div class="items-editor">
    <div
      ref="listEl"
      class="items-list"
    >
      <div
        v-for="(element, index) in items"
        :key="element.id"
        class="item-card"
      >
        <div class="item-card-head">
          <span class="drag-handle">⠿</span>
          <span class="item-title">{{ titleOf(element) || `条目 ${index + 1}` }}</span>
          <el-button
            size="small"
            text
            type="danger"
            @click="removeItem(index)"
          >
            删除
          </el-button>
        </div>
        <el-form-item
          v-for="field in fields"
          :key="field.key"
          :label="field.label"
        >
          <el-input
            v-if="field.type !== 'textarea'"
            :model-value="valueOf(element, field.key)"
            @update:model-value="setField(index, field.key, $event)"
          />
          <el-input
            v-else
            type="textarea"
            :rows="3"
            :model-value="valueOf(element, field.key)"
            @update:model-value="setField(index, field.key, $event)"
          />
        </el-form-item>
      </div>
    </div>
    <el-button
      size="small"
      type="primary"
      plain
      @click="addItem"
    >
      添加条目
    </el-button>
  </div>
</template>

<style scoped>
.item-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px;
  margin-bottom: 10px;
}

.item-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.drag-handle {
  cursor: grab;
  color: var(--color-text-secondary);
  user-select: none;
}

.item-title {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
}
</style>
