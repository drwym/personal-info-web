import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'

const routes = [
  { path: '/', name: 'Home', component: HomePage },
  { path: '/clients', name: 'Clients', component: () => import('../views/ClientView.vue') },
  { path: '/calendar', name: 'Calendar', component: () => import('../views/HolidayView.vue') },
  { path: '/sources', name: 'Sources', component: () => import('../views/SourceView.vue') },
  { path: '/price', name: 'Price', component: () => import('../views/PriceView.vue') }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
