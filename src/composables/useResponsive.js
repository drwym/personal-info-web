import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

export function useResponsive() {
  const mqMobile = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null
  const isMobile = ref(mqMobile ? mqMobile.matches : window.innerWidth <= 768)
  const tableRef = ref(null)

  const pageSizes = ref(isMobile.value ? [10, 20, 50] : [10, 20, 50, 100])

  // tableRef 指向 ClientTable 组件实例，通过 .innerTable 获取内部 el-table
  const getTable = () => tableRef.value?.innerTable

  const relayoutTable = () => {
    nextTick(() => {
      const table = getTable()
      if (table) {
        table.doLayout()
        setTimeout(() => { getTable()?.doLayout() }, 300)
      }
    })
  }

  const handleWindowResize = () => {
    const mobile = mqMobile ? mqMobile.matches : window.innerWidth <= 768
    if (mobile !== isMobile.value) {
      isMobile.value = mobile
      const newSizes = mobile ? [10, 20, 50] : [10, 20, 50, 100]
      pageSizes.value = newSizes
    }
    getTable()?.doLayout()
  }

  const setupResponsive = (onDeviceChange) => {
    if (mqMobile) {
      if (mqMobile.addEventListener) mqMobile.addEventListener('change', (e) => {
        handleWindowResize()
        onDeviceChange?.()
      })
      else if (mqMobile.addListener) mqMobile.addListener(handleWindowResize)
    }
    window.addEventListener('resize', handleWindowResize)
  }

  const cleanupResponsive = () => {
    window.removeEventListener('resize', handleWindowResize)
    if (mqMobile) {
      if (mqMobile.removeEventListener) mqMobile.removeEventListener('change', handleWindowResize)
      else if (mqMobile.removeListener) mqMobile.removeListener(handleWindowResize)
    }
  }

  return {
    isMobile, tableRef, pageSizes,
    relayoutTable, setupResponsive, cleanupResponsive, handleWindowResize
  }
}
