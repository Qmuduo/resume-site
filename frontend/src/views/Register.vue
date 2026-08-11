<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import { getErrorMessage } from '@/utils/error'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  email: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{3,32}$/, message: '用户名为 3-32 位字母、数字或下划线', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 72, message: '密码长度需为 8-72 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ],
  nickname: [{ max: 64, message: '昵称长度不能超过 64 位', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }]
}

async function onSubmit() {
  const valid = await formRef.value
    ?.validate()
    .then(() => true)
    .catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await userStore.register({
      username: form.username.trim(),
      password: form.password,
      nickname: form.nickname.trim() || undefined,
      email: form.email.trim() || undefined
    })
    ElMessage.success('注册成功，请登录')
    router.replace({ path: '/login', query: { username: form.username.trim() } })
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '注册失败，请稍后再试'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <el-card class="auth-card">
      <h2>注册</h2>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @keyup.enter="onSubmit"
      >
        <el-form-item
          label="用户名"
          prop="username"
        >
          <el-input
            v-model="form.username"
            placeholder="3-32 位字母、数字或下划线"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item
          label="密码"
          prop="password"
        >
          <el-input
            v-model="form.password"
            type="password"
            placeholder="8-72 位"
            autocomplete="new-password"
            show-password
          />
        </el-form-item>
        <el-form-item
          label="确认密码"
          prop="confirmPassword"
        >
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="再次输入密码"
            autocomplete="new-password"
            show-password
          />
        </el-form-item>
        <el-form-item
          label="昵称（可选）"
          prop="nickname"
        >
          <el-input
            v-model="form.nickname"
            placeholder="昵称"
          />
        </el-form-item>
        <el-form-item
          label="邮箱（可选）"
          prop="email"
        >
          <el-input
            v-model="form.email"
            placeholder="邮箱"
            autocomplete="email"
          />
        </el-form-item>
        <el-button
          type="primary"
          class="submit"
          :loading="loading"
          @click="onSubmit"
        >
          注册
        </el-button>
      </el-form>
      <p class="switch">
        已有账号？<RouterLink to="/login">
          去登录
        </RouterLink>
      </p>
    </el-card>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-page);
}
.auth-card {
  width: 380px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}
.auth-card h2 {
  margin: 0 0 16px;
  text-align: center;
}
.submit {
  width: 100%;
}
.switch {
  margin: 12px 0 0;
  text-align: center;
  font-size: 14px;
}
</style>
