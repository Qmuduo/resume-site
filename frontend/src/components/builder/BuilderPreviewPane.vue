<script setup lang="ts">
import { computed, ref } from 'vue'

import { renderTemplate } from '@/template-engine'
import type { ResumeData, ResumeTemplate } from '@/types'

const props = defineProps<{ template: ResumeTemplate | null; data: ResumeData }>()

const format = ref<'A4' | 'Letter'>('A4')
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const stageRef = ref<HTMLElement | null>(null)

const PAGE_WIDTH: Record<'A4' | 'Letter', number> = { A4: 794, Letter: 816 }
const PAGE_HEIGHT: Record<'A4' | 'Letter', number> = { A4: 1123, Letter: 1056 }

const previewHtml = computed(() => (props.template ? renderTemplate(props.template, props.data) : ''))

const pageStyle = computed(() => ({
  width: `${PAGE_WIDTH[format.value]}px`,
  minHeight: `${PAGE_HEIGHT[format.value]}px`,
  transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})`,
  transformOrigin: 'top left'
}))

function resetView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}

function onMouseDown(e: MouseEvent) {
  dragging.value = true
  dragStart.value = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y }
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  pan.value = { x: e.clientX - dragStart.value.x, y: e.clientY - dragStart.value.y }
}

function onMouseUp() {
  dragging.value = false
}
</script>

<template>
  <div class="preview-pane">
    <div class="preview-toolbar">
      <el-radio-group v-model="format" size="small">
        <el-radio-button value="A4">A4</el-radio-button>
        <el-radio-button value="Letter">Letter</el-radio-button>
      </el-radio-group>
      <el-input-number v-model="zoom" :min="0.2" :max="3" :step="0.1" size="small" />
      <el-button size="small" @click="resetView">复位</el-button>
      <span class="pan-hint">拖动画布平移</span>
    </div>
    <div
      ref="stageRef"
      class="preview-stage"
      :class="{ dragging }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <div class="preview-html" :style="pageStyle" v-html="previewHtml"></div>
    </div>
  </div>
</template>

<style scoped>
.preview-pane {
  min-height: 60vh;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pan-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.preview-stage {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-soft);
  padding: 16px;
  min-height: 60vh;
  overflow: auto;
  cursor: grab;
}

.preview-stage.dragging {
  cursor: grabbing;
}

.preview-html {
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
</style>
