import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'

const routes = [
  { path: '/', name: 'Home', component: HomePage },
  { path: '/clients', name: 'Clients', component: () => import('../views/ClientView.vue') },
  { path: '/calendar', name: 'Calendar', component: () => import('../views/HolidayView.vue') },
  { path: '/sources', name: 'Sources', component: () => import('../views/SourceView.vue') },
  { path: '/price', name: 'Price', component: () => import('../views/PriceView.vue') },
  { path: '/:pathMatch(.*)', name: 'NotFound', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 全局路由守卫：未登录时重定向到首页（弹出登录框）
router.beforeEach((to, from, next) => {
  if (to.path === '/' || to.name === 'NotFound') {
    return next()
  }
  // 检查 localStorage 中是否存在 Supabase session token
  const authKey = 'sb-client-auth'
  const hasToken = (() => {
    try {
      const raw = localStorage.getItem(authKey)
      if (!raw) return false
      const parsed = JSON.parse(raw)
      return !!(parsed?.access_token || parsed?.user)
    } catch {
      return false
    }
  })()

  if (!hasToken) {
    return next('/')
  }
  next()
})

export default router
