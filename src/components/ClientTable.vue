<template>
  <el-card class="table-card" shadow="never" body-style="padding:0;">
    <div class="table-wrapper" ref="wrapperRef">
      <!-- 移动端卡片列表 -->
      <div v-if="isMobile" v-loading="loadingPage" class="mobile-card-list">
        <div v-if="pageData.length === 0" class="mobile-card-empty">
          <el-empty description="暂无客户数据">
            <el-button type="primary" size="small" @click="$emit('add')">
              <el-icon><Plus /></el-icon> 添加第一条数据
            </el-button>
          </el-empty>
        </div>
        <div v-for="(row, idx) in pageData" :key="row.id" class="client-card">
          <div class="card-header">
            <el-checkbox
              :model-value="isSelected(row)"
              aria-label="选择该客户"
              @change="toggleSelect(row)"
            />
            <span class="card-index">{{ indexMethod(idx) }}</span>
            <span class="card-code">{{ row.userCode || '-' }}</span>
            <span class="card-country" :class="getCountryClass(row.status)">
              {{ row.countryName || row.country }}
              <span v-if="row.countryCode" class="country-code-sub">({{ row.countryCode }})</span>
            </span>
            <span v-if="row.ord" class="cell-ordered card-ordered">已下单</span>
          </div>
          <div class="card-body">
            <div class="card-field">
              <span class="card-label">公司</span>
              <span class="card-value">{{ row.company || '-' }}</span>
            </div>
            <div class="card-field">
              <span class="card-label">客户名</span>
              <span class="card-value">{{ row.clientName || '-' }}</span>
            </div>
            <div class="card-field">
              <span class="card-label">联系方式</span>
              <span class="card-value">{{ row.phone || '-' }}</span>
            </div>
            <div class="card-field">
              <span class="card-label">跟进时间</span>
              <span class="card-value">{{ row.time || '-' }}</span>
            </div>
            <div class="card-field card-field-full">
              <span class="card-label">来源</span>
              <span class="card-value">
                <el-tag v-if="row.source" size="small" effect="plain">{{ row.source }}</el-tag>
                <span v-else class="cell-placeholder">-</span>
              </span>
            </div>
          </div>
          <div v-if="row.remarks" class="card-remark" @click="$emit('show-remark', row.remarks)">
            <span class="card-label">备注</span>{{ row.remarks }}
          </div>
          <div class="card-footer">
            <el-button link type="primary" size="small" @click="$emit('edit', row.id)">
              <el-icon><Edit /></el-icon> 修改
            </el-button>
            <el-button link type="danger" size="small" @click="$emit('delete', row.id)">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </div>
        </div>
      </div>
      <!-- 桌面端表格 -->
      <el-table
        v-else
        ref="innerTable"
        class="cust-table"
        v-loading="loadingPage"
        :data="pageData"
        :height="tableHeight"
        :span-method="spanMethod"
        stripe
        border
        :size="isMobile ? 'small' : 'default'"
        style="width: 100%;"
        empty-text="暂无客户数据"
        @selection-change="$emit('selection-change', $event)"
      >
        <!-- 空状态 -->
        <template #empty>
          <el-empty description="暂无客户数据">
            <el-button type="primary" size="small" @click="$emit('add')">
              <el-icon><Plus /></el-icon> 添加第一条数据
            </el-button>
          </el-empty>
        </template>
        <!-- 1. 复选框 -->
        <el-table-column type="selection" :width="isMobile ? 38 : 50" align="center"></el-table-column>
        <!-- 2. 序号 -->
        <el-table-column type="index" label="序号" :width="isMobile ? 44 : 60" align="center" header-align="center" :index="indexMethod"></el-table-column>
        <!-- 3. 用户编码 -->
        <el-table-column label="用户编码" prop="userCode" :min-width="isMobile ? 80 : 110" align="center" header-align="center" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.userCode">{{ row.userCode }}</span>
            <span v-else class="cell-placeholder">-</span>
          </template>
        </el-table-column>
        <!-- 4. 公司 -->
        <el-table-column label="公司" prop="company" :min-width="isMobile ? 100 : 140" align="center" header-align="center" show-overflow-tooltip></el-table-column>
        <!-- 5. 国家 (区号) -->
        <el-table-column label="国家" prop="country" :min-width="isMobile ? 80 : 110" align="center" class-name="col-country" header-align="center" show-overflow-tooltip>
          <template #default="{ row }">
            <div :class="getCountryClass(row.status)">
              {{ row.countryName || row.country }}
              <span class="country-code-sub">({{ row.countryCode || '' }})</span>
            </div>
          </template>
        </el-table-column>
        <!-- 6. 跟进时间 -->
        <el-table-column label="跟进时间" prop="time" :min-width="isMobile ? 95 : 120" align="center" header-align="center" show-overflow-tooltip></el-table-column>
        <!-- 7. 客户名 -->
        <el-table-column label="客户名" prop="clientName" :min-width="isMobile ? 80 : 110" align="center" header-align="center" show-overflow-tooltip></el-table-column>
        <!-- 8. 联系方式 -->
        <el-table-column label="联系方式" prop="phone" :min-width="isMobile ? 100 : 140" align="center" header-align="center" show-overflow-tooltip></el-table-column>
        <!-- 9. 来源 -->
        <el-table-column label="来源" prop="source" :width="isMobile ? 70 : 100" align="center" header-align="center">
          <template #default="{ row }">
            <el-tag v-if="row.source" size="small" effect="plain">{{ row.source }}</el-tag>
            <span v-else class="cell-placeholder">-</span>
          </template>
        </el-table-column>
        <!-- 10. 下单 -->
        <el-table-column label="下单" prop="ord" :width="isMobile ? 60 : 80" align="center" header-align="center">
          <template #default="{ row }">
            <span v-if="row.ord" class="cell-ordered">已下单</span>
            <span v-else class="cell-placeholder">-</span>
          </template>
        </el-table-column>
        <!-- 11. 备注 -->
        <el-table-column label="备注" prop="remarks" :min-width="isMobile ? 140 : 200" align="left" header-align="center" class-name="col-remarks">
          <template #default="{ row }">
            <span class="remark-text" @click="$emit('show-remark', row.remarks)">
              {{ row.remarks || '' }}
            </span>
          </template>
        </el-table-column>
        <!-- 12. 操作 -->
        <el-table-column label="操作" :width="isMobile ? 110 : 140" align="center" header-align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$emit('edit', row.id)">
              <el-icon><Edit /></el-icon> 修改
            </el-button>
            <el-button link type="danger" size="small" @click="$emit('delete', row.id)">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <!-- 分页 -->
    <div class="pagination-wrapper" :class="{ 'mobile-pager': isMobile }">
      <el-pagination
        :current-page="pagination.currentPage"
        :page-size="pagination.pageSize"
        :page-sizes="pageSizes"
        :total="pagination.total"
        :page-count="Math.max(1, Math.ceil(pagination.total / pagination.pageSize))"
        :layout="pagerLayout"
        :small="isMobile"
        :pager-count="isMobile ? 5 : 7"
        background
        @current-change="$emit('page-change', $event)"
        @size-change="$emit('size-change', $event)"
      ></el-pagination>
    </div>
  </el-card>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  pageData: Array,
  loadingPage: Boolean,
  isMobile: Boolean,
  pagination: Object,
  pageSizes: Array
})

const innerTable = ref(null)
defineExpose({ innerTable })

// 桌面端表格高度自适应：测得容器像素高度后绑定给 el-table，实现表体内部滚动
const wrapperRef = ref(null)
const tableHeight = ref(undefined)
let resizeObserver = null

const updateHeight = () => {
  if (props.isMobile) {
    tableHeight.value = undefined
    return
  }
  const h = wrapperRef.value?.clientHeight
  if (h) tableHeight.value = h
}

onMounted(() => {
  updateHeight()
  if (typeof ResizeObserver !== 'undefined' && wrapperRef.value) {
    resizeObserver = new ResizeObserver(() => updateHeight())
    resizeObserver.observe(wrapperRef.value)
  }
})

watch(() => props.isMobile, updateHeight)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

const emit = defineEmits(['selection-change', 'show-remark', 'edit', 'delete', 'page-change', 'size-change', 'add'])

// 移动端卡片模式多选：维护本地选中集合并同步 selection-change，行为与表格勾选一致
const mobileSelected = ref([])
const isSelected = (row) => mobileSelected.value.some(r => r.id === row.id)
const toggleSelect = (row) => {
  mobileSelected.value = isSelected(row)
    ? mobileSelected.value.filter(r => r.id !== row.id)
    : [...mobileSelected.value, row]
  emit('selection-change', mobileSelected.value)
}
watch(() => props.pageData, () => {
  if (mobileSelected.value.length) {
    mobileSelected.value = []
    emit('selection-change', mobileSelected.value)
  }
})

const pagerLayout = computed(() => 'sizes, prev, pager, next')

const indexMethod = (index) => {
  return (props.pagination.currentPage - 1) * props.pagination.pageSize + index + 1
}

// 按公司分组合并单元格：对用户编码、公司两列合并相邻同 user_code 的行
const spanMethod = ({ row, column, rowIndex }) => {
  if (column.property !== 'userCode' && column.property !== 'company') return
  const data = props.pageData
  const key = row.userCode
  if (!key) return { rowspan: 1, colspan: 1 }
  if (rowIndex > 0 && data[rowIndex - 1].userCode === key) return { rowspan: 0, colspan: 0 }
  let span = 1
  for (let i = rowIndex + 1; i < data.length && data[i].userCode === key; i++) span++
  return { rowspan: span, colspan: 1 }
}

const getCountryClass = (status) => {
  if (status === '潜在客户') return 'country-potential'
  if (status === '重点跟进') return 'country-focus'
  if (status === '下单完成') return 'country-done'
  return 'country-default'
}
</script>

<style scoped>
.cell-placeholder { color: var(--text-placeholder); }
.cell-ordered { color: var(--status-done); }

/* ========== 移动端卡片列表 ========== */
.mobile-card-list {
  min-height: 240px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mobile-card-empty { padding: 24px 0; }
.client-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: var(--radius-md, 8px);
  padding: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #ebeef5;
  flex-wrap: wrap;
}
.card-index {
  font-size: 11px;
  color: #909399;
  flex-shrink: 0;
}
.card-code {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  flex-shrink: 0;
}
.card-country {
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-ordered {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.card-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  padding: 10px 0;
}
.card-field {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  min-width: 0;
}
.card-field-full { grid-column: 1 / -1; }
.card-label {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}
.card-value {
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-remark {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 8px 0 0;
  border-top: 1px dashed #ebeef5;
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.card-remark:active { color: var(--app-primary, #409eff); }
.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding-top: 8px;
  margin-top: 2px;
  border-top: 1px solid #f0f2f5;
}
.card-footer .el-button { padding: 4px 6px; }

@media (min-width: 769px) {
  .table-wrapper {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}
</style>
