import { ref } from 'vue'

/**
 * 通用状态标签 composable
 * 用于 PageHeader 中的 status-tag 显示与更新
 */
export function useStatus(initialText = '连接中...', initialType = 'info') {
  const statusText = ref(initialText)
  const statusTagType = ref(initialType)

  const setStatus = (type, text) => {
    statusText.value = text
    if (type === 'ready') statusTagType.value = 'success'
    else if (type === 'error') statusTagType.value = 'danger'
    else statusTagType.value = 'info'
  }

  return { statusText, statusTagType, setStatus }
}
