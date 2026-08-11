<script setup lang="ts">
import type { ResumeData, ResumeTemplate } from '@/types'

const props = defineProps<{ template: ResumeTemplate | null; templates: ResumeTemplate[]; data: ResumeData }>()
const emit = defineEmits<{ (e: 'change'): void }>()

function setTemplate(code: string) {
  props.data.metadata.template = code
  emit('change')
}
</script>

<template>
  <div class="design-pane">
    <el-divider content-position="left">模板</el-divider>
    <el-select :model-value="data.metadata.template" @update:model-value="setTemplate">
      <el-option v-for="t in templates" :key="t.code" :label="t.name" :value="t.code" />
    </el-select>
  </div>
</template>

<style scoped>
.design-pane {
  min-height: 60vh;
}
</style>
