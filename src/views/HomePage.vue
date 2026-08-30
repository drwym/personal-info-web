<template>
  <div class="dashboard-page">
    <PageHeader
      title="首页看板"
      :status-text="statusText"
      :status-tag-type="statusTagType"
    />

    <div v-loading="loading" class="dashboard-content" element-loading-text="正在加载统计数据...">
      <!-- 加载失败重试 -->
      <el-alert v-if="loadError" :title="loadError" type="error" show-icon style="margin-bottom: 16px;">
        <template #default>
          <el-button size="small" type="danger" plain @click="fetchDashboard">重新加载</el-button>
        </template>
      </el-alert>

      <!-- 用户信息卡片 -->
      <el-card shadow="never" class="user-card">
        <div class="user-card-inner">
          <el-avatar :size="56" style="background:#409eff;flex-shrink:0;">
            {{ (displayUsername || 'U').charAt(0).toUpperCase() }}
          </el-avatar>
          <div class="user-meta">
            <div class="user-greeting">你好，<strong>{{ displayUsername }}</strong></div>
            <div class="user-email">{{ currentUser?.email || '' }}</div>
          </div>
          <div class="user-badge">
            <el-tag type="success" effect="plain" round>已登录</el-tag>
          </div>
        </div>
      </el-card>

      <!-- 统计数字卡片 -->
      <el-row :gutter="16" class="stat-row">
        <el-col :xs="12" :sm="6" v-for="item in statCards" :key="item.label">
          <el-card shadow="never" class="stat-card" :body-style="{ padding: '20px 16px' }">
            <div class="stat-icon" :style="{ background: item.bg }">
              <el-icon :size="22" :color="item.color"><component :is="item.icon" /></el-icon>
            </div>
            <div class="stat-value">{{ item.value }}</div>
            <div class="stat-label">{{ item.label }}</div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 数据分布区 -->
      <el-row :gutter="16" class="dist-row">
        <el-col :xs="24" :sm="12">
          <el-card shadow="never" class="dist-card">
            <template #header>
              <span class="dist-title">🌍 国家 Top 5</span>
            </template>
            <div v-if="countryTop.length === 0" class="dist-empty">暂无数据</div>
            <div v-else class="dist-list">
              <div v-for="(item, idx) in countryTop" :key="item.code" class="dist-item">
                <span class="dist-rank">{{ idx + 1 }}</span>
                <span class="dist-name">{{ item.name }}</span>
                <el-progress
                  :percentage="Math.round((item.count / countryTop[0].count) * 100)"
                  :stroke-width="14"
                  :show-text="false"
                  :color="barColors[idx]"
                  style="flex:1;min-width:60px;"
                />
                <span class="dist-count">{{ item.count }}</span>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-card shadow="never" class="dist-card">
            <template #header>
              <span class="dist-title">📌 来源 Top 5</span>
            </template>
            <div v-if="sourceTop.length === 0" class="dist-empty">暂无数据</div>
            <div v-else class="dist-list">
              <div v-for="(item, idx) in sourceTop" :key="item.name" class="dist-item">
                <span class="dist-rank">{{ idx + 1 }}</span>
                <span class="dist-name">{{ item.name || '未分类' }}</span>
                <el-progress
                  :percentage="Math.round((item.count / sourceTop[0].count) * 100)"
                  :stroke-width="14"
                  :show-text="false"
                  :color="barColors[idx]"
                  style="flex:1;min-width:60px;"
                />
                <span class="dist-count">{{ item.count }}</span>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 最近添加客户 -->
      <el-card shadow="never" class="recent-card">
        <template #header>
          <div class="recent-header">
            <span class="dist-title">🕐 最近添加</span>
            <el-button link type="primary" @click="$router.push('/clients')">查看全部 →</el-button>
          </div>
        </template>
        <div v-if="recentList.length === 0" class="dist-empty">暂无客户数据</div>
        <el-table v-else :data="recentList" size="small" :show-header="true" style="width:100%;">
          <el-table-column prop="userCode" label="编码" width="80" />
          <el-table-column prop="countryName" label="国家" width="100">
            <template #default="{ row }">{{ row.countryName || row.country }}</template>
          </el-table-column>
          <el-table-column prop="company" label="公司" show-overflow-tooltip />
          <el-table-column prop="clientName" label="客户" width="100" show-overflow-tooltip />
          <el-table-column prop="time" label="跟进时间" width="130" />
          <el-table-column prop="status" label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="rowStatusType(row.status)" size="small" effect="plain">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, TABLE_NAME } from '../config/supabase'
import { isoToCn } from '../utils/countryCodeMap'
import { useAuth } from '../composables/useAuth'
import { useStatus } from '../composables/useStatus'
import PageHeader from '../components/PageHeader.vue'

const { currentUser, displayUsername } = useAuth()
const { statusText, statusTagType, setStatus } = useStatus()

// ========== 数据状态 ==========
const loading = ref(false)
const loadError = ref('')
const allRecords = ref([])   // 轻量记录（用于聚合）
const recentList = ref([])   // 最近 5 条（带详情）

const barColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']

// ========== 聚合统计 ==========
const stats = computed(() => {
  const records = allRecords.value
  const total = records.length
  const potential = records.filter(r => r.status === '潜在客户').length
  const focus = records.filter(r => r.status === '重点跟进').length
  const ordered = records.filter(r => r.status === '下单完成').length
  return { total, potential, focus, ordered }
})

const statCards = computed(() => [
  { label: '客户总数', value: stats.value.total, icon: 'User', color: '#409eff', bg: '#ecf5ff' },
  { label: '潜在客户', value: stats.value.potential, icon: 'Star', color: '#1e90ff', bg: '#e8f4ff' },
  { label: '重点跟进', value: stats.value.focus, icon: 'Warning', color: '#f56c6c', bg: '#fef0f0' },
  { label: '下单完成', value: stats.value.ordered, icon: 'CircleCheck', color: '#67c23a', bg: '#f0f9eb' }
])

const countryTop = computed(() => {
  const map = {}
  for (const r of allRecords.value) {
    const code = r.country || '未知'
    map[code] = (map[code] || 0) + 1
  }
  return Object.entries(map)
    .map(([code, count]) => ({ code, name: isoToCn[code] || code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
})

const sourceTop = computed(() => {
  const map = {}
  for (const r of allRecords.value) {
    const src = r.source || '未分类'
    map[src] = (map[src] || 0) + 1
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
})

const rowStatusType = (status) => {
  if (status === '潜在客户') return ''
  if (status === '重点跟进') return 'danger'
  if (status === '下单完成') return 'success'
  return 'info'
}

// ========== 数据加载 ==========
const fetchDashboard = async () => {
  if (!supabase || !currentUser.value) return
  loading.value = true
  loadError.value = ''
  try {
    // 一次轻量查询：聚合统计用（只取必要字段）
    const { data: aggData, error: aggErr } = await supabase
      .from(TABLE_NAME)
      .select('country, source, status')
      .eq('user_id', currentUser.value.id)
    if (aggErr) throw aggErr
    allRecords.value = aggData || []

    // 另一次查询：最近 5 条详情
    const { data: recentData, error: recentErr } = await supabase
      .from(TABLE_NAME)
      .select('user_code, country, company, client_name, follow_time, status')
      .eq('user_id', currentUser.value.id)
      .order('id', { ascending: false })
      .limit(5)
    if (recentErr) throw recentErr
    recentList.value = (recentData || []).map(r => ({
      userCode: r.user_code || '',
      country: r.country || '',
      countryName: isoToCn[r.country] || r.country || '',
      company: r.company || '',
      clientName: r.client_name || '',
      time: r.follow_time || '',
      status: r.status || ''
    }))

    const total = allRecords.value.length
    setStatus('ready', `共 ${total} 条客户数据`)
  } catch (err) {
    console.error('加载看板数据失败:', err)
    loadError.value = '加载数据失败: ' + (err.message || err)
    setStatus('error', '加载失败')
  } finally {
    loading.value = false
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  if (currentUser.value) fetchDashboard()
})
</script>

<style scoped>
.dashboard-page {
  padding: 0;
}

.dashboard-content {
  min-height: 60vh;
}

/* 用户信息卡片 */
.user-card {
  margin-bottom: 16px;
}

.user-card-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-meta {
  flex: 1;
  min-width: 0;
}

.user-greeting {
  font-size: 18px;
  color: #303133;
  margin-bottom: 4px;
}

.user-greeting strong {
  color: #409eff;
}

.user-email {
  font-size: 13px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-badge {
  flex-shrink: 0;
}

/* 统计卡片 */
.stat-row {
  margin-bottom: 16px;
}

.stat-card {
  text-align: center;
  margin-bottom: 0;
  cursor: default;
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

/* 分布区 */
.dist-row {
  margin-bottom: 16px;
}

.dist-card {
  margin-bottom: 0;
}

.dist-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.dist-empty {
  text-align: center;
  color: #c0c4cc;
  padding: 24px 0;
  font-size: 14px;
}

.dist-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dist-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dist-rank {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f0f2f5;
  color: #606266;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dist-name {
  width: 70px;
  flex-shrink: 0;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dist-count {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  flex-shrink: 0;
  min-width: 24px;
  text-align: right;
}

/* 最近添加 */
.recent-card {
  margin-bottom: 16px;
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .user-card-inner {
    flex-wrap: wrap;
  }

  .user-greeting {
    font-size: 16px;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    margin-bottom: 8px;
  }

  .dist-name {
    width: 56px;
    font-size: 12px;
  }
}
</style>
