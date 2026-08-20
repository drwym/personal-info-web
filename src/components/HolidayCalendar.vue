<template>
  <div class="holiday-calendar-wrapper" v-loading="loading" element-loading-text="正在加载节日数据...">
    <!-- 顶部工具栏 -->
    <div class="calendar-toolbar">
      <el-button text @click="$emit('back')">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
      <div class="calendar-title">{{ currentYear }}年 {{ currentMonth }}月节日</div>
      <el-select
        v-model="selectedCountries"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        placeholder="选择国家"
        style="width: 260px;"
        @change="onCountryChange"
      >
        <el-option
          v-for="code in HOLIDAY_COUNTRY_CODES"
          :key="code"
          :label="isoToCn[code] || code"
          :value="code"
        />
      </el-select>
      <div class="calendar-nav">
        <el-button size="small" @click="prevMonth">
          <el-icon><ArrowLeft /></el-icon> 上月
        </el-button>
        <el-button size="small" @click="goToday">今天</el-button>
        <el-button size="small" @click="nextMonth">
          下月 <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 进度提示 -->
    <div v-if="fetchProgress" class="fetch-progress">
      <el-icon class="is-loading"><Loading /></el-icon>
      {{ fetchProgress }}
    </div>

    <!-- 错误提示 -->
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="calendar-error" />

    <!-- 日历网格 -->
    <div class="calendar-grid">
      <!-- 星期表头（固定不滚动） -->
      <div class="calendar-header-row">
        <div class="weekday-header" v-for="(day, idx) in weekDays" :key="idx" :style="{ background: weekdayColors[idx] }">
          {{ day }}
        </div>
      </div>

      <!-- 每行日期（独立横向滚动） -->
      <div class="calendar-row-wrapper" v-for="(row, ri) in calendarRows" :key="ri">
        <div class="calendar-row">
          <div
            v-for="(cell, ci) in row"
            :key="ci"
            class="calendar-cell"
            :class="{ 'is-other-month': !cell.isCurrentMonth, 'is-today': cell.isToday }"
          >
            <template v-if="cell.isCurrentMonth">
              <div class="cell-date">{{ cell.day }}</div>
              <div class="cell-holidays">
                <div
                  v-for="(h, hi) in getHolidays(cell.day)"
                  :key="hi"
                  class="holiday-item"
                  :class="{ 'is-truncated': getHolidays(cell.day).length > maxVisible && hi >= maxVisible && !isCellExpanded(currentYear, currentMonth, cell.day) }"
                >
                  <span class="holiday-country">{{ h.country }}</span>
                  <span class="holiday-sep">·</span>
                  <span class="holiday-name">{{ h.name }}</span>
                </div>
                <div
                  v-if="getHolidays(cell.day).length > maxVisible && !isCellExpanded(currentYear, currentMonth, cell.day)"
                  class="expand-hint"
                  @click="toggleExpand(currentYear, currentMonth, cell.day)"
                >
                  +{{ getHolidays(cell.day).length - maxVisible }} 更多
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive } from 'vue'
import { ArrowLeft, ArrowRight, Loading } from '@element-plus/icons-vue'
import { useHolidays } from '../composables/useHolidays'
import { HOLIDAY_COUNTRY_CODES, isoToCn } from '../utils/countryCodeMap'

const emit = defineEmits(['back'])

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)
const selectedCountries = ref(['CN', 'US', 'JP', 'KR', 'GB', 'DE', 'FR'])

const { holidaysByDay, loading, error, fetchProgress, loadHolidays } = useHolidays()

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const weekdayColors = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#2980b9'
]

const maxVisible = 3

// 用 reactive Map 追踪每个格子的展开状态（key: "year-month-day"）
const expandedCells = reactive({})

const getExpandedKey = (year, month, day) => `${year}-${month}-${day}`

const isCellExpanded = (year, month, day) => {
  return !!expandedCells[getExpandedKey(year, month, day)]
}

const toggleExpand = (year, month, day) => {
  const key = getExpandedKey(year, month, day)
  expandedCells[key] = !expandedCells[key]
}

// 计算日历格子（一维）
const calendarCells = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay() // 0=日

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`

  const cells = []

  // 上月填充
  const prevLastDay = new Date(year, month - 1, 0).getDate()
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: prevLastDay - i, isCurrentMonth: false, isToday: false })
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDateStr = `${year}-${month}-${d}`
    cells.push({
      day: d,
      isCurrentMonth: true,
      isToday: cellDateStr === todayStr
    })
  }

  // 下月填充
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, isCurrentMonth: false, isToday: false })
    }
  }

  return cells
})

// 按行分组（二维数组，每行 7 个格子）
const calendarRows = computed(() => {
  const cells = calendarCells.value
  const rows = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
})

const getHolidays = (day) => {
  return holidaysByDay.value[day] || []
}

const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentYear.value--
    currentMonth.value = 12
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentYear.value++
    currentMonth.value = 1
  } else {
    currentMonth.value++
  }
}

const goToday = () => {
  const today = new Date()
  currentYear.value = today.getFullYear()
  currentMonth.value = today.getMonth() + 1
}

const onCountryChange = () => {
  loadHolidays(currentYear.value, currentMonth.value, selectedCountries.value)
}

watch([currentYear, currentMonth], ([y, m]) => {
  loadHolidays(y, m, selectedCountries.value)
})

onMounted(() => {
  loadHolidays(currentYear.value, currentMonth.value, selectedCountries.value)
})
</script>
