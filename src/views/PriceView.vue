<template>
  <div v-loading.fullscreen.lock="fullscreenLoading" element-loading-text="正在从云端加载数据...">
    <PageHeader
      title="启迅价格表"
      :status-text="statusText"
      :status-tag-type="statusTagType"
      :display-username="displayUsername"
      @back="$router.push('/')"
      @logout="handleLogout"
    />

    <div class="price-content">
      <div class="filter-bar">
        <div class="filter-row">
          <span class="exchange-rate-label">汇率换算：</span>
          <el-input
            v-model.number="exchangeRate"
            placeholder="输入汇率，如 6.75"
            style="width: 200px"
            clearable
            type="number"
            :step="0.01"
            :min="0"
          />
          <span v-if="exchangeRate > 0" class="exchange-rate-hint">
            美元价 = 人民币价 ÷ {{ exchangeRate }}，向上取整
          </span>
        </div>
        <div class="filter-row">
          <span class="exchange-rate-label">设备名称：</span>
          <el-input
            v-model="searchName"
            placeholder="输入设备名称搜索"
            style="width: 260px"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #append>
              <el-button :icon="Search" @click="handleSearch" />
            </template>
          </el-input>
          <div style="margin-left: auto; display: flex; gap: 8px">
            <el-button
              type="primary"
              :icon="Download"
              :loading="exportingPdf"
              @click="exportPDF"
            >
              <template v-if="exportingPdf && exportProgress.total > 0">
                下载图片 {{ exportProgress.loaded }}/{{ exportProgress.total }}
              </template>
              <template v-else>导出 PDF</template>
            </el-button>
            <el-button
              type="success"
              :icon="Download"
              :loading="exportingExcel"
              @click="exportExcel"
            >
              <template v-if="exportingExcel && exportProgress.total > 0">
                下载图片 {{ exportProgress.loaded }}/{{ exportProgress.total }}
              </template>
              <template v-else>导出 Excel</template>
            </el-button>
          </div>
        </div>
      </div>

      <el-table
        ref="tableRef"
        :data="tableData"
        :loading="loadingTable"
        border
        stripe
        style="width: 100%"
        :row-class-name="tableRowClassName"
        v-loading="loadingTable"
        element-loading-text="加载中..."
      >
        <el-table-column type="index" label="#" width="60" align="center" fixed />
        <el-table-column prop="equipment_name" label="Equipment Name" min-width="200" show-overflow-tooltip fixed />
        <el-table-column prop="image_url" label="Equipment Images" width="110" align="center">
          <template #default="{ row }">
            <div v-if="row.image_url" class="image-cell">
              <el-image
                :src="row.image_url"
                style="width: 70px; height: 70px"
                fit="contain"
                :preview-src-list="[row.image_url]"
                preview-teleported
                lazy
              >
                <template #error>
                  <div class="image-error">
                    <el-icon :size="20"><Picture /></el-icon>
                  </div>
                </template>
                <template #placeholder>
                  <div class="image-loading">
                    <el-icon class="is-loading" :size="18"><Loading /></el-icon>
                  </div>
                </template>
              </el-image>
            </div>
            <span v-else class="image-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="specification" label="Specification" width="100" align="center" />
        <el-table-column prop="factory_price" label="Factory Price" width="120" align="right">
          <template #default="{ row }">
            {{ row.factory_price ? Number(row.factory_price).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="price_usd" label="Price(USD)" width="130" align="right">
          <template #default="{ row }">
            <template v-if="exchangeRate > 0 && row.price_rmb">
              <span class="calculated-price">{{ Math.ceil(row.price_rmb / exchangeRate).toLocaleString() }}</span>
            </template>
            <template v-else>
              {{ row.price_usd ? Number(row.price_usd).toLocaleString() : '-' }}
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="price_rmb" label="Price(RMB)" width="130" align="right">
          <template #default="{ row }">
            {{ row.price_rmb ? Number(row.price_rmb).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="equipment_dimensions" label="Equipment Dimensions" min-width="180" show-overflow-tooltip />
        <el-table-column prop="wooden_frame_dimensions" label="Wooden frame dimensions" min-width="200" show-overflow-tooltip />
        <el-table-column prop="volume" label="Volume" min-width="160" show-overflow-tooltip />
        <el-table-column prop="area" label="Area" min-width="140" show-overflow-tooltip />
        <el-table-column prop="standard_configuration" label="Standard configuration" min-width="120" show-overflow-tooltip />
        <el-table-column prop="remarks" label="Remarks" min-width="220" show-overflow-tooltip />
        <el-table-column prop="game_instructions" label="Game Instructions" min-width="280" show-overflow-tooltip />
      </el-table>

      <div class="price-pagination" v-if="total > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, Search, Picture, Loading } from '@element-plus/icons-vue'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase, PRICE_TABLE_NAME } from '../config/supabase'
import { useAuth } from '../composables/useAuth'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()

// ========== Composables ==========
const {
  currentUser,
  displayUsername,
  fullscreenLoading,
  handleLogout
} = useAuth()

// ========== 状态 ==========
const statusText = ref('连接中...')
const statusTagType = ref('info')

const setStatus = (type, text) => {
  statusText.value = text
  if (type === 'ready') statusTagType.value = 'success'
  else if (type === 'error') statusTagType.value = 'danger'
  else statusTagType.value = 'info'
}

// ========== 汇率 ==========
const exchangeRate = ref(null)

// ========== 筛选 ==========
const searchName = ref('')

// ========== 表格数据 ==========
const tableRef = ref(null)
const tableData = ref([])
const loadingTable = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

/**
 * 从数据库行映射到表格行数据
 * 字段对应关系（基于 Excel 第3行标题）：
 *   equipment_name       → Equipment Name
 *   image_url            → Equipment Images（CDN 链接，表格暂不显示）
 *   specification        → Specification
 *   factory_price        → Factory Price 6.75
 *   price_usd            → Price(USD)
 *   price_rmb            → Price(RMB)
 *   equipment_dimensions → Equipment Dimensions
 *   wooden_frame_dimensions → Wooden frame dimensions
 *   volume               → Volume
 *   area                 → Area
 *   standard_configuration → Standard configuration
 *   remarks              → Remarks
 *   game_instructions    → Game Instructions
 */
const mapFromDB = (row) => ({
  id: row.id,
  equipment_name: row.equipment_name || '',
  image_url: row.image_url || '',
  specification: row.specification || '',
  factory_price: row.factory_price,
  price_usd: row.price_usd,
  price_rmb: row.price_rmb,
  equipment_dimensions: row.equipment_dimensions || '',
  wooden_frame_dimensions: row.wooden_frame_dimensions || '',
  volume: row.volume || '',
  area: row.area || '',
  standard_configuration: row.standard_configuration || '',
  remarks: row.remarks || '',
  game_instructions: row.game_instructions || ''
})

const buildQuery = () => {
  let q = supabase.from(PRICE_TABLE_NAME).select('*', { count: 'exact' })
  if (searchName.value.trim()) {
    q = q.ilike('equipment_name', `%${searchName.value.trim()}%`)
  }
  q = q.order('id', { ascending: true })
  return q
}

const fetchPage = async () => {
  if (loadingTable.value) return
  if (!currentUser.value) {
    ElMessage.warning('请先登录后查看价格表')
    router.push('/')
    return
  }
  loadingTable.value = true
  try {
    const from = (currentPage.value - 1) * pageSize.value
    const to = from + pageSize.value - 1
    const { data, error, count } = await buildQuery().range(from, to)
    if (error) throw error
    tableData.value = (data || []).map(mapFromDB)
    total.value = count || 0
    const totalPages = Math.max(1, Math.ceil(total.value / pageSize.value))
    if (currentPage.value > totalPages) {
      currentPage.value = totalPages
      loadingTable.value = false
      return fetchPage()
    }
    setStatus('ready', `共 ${total.value} 条产品数据 · 第 ${currentPage.value}/${totalPages} 页`)
    return true
  } catch (err) {
    console.error('加载价格数据失败:', err)
    setStatus('error', '加载失败')
    ElMessage.error('加载数据失败: ' + (err?.message || err))
    return false
  } finally {
    loadingTable.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchPage()
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  fetchPage()
}

const handleCurrentChange = (page) => {
  currentPage.value = page
  fetchPage()
}

const tableRowClassName = () => 'price-table-row'

// ========== 导出 ==========
const exportingExcel = ref(false)
const exportingPdf = ref(false)
const exportProgress = ref({ loaded: 0, total: 0 })

const fetchAllData = async () => {
  let q = supabase.from(PRICE_TABLE_NAME).select('*')
  if (searchName.value.trim()) {
    q = q.ilike('equipment_name', `%${searchName.value.trim()}%`)
  }
  q = q.order('id', { ascending: true })
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(mapFromDB)
}

/** 从 URL 获取图片 ArrayBuffer，失败返回 null */
const fetchImageBuffer = async (url) => {
  if (!url) return null
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    return await resp.arrayBuffer()
  } catch {
    return null
  }
}

/** 从 URL 获取图片 base64 Data URL，失败返回 null */
const fetchImageAsDataURL = async (url) => {
  if (!url) return null
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** 并发下载图片，返回 Map<rowIndex, dataURL> */
const downloadImagesConcurrently = async (tasks, onProgress) => {
  const results = new Map()
  const CONCURRENCY = 5
  let completed = 0
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async ({ rowIndex, url }) => {
      const dataURL = await fetchImageAsDataURL(url)
      if (dataURL) results.set(rowIndex, dataURL)
      completed++
      onProgress?.(completed)
    }))
  }
  return results
}

const exportExcel = async () => {
  if (total.value === 0) {
    ElMessage.warning('当前没有数据可以导出！')
    return
  }
  exportingExcel.value = true
  exportProgress.value = { loaded: 0, total: 0 }
  try {
    const allData = await fetchAllData()
    if (allData.length === 0) {
      ElMessage.warning('没有可导出的数据！')
      return
    }

    const useCalculatedRate = exchangeRate.value > 0
    const IMG_COL = 3   // 产品图片在第 3 列（C列）
    const IMG_W = 80    // 图片宽度 px
    const IMG_H = 80    // 图片高度 px
    const ROW_H = 68    // 行高 pt

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('启迅价格表')

    // 列定义（英文列名匹配原始 Excel）
    ws.columns = [
      { header: '#', key: 'index', width: 7 },
      { header: 'Equipment Name', key: 'name', width: 38 },
      { header: 'Equipment Images', key: 'image', width: 14 },
      { header: 'Specification', key: 'spec', width: 13 },
      { header: 'Factory Price', key: 'factory', width: 13 },
      { header: 'Price(USD)', key: 'usd', width: 14 },
      { header: 'Price(RMB)', key: 'rmb', width: 13 },
      { header: 'Equipment Dimensions', key: 'eq_dim', width: 24 },
      { header: 'Wooden frame dimensions', key: 'wood_dim', width: 32 },
      { header: 'Volume', key: 'volume', width: 20 },
      { header: 'Area', key: 'area', width: 18 },
      { header: 'Standard configuration', key: 'config', width: 20 },
      { header: 'Remarks', key: 'remarks', width: 32 },
      { header: 'Game Instructions', key: 'instructions', width: 42 }
    ]

    // 表头样式
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, size: 11 }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4FD' }
    }
    headerRow.height = 24

    // 收集需要下载图片的行
    const imageTasks = []
    exportProgress.value.total = allData.filter(d => d.image_url).length

    // 填充数据行
    allData.forEach((item, idx) => {
      const usdPrice = useCalculatedRate && item.price_rmb
        ? Math.ceil(item.price_rmb / exchangeRate.value)
        : item.price_usd

      const row = ws.addRow({
        index: idx + 1,
        name: item.equipment_name,
        image: '',  // 图片通过 addImage 嵌入
        spec: item.specification,
        factory: item.factory_price,
        usd: usdPrice,
        rmb: item.price_rmb,
        eq_dim: item.equipment_dimensions,
        wood_dim: item.wooden_frame_dimensions,
        volume: item.volume,
        area: item.area,
        config: item.standard_configuration,
        remarks: item.remarks,
        instructions: item.game_instructions
      })
      row.height = ROW_H
      row.alignment = { vertical: 'middle', wrapText: true }

      // 价格列右对齐
      ;[5, 6, 7].forEach(col => {
        row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' }
      })
      // 序号列居中
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

      // 记录有图片的行，稍后下载并嵌入
      if (item.image_url) {
        imageTasks.push({ rowIndex: idx + 2, url: item.image_url })
      }
    })

    // 边框样式
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
    }
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = thinBorder
      })
    })

    // 并发下载图片并嵌入（最多 5 个并发）
    const CONCURRENCY = 5
    let completed = 0
    for (let i = 0; i < imageTasks.length; i += CONCURRENCY) {
      const batch = imageTasks.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(async ({ rowIndex, url }) => {
        const buf = await fetchImageBuffer(url)
        if (!buf) { completed++; return }
        const ext = url.match(/\.png/i) ? 'png' : 'jpeg'
        const imageId = wb.addImage({ buffer: buf, extension: ext })
        ws.addImage(imageId, {
          tl: { col: IMG_COL - 1 + 0.05, row: rowIndex - 1 + 0.05 },
          ext: { width: IMG_W, height: IMG_H }
        })
        completed++
        exportProgress.value = { ...exportProgress.value, loaded: completed }
      }))
    }

    // 生成文件并下载
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `启迅价格表_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
    URL.revokeObjectURL(link.href)

    ElMessage.success(`导出成功！共 ${allData.length} 条数据`)
  } catch (err) {
    ElMessage.error('导出失败: ' + (err.message || err))
  } finally {
    exportingExcel.value = false
    exportProgress.value = { loaded: 0, total: 0 }
  }
}

// ========== 导出 PDF ==========
const exportPDF = async () => {
  if (total.value === 0) {
    ElMessage.warning('当前没有数据可以导出！')
    return
  }
  exportingPdf.value = true
  exportProgress.value = { loaded: 0, total: 0 }
  try {
    const allData = await fetchAllData()
    if (allData.length === 0) {
      ElMessage.warning('没有可导出的数据！')
      return
    }

    const useCalculatedRate = exchangeRate.value > 0
    const IMG_SIZE = 14 // 图片在 PDF 中的尺寸（pt）

    // 创建 A3 横向 PDF（表格列多，需要更宽页面）
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' })

    // 标题
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Qixun Technology Price List', 42, 36)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(`Date: ${new Date().toISOString().split('T')[0]}`, 42, 52)
    doc.setTextColor(0, 0, 0)

    // 预下载图片
    const imageTasks = []
    allData.forEach((item, idx) => {
      if (item.image_url) {
        imageTasks.push({ rowIndex: idx, url: item.image_url })
      }
    })
    exportProgress.value.total = imageTasks.length
    const imageMap = await downloadImagesConcurrently(imageTasks, (loaded) => {
      exportProgress.value = { ...exportProgress.value, loaded }
    })

    // 构建表格数据
    const headers = [
      '#', 'Equipment Name', 'Equipment Images', 'Specification',
      'Factory Price', 'Price(USD)', 'Price(RMB)',
      'Equipment Dimensions', 'Wooden frame dimensions',
      'Volume', 'Area', 'Standard configuration', 'Remarks', 'Game Instructions'
    ]

    const body = allData.map((item, idx) => {
      const usdPrice = useCalculatedRate && item.price_rmb
        ? Math.ceil(item.price_rmb / exchangeRate.value)
        : item.price_usd
      return [
        idx + 1,
        item.equipment_name,
        '', // 图片通过 didDrawCell 嵌入
        item.specification || '',
        item.factory_price ?? '',
        usdPrice ?? '',
        item.price_rmb ?? '',
        item.equipment_dimensions || '',
        item.wooden_frame_dimensions || '',
        item.volume || '',
        item.area || '',
        item.standard_configuration || '',
        item.remarks || '',
        item.game_instructions || ''
      ]
    })

    // 生成表格
    autoTable(doc, {
      head: [headers],
      body,
      startY: 64,
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: [220, 220, 220],
        lineWidth: 0.3
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7.5
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 22 },
        1: { cellWidth: 80 },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' },
        4: { halign: 'right', cellWidth: 42 },
        5: { halign: 'right', cellWidth: 38 },
        6: { halign: 'right', cellWidth: 40 },
        7: { cellWidth: 55 },
        8: { cellWidth: 55 },
        9: { cellWidth: 38 },
        10: { cellWidth: 32 },
        11: { cellWidth: 50 },
        12: { cellWidth: 65 },
        13: { cellWidth: 80 }
      },
      alternateRowStyles: { fillColor: [247, 250, 252] },
      margin: { left: 20, right: 20 },
      didDrawCell: (data) => {
        // 在图片列（第3列，index=2）嵌入图片
        if (data.section === 'body' && data.column.index === 2) {
          const dataURL = imageMap.get(data.row.index)
          if (dataURL) {
            const x = data.cell.x + (data.cell.width - IMG_SIZE) / 2
            const y = data.cell.y + (data.cell.height - IMG_SIZE) / 2
            doc.addImage(dataURL, 'PNG', x, y, IMG_SIZE, IMG_SIZE)
          }
        }
      }
    })

    // 添加页脚（页码）
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Page ${i} / ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 12,
        { align: 'center' }
      )
    }

    doc.save(`Qixun_PriceList_${new Date().toISOString().split('T')[0]}.pdf`)
    ElMessage.success(`导出成功！共 ${allData.length} 条数据`)
  } catch (err) {
    ElMessage.error('导出失败: ' + (err.message || err))
  } finally {
    exportingPdf.value = false
    exportProgress.value = { loaded: 0, total: 0 }
  }
}

// ========== 生命周期 ==========
onMounted(async () => {
  if (!currentUser.value) {
    ElMessage.warning('请先登录后再查看价格表')
    router.push('/')
    return
  }
  try {
    await fetchPage()
  } catch (e) {
    console.error('加载价格数据失败:', e)
    ElMessage.error('数据加载失败：' + (e.message || e))
    setStatus('error', '加载失败')
    fullscreenLoading.value = false
  }
})
</script>

<style scoped>
.filter-bar {
  margin-bottom: 12px;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-row + .filter-row {
  margin-top: 10px;
}

.exchange-rate-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}

.exchange-rate-hint {
  font-size: 12px;
  color: #909399;
}

.calculated-price {
  color: #e6a23c;
  font-weight: 600;
}

.price-content {
  padding: 16px;
}

.price-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 图片列样式 */
.image-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
}

.image-cell :deep(.el-image) {
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.image-cell :deep(.el-image:hover) {
  transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.image-error,
.image-loading {
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 4px;
  color: #c0c4cc;
}

.image-empty {
  color: #c0c4cc;
  font-size: 14px;
}

/* 表格行样式优化 */
:deep(.price-table-row td) {
  vertical-align: middle;
}

:deep(.el-table) {
  --el-table-row-hover-bg-color: #ecf5ff;
}

@media (max-width: 768px) {
  .price-content {
    padding: 8px;
  }
}
</style>
