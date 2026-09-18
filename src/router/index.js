import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'

const routes = [
  { path: '/', name: 'Home', component: HomePage, meta: { title: '首页看板' } },
  { path: '/clients', name: 'Clients', component: () => import('../views/ClientView.vue'), meta: { title: '客户信息' } },
  { path: '/calendar', name: 'Calendar', component: () => import('../views/HolidayView.vue'), meta: { title: '国家日历' } },
  { path: '/sources', name: 'Sources', component: () => import('../views/SourceView.vue'), meta: { title: '来源配置' } },
  { path: '/price', name: 'Price', component: () => import('../views/PriceView.vue'), meta: { title: '价格表' } },
  { path: '/:pathMatch(.*)', name: 'NotFound', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 动态页面标题
const BASE_TITLE = '个人中心'
router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · ${BASE_TITLE}` : BASE_TITLE
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
