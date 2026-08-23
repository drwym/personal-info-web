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
          <el-button
            type="success"
            :icon="Download"
            :loading="exporting"
            @click="exportExcel"
            style="margin-left: auto"
          >
            导出 Excel
          </el-button>
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
        <el-table-column type="index" label="序号" width="60" align="center" fixed />
        <el-table-column prop="equipment_name" label="设备名称" min-width="200" show-overflow-tooltip fixed />
        <!-- 图片列暂时隐藏，待后续迭代启用：image_url 字段已存在于数据结构中 -->
        <!-- <el-table-column prop="image_url" label="产品图片" width="120" align="center">
          <template #default="{ row }">
            <el-image v-if="row.image_url" :src="row.image_url" style="width: 80px; height: 80px" fit="contain" :preview-src-list="[row.image_url]" />
            <span v-else>-</span>
          </template>
        </el-table-column> -->
        <el-table-column prop="specification" label="规格" width="100" align="center" />
        <el-table-column prop="factory_price" label="出厂价(¥)" width="120" align="right">
          <template #default="{ row }">
            {{ row.factory_price ? Number(row.factory_price).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="price_usd" label="美元价(USD)" width="130" align="right">
          <template #default="{ row }">
            <template v-if="exchangeRate > 0 && row.price_rmb">
              <span class="calculated-price">{{ Math.ceil(row.price_rmb / exchangeRate).toLocaleString() }}</span>
            </template>
            <template v-else>
              {{ row.price_usd ? Number(row.price_usd).toLocaleString() : '-' }}
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="price_rmb" label="人民币价(¥)" width="130" align="right">
          <template #default="{ row }">
            {{ row.price_rmb ? Number(row.price_rmb).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="equipment_dimensions" label="设备尺寸" min-width="180" show-overflow-tooltip />
        <el-table-column prop="wooden_frame_dimensions" label="木架尺寸" min-width="200" show-overflow-tooltip />
        <el-table-column prop="volume" label="体积" min-width="160" show-overflow-tooltip />
        <el-table-column prop="area" label="面积" min-width="140" show-overflow-tooltip />
        <el-table-column prop="standard_configuration" label="标准配置" min-width="120" show-overflow-tooltip />
        <el-table-column prop="remarks" label="备注" min-width="220" show-overflow-tooltip />
        <el-table-column prop="game_instructions" label="游戏说明" min-width="280" show-overflow-tooltip />
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
import { Download, Search } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
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

// ========== 导出 Excel ==========
const exporting = ref(false)

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

const exportExcel = async () => {
  if (total.value === 0) {
    ElMessage.warning('当前没有数据可以导出！')
    return
  }
  exporting.value = true
  try {
    const allData = await fetchAllData()
    if (allData.length === 0) {
      ElMessage.warning('没有可导出的数据！')
      return
    }

    const useCalculatedRate = exchangeRate.value > 0

    const header = [
      '序号', '设备名称', '规格', '出厂价(¥)',
      '美元价(USD)', '人民币价(¥)',
      '设备尺寸', '木架尺寸', '体积', '面积',
      '标准配置', '备注', '游戏说明'
    ]

    const rows = allData.map((item, index) => {
      const usdPrice = useCalculatedRate && item.price_rmb
        ? Math.ceil(item.price_rmb / exchangeRate.value)
        : item.price_usd

      return [
        index + 1,
        item.equipment_name,
        item.specification,
        item.factory_price,
        usdPrice,
        item.price_rmb,
        item.equipment_dimensions,
        item.wooden_frame_dimensions,
        item.volume,
        item.area,
        item.standard_configuration,
        item.remarks,
        item.game_instructions
      ]
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = [
      { wch: 6 }, { wch: 35 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 12 },
      { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 16 },
      { wch: 18 }, { wch: 30 }, { wch: 40 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, '启迅价格表')

    XLSX.writeFile(wb, `启迅价格表_${new Date().toISOString().split('T')[0]}.xlsx`)
    ElMessage.success(`导出成功！共 ${allData.length} 条数据`)
  } catch (err) {
    ElMessage.error('导出失败: ' + (err.message || err))
  } finally {
    exporting.value = false
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

@media (max-width: 768px) {
  .price-content {
    padding: 8px;
  }
}
</style>
