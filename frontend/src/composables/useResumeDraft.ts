import { computed, ref } from 'vue'

import type { ResumeData } from '@/types'

/** 草稿快照：撤销/重做栈（最多 50 步）。 */
export function useResumeDraft(data: { value: ResumeData }) {
  const past = ref<string[]>([])
  const future = ref<string[]>([])
  const MAX = 50

  function snapshot() {
    const current = JSON.stringify(data.value)
    const last = past.value[past.value.length - 1]
    if (last === current) return
    past.value.push(current)
    if (past.value.length > MAX) past.value.shift()
    future.value = []
  }

  function undo() {
    const prev = past.value.pop()
    if (prev === undefined) return
    future.value.push(JSON.stringify(data.value))
    data.value = JSON.parse(prev) as ResumeData
  }

  function redo() {
    const next = future.value.pop()
    if (next === undefined) return
    past.value.push(JSON.stringify(data.value))
    data.value = JSON.parse(next) as ResumeData
  }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  return { snapshot, undo, redo, canUndo, canRedo }
}
