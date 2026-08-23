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

    <!-- 路由视图 -->
    <router-view v-if="currentUser" />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from './composables/useAuth'
import { useResponsive } from './composables/useResponsive'
import AuthDialog from './components/AuthDialog.vue'

const router = useRouter()

// ========== Composables ==========
const {
  currentUser,
  authDialogVisible, authLoading, authError, authForm,
  bootReady,
  handleAuth,
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
