<template>
  <el-card class="table-card" shadow="never" body-style="padding:0;">
    <div class="table-wrapper">
      <el-table
        ref="innerTable"
        class="cust-table"
        v-loading="loadingPage"
        :data="pageData"
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
            <span v-else style="color:#c0c4cc;">-</span>
          </template>
        </el-table-column>
        <!-- 4. 国家 (区号) -->
        <el-table-column label="国家" prop="country" :min-width="isMobile ? 80 : 110" align="center" class-name="col-country" header-align="center">
          <template #default="{ row }">
            <div :class="getCountryClass(row.status)">
              {{ row.countryName || row.country }}
              <div class="country-code-sub">({{ row.countryCode || '' }})</div>
            </div>
          </template>
        </el-table-column>
        <!-- 5. 跟进时间 -->
        <el-table-column label="跟进时间" prop="time" :min-width="isMobile ? 95 : 120" align="center" header-align="center" show-overflow-tooltip></el-table-column>
        <!-- 6. 公司 -->
        <el-table-column label="公司" prop="company" :min-width="isMobile ? 100 : 140" align="center" header-align="center" show-overflow-tooltip></el-table-column>
        <!-- 7. 客户名 -->
        <el-table-column label="客户名" prop="clientName" :min-width="isMobile ? 80 : 110" align="center" header-align="center" show-overflow-tooltip></el-table-column>
        <!-- 8. 联系方式 -->
        <el-table-column label="联系方式" prop="phone" :min-width="isMobile ? 100 : 140" align="center" header-align="center" show-overflow-tooltip></el-table-column>
        <!-- 9. 来源 -->
        <el-table-column label="来源" prop="source" :width="isMobile ? 70 : 100" align="center" header-align="center">
          <template #default="{ row }">
            <el-tag v-if="row.source" size="small" effect="plain">{{ row.source }}</el-tag>
            <span v-else style="color:#c0c4cc;">-</span>
          </template>
        </el-table-column>
        <!-- 10. 下单 -->
        <el-table-column label="下单" prop="ord" :width="isMobile ? 60 : 80" align="center" header-align="center">
          <template #default="{ row }">
            <span v-if="row.ord" style="color:#67c23a;">已下单</span>
            <span v-else style="color:#c0c4cc;">-</span>
          </template>
        </el-table-column>
        <!-- 11. 备注 -->
        <el-table-column label="备注" prop="remarks" :min-width="isMobile ? 140 : 200" align="left" header-align="center" class-name="col-remarks">
          <template #default="{ row }">
            <div class="remark-cell">
              <span class="remark-text" @click="$emit('show-remark', row.remarks)">
                {{ row.remarks || '' }}
              </span>
              <div class="edit-link">
                <el-button link type="primary" size="small" @click="$emit('edit', row.id)">
                  <el-icon><Edit /></el-icon> 修改
                </el-button>
              </div>
            </div>
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
import { computed, ref } from 'vue'

const props = defineProps({
  pageData: Array,
  loadingPage: Boolean,
  isMobile: Boolean,
  pagination: Object,
  pageSizes: Array
})

const innerTable = ref(null)
defineExpose({ innerTable })

const emit = defineEmits(['selection-change', 'show-remark', 'edit', 'page-change', 'size-change', 'add'])

const pagerLayout = computed(() => 'sizes, prev, pager, next')

const indexMethod = (index) => {
  return (props.pagination.currentPage - 1) * props.pagination.pageSize + index + 1
}

const getCountryClass = (status) => {
  if (status === '潜在客户') return 'country-potential'
  if (status === '重点跟进') return 'country-focus'
  if (status === '下单完成') return 'country-done'
  return 'country-default'
}
</script>
