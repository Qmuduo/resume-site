<script setup lang="ts">
import { ElMessage } from 'element-plus'

function showReady() {
  ElMessage.info('前端骨架已就绪')
}
</script>

<template>
  <main class="home">
    <h1>Resume Template Site</h1>
    <button type="button" @click="showReady">Hello</button>
  </main>
</template>

<style scoped>
.home {
  padding: 24px;
}
</style>
