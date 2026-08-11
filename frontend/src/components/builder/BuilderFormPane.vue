<script setup lang="ts">
import type { ResumeData } from '@/types'

defineProps<{ section: string; data: ResumeData }>()
</script>

<template>
  <div class="form-pane">
    <h3 class="form-pane-title">当前区块：{{ section }}</h3>
    <p class="form-pane-hint">表单面板将在阶段三逐步完善（Task 31）</p>
  </div>
</template>

<style scoped>
.form-pane {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  max-height: 70vh;
  overflow: auto;
}

.form-pane-title {
  margin: 0 0 8px;
  font-size: 15px;
}

.form-pane-hint {
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
