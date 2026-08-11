<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteResume, fetchResumes } from '@/api/resume'
import { getErrorMessage } from '@/utils/error'
import type { ResumeRecord } from '@/types'

const router = useRouter()
const resumes = ref<ResumeRecord[]>([])
const loading = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  try {
    resumes.value = await fetchResumes()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载简历列表失败'))
  } finally {
    loading.value = false
  }
}

async function onDelete(row: ResumeRecord) {
  try {
    await ElMessageBox.confirm(`确定删除简历「${row.title}」吗？删除后不可恢复。`, '删除确认', {
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await deleteResume(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '删除失败'))
  }
}

function formatTime(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

/** 列表接口返回 Resume 实体，模板编码藏在 data 单文档里 */
function templateCodeOf(row: ResumeRecord): string {
  if (typeof row.data === 'string') {
    try {
      const parsed = JSON.parse(row.data) as { metadata?: { template?: string } }
      if (parsed?.metadata?.template) return parsed.metadata.template
    } catch {
      // 忽略解析失败
    }
  } else if (row.data && typeof row.data === 'object' && 'metadata' in row.data) {
    const meta = (row.data as { metadata?: { template?: string } }).metadata
    if (meta?.template) return meta.template
  }
  return row.templateCode || '-'
}
</script>

<template>
  <main class="page-container">
    <header class="page-header list-header">
      <div>
        <h1 class="page-title">
          我的简历
        </h1>
        <p class="page-subtitle">
          管理当前账号下的所有简历
        </p>
      </div>
      <el-button
        type="primary"
        @click="router.push('/editor')"
      >
        新建简历
      </el-button>
    </header>

    <div class="surface-card table-card">
      <el-table
        v-loading="loading"
        :data="resumes"
        stripe
        empty-text="还没有简历，点击右上角新建"
      >
        <el-table-column
          prop="title"
          label="标题"
          min-width="200"
        />
        <el-table-column
          label="模板"
          min-width="140"
        >
          <template #default="{ row }">
            {{ templateCodeOf(row as ResumeRecord) }}
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="110"
        >
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="更新时间"
          width="180"
        >
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="230"
        >
          <template #default="{ row }">
            <el-button
              size="small"
              @click="router.push(`/resumes/${row.id}/preview`)"
            >
              查看
            </el-button>
            <el-button
              size="small"
              @click="router.push(`/editor/${row.id}`)"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="onDelete(row as ResumeRecord)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </main>
</template>

<style scoped>
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-card {
  padding: 16px;
}
</style>
