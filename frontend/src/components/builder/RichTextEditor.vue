<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

let editor: Editor | undefined

onMounted(() => {
  editor = new Editor({
    content: props.modelValue,
    extensions: [StarterKit, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    onUpdate: ({ editor: ed }) => emit('update:modelValue', ed.getHTML())
  })
})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = undefined
})

function run(action: (ed: Editor) => void) {
  if (editor) action(editor)
}
</script>

<template>
  <div class="rich-text-editor">
    <div class="rich-toolbar">
      <button
        type="button"
        @mousedown.prevent="run((ed) => ed.chain().focus().toggleBold().run())"
      >
        B
      </button>
      <button
        type="button"
        @mousedown.prevent="run((ed) => ed.chain().focus().toggleItalic().run())"
      >
        I
      </button>
      <button
        type="button"
        @mousedown.prevent="run((ed) => ed.chain().focus().toggleBulletList().run())"
      >
        • 列表
      </button>
      <button
        type="button"
        @mousedown.prevent="run((ed) => ed.chain().focus().setTextAlign('left').run())"
      >
        左
      </button>
      <button
        type="button"
        @mousedown.prevent="run((ed) => ed.chain().focus().setTextAlign('center').run())"
      >
        中
      </button>
      <button
        type="button"
        @mousedown.prevent="run((ed) => ed.chain().focus().setTextAlign('right').run())"
      >
        右
      </button>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
.rich-text-editor {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px;
}

.rich-toolbar {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.rich-toolbar button {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  padding: 2px 10px;
  cursor: pointer;
  font-size: 13px;
}
</style>
