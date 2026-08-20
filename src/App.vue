<template>
  <div v-loading.fullscreen.lock="fullscreenLoading" element-loading-text="正在从云端加载数据...">
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

    <!-- 主界面 -->
    <div v-if="currentUser">
      <PageHeader
        :status-text="statusText"
        :status-tag-type="statusTagType"
        :display-username="displayUsername"
        @logout="handleLogout"
      />

      <FilterBar
        :current-filters="currentFilters"
        :source-list="sourceList"
        :refreshing="refreshing"
        @update:current-filters="Object.assign(currentFilters, $event)"
        @search-user-code="searchUserCode"
        @manage-sources="openSourceDialog"
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
        @page-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />

      <ActionBar
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

      <!-- 来源选项管理弹窗 -->
      <SourceManageDialog
        :visible="sourceDialogVisible"
        :source-options="sourceOptions"
        :loading="sourceLoading"
        :is-mobile="isMobile"
        @add-source="openSourceForm()"
        @edit-source="openSourceForm($event)"
        @delete-source="deleteSourceOption"
        @update:visible="sourceDialogVisible = $event"
      />

      <!-- 来源添加/编辑弹窗 -->
      <SourceFormDialog
        :visible="sourceFormVisible"
        :editing-id="sourceEditingId"
        :name="sourceFormName"
        :loading="sourceLoading"
        :is-mobile="isMobile"
        @submit="submitSourceForm"
        @update:visible="sourceFormVisible = $event"
        @update:name="sourceFormName = $event"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { supabase, TABLE_NAME, SOURCE_TABLE_NAME } from './config/supabase'
import { countryData } from './data/countryData'
import { useAuth } from './composables/useAuth'
import { useResponsive } from './composables/useResponsive'
import AuthDialog from './components/AuthDialog.vue'
import PageHeader from './components/PageHeader.vue'
import FilterBar from './components/FilterBar.vue'
import ClientTable from './components/ClientTable.vue'
import ActionBar from './components/ActionBar.vue'
import EditDialog from './components/EditDialog.vue'
import SourceManageDialog from './components/SourceManageDialog.vue'
import SourceFormDialog from './components/SourceFormDialog.vue'

// ========== Composables ==========
const {
  currentUser, displayUsername,
  authDialogVisible, authLoading, authError, authForm,
  fullscreenLoading, bootReady,
  handleAuth, handleLogout,
  showAuthPage, applyUser, clearUser,
  setupAuthListener, getSession, withTimeout, cleanup: cleanupAuth
} = useAuth()

const {
  isMobile, tableRef, pageSizes,
  relayoutTable, setupResponsive, cleanupResponsive
} = useResponsive()

// ========== 状态 ==========
const statusText = ref('连接中...')
const statusTagType = ref('info')

const setStatus = (type, text) => {
  statusText.value = text
  if (type === 'ready') statusTagType.value = 'success'
  else if (type === 'error') statusTagType.value = 'danger'
  else statusTagType.value = 'info'
}

// ========== 来源管理 ==========
const sourceList = ref([])
const sourceLoading = ref(false)
const sourceDialogVisible = ref(false)
const sourceFormVisible = ref(false)
const sourceEditingId = ref(null)
const sourceFormName = ref('')
const sourceOptions = ref([])

const fetchSourceOptions = async () => {
  if (!supabase || !currentUser.value) return
  try {
    const { data, error } = await supabase
      .from(SOURCE_TABLE_NAME)
      .select('id, name, sort_order')
      .or(`is_global.eq.true,user_id.eq.${currentUser.value.id}`)
      .order('sort_order', { ascending: true })
    if (error) throw error
    const items = (data || []).map(r => ({
      id: r.id, name: r.name, sortOrder: r.sort_order || 0, isGlobal: r.is_global === true
    }))
    sourceOptions.value = items
    sourceList.value = items.map(o => o.name)
  } catch (err) {
    console.error('加载来源选项失败:', err)
  }
}

const openSourceDialog = async () => {
  sourceDialogVisible.value = true
  sourceFormVisible.value = false
  sourceEditingId.value = null
  sourceFormName.value = ''
  await fetchSourceOptions()
}

const openSourceForm = (item = null) => {
  if (item) {
    sourceEditingId.value = item.id
    sourceFormName.value = item.name
  } else {
    sourceEditingId.value = null
    sourceFormName.value = ''
  }
  sourceFormVisible.value = true
}

const submitSourceForm = async () => {
  const name = sourceFormName.value.trim()
  if (!name) { ElMessage.warning('请输入来源名称'); return }
  if (!sourceEditingId.value && sourceOptions.value.some(o => o.name === name)) {
    ElMessage.warning('该来源已存在'); return
  }
  sourceLoading.value = true
  try {
    if (sourceEditingId.value) {
      const { error } = await supabase.from(SOURCE_TABLE_NAME).update({ name }).eq('id', sourceEditingId.value)
      if (error) throw error
      ElMessage.success('修改来源成功')
    } else {
      const maxSort = sourceOptions.value.length > 0
        ? Math.max(...sourceOptions.value.map(o => o.sortOrder)) + 1 : 1
      const { error } = await supabase.from(SOURCE_TABLE_NAME)
        .insert([{ user_id: currentUser.value.id, name, sort_order: maxSort, is_global: false }])
      if (error) throw error
      ElMessage.success('添加来源成功')
    }
    sourceFormVisible.value = false
    sourceEditingId.value = null
    sourceFormName.value = ''
    await fetchSourceOptions()
  } catch (err) {
    ElMessage.error('操作失败: ' + (err.message || err))
  } finally {
    sourceLoading.value = false
  }
}

const deleteSourceOption = async (item) => {
  try {
    await ElMessageBox.confirm(`确定要删除来源「${item.name}」吗？`, '删除确认', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
    sourceLoading.value = true
    const { error } = await supabase.from(SOURCE_TABLE_NAME).delete().eq('id', item.id)
    if (error) throw error
    ElMessage.success('删除成功')
    await fetchSourceOptions()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败: ' + (err.message || err))
  } finally {
    sourceLoading.value = false
  }
}

// ========== 数据加载（服务端分页） ==========
const pageData = ref([])
const currentFilters = reactive({ status: 'all', source: 'all', userCode: '' })
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
  if (currentFilters.userCode) q = q.ilike('user_code', `%${currentFilters.userCode}%`)
  q = q.order('user_code', { ascending: true })
  return q
}

const fetchPage = async () => {
  if (loadingPage.value) return false
  if (!supabase) { ElMessage.warning('云端服务尚未初始化，请稍候重试'); return false }
  if (!currentUser.value) { ElMessage.warning('请先登录后再加载数据'); showAuthPage(); return false }
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
    fullscreenLoading.value = false
    return false
  }
  if (refreshing.value) return false
  refreshing.value = true
  if (silent && !fullscreenLoading.value) fullscreenLoading.value = true
  try {
    pagination.currentPage = 1
    await fetchSourceOptions()
    const ok = await fetchPage()
    if (ok && !silent) ElMessage.success('数据已刷新')
    return ok
  } finally {
    refreshing.value = false
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
  form.countryCode = countryData[form.country] || ''
}

// 监听下单 checkbox 变化
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
  form.time = new Date().toISOString().split('T')[0]
  form.company = ''; form.clientName = ''; form.userCode = ''; form.phone = ''
  form.source = ''; form.status = '重点跟进'; form.remarks = ''; form.isOrdered = false
  originalStatus.value = ''
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日`
  return dateStr
}

const parseDateForInput = (dateStr) => {
  if (!dateStr) return ''
  const m = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return dateStr
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
  fullscreenLoading.value = true
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
    fullscreenLoading.value = false
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
    fullscreenLoading.value = true
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
    fullscreenLoading.value = false
  }
}

// ========== 筛选 ==========
// 状态、来源：实时过滤
watch(() => [currentFilters.status, currentFilters.source], () => {
  pagination.currentPage = 1
  fetchPage()
})
// 用户编码：仅手动触发
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
      excelRows.push([index + 1, item.country, item.countryCode || '', item.time, item.company, item.clientName, item.userCode || '', item.phone || '', item.source || '', item.status, item.ord || '', item.remarks])
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
  // 设置响应式监听
  setupResponsive(() => {
    // 设备切换时调整分页
    const mobile = isMobile.value
    if (mobile && pagination.pageSize > 50) pagination.pageSize = 10
    else if (!mobile && pagination.pageSize > 100) pagination.pageSize = 20
    nextTick(() => fetchPage())
  })

  // 设置 auth 事件监听
  setupAuthListener(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      clearUser()
      pageData.value = []
      pagination.total = 0
      pagination.currentPage = 1
      setStatus('info', '未登录')
      showAuthPage()
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
      if (!bootReady.value) return // 启动阶段交给 getSession
      if (prevId && newId && prevId === newId) return // 同用户重复登录
      try { await refreshData(true) } catch (e) { console.warn(e) }
    }
  })

  // 主动获取会话
  const initialSession = await getSession()
  bootReady.value = true

  if (initialSession?.user) {
    applyUser(initialSession.user)
    try {
      await refreshData(true)
    } catch (e) {
      console.error('首次加载数据失败:', e)
      ElMessage.error('数据加载失败：' + (e.message || e))
      setStatus('error', '加载失败')
      fullscreenLoading.value = false
      loadingPage.value = false
    }
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
