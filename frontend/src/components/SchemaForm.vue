<script setup lang="ts">
import { computed } from 'vue'

import type { SchemaNode } from '@/types'

const props = defineProps<{
  schema: SchemaNode
  model: Record<string, unknown>
}>()

const LABELS: Record<string, string> = {
  name: '姓名',
  email: '邮箱',
  phone: '电话',
  linkedin: '领英',
  summary: '个人简介',
  experiences: '工作经历',
  company: '公司',
  title: '职位',
  experience: '工作经历',
  activities: '课外活动',
  organization: '组织/机构',
  location: '地点',
  role: '职位/角色',
  date: '时间',
  bullets: '要点',
  start: '开始时间',
  end: '结束时间',
  education: '教育背景',
  school: '学校',
  degree: '学历',
  year: '年份',
  skills: '技能',
  highlights: '亮点',
  contact: '联系方式'
}

const isObjectSchema = computed(() => props.schema.type === 'object' && !!props.schema.properties)

const properties = computed(() => Object.entries(props.schema.properties ?? {}))

function labelOf(key: string): string {
  return LABELS[key] ?? key
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function objectOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function objectSchemaOf(schema: SchemaNode): SchemaNode {
  return schema.items ?? {}
}

function isStringArray(schema: SchemaNode): boolean {
  return schema.type === 'array' && schema.items?.type === 'string'
}

function isObjectArray(schema: SchemaNode): boolean {
  return schema.type === 'array' && schema.items?.type === 'object'
}

function setValue(key: string, value: unknown) {
  props.model[key] = value
}

function setArrayItem(key: string, index: number, value: unknown) {
  const items = arrayOf(props.model[key])
  items[index] = value
  props.model[key] = items
}

function addStringItem(key: string) {
  const items = arrayOf(props.model[key])
  items.push('')
  props.model[key] = items
}

function addObjectItem(key: string) {
  const items = arrayOf(props.model[key])
  items.push({})
  props.model[key] = items
}

function removeItem(key: string, index: number) {
  const items = arrayOf(props.model[key])
  items.splice(index, 1)
  props.model[key] = items
}
</script>

<template>
  <el-form v-if="isObjectSchema" label-width="96px">
    <el-form-item v-for="[key, sub] in properties" :key="key" :label="labelOf(key)">
      <el-input
        v-if="sub.type === 'string'"
        :model-value="stringOf(model[key])"
        @update:model-value="setValue(key, $event)"
      />
      <template v-else-if="isStringArray(sub)">
        <div v-for="(item, index) in arrayOf(model[key])" :key="index" class="array-row">
          <el-input
            :model-value="stringOf(item)"
            @update:model-value="setArrayItem(key, index, $event)"
          />
          <el-button size="small" @click="removeItem(key, index)">删除</el-button>
        </div>
        <el-button size="small" @click="addStringItem(key)">添加</el-button>
      </template>
      <template v-else-if="isObjectArray(sub)">
        <div v-for="(item, index) in arrayOf(model[key])" :key="index" class="array-card">
          <SchemaForm :schema="objectSchemaOf(sub)" :model="objectOf(item)" />
          <el-button size="small" @click="removeItem(key, index)">删除该项</el-button>
        </div>
        <el-button size="small" @click="addObjectItem(key)">添加</el-button>
      </template>
      <SchemaForm
        v-else-if="sub.type === 'object'"
        :schema="sub"
        :model="objectOf(model[key])"
      />
    </el-form-item>
  </el-form>
</template>

<style scoped>
.array-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.array-card {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 8px;
}
</style>
