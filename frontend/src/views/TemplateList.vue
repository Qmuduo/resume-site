<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { fetchTemplates } from '@/api/template'
import type { ResumeTemplate } from '@/types'

const templates = ref<ResumeTemplate[]>([])
const loading = ref(false)

onMounted(loadTemplates)

async function loadTemplates() {
  loading.value = true
  try {
    templates.value = await fetchTemplates()
  } catch {
    ElMessage.error('模板列表加载失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="template-list">
    <h1>内置模板</h1>
    <p v-if="loading">加载中…</p>
    <el-row v-else :gutter="16">
      <el-col v-for="tpl in templates" :key="tpl.code" :span="8">
        <el-card class="template-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>{{ tpl.name }}</span>
              <el-tag size="small">{{ tpl.code }}</el-tag>
            </div>
          </template>
          <p>{{ tpl.description }}</p>
        </el-card>
      </el-col>
    </el-row>
  </main>
</template>

<style scoped>
.template-list {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.template-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
