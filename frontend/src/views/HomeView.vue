<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
</script>

<template>
  <main class="home">
    <h1>Resume Template Site</h1>
    <p class="slogan">在线简历模板市场，登录后创建并管理你的简历</p>
    <nav>
      <RouterLink to="/templates">模板市场</RouterLink>
      <RouterLink v-if="userStore.isLoggedIn" to="/resumes">我的简历</RouterLink>
      <RouterLink v-else to="/login">登录</RouterLink>
    </nav>
  </main>
</template>

<style scoped>
.home {
  padding: 24px;
  text-align: center;
}
.slogan {
  color: #909399;
}
</style>
