<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { fetchTemplates } from '@/api/template'
import { useUserStore } from '@/stores/userStore'
import type { ResumeTemplate } from '@/types'

const router = useRouter()
const userStore = useUserStore()
const templates = ref<ResumeTemplate[]>([])
const loading = ref(false)

onMounted(loadTemplates)

async function loadTemplates() {
  loading.value = true
  try {
    templates.value = await fetchTemplates()
  } catch (error) {
    ElMessage.error('模板列表加载失败')
  } finally {
    loading.value = false
  }
}

function useTemplate(tpl: ResumeTemplate) {
  if (userStore.isLoggedIn) {
    router.push({ path: '/editor', query: { template: tpl.code } })
  } else {
    ElMessage.info('请先登录后使用模板')
    router.push({ path: '/login', query: { redirect: `/editor?template=${tpl.code}` } })
  }
}
</script>

<template>
  <main class="template-list">
    <header class="page-header">
      <div>
        <h1>模板市场</h1>
        <p class="subtitle">公开模板浏览，选择喜欢的模板创建你的简历</p>
      </div>
    </header>
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
          <el-button type="primary" class="use-button" @click="useTemplate(tpl)">使用此模板</el-button>
        </el-card>
      </el-col>
    </el-row>
  </main>
</template>

<style scoped>
.template-list {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px;
}
.page-header {
  margin-bottom: 16px;
}
.page-header h1 {
  margin: 0 0 4px;
}
.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.template-card {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.use-button {
  margin-top: 8px;
}
</style>
