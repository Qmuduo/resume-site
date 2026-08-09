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
      path: '/resumes',
      name: 'resumes',
      component: () => import('@/views/ResumeList.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('@/views/ResumeEditor.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/editor/:id',
      name: 'editor-edit',
      component: () => import('@/views/ResumeEditor.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue')
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/Register.vue')
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/views/AdminUsers.vue'),
      meta: { requiresAuth: true, adminOnly: true }
    }
  ]
})

export default router
