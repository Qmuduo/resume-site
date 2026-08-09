import { readAccessToken, readStoredUser } from '@/utils/auth-storage'
import router from './index'

router.beforeEach((to) => {
  const token = readAccessToken()
  if (to.meta.requiresAuth && !token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.meta.adminOnly && readStoredUser()?.role !== 'ADMIN') {
    return { path: '/' }
  }
  if ((to.path === '/login' || to.path === '/register') && token) {
    return { path: '/' }
  }
})
