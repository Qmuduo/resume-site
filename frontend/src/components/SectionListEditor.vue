<script setup lang="ts">
import { computed } from 'vue'

export interface FieldSpec {
  key: string
  label: string
  type?: 'input' | 'textarea'
  placeholder?: string
}

const props = defineProps<{
  modelValue: unknown[]
  fields: FieldSpec[]
  titleKey?: string
  addLabel?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown[]): void
}>()

const items = computed(() => props.modelValue)

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function addItem() {
  emit('update:modelValue', [...items.value, {}])
}

function removeItem(index: number) {
  const list = [...items.value]
  list.splice(index, 1)
  emit('update:modelValue', list)
}

function setField(index: number, key: string, value: string) {
  const list = [...items.value]
  const item =
    list[index] !== null && typeof list[index] === 'object' && !Array.isArray(list[index])
      ? (list[index] as Record<string, unknown>)
      : {}
  item[key] = value
  list[index] = item
  emit('update:modelValue', list)
}

function titleOf(item: unknown): string {
  if (item === null || typeof item !== 'object') return ''
  const obj = item as Record<string, unknown>
  return stringOf(obj[props.titleKey ?? ''] ?? obj.name ?? obj.company ?? obj.school ?? obj.title)
}
</script>

<template>
  <div class="section-list-editor">
    <div v-for="(item, index) in items" :key="index" class="list-card">
      <div class="list-card-head">
        <span class="list-card-title">{{ titleOf(item) || `条目 ${index + 1}` }}</span>
        <el-button size="small" type="danger" plain @click="removeItem(index)">删除</el-button>
      </div>
      <div class="list-card-body">
        <el-form-item
          v-for="field in fields"
          :key="field.key"
          :label="field.label"
          class="list-card-field"
        >
          <el-input
            v-if="field.type !== 'textarea'"
            :model-value="stringOf((item as Record<string, unknown>)?.[field.key])"
            :placeholder="field.placeholder"
            @update:model-value="setField(index, field.key, $event)"
          />
          <el-input
            v-else
            type="textarea"
            :rows="2"
            :model-value="stringOf((item as Record<string, unknown>)?.[field.key])"
            :placeholder="field.placeholder"
            @update:model-value="setField(index, field.key, $event)"
          />
        </el-form-item>
      </div>
    </div>
    <el-button size="small" type="primary" plain @click="addItem">
      {{ addLabel ?? '添加条目' }}
    </el-button>
  </div>
</template>

<style scoped>
.section-list-editor {
  width: 100%;
}

.list-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  padding: 10px;
  margin-bottom: 10px;
}

.list-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.list-card-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text);
}

.list-card-body :deep(.el-form-item) {
  margin-bottom: 10px;
}

.list-card-field {
  margin-bottom: 8px;
}
</style>
