<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAdminUsers, updateUserRole } from '@/api/admin'
import { useUserStore } from '@/stores/userStore'
import { getErrorMessage } from '@/utils/error'
import type { UserInfo, UserRole } from '@/types/user'

const userStore = useUserStore()
const users = ref<UserInfo[]>([])
const loading = ref(false)
const changingId = ref<number | null>(null)

onMounted(load)

async function load() {
  loading.value = true
  try {
    users.value = await fetchAdminUsers()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载用户列表失败'))
  } finally {
    loading.value = false
  }
}

function isSelf(user: UserInfo): boolean {
  return user.id === userStore.user?.id
}

async function onRoleChange(user: UserInfo, role: UserRole) {
  const previous = user.role
  user.role = role
  changingId.value = user.id
  try {
    await updateUserRole(user.id, role)
    ElMessage.success(`已将 ${user.username} 设为 ${role}`)
  } catch (error) {
    user.role = previous
    ElMessage.error(getErrorMessage(error, '更新角色失败'))
  } finally {
    changingId.value = null
  }
}

function formatTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}
</script>

<template>
  <main class="admin-users">
    <header class="page-header">
      <h1>用户管理</h1>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </header>

    <el-table v-loading="loading" :data="users" border stripe>
      <el-table-column prop="id" label="ID" width="90" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column prop="nickname" label="昵称" min-width="120">
        <template #default="{ row }">{{ row.nickname || '-' }}</template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="180">
        <template #default="{ row }">{{ row.email || '-' }}</template>
      </el-table-column>
      <el-table-column label="角色" width="160">
        <template #default="{ row }">
          <el-select
            v-model="row.role"
            :disabled="changingId === row.id || isSelf(row as UserInfo)"
            size="small"
            @change="(role: UserRole) => onRoleChange(row as UserInfo, role)"
          >
            <el-option label="USER" value="USER" />
            <el-option label="ADMIN" value="ADMIN" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
    </el-table>
  </main>
</template>

<style scoped>
.admin-users {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header h1 {
  margin: 0;
}
</style>
