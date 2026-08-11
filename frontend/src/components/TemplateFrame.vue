<script setup lang="ts">
import { computed } from 'vue'

import type { TemplateDocument } from '@/template-engine'

const props = defineProps<{
  document: TemplateDocument
  width?: number
  minHeight?: number
}>()

const srcDoc = computed(
  () =>
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${props.document.css}</style></head><body>${props.document.html}</body></html>`
)

const frameStyle = computed(() => ({
  width: props.width ? `${props.width}px` : '100%',
  minHeight: `${props.minHeight ?? 800}px`
}))
</script>

<template>
  <iframe
    class="template-frame"
    :srcdoc="srcDoc"
    sandbox="allow-scripts"
    :style="frameStyle"
  />
</template>

<style scoped>
.template-frame {
  border: none;
  background: #fff;
  display: block;
}
</style>
