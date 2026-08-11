<script setup lang="ts">
import type { ResumeTemplate } from '@/types'

const props = defineProps<{
  templates: ResumeTemplate[]
  modelValue: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'switch', value: string): void
}>()

function onChange(value: string) {
  if (!value || value === props.modelValue) return
  emit('update:modelValue', value)
  emit('switch', value)
}
</script>

<template>
  <el-select
    :model-value="modelValue"
    :disabled="loading"
    class="template-switcher"
    placeholder="选择模板"
    @update:model-value="onChange"
  >
    <el-option v-for="tpl in templates" :key="tpl.code" :label="tpl.name" :value="tpl.code" />
  </el-select>
</template>

<style scoped>
.template-switcher {
  width: 220px;
}
</style>
