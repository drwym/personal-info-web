<template>
  <div v-loading.fullscreen.lock="initialLoading" element-loading-text="正在从云端加载数据...">
    <PageHeader
      title="客户信息表"
      :status-text="statusText"
      :status-tag-type="statusTagType"
    />

    <FilterBar
      :current-filters="currentFilters"
      :source-list="sourceList"
      :country-list="countryList"
      :refreshing="refreshing"
      @update:current-filters="Object.assign(currentFilters, $event)"
      @search-user-code="searchUserCode"
      @refresh="refreshData()"
    />

    <ClientTable
      ref="tableRef"
      :page-data="pageData"
      :loading-page="loadingPage"
      :is-mobile="isMobile"
      :pagination="pagination"
      :page-sizes="pageSizes"
      @selection-change="handleSelectionChange"
      @show-remark="showRemarkInfo"
      @edit="openModal"
      @add="openModal()"
      @page-change="handleCurrentChange"
      @size-change="handleSizeChange"
    />

    <ActionBar
      :has-selection="selectedRows.length > 0"
      @batch-delete="batchDelete"
      @export-excel="exportExcel"
      @export-data="exportData"
      @import-data="importData"
      @add="openModal()"
    />

    <!-- 添加/编辑 弹窗 -->
    <EditDialog
      :visible="modalVisible"
      :editing-id="editingId"
      :form="form"
      :country-data="countryData"
      :source-list="sourceList"
      :submit-loading="submitLoading"
      :is-mobile="isMobile"
      @submit="submitAddData"
      @update:visible="modalVisible = $event"
      @update-country-code="updateCountryCode"
    />
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { supabase, TABLE_NAME } from '../config/supabase'
import { countryData } from '../data/countryData'
import { isoToCn } from '../utils/countryCodeMap'
import { formatDate, parseDateForInput, todayISO } from '../utils/dateFormat'
import { useAuth } from '../composables/useAuth'
import { useResponsive } from '../composables/useResponsive'
import { useStatus } from '../composables/useStatus'
import { useSourceOptions } from '../composables/useSourceOptions'
import PageHeader from '../components/PageHeader.vue'
import FilterBar from '../components/FilterBar.vue'
import ClientTable from '../components/ClientTable.vue'
import ActionBar from '../components/ActionBar.vue'
import EditDialog from '../components/EditDialog.vue'

const router = useRouter()

// ========== Composables ==========
const { currentUser, fullscreenLoading, bootReady, withTimeout } = useAuth()
const { isMobile, tableRef, pageSizes, relayoutTable, setupResponsive, cleanupResponsive } = useResponsive()
const { statusText, statusTagType, setStatus } = useStatus()
const { sourceList, fetchSourceOptions } = useSourceOptions()

// ========== 状态 ==========
const initialLoading = ref(true)   // 首次全屏 loading
const countryList = computed(() => Object.keys(countryData))

// ========== 数据加载（服务端分页） ==========
const pageData = ref([])

// 从 sessionStorage 恢复筛选条件
const restoreFilters = () => {
  try {
    const saved = sessionStorage.getItem('client-filters')
    if (saved) return JSON.parse(saved)
  } catch {}
  return null
}

const savedFilters = restoreFilters()
const currentFilters = reactive(savedFilters || { status: 'all', source: 'all', country: 'all', userCode: '' })

// 持久化筛选条件
watch(currentFilters, (val) => {
  sessionStorage.setItem('client-filters', JSON.stringify(val))
}, { deep: true })

const pagination = reactive({
  currentPage: 1,
  pageSize: isMobile.value ? 10 : 20,
  total: 0
})
const selectedRows = ref([])
const loadingPage = ref(false)
const refreshing = ref(false)

const mapFromDB = (row) => ({
  id: row.id,
  country: row.country || '',
  countryName: isoToCn[row.country] || row.country || '',
  countryCode: row.country_code || '',
  time: row.follow_time || '',
  company: row.company || '',
  clientName: row.client_name || '',
  userCode: row.user_code || '',
  phone: row.phone || '',
  source: row.source || '',
  status: row.status || '潜在客户',
  ord: row.ord || '',
  remarks: row.remarks || ''
})

const buildQuery = () => {
  let q = supabase.from(TABLE_NAME).select('*', { count: 'exact' })
    .eq('user_id', currentUser.value.id)
  if (currentFilters.status !== 'all') q = q.eq('status', currentFilters.status)
  if (currentFilters.source !== 'all') q = q.eq('source', currentFilters.source)
  if (currentFilters.country !== 'all') q = q.eq('country', currentFilters.country)
  if (currentFilters.userCode) q = q.ilike('user_code', `%${currentFilters.userCode}%`)
  q = q.order('user_code', { ascending: true })
  return q
}

const fetchPage = async () => {
  if (loadingPage.value) return false
  if (!supabase) { ElMessage.warning('云端服务尚未初始化，请稍候重试'); return false }
  if (!currentUser.value) { ElMessage.warning('请先登录后再加载数据'); router.push('/'); return false }
  loadingPage.value = true
  try {
    const from = (pagination.currentPage - 1) * pagination.pageSize
    const to = from + pagination.pageSize - 1
    const { data, error, count } = await withTimeout(
      buildQuery().range(from, to), 15000, `分页查询 page=${pagination.currentPage}`
    )
    if (error) throw error
    pageData.value = (data || []).map(mapFromDB)
    pagination.total = count || 0
    const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    if (pagination.currentPage > totalPages) {
      pagination.currentPage = totalPages
      loadingPage.value = false
      return fetchPage()
    }
    setStatus('ready', `共 ${pagination.total} 条数据 · 第 ${pagination.currentPage}/${totalPages} 页`)
    selectedRows.value = []
    relayoutTable()
    return true
  } catch (err) {
    console.error('加载数据失败:', err)
    setStatus('error', '加载失败')
    ElMessage.error('加载数据失败: ' + (err?.message || err))
    return false
  } finally {
    loadingPage.value = false
  }
}

const refreshData = async (silent = false) => {
  if (!supabase || !currentUser.value) {
    if (!silent) ElMessage.warning('请先登录')
    return false
  }
  if (refreshing.value) return false
  refreshing.value = true
  // 仅首次加载使用全屏 loading，刷新只用表格 loading
  if (initialLoading.value) fullscreenLoading.value = true
  try {
    pagination.currentPage = 1
    await fetchSourceOptions(currentUser.value.id)
    const ok = await fetchPage()
    if (ok && !silent) ElMessage.success('数据已刷新')
    return ok
  } finally {
    refreshing.value = false
    initialLoading.value = false
    fullscreenLoading.value = false
  }
}

const handleSizeChange = (size) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  fetchPage()
  nextTick(() => { tableRef.value?.innerTable?.scrollTo({ top: 0 }) })
}

const handleCurrentChange = (page) => {
  pagination.currentPage = page
  fetchPage()
  nextTick(() => { tableRef.value?.innerTable?.scrollTo({ top: 0 }) })
}

// ========== 弹窗表单 ==========
const modalVisible = ref(false)
const editingId = ref(null)
const submitLoading = ref(false)
const originalStatus = ref('')
const form = reactive({
  country: '', countryCode: '', time: '', company: '',
  clientName: '', userCode: '', phone: '', source: '', status: '重点跟进', remarks: '', isOrdered: false
})

const updateCountryCode = () => {
  form.countryCode = countryData[form.country]?.phone || ''
}

watch(() => form.isOrdered, (newValue) => {
  if (newValue) {
    if (form.status !== '下单完成') {
      originalStatus.value = form.status
      form.status = '下单完成'
    }
  } else {
    if (originalStatus.value) {
      form.status = originalStatus.value
      originalStatus.value = ''
    }
  }
})

const resetForm = () => {
  form.country = ''; form.countryCode = ''
  form.time = todayISO()
  form.company = ''; form.clientName = ''; form.userCode = ''; form.phone = ''
  form.source = ''; form.status = '重点跟进'; form.remarks = ''; form.isOrdered = false
  originalStatus.value = ''
}

const openModal = async (id = null) => {
  editingId.value = id
  if (id !== null) {
    let item = pageData.value.find(d => d.id === id)
    if (!item) {
      try {
        const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('id', id).maybeSingle()
        if (!error && data) item = mapFromDB(data)
      } catch (e) {}
    }
    if (item) {
      form.country = item.country
      form.countryCode = item.countryCode || ''
      form.time = parseDateForInput(item.time)
      form.company = item.company
      form.clientName = item.clientName
      form.userCode = item.userCode || ''
      form.phone = item.phone || ''
      form.source = item.source
      form.status = item.status
      form.remarks = item.remarks
      const isOrdered = !!(item.ord && item.ord.trim() !== '')
      form.isOrdered = isOrdered
      originalStatus.value = isOrdered ? '' : item.status
    }
  } else {
    resetForm()
  }
  modalVisible.value = true
}

const showRemarkInfo = (text) => {
  if (text && text.trim() !== '') {
    ElMessageBox.alert(text, '📝 备注详情', { confirmButtonText: '关闭' })
  } else {
    ElMessage.info('暂无备注信息')
  }
}

const generateUserCode = async () => {
  const { data, error } = await supabase
    .from(TABLE_NAME).select('user_code')
    .eq('user_id', currentUser.value.id)
    .order('user_code', { ascending: false }).limit(1)
  if (error || !data || data.length === 0) return '00001'
  const lastNum = parseInt(data[0].user_code, 10) || 0
  return String(lastNum + 1).padStart(5, '0')
}

const submitAddData = async () => {
  if (!form.country || !form.time) {
    ElMessage.warning('请至少填写【国家】和【跟进时间】！'); return
  }
  submitLoading.value = true
  // 提交时仅弹窗 loading，不锁全屏
  try {
    const country = form.country.trim()
    const countryCode = form.countryCode.trim()
    const time = formatDate(form.time)
    const company = form.company.trim()
    const clientName = form.clientName.trim()
    const phone = form.phone.trim()
    const source = form.source
    const status = form.status
    const remarks = form.remarks.trim()

    if (editingId.value !== null) {
      const record = { country, country_code: countryCode, follow_time: time, company, client_name: clientName, phone, source, status, remarks, ord: form.isOrdered ? '已下单' : '' }
      const { error } = await supabase.from(TABLE_NAME).update(record).eq('id', editingId.value)
      if (error) throw error
      ElMessage.success('修改成功！')
    } else {
      const userCode = await generateUserCode()
      const record = { user_id: currentUser.value.id, country, country_code: countryCode, follow_time: time, company, client_name: clientName, user_code: userCode, phone, source, status, ord: form.isOrdered ? '已下单' : '', remarks }
      const { error } = await supabase.from(TABLE_NAME).insert([record])
      if (error) throw error
      ElMessage.success('添加成功！')
    }
    modalVisible.value = false
    if (editingId.value !== null) await fetchPage()
    else await refreshData()
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  } finally {
    submitLoading.value = false
  }
}

// ========== 多选 & 批量删除 ==========
const handleSelectionChange = (rows) => { selectedRows.value = rows }

const batchDelete = async () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先在表格中勾选需要删除的客户行！'); return
  }
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRows.value.length} 条客户数据吗？此操作不可撤销！`,
      '批量删除确认', { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    )
    // 删除时仅表格 loading，不锁全屏
    loadingPage.value = true
    const ids = selectedRows.value.map(r => r.id)
    const { error } = await supabase.from(TABLE_NAME).delete().in('id', ids)
    if (error) throw error
    ElMessage.success(`成功删除 ${ids.length} 条数据`)
    const restOnPage = pageData.value.filter(item => !ids.includes(item.id)).length
    if (restOnPage === 0 && pagination.currentPage > 1) pagination.currentPage -= 1
    await fetchPage()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败: ' + (err.message || err))
  } finally {
    loadingPage.value = false
  }
}

// ========== 筛选 ==========
watch(() => [currentFilters.status, currentFilters.source, currentFilters.country], () => {
  pagination.currentPage = 1
  fetchPage()
})

const searchUserCode = () => {
  pagination.currentPage = 1
  fetchPage()
}

// ========== 导出导入 ==========
const fetchAll = async (applyFilters = false) => {
  let q = supabase.from(TABLE_NAME).select('*').eq('user_id', currentUser.value.id)
  if (applyFilters) {
    if (currentFilters.status !== 'all') q = q.eq('status', currentFilters.status)
    if (currentFilters.source !== 'all') q = q.eq('source', currentFilters.source)
    if (currentFilters.country !== 'all') q = q.eq('country', currentFilters.country)
    if (currentFilters.userCode) q = q.ilike('user_code', `%${currentFilters.userCode}%`)
  }
  q = q.order('user_code', { ascending: true })
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(mapFromDB)
}

const exportExcel = async () => {
  if (pagination.total === 0) { ElMessage.warning('当前没有数据可以导出！'); return }
  fullscreenLoading.value = true
  try {
    const XLSX = (await import('xlsx')).default
    const all = await fetchAll(true)
    if (all.length === 0) { ElMessage.warning('当前筛选条件下没有数据！'); return }
    const excelRows = [['序号', '国家', '区号', '跟进时间', '公司', '客户名', '用户编码', '联系方式', '来源', '状态', '下单', '备注']]
    all.forEach((item, index) => {
      excelRows.push([index + 1, item.countryName || item.country, item.countryCode || '', item.time, item.company, item.clientName, item.userCode || '', item.phone || '', item.source || '', item.status, item.ord || '', item.remarks])
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(excelRows)
    ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws, '客户数据')
    XLSX.writeFile(wb, `客户信息表_${new Date().toISOString().split('T')[0]}.xlsx`)
    ElMessage.success('Excel 导出成功！')
  } catch (err) {
    ElMessage.error('导出失败: ' + (err.message || err))
  } finally {
    fullscreenLoading.value = false
  }
}

const exportData = async () => {
  if (pagination.total === 0) { ElMessage.warning('当前没有数据可以备份！'); return }
  fullscreenLoading.value = true
  try {
    const all = await fetchAll(false)
    if (all.length === 0) { ElMessage.warning('当前没有数据可以备份！'); return }
    const payload = all.map(item => ({
      country: item.country, countryCode: item.countryCode, time: item.time,
      company: item.company, clientName: item.clientName, userCode: item.userCode,
      phone: item.phone, source: item.source, status: item.status, ord: item.ord, remarks: item.remarks
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `客户数据备份_${new Date().toISOString().split('T')[0]}.json`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 1500)
    ElMessage.success('数据备份成功！')
  } catch (err) {
    ElMessage.error('备份失败: ' + (err.message || err))
  } finally {
    fullscreenLoading.value = false
  }
}

const importData = (file) => {
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result)
      if (!Array.isArray(imported) || imported.length === 0) {
        ElMessage.error('文件格式错误，请选择正确的 JSON 备份文件。'); return false
      }
      try {
        await ElMessageBox.confirm(
          `找到 ${imported.length} 条客户数据，确认要导入到云端吗？`,
          '数据恢复确认', { confirmButtonText: '确定导入', cancelButtonText: '取消', type: 'info' }
        )
      } catch { return false }
      fullscreenLoading.value = true
      const records = imported.map(item => ({
        user_id: currentUser.value.id,
        country: item.country || '', country_code: item.countryCode || '',
        follow_time: item.time || '', company: item.company || '',
        client_name: item.clientName || '', user_code: item.userCode || '',
        phone: item.phone || '', source: item.source || '', status: item.status || '潜在客户',
        ord: item.ord || '', remarks: item.remarks || ''
      }))
      const { error } = await supabase.from(TABLE_NAME).insert(records)
      if (error) throw error
      ElMessage.success('导入成功！')
      await refreshData()
    } catch (err) {
      ElMessage.error('解析文件失败，请确认文件未被损坏。' + (err.message || ''))
    } finally {
      fullscreenLoading.value = false
    }
  }
  reader.readAsText(file)
  return false
}

// ========== 生命周期 ==========
onMounted(async () => {
  setupResponsive(() => {
    const mobile = isMobile.value
    if (mobile && pagination.pageSize > 50) pagination.pageSize = 10
    else if (!mobile && pagination.pageSize > 100) pagination.pageSize = 20
    nextTick(() => fetchPage())
  })

  if (currentUser.value) {
    try {
      await refreshData(true)
    } catch (e) {
      console.error('加载数据失败:', e)
      ElMessage.error('数据加载失败：' + (e.message || e))
      setStatus('error', '加载失败')
      initialLoading.value = false
      fullscreenLoading.value = false
      loadingPage.value = false
    }
  } else {
    initialLoading.value = false
    fullscreenLoading.value = false
  }
})

onBeforeUnmount(() => {
  cleanupResponsive()
})
</script>
