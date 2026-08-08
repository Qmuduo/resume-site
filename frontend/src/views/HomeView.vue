<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ElMessage } from 'element-plus'

function showReady() {
  ElMessage.info('前端骨架已就绪')
}
</script>

<template>
  <main class="home">
    <h1>Resume Template Site</h1>
    <nav>
      <RouterLink to="/templates">内置模板</RouterLink>
      <span> </span>
      <RouterLink to="/editor">简历编辑</RouterLink>
    </nav>
    <button type="button" @click="showReady">Hello</button>
  </main>
</template>

<style scoped>
.home {
  padding: 24px;
}
</style>
