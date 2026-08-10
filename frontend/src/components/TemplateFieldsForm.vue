<script setup lang="ts">
import { computed } from 'vue'

import type { ResumeExtendedData, TemplateFieldDef, TemplateManifest } from '@/types'
import SectionListEditor, { type FieldSpec } from './SectionListEditor.vue'

const props = defineProps<{
  manifest: TemplateManifest | null
  model: ResumeExtendedData
}>()

/** 模板专属字段（未映射公共模型的字段） */
const customFields = computed<TemplateFieldDef[]>(
  () =>
    props.manifest?.fields?.filter(
      (field) => !field.commonPath && field.name !== 'name' && field.name !== 'title'
    ) ?? []
)

const hasCustomFields = computed(() => customFields.value.length > 0)

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function boolOf(value: unknown): boolean {
  return value === true
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function setValue(key: string, value: unknown) {
  props.model[key] = value
}

function addStringItem(key: string) {
  props.model[key] = [...arrayOf(props.model[key]), '']
}

function removeStringItem(key: string, index: number) {
  const list = [...arrayOf(props.model[key])]
  list.splice(index, 1)
  props.model[key] = list
}

function setStringItem(key: string, index: number, value: string) {
  const list = [...arrayOf(props.model[key])]
  list[index] = value
  props.model[key] = list
}

function isStringArray(field: TemplateFieldDef): boolean {
  return field.type === 'array' || field.type === 'string[]'
}

function isObjectField(field: TemplateFieldDef): boolean {
  return field.type === 'object' || field.type === 'object[]'
}

function objectFieldsFor(field: TemplateFieldDef): FieldSpec[] {
  const fields: FieldSpec[] = [{ key: 'name', label: '名称' }]
  if (/date|time|year/i.test(field.name)) fields.push({ key: 'date', label: '时间' })
  if (/desc|detail|summary/i.test(field.name)) fields.push({ key: 'description', label: '描述', type: 'textarea' })
  return fields
}
</script>

<template>
  <div v-if="hasCustomFields" class="template-fields-form">
    <el-divider content-position="left">模板专属字段</el-divider>
    <p class="template-fields-hint">
      以下字段仅当前模板使用，切换模板时未映射的数据会自动暂存保留。
    </p>
    <el-form label-width="96px">
      <el-form-item v-for="field in customFields" :key="field.name" :label="field.label || field.name">
        <el-input
          v-if="field.type === 'string'"
          :model-value="stringOf(model[field.name])"
          @update:model-value="setValue(field.name, $event)"
        />
        <el-switch
          v-else-if="field.type === 'boolean'"
          :model-value="boolOf(model[field.name])"
          @update:model-value="setValue(field.name, $event)"
        />
        <template v-else-if="isStringArray(field)">
          <div v-for="(item, index) in arrayOf(model[field.name])" :key="index" class="field-row">
            <el-input
              :model-value="stringOf(item)"
              @update:model-value="setStringItem(field.name, index, $event)"
            />
            <el-button size="small" @click="removeStringItem(field.name, index)">删除</el-button>
          </div>
          <el-button size="small" type="primary" plain @click="addStringItem(field.name)">添加</el-button>
        </template>
        <SectionListEditor
          v-else-if="isObjectField(field)"
          :model-value="arrayOf(model[field.name])"
          :fields="objectFieldsFor(field)"
          title-key="name"
          @update:model-value="setValue(field.name, $event)"
        />
        <el-input
          v-else
          :model-value="stringOf(model[field.name])"
          @update:model-value="setValue(field.name, $event)"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.template-fields-form {
  margin-top: 4px;
}

.template-fields-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0 0 12px;
}

.field-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  width: 100%;
}
</style>
