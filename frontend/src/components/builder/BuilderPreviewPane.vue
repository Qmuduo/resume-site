<script setup lang="ts">
import { computed } from 'vue'

import { renderTemplate } from '@/template-engine'
import type { ResumeData, ResumeTemplate } from '@/types'

const props = defineProps<{ template: ResumeTemplate | null; data: ResumeData }>()

const previewHtml = computed(() => (props.template ? renderTemplate(props.template, props.data) : ''))
</script>

<template>
  <div class="preview-pane">
    <div class="preview-html" v-html="previewHtml"></div>
  </div>
</template>

<style scoped>
.preview-pane {
  min-height: 60vh;
  overflow: auto;
}
</style>
