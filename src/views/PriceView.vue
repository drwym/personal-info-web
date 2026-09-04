<template>
  <div v-loading.fullscreen.lock="initialLoading" element-loading-text="正在从云端加载数据...">
    <PageHeader
      title="启迅价格表"
      :status-text="statusText"
      :status-tag-type="statusTagType"
    />

    <div class="price-content">
      <div class="filter-bar">
        <div class="filter-row">
          <span class="exchange-rate-label">USD汇率：</span>
          <el-input
            v-model.number="usdExchangeRate"
            placeholder="美元价 = 工厂价 ÷ 汇率"
            style="width: 200px"
            clearable
            type="number"
            :step="0.01"
            :min="0"
          />
          <span class="exchange-rate-label" style="margin-left: 12px">RMB汇率：</span>
          <el-input
            v-model.number="rmbExchangeRate"
            placeholder="人民币价 = 美元价 × 汇率"
            style="width: 200px"
            clearable
            type="number"
            :step="0.01"
            :min="0"
          />
          <span v-if="usdExchangeRate > 0 || rmbExchangeRate > 0" class="exchange-rate-hint">
            {{ usdExchangeRate > 0 ? `美元价 = 工厂价 ÷ ${usdExchangeRate}（向上取整）` : '' }}{{ usdExchangeRate > 0 && rmbExchangeRate > 0 ? '，' : '' }}{{ rmbExchangeRate > 0 ? `人民币价 = 美元价 × ${rmbExchangeRate}（向上取整）` : '' }}
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
            <el-radio-group v-model="pdfPriceMode" size="small">
              <el-radio-button value="usd">USD</el-radio-button>
              <el-radio-button value="rmb">RMB</el-radio-button>
            </el-radio-group>
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
            <template v-if="usdExchangeRate > 0 && row.factory_price">
              <span class="calculated-price">$ {{ Math.ceil(row.factory_price / usdExchangeRate).toLocaleString() }}</span>
            </template>
            <template v-else>
              {{ row.price_usd ? '$ ' + Number(row.price_usd).toLocaleString() : '-' }}
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="price_rmb" label="Price(RMB)" width="130" align="right">
          <template #default="{ row }">
            <template v-if="rmbExchangeRate > 0 && usdExchangeRate > 0 && row.factory_price">
              <span class="calculated-price">¥ {{ Math.ceil(Math.ceil(row.factory_price / usdExchangeRate) * rmbExchangeRate).toLocaleString() }}</span>
            </template>
            <template v-else>
              {{ row.price_rmb ? '¥ ' + Number(row.price_rmb).toLocaleString() : '-' }}
            </template>
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
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, Search, Picture, Loading } from '@element-plus/icons-vue'
import { supabase, PRICE_TABLE_NAME, IMAGE_BUCKET_NAME } from '../config/supabase'
import { useAuth } from '../composables/useAuth'
import { useStatus } from '../composables/useStatus'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()

// ========== Composables ==========
const {
  currentUser,
  fullscreenLoading
} = useAuth()

const { statusText, statusTagType, setStatus } = useStatus()

// ========== 状态 ==========
const initialLoading = ref(true)   // 首次全屏 loading

// ========== 汇率（持久化到 localStorage） ==========
const savedUsdRate = (() => { try { return parseFloat(localStorage.getItem('price-usd-exchange-rate')) || null } catch { return null } })()
const usdExchangeRate = ref(savedUsdRate)
watch(usdExchangeRate, (val) => { if (val) localStorage.setItem('price-usd-exchange-rate', String(val)); else localStorage.removeItem('price-usd-exchange-rate') })
const savedRmbRate = (() => { try { return parseFloat(localStorage.getItem('price-rmb-exchange-rate')) || null } catch { return null } })()
const rmbExchangeRate = ref(savedRmbRate)
watch(rmbExchangeRate, (val) => { if (val) localStorage.setItem('price-rmb-exchange-rate', String(val)); else localStorage.removeItem('price-rmb-exchange-rate') })
const pdfPriceMode = ref('usd') // PDF导出币种选择：'usd' | 'rmb'

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
 *   image_url            → Equipment Images（由产品名 + .jpeg 通过 Supabase Storage 生成临时签名 URL）
 *   specification        → Specification
 *   factory_price        → Factory Price
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

/** 缓存 bucket 中的文件名集合，避免重复 list 请求 */
let imageFileSet = null
const loadImageFileSet = async () => {
  if (imageFileSet) return imageFileSet
  const { data } = await supabase.storage.from(IMAGE_BUCKET_NAME).list('', { limit: 1000 })
  imageFileSet = new Set((data || []).map(f => f.name))
  return imageFileSet
}

/** 根据产品名生成 Supabase Storage 临时签名 URL（兼容 jpeg/png） */
const getProductImageUrl = async (equipmentName) => {
  if (!equipmentName) return ''
  const fileSet = await loadImageFileSet()
  for (const ext of ['jpeg', 'png']) {
    const fileName = `${equipmentName}.${ext}`
    if (!fileSet.has(fileName)) continue
    const { data } = await supabase.storage
      .from(IMAGE_BUCKET_NAME)
      .createSignedUrl(fileName, 3600)
    if (data?.signedUrl) return data.signedUrl
  }
  return ''
}

const mapFromDB = async (row) => ({
  id: row.id,
  equipment_name: row.equipment_name || '',
  image_url: await getProductImageUrl(row.equipment_name),
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
  q = q.order('equipment_name', { ascending: true })
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
    tableData.value = await Promise.all((data || []).map(mapFromDB))
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
  q = q.order('equipment_name', { ascending: true })
  const { data, error } = await q
  if (error) throw error
  return await Promise.all((data || []).map(mapFromDB))
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

const exportExcel = async () => {
  if (total.value === 0) {
    ElMessage.warning('当前没有数据可以导出！')
    return
  }
  exportingExcel.value = true
  exportProgress.value = { loaded: 0, total: 0 }
  try {
    const ExcelJS = (await import('exceljs')).default
    const allData = await fetchAllData()
    if (allData.length === 0) {
      ElMessage.warning('没有可导出的数据！')
      return
    }

    const useUsdRate = usdExchangeRate.value > 0
    const useRmbRate = rmbExchangeRate.value > 0
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

    // 在表头上方插入联系信息行
    const contactLines = [
      'WhatsApp: 008613049108027  WeChat: Qixun116688  Email: jadezeng0802@gmail.com',
      'Add: Qixun Technology, GoldenShield Building, No.46, Shui Lian Avenue, Panyu District, Guangzhou City'
    ]
    // 从后往前插入，保证顺序正确
    for (let i = contactLines.length - 1; i >= 0; i--) {
      ws.spliceRows(1, 0, [contactLines[i]])
      const r = ws.getRow(1)
      r.getCell(1).font = { name: 'Arial', bold: true, size: 10 }
      r.getCell(1).alignment = { vertical: 'middle' }
      r.height = 18
    }

    // 表头样式（联系信息占2行，表头在第3行）
    const headerRow = ws.getRow(3)
    headerRow.font = { name: 'Arial', bold: true, size: 11 }
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
      const usdPrice = useUsdRate && item.factory_price
        ? Math.ceil(item.factory_price / usdExchangeRate.value)
        : item.price_usd
      const rmbPrice = useRmbRate && useUsdRate && item.factory_price
        ? Math.ceil(Math.ceil(item.factory_price / usdExchangeRate.value) * rmbExchangeRate.value)
        : item.price_rmb

      const row = ws.addRow({
        index: idx + 1,
        name: item.equipment_name,
        image: '',  // 图片通过 addImage 嵌入
        spec: item.specification,
        usd: usdPrice,
        rmb: rmbPrice,
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
      ;[4, 5, 6].forEach(col => {
        row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' }
      })
      // 序号列居中
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      // 全局 Arial 字体，价格和尺寸列加粗
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11 }
      })
      ;[5, 6, 7, 8, 9, 10].forEach(col => {
        const cell = row.getCell(col)
        cell.font = { name: 'Arial', size: 11, bold: true }
      })

      // 记录有图片的行，稍后下载并嵌入
      if (item.image_url) {
        imageTasks.push({ rowIndex: idx + 4, url: item.image_url })
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

// ========== 导出 PDF：字体与图片预处理 helper ==========
const PDF_IMG_MAX_EDGE = 400      // 图片降采样最长边（px），控制体积同时保证清晰
const PDF_IMG_QUALITY = 0.88      // JPEG 编码质量
const ARIAL = 'Arial'             // jsPDF 中注册的英文字体家族名
const CJK_FONT_NAME = 'NotoSC'    // 中文兜底字体家族名
const fontCache = {}

/** 读取 public/ 下字体文件并转 base64（带缓存）；校验字体魔数，避免 SPA 回退把 index.html 当字体 */
const loadFontBase64 = async (path) => {
  if (fontCache[path]) return fontCache[path]
  const resp = await fetch(`${import.meta.env.BASE_URL}${path}`)
  if (!resp.ok) throw new Error('missing-font:' + path)
  const bytes = new Uint8Array(await resp.arrayBuffer())
  // 字体魔数：TrueType(00 01 00 00) / CFF('OTTO') / 'true' / 'typ1'；HTML 回退会以 '<' 开头，据此拦截
  const valid =
    (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
    (bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f) ||
    (bytes[0] === 0x74 && bytes[1] === 0x72 && bytes[2] === 0x75 && bytes[3] === 0x65) ||
    (bytes[0] === 0x74 && bytes[1] === 0x79 && bytes[2] === 0x70 && bytes[3] === 0x31)
  if (!valid) throw new Error('invalid-font:' + path)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
  }
  return (fontCache[path] = btoa(bin))
}

/** 内嵌 Arial 度量等价字体 Arimo，注册为家族名 'Arial'。
 *  优先静态 Regular/Bold（可得真实粗体）；缺失则回退可变字体（normal/bold 共用一份，粗体按默认字重、非真实加粗）。 */
const ensureArialFont = async (doc) => {
  const tryLoad = async (p) => { try { return await loadFontBase64(p) } catch { return null } }
  let reg = await tryLoad('fonts/Arimo-Regular.ttf')
  let bold = await tryLoad('fonts/Arimo-Bold.ttf')
  if (!reg || !bold) {
    const variable = await tryLoad('fonts/Arimo-VariableFont_wght.ttf')
    if (!variable) throw new Error('missing-font:Arimo')   // 静态与可变都缺失 → 触发 helvetica 回退
    reg = reg || variable
    bold = bold || variable
  }
  doc.addFileToVFS('Arimo-Regular.ttf', reg)
  doc.addFont('Arimo-Regular.ttf', ARIAL, 'normal')
  if (bold === reg) {
    doc.addFont('Arimo-Regular.ttf', ARIAL, 'bold')   // 复用同一 VFS，避免重复内嵌同一份字体
  } else {
    doc.addFileToVFS('Arimo-Bold.ttf', bold)
    doc.addFont('Arimo-Bold.ttf', ARIAL, 'bold')
  }
}

/** 仅当检测到中文时兜底内嵌 Noto Sans SC */
const ensureCjkFont = async (doc) => {
  const b64 = await loadFontBase64('fonts/NotoSansSC-Regular.ttf')
  doc.addFileToVFS('NotoSansSC-Regular.ttf', b64)
  doc.addFont('NotoSansSC-Regular.ttf', CJK_FONT_NAME, 'normal')
  doc.addFont('NotoSansSC-Regular.ttf', CJK_FONT_NAME, 'bold')
}

/** 将图片 Data URL 降采样为 JPEG（透明区填白防变黑），返回 { data, ratio } */
const downscaleToJpeg = (dataURL) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => {
    const w0 = img.naturalWidth || img.width
    const h0 = img.naturalHeight || img.height
    if (!w0 || !h0) return resolve(null)
    const s = Math.min(1, PDF_IMG_MAX_EDGE / Math.max(w0, h0))
    const cw = Math.max(1, Math.round(w0 * s))
    const ch = Math.max(1, Math.round(h0 * s))
    const c = document.createElement('canvas')
    c.width = cw
    c.height = ch
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cw, ch)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, cw, ch)
    resolve({ data: c.toDataURL('image/jpeg', PDF_IMG_QUALITY), ratio: cw / ch })
  }
  img.onerror = () => resolve(null)
  img.src = dataURL
})

// ========== 导出 PDF ==========
const exportPDF = async () => {
  if (total.value === 0) {
    ElMessage.warning('当前没有数据可以导出！')
    return
  }
  exportingPdf.value = true
  exportProgress.value = { loaded: 0, total: 0 }
  try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ])
    const allData = await fetchAllData()
    if (allData.length === 0) {
      ElMessage.warning('没有可导出的数据！')
      return
    }

    const useUsdRate = usdExchangeRate.value > 0
    const useRmbRate = rmbExchangeRate.value > 0

    // 预下载图片（用于进度显示）
    const imageTasks = allData
      .map((item, idx) => item.image_url ? { rowIndex: idx, url: item.image_url } : null)
      .filter(Boolean)
    exportProgress.value.total = imageTasks.length

    // 预下载图片并降采样为 JPEG（控制体积，保留清晰度；透明区填白防变黑）
    const imageDataMap = new Map()
    const CONCURRENCY = 5
    let completed = 0
    for (let i = 0; i < imageTasks.length; i += CONCURRENCY) {
      const batch = imageTasks.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(async ({ rowIndex, url }) => {
        const dataURL = await fetchImageAsDataURL(url)
        if (dataURL) {
          const scaled = await downscaleToJpeg(dataURL)
          if (scaled) imageDataMap.set(rowIndex, scaled)
        }
        completed++
        exportProgress.value = { ...exportProgress.value, loaded: completed }
      }))
    }

    // 组装表头与表体（图片列留空，由 autoTable 的 didDrawCell 叠加原生 JPEG）
    const fmtPrice = (v) => v != null ? Number(v).toLocaleString() : ''
    const isUSD = pdfPriceMode.value === 'usd'
    const priceSymbol = isUSD ? '$' : '¥'   // PDF价格列币种符号：USD用$，RMB用¥
    const IMG_COL = 2   // 图片列索引（0-based）

    const head = [[
      '#', 'Equipment Name', 'Equipment Images', 'Specification',
      `Price(${isUSD ? 'USD' : 'RMB'})`, 'Equipment Dimensions', 'Wooden frame dimensions',
      'Volume', 'Area', 'Standard configuration', 'Remarks', 'Game Instructions'
    ]]

    const body = allData.map((item, idx) => {
      const usdPrice = isUSD ? (
        useUsdRate && item.factory_price
          ? Math.ceil(item.factory_price / usdExchangeRate.value)
          : item.price_usd
      ) : null
      const rmbPrice = !isUSD ? (
        useRmbRate && useUsdRate && item.factory_price
          ? Math.ceil(Math.ceil(item.factory_price / usdExchangeRate.value) * rmbExchangeRate.value)
          : item.price_rmb
      ) : null
      const priceVal = isUSD ? usdPrice : rmbPrice
      const priceText = priceVal != null ? `${priceSymbol} ${fmtPrice(priceVal)}` : ''
      return [
        idx + 1,
        item.equipment_name || '',
        '',
        item.specification || '',
        priceText,
        item.equipment_dimensions || '',
        item.wooden_frame_dimensions || '',
        item.volume || '',
        item.area || '',
        item.standard_configuration || '',
        item.remarks || '',
        item.game_instructions || ''
      ]
    })

    // 创建 A4 横向 PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // 字体：英文统一用内嵌 Arial（Arimo 度量等价），缺失回退 helvetica；含中文时兜底
    let baseFont = 'helvetica'
    try {
      await ensureArialFont(doc)
      baseFont = ARIAL
    } catch {
      ElMessage.warning('未找到 Arial 字体（public/fonts/Arimo-Regular.ttf 与 Arimo-Bold.ttf），已回退内置 helvetica')
    }
    const CJK_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/
    const hasCJK = allData.some(it => CJK_RE.test(
      `${it.equipment_name} ${it.specification} ${it.remarks} ${it.standard_configuration} ${it.game_instructions} ${it.equipment_dimensions} ${it.wooden_frame_dimensions} ${it.volume} ${it.area}`
    ))
    let bodyFont = baseFont   // 表头/抬头/页码用 baseFont(Arial)；body 默认同，含中文时兜底
    if (hasCJK) {
      try {
        await ensureCjkFont(doc)
        bodyFont = CJK_FONT_NAME
      } catch {
        ElMessage.warning('检测到中文但缺少字体（public/fonts/NotoSansSC-Regular.ttf），中文可能显示异常')
      }
    }

    const pageW = doc.internal.pageSize.getWidth()   // 297mm
    const pageH = doc.internal.pageSize.getHeight()  // 210mm
    const marginX = 6

    // 首页品牌抬头（logo + 标题居中、联系信息、地址、日期）
    const logoH = 10  // logo 高度 mm
    const logoW = logoH * 1.5  // 15mm
    const gap = 4  // logo 与标题间距 mm
    doc.setFontSize(14)
    doc.setFont(baseFont, 'bold')
    const titleText = 'Qixun Technology Price List'
    const titleW = doc.getTextWidth(titleText)
    const groupW = logoW + gap + titleW
    const groupX = (pageW - groupW) / 2  // 整体居中起始 X

    try {
      const logoResp = await fetch(`${import.meta.env.BASE_URL}logo.png`)
      const logoBlob = await logoResp.blob()
      const logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(logoBlob)
      })
      doc.addImage(logoBase64, 'PNG', groupX, 3, logoW, logoH)
    } catch (e) { /* logo 加载失败时忽略 */ }
    doc.text(titleText, groupX + logoW + gap, 9)

    // 联系信息（标题下方，表格上方）
    doc.setFontSize(9)
    doc.setFont(baseFont, 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('WhatsApp: 008613049108027  WeChat: Qixun116688  Email: jadezeng0802@gmail.com', marginX, 15)
    doc.text('Add: Qixun Technology, GoldenShield Building, No.46, Shui Lian Avenue, Panyu District, Guangzhou City', marginX, 20)

    doc.setFontSize(8)
    doc.setFont(baseFont, 'normal')
    doc.setTextColor(130, 130, 130)
    doc.text(`Date: ${new Date().toISOString().split('T')[0]}`, pageW / 2, 25, { align: 'center' })
    doc.setTextColor(0, 0, 0)

    // autoTable：矢量文字 + 原生图片，自动分页并每页重复表头
    autoTable(doc, {
      startY: 28,
      head,
      body,
      margin: { top: 12, right: marginX, bottom: 14, left: marginX },
      theme: 'grid',
      rowPageBreak: 'avoid',   // 行不跨页：整行放不下时整体移到下一页，宁可每页行数少
      styles: { font: bodyFont, fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', valign: 'middle' },
      headStyles: { font: baseFont, fontStyle: 'bold', fontSize: 9, halign: 'center', fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [247, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 30, halign: 'center' },   // 图片列加宽，产品图展示更大
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 26 },
        6: { cellWidth: 30 },
        7: { cellWidth: 16 },
        8: { cellWidth: 15 },
        9: { cellWidth: 22 },
        10: { cellWidth: 28 },
        11: { cellWidth: 42 }
      }, // 合计 285mm
      didParseCell: (d) => {
        if (d.section !== 'body') return
        if (d.column.index === IMG_COL && imageDataMap.has(d.row.index)) d.cell.styles.minCellHeight = 22   // 抬高图片行，给产品图更多纵向空间
        if (d.column.index === 3 || d.column.index === 4) d.cell.styles.fontStyle = 'bold'
      },
      didDrawCell: (d) => {
        if (d.section !== 'body' || d.column.index !== IMG_COL) return
        const im = imageDataMap.get(d.row.index)
        if (!im) return
        const boxW = d.cell.width - 3, boxH = d.cell.height - 3   // 留 1.5mm padding
        let w = boxW, h = w / im.ratio
        if (h > boxH) { h = boxH; w = h * im.ratio }               // contain 等比缩放
        const x = d.cell.x + (d.cell.width - w) / 2
        const y = d.cell.y + (d.cell.height - h) / 2
        d.doc.addImage(im.data, 'JPEG', x, y, w, h, undefined, 'FAST')
      }
    })

    // 页码脚注（autoTable 完成后统一补）
    const n = doc.getNumberOfPages()
    for (let p = 1; p <= n; p++) {
      doc.setPage(p)
      doc.setFont(baseFont, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(160, 160, 160)
      doc.text(`Page ${p} / ${n}`, pageW / 2, pageH - 5, { align: 'center' })
    }
    doc.setTextColor(0, 0, 0)

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
  } finally {
    initialLoading.value = false
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
