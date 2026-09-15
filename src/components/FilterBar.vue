<template>
  <el-card class="filter-card" shadow="never">
    <div class="filter-row">
      <div class="filter-group">
        <span class="filter-label">状态筛选：</span>
        <el-radio-group v-model="localStatus" size="small">
          <el-radio-button value="潜在客户" class="rb-primary" @click="toggleStatus('潜在客户')">☆潜在客户</el-radio-button>
          <el-radio-button value="重点跟进" class="rb-danger" @click="toggleStatus('重点跟进')">☆重点跟进</el-radio-button>
          <el-radio-button value="下单完成" class="rb-success" @click="toggleStatus('下单完成')">☆下单完成</el-radio-button>
        </el-radio-group>
      </div>
      <div class="filter-group">
        <span class="filter-label">来源筛选：</span>
        <el-select
          v-model="localSource"
          placeholder="全部来源"
          size="small"
          style="width: 160px;"
          filterable
          clearable
        >
          <el-option
            v-for="s in sourceList"
            :key="s"
            :label="s"
            :value="s"
          ></el-option>
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">国家筛选：</span>
        <el-select
          v-model="localCountry"
          placeholder="全部国家"
          size="small"
          style="width: 160px;"
          filterable
          clearable
        >
          <el-option
            v-for="c in countryList"
            :key="c"
            :label="isoToCn[c] || c"
            :value="c"
          ></el-option>
        </el-select>
      </div>
      <div class="filter-group">
        <span class="filter-label">关键词：</span>
        <el-input
          v-model="localUserCode"
          placeholder="编码/客户名/公司/联系方式/备注"
          size="small"
          style="width: 240px;"
          clearable
          @keyup.enter="$emit('search-user-code')"
          @clear="$emit('search-user-code')"
        >
          <template #append>
            <el-button size="small" @click="$emit('search-user-code')">
              <el-icon><Search /></el-icon>
            </el-button>
          </template>
        </el-input>
      </div>
      <div class="filter-group" style="margin-left:auto;">
        <el-button type="primary" :loading="refreshing" @click="$emit('refresh')">
          <el-icon><Refresh /></el-icon> 刷新数据
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { isoToCn } from '../utils/countryCodeMap'

const props = defineProps({
  currentFilters: Object,
  sourceList: Array,
  countryList: Array,
  refreshing: Boolean
})

const emit = defineEmits(['update:currentFilters', 'search-user-code', 'refresh'])

const localStatus = computed({
  get: () => props.currentFilters.status,
  set: (val) => emit('update:currentFilters', { ...props.currentFilters, status: val })
})

// 再次点击已选中的状态 → 取消选中（清空），恢复查询全部状态
const toggleStatus = (val) => {
  if (props.currentFilters.status === val) {
    emit('update:currentFilters', { ...props.currentFilters, status: '' })
  }
}

const localSource = computed({
  get: () => props.currentFilters.source,
  set: (val) => emit('update:currentFilters', { ...props.currentFilters, source: val })
})

const localCountry = computed({
  get: () => props.currentFilters.country,
  set: (val) => emit('update:currentFilters', { ...props.currentFilters, country: val })
})

const localUserCode = computed({
  get: () => props.currentFilters.userCode,
  set: (val) => emit('update:currentFilters', { ...props.currentFilters, userCode: val })
})
</script>
