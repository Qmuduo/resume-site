import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/templates',
      name: 'templates',
      component: () => import('@/views/TemplateList.vue')
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('@/views/ResumeEditor.vue')
    },
    {
      path: '/editor/:id',
      name: 'editor-edit',
      component: () => import('@/views/ResumeEditor.vue')
    }
  ]
})

export default router
