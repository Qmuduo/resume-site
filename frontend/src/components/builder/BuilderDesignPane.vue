<script setup lang="ts">
import { computed } from 'vue'

import type { ResumeData, ResumeTemplate } from '@/types'

const props = defineProps<{
  template: ResumeTemplate | null
  templates: ResumeTemplate[]
  data: ResumeData
}>()
const emit = defineEmits<{ (e: 'change'): void }>()

const colors = computed(() => props.data.metadata.design.colors)
const typography = computed(() => props.data.metadata.typography)
const page = computed(() => props.data.metadata.page)
const metadata = computed(() => props.data.metadata)

function setColor(key: 'primary' | 'text' | 'background', value: string | null) {
  if (value === null) return
  colors.value[key] = value
  emit('change')
}

function setType(key: 'headingFont' | 'bodyFont', value: string) {
  typography.value[key] = value
  emit('change')
}

function setFontSize(value: number | undefined) {
  if (value === undefined) return
  typography.value.fontSize = value
  emit('change')
}

function setPageMargin(value: number | undefined) {
  if (value === undefined) return
  page.value.margin = value
  emit('change')
}

function setStylesheet(value: string) {
  props.data.metadata.stylesheet = value
  emit('change')
}

function setTemplate(code: string) {
  metadata.value.template = code
  emit('change')
}
</script>

<template>
  <div class="design-pane">
    <el-divider content-position="left">
      模板
    </el-divider>
    <el-select
      :model-value="metadata.template"
      @update:model-value="setTemplate"
    >
      <el-option
        v-for="t in templates"
        :key="t.code"
        :label="t.name"
        :value="t.code"
      />
    </el-select>

    <el-divider content-position="left">
      主题色
    </el-divider>
    <el-form label-width="72px">
      <el-form-item label="主色">
        <el-color-picker
          :model-value="colors.primary"
          @update:model-value="setColor('primary', $event)"
        />
      </el-form-item>
      <el-form-item label="正文">
        <el-color-picker
          :model-value="colors.text"
          @update:model-value="setColor('text', $event)"
        />
      </el-form-item>
      <el-form-item label="背景">
        <el-color-picker
          :model-value="colors.background"
          @update:model-value="setColor('background', $event)"
        />
      </el-form-item>
    </el-form>

    <el-divider content-position="left">
      排版
    </el-divider>
    <el-form label-width="72px">
      <el-form-item label="标题字体">
        <el-input
          id="dp-heading-font"
          :model-value="typography.headingFont"
          @update:model-value="setType('headingFont', $event)"
        />
      </el-form-item>
      <el-form-item label="正文字体">
        <el-input
          id="dp-body-font"
          :model-value="typography.bodyFont"
          @update:model-value="setType('bodyFont', $event)"
        />
      </el-form-item>
      <el-form-item label="字号">
        <el-input-number
          :model-value="typography.fontSize"
          :min="8"
          :max="20"
          @update:model-value="setFontSize"
        />
      </el-form-item>
      <el-form-item label="页边距">
        <el-input-number
          :model-value="page.margin"
          :min="0"
          :max="100"
          @update:model-value="setPageMargin"
        />
      </el-form-item>
      <el-form-item label="自定义 CSS">
        <el-input
          type="textarea"
          :rows="6"
          :model-value="metadata.stylesheet"
          @update:model-value="setStylesheet"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.design-pane {
  min-height: 60vh;
}
</style>
