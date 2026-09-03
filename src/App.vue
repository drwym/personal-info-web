<template>
  <div>
    <!-- 登录 -->
    <AuthDialog
      :visible="authDialogVisible"
      :error="authError"
      :loading="authLoading"
      :form="authForm"
      :is-mobile="isMobile"
      @login="handleAuth"
      @update:visible="authDialogVisible = $event"
    />

    <!-- 全局导航栏（登录后显示） -->
    <AppNavbar
      v-if="currentUser"
      :display-username="displayUsername"
      :is-mobile="isMobile"
      @logout="handleLogout"
    />

    <!-- 路由视图（带过渡动画） -->
    <router-view v-if="currentUser" v-slot="{ Component, route }">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </router-view>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from './composables/useAuth'
import { useResponsive } from './composables/useResponsive'
import AuthDialog from './components/AuthDialog.vue'
import AppNavbar from './components/AppNavbar.vue'

const router = useRouter()

// ========== Composables ==========
const {
  currentUser, displayUsername,
  authDialogVisible, authLoading, authError, authForm,
  bootReady,
  handleAuth, handleLogout,
  showAuthPage, applyUser, clearUser,
  setupAuthListener, getSession, cleanup: cleanupAuth
} = useAuth()

const {
  isMobile,
  setupResponsive, cleanupResponsive
} = useResponsive()

// ========== 生命周期 ==========
onMounted(async () => {
  setupResponsive(() => {})

  setupAuthListener(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      clearUser()
      showAuthPage()
      router.push('/')
      ElMessage.info('已退出登录')
      return
    }
    if (event === 'TOKEN_REFRESHED' && bootReady.value && session?.user) {
      applyUser(session.user)
      return
    }
    if (event === 'SIGNED_IN') {
      const prevId = currentUser.value?.id
      const newId = session?.user?.id
      if (session?.user) applyUser(session.user)
      if (!bootReady.value) return
      if (prevId && newId && prevId === newId) return
    }
  })

  const initialSession = await getSession()
  bootReady.value = true

  if (initialSession?.user) {
    applyUser(initialSession.user)
  } else {
    clearUser()
    showAuthPage()
  }
})

onBeforeUnmount(() => {
  cleanupAuth()
  cleanupResponsive()
})
</script>

<style>
/* 页面切换过渡动画 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease;
}
.page-fade-enter-from {
  opacity: 0;
}
.page-fade-leave-to {
  opacity: 0;
}
</style>
