<script setup lang="ts">
import { ElMessageBox } from 'element-plus'

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
  ElMessageBox.confirm(
    '切换模板后，公共数据（姓名、工作经历、教育背景等）完整保留；' +
      '当前模板的专属字段会尽量迁移，无法映射的将自动暂存，切回后恢复。是否继续？',
    '切换模板',
    {
      confirmButtonText: '切换',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      emit('switch', value)
    })
    .catch(() => {
      // 取消：回滚选择
      emit('update:modelValue', props.modelValue)
    })
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
