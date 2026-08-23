import { ref } from 'vue'
import { supabase } from '../config/supabase'
import { ElMessage, ElMessageBox } from 'element-plus'

// 单例状态，所有组件共享同一份认证实例
const currentUser = ref(null)
const displayUsername = ref('--')
const authDialogVisible = ref(false)
const authLoading = ref(false)
const authError = ref('')
const authForm = ref({ email: '', password: '' })
const fullscreenLoading = ref(false)
const bootReady = ref(false)
let authListener = null

export function useAuth() {

  const showAuthPage = () => {
    authForm.value = { email: '', password: '' }
    authError.value = ''
    authDialogVisible.value = true
  }

  const applyUser = (user) => {
    currentUser.value = user
    const dn = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '用户'
    displayUsername.value = dn
    authDialogVisible.value = false
  }

  const clearUser = () => {
    currentUser.value = null
    displayUsername.value = '--'
  }

  const handleAuth = async () => {
    const email = authForm.value.email.trim()
    const password = authForm.value.password
    authError.value = ''
    if (!email || !password) { authError.value = '请填写邮箱和密码'; return }
    if (password.length < 6) { authError.value = '密码至少6位'; return }
    authLoading.value = true
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      authError.value = err.message || '操作失败，请重试'
    } finally {
      authLoading.value = false
    }
  }

  const handleLogout = async () => {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定退出', cancelButtonText: '取消', type: 'warning'
      })
      await supabase.auth.signOut()
    } catch (e) { /* 取消 */ }
  }

  const withTimeout = (promise, ms, label) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[TIMEOUT] ${label} 超时（${ms}ms）`))
      }, ms)
      promise.then(
        (v) => { clearTimeout(timer); resolve(v) },
        (e) => { clearTimeout(timer); reject(e) }
      )
    })
  }

  const setupAuthListener = (onEvent) => {
    authListener = supabase.auth.onAuthStateChange(async (event, session) => {
      await onEvent(event, session)
    })
  }

  const getSession = async () => {
    try {
      const result = await withTimeout(
        supabase.auth.getSession(),
        15000,
        'supabase.auth.getSession()'
      )
      const { data: { session }, error } = result
      if (error) throw error
      return session
    } catch (e) {
      console.error('getSession 异常：', e)
      // 兜底：等 500ms 检查 currentUser 是否已被监听器提前设置
      await new Promise(r => setTimeout(r, 500))
      if (currentUser.value) return { user: currentUser.value }
      return null
    }
  }

  const cleanup = () => {
    if (authListener?.data?.subscription) {
      authListener.data.subscription.unsubscribe()
    }
  }

  return {
    currentUser, displayUsername,
    authDialogVisible, authLoading, authError, authForm,
    fullscreenLoading, bootReady,
    handleAuth, handleLogout,
    showAuthPage, applyUser, clearUser,
    setupAuthListener, getSession, withTimeout, cleanup
  }
}
