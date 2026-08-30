<template>
  <div class="app-navbar" :class="{ 'is-mobile': isMobile }">
    <!-- 桌面端顶部导航栏 -->
    <template v-if="!isMobile">
      <div class="navbar-inner">
        <div class="navbar-left">
          <span class="navbar-brand" @click="$router.push('/')">📋 个人中心</span>
          <el-menu
            :default-active="activeRoute"
            mode="horizontal"
            :ellipsis="false"
            router
            class="navbar-menu"
          >
            <el-menu-item index="/">首页</el-menu-item>
            <el-menu-item index="/clients">客户信息</el-menu-item>
            <el-menu-item index="/calendar">国家日历</el-menu-item>
            <el-menu-item index="/sources">来源配置</el-menu-item>
            <el-menu-item index="/price">价格表</el-menu-item>
          </el-menu>
        </div>
        <div class="navbar-right">
          <el-dropdown trigger="click" @command="handleUserCommand">
            <div class="user-trigger">
              <el-avatar :size="28" style="background:#409eff;">
                {{ (displayUsername || 'U').charAt(0).toUpperCase() }}
              </el-avatar>
              <span class="user-name">{{ displayUsername }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  <el-icon><User /></el-icon> {{ displayUsername }}
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </template>

    <!-- 移动端顶部简洁导航栏 -->
    <template v-else>
      <div class="navbar-inner mobile-navbar">
        <span class="navbar-brand" @click="$router.push('/')">📋</span>
        <span class="mobile-title">{{ currentTitle }}</span>
        <el-dropdown trigger="click" @command="handleUserCommand">
          <el-avatar :size="26" style="background:#409eff;">
            {{ (displayUsername || 'U').charAt(0).toUpperCase() }}
          </el-avatar>
        </el-dropdown>
      </div>
      <!-- 移动端底部 Tab Bar -->
      <div class="mobile-tabbar">
        <div
          v-for="item in tabItems"
          :key="item.path"
          class="tabbar-item"
          :class="{ active: activeRoute === item.path }"
          @click="$router.push(item.path)"
        >
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
          <span class="tabbar-label">{{ item.label }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { User, SwitchButton, ArrowDown, Document, Calendar, Setting, PriceTag } from '@element-plus/icons-vue'

defineProps({
  displayUsername: { type: String, default: '--' },
  isMobile: { type: Boolean, default: false }
})

const emit = defineEmits(['logout'])

const route = useRoute()
const activeRoute = computed(() => route.path)

const tabItems = [
  { path: '/', label: '首页', icon: 'HomeFilled' },
  { path: '/clients', label: '客户', icon: 'Document' },
  { path: '/calendar', label: '日历', icon: 'Calendar' },
  { path: '/sources', label: '来源', icon: 'Setting' },
  { path: '/price', label: '价格', icon: 'PriceTag' }
]

const titleMap = {
  '/clients': '客户信息',
  '/calendar': '国家日历',
  '/sources': '来源配置',
  '/price': '价格表',
  '/': '首页看板'
}

const currentTitle = computed(() => titleMap[route.path] || '首页看板')

const handleUserCommand = (command) => {
  if (command === 'logout') emit('logout')
}
</script>

<style scoped>
.app-navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  margin: -16px -16px 16px -16px;
  padding: 0 16px;
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  max-width: 1400px;
  margin: 0 auto;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.navbar-brand {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.navbar-menu {
  border-bottom: none !important;
  background: transparent;
}

.navbar-menu .el-menu-item {
  font-size: 14px;
  font-weight: 500;
}

.navbar-right {
  display: flex;
  align-items: center;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.user-trigger:hover {
  background: #f5f7fa;
}

.user-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 移动端 */
.mobile-navbar {
  height: 44px;
  padding: 0 4px;
}

.mobile-navbar .navbar-brand {
  font-size: 18px;
}

.mobile-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.mobile-tabbar {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  border-top: 1px solid #ebeef5;
  padding: 4px 0;
  padding-bottom: calc(4px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.06);
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  cursor: pointer;
  color: #909399;
  transition: color 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.tabbar-item.active {
  color: #409eff;
}

.tabbar-label {
  font-size: 11px;
  font-weight: 500;
}
</style>
