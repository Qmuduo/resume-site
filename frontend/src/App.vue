<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import type { FormInstance } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import { getErrorMessage } from '@/utils/error'

const router = useRouter()
const userStore = useUserStore()

const displayName = computed(() => userStore.displayName || '用户')
const isAdmin = computed(() => userStore.isAdmin)

const passwordDialogVisible = ref(false)
const passwordLoading = ref(false)
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

function resetPasswordForm() {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, max: 72, message: '密码长度需为 8-72 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (value !== passwordForm.newPassword) callback(new Error('两次输入的新密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

onMounted(() => {
  void userStore.init()
})

function handleUserCommand(command: string) {
  if (command === 'password') {
    resetPasswordForm()
    passwordDialogVisible.value = true
  } else if (command === 'logout') {
    void handleLogout()
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  await userStore.logout()
  ElMessage.success('已退出登录')
  router.replace('/')
}

async function onSubmitPassword() {
  const valid = await passwordFormRef.value
    ?.validate()
    .then(() => true)
    .catch(() => false)
  if (!valid) return
  passwordLoading.value = true
  try {
    await userStore.changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })
    ElMessage.success('密码已修改，请重新登录')
    passwordDialogVisible.value = false
    resetPasswordForm()
    router.replace('/login')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '修改密码失败，请稍后再试'))
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div class="layout">
    <header class="site-header">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">R</span>
        <span>Resume Site</span>
      </RouterLink>
      <div class="header-right">
        <nav class="nav">
          <RouterLink to="/templates">模板市场</RouterLink>
          <RouterLink v-if="userStore.isLoggedIn" to="/resumes">我的简历</RouterLink>
          <RouterLink to="/editor">编辑简历</RouterLink>
          <RouterLink v-if="isAdmin" to="/admin/users">用户管理</RouterLink>
        </nav>
        <div class="auth">
          <template v-if="userStore.isLoggedIn">
            <el-tag v-if="isAdmin" size="small" type="danger" class="role-tag">ADMIN</el-tag>
            <el-dropdown @command="handleUserCommand">
              <span class="user-trigger">{{ displayName }}</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="password">修改密码</el-dropdown-item>
                  <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <RouterLink class="link" to="/login">登录</RouterLink>
            <RouterLink class="link" to="/register">注册</RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="content">
      <RouterView />
    </main>

    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="420px">
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-position="top">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordLoading" @click="onSubmitPassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--color-accent);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav a {
  color: var(--color-text-secondary);
  font-size: 14px;
  transition: color 0.2s ease-out;
}

.nav a:hover,
.nav a.router-link-active {
  color: var(--color-accent);
}

.auth {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auth .link {
  color: var(--color-text-secondary);
  transition: color 0.2s ease-out;
}

.auth .link:hover {
  color: var(--color-accent);
}

.user-trigger {
  cursor: pointer;
  color: var(--color-text);
  outline: none;
}

.role-tag {
  margin-right: 4px;
}

.content {
  min-height: calc(100vh - 64px);
}
</style>
