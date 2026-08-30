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
      <div class="user-card">
        <div class="user-card-deco">
          <div class="deco-circle c1"></div>
          <div class="deco-circle c2"></div>
          <div class="deco-circle c3"></div>
        </div>
        <div class="user-card-inner">
          <el-avatar :size="52" class="user-avatar">
            {{ (displayUsername || 'U').charAt(0).toUpperCase() }}
          </el-avatar>
          <div class="user-meta">
            <div class="user-greeting">你好，<strong>{{ displayUsername }}</strong></div>
            <div class="user-email">{{ currentUser?.email || '' }}</div>
          </div>
          <div class="user-badge">
            <el-tag type="success" effect="dark" round size="small">● 在线</el-tag>
          </div>
        </div>
      </div>

      <!-- 统计数字卡片 -->
      <el-row :gutter="14" class="stat-row">
        <el-col :xs="12" :sm="6" v-for="(item, idx) in statCards" :key="item.label">
          <div class="stat-card" :style="{ '--accent': item.color, animationDelay: idx * 0.08 + 's' }">
            <div class="stat-icon">
              <el-icon :size="20"><component :is="item.icon" /></el-icon>
            </div>
            <div class="stat-value">{{ item.value }}</div>
            <div class="stat-label">{{ item.label }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- 数据分布区 -->
      <el-row :gutter="14" class="dist-row">
        <el-col :xs="24" :sm="12">
          <div class="dist-card">
            <div class="dist-header">
              <span class="dist-header-icon">🌍</span>
              <span class="dist-header-text">国家 Top 5</span>
            </div>
            <div v-if="countryTop.length === 0" class="dist-empty">暂无数据</div>
            <div v-else class="dist-list">
              <div v-for="(item, idx) in countryTop" :key="item.code" class="dist-item">
                <span class="dist-rank" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
                <span class="dist-name">{{ item.name }}</span>
                <div class="dist-bar-track">
                  <div class="dist-bar-fill" :style="{ width: Math.round((item.count / countryTop[0].count) * 100) + '%', background: barColors[idx] }"></div>
                </div>
                <span class="dist-count">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12">
          <div class="dist-card">
            <div class="dist-header">
              <span class="dist-header-icon">📌</span>
              <span class="dist-header-text">来源 Top 5</span>
            </div>
            <div v-if="sourceTop.length === 0" class="dist-empty">暂无数据</div>
            <div v-else class="dist-list">
              <div v-for="(item, idx) in sourceTop" :key="item.name" class="dist-item">
                <span class="dist-rank" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
                <span class="dist-name">{{ item.name || '未分类' }}</span>
                <div class="dist-bar-track">
                  <div class="dist-bar-fill" :style="{ width: Math.round((item.count / sourceTop[0].count) * 100) + '%', background: barColors[idx] }"></div>
                </div>
                <span class="dist-count">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 最近添加客户 -->
      <div class="recent-card">
        <div class="recent-header">
          <div class="recent-header-left">
            <span class="dist-header-icon">🕐</span>
            <span class="dist-header-text">最近添加</span>
          </div>
          <el-button link type="primary" @click="$router.push('/clients')">查看全部 →</el-button>
        </div>
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
      </div>
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
/* ========== 入场动画 ========== */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.dashboard-page {
  padding: 0;
}

.dashboard-content {
  min-height: 60vh;
}

/* ========== 用户信息卡片 ========== */
.user-card {
  background: linear-gradient(135deg, #409eff 0%, #6366f1 50%, #8b5cf6 100%);
  border-radius: 16px;
  padding: 28px 24px;
  margin-bottom: 20px;
  color: #fff;
  position: relative;
  overflow: hidden;
  animation: fadeSlideUp 0.5s ease both;
}

.user-card-deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
}

.deco-circle.c1 {
  width: 180px;
  height: 180px;
  top: -60px;
  right: -30px;
}

.deco-circle.c2 {
  width: 120px;
  height: 120px;
  bottom: -40px;
  right: 80px;
  background: rgba(255, 255, 255, 0.04);
}

.deco-circle.c3 {
  width: 80px;
  height: 80px;
  top: -20px;
  left: 40%;
  background: rgba(255, 255, 255, 0.05);
}

.user-card-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.user-avatar {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(4px);
}

.user-meta {
  flex: 1;
  min-width: 0;
}

.user-greeting {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 4px;
}

.user-greeting strong {
  color: #fff;
  font-weight: 700;
}

.user-email {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-badge {
  flex-shrink: 0;
}

.user-badge :deep(.el-tag) {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
  backdrop-filter: blur(4px);
}

/* ========== 统计卡片 ========== */
.stat-row {
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 22px 16px 18px;
  text-align: center;
  border: 1px solid #eef0f4;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  animation: fadeSlideUp 0.5s ease both;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent, #409eff), color-mix(in srgb, var(--accent, #409eff) 60%, white));
  border-radius: 12px 12px 0 0;
}

.stat-card::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent, #409eff) 6%, transparent), transparent);
  pointer-events: none;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border-color: color-mix(in srgb, var(--accent, #409eff) 20%, #f0f2f5);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  background: color-mix(in srgb, var(--accent, #409eff) 10%, transparent);
  color: var(--accent, #409eff);
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.stat-card:hover .stat-icon {
  transform: scale(1.08);
}

.stat-value {
  font-size: 32px;
  font-weight: 800;
  color: #1a1a2e;
  line-height: 1.2;
  letter-spacing: -0.5px;
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
  position: relative;
  z-index: 1;
}

/* ========== 分布区 ========== */
.dist-row {
  margin-bottom: 20px;
}

.dist-card {
  background: #fff;
  border-radius: 12px;
  padding: 22px;
  border: 1px solid #eef0f4;
  height: 100%;
  transition: all 0.3s ease;
  animation: fadeSlideUp 0.5s ease both;
}

.dist-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.dist-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f2f5;
}

.dist-header-icon {
  font-size: 18px;
}

.dist-header-text {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}

.dist-empty {
  text-align: center;
  color: #c0c4cc;
  padding: 36px 0;
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
  gap: 10px;
  padding: 4px 0;
  border-radius: 6px;
  transition: background 0.2s ease;
}

.dist-item:hover {
  background: #fafbfc;
}

.dist-rank {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #f0f2f5;
  color: #8c8c8c;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dist-rank.rank-1 {
  background: linear-gradient(135deg, #fff7e6, #ffe7ba);
  color: #d48806;
  box-shadow: 0 2px 6px rgba(250, 173, 20, 0.15);
}

.dist-rank.rank-2 {
  background: linear-gradient(135deg, #f0f5ff, #d6e4ff);
  color: #2f54eb;
  box-shadow: 0 2px 6px rgba(47, 84, 235, 0.1);
}

.dist-rank.rank-3 {
  background: linear-gradient(135deg, #f6ffed, #d9f7be);
  color: #389e0d;
  box-shadow: 0 2px 6px rgba(82, 196, 26, 0.1);
}

.dist-name {
  width: 72px;
  flex-shrink: 0;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.dist-bar-track {
  flex: 1;
  height: 10px;
  background: #f5f7fa;
  border-radius: 5px;
  overflow: hidden;
  min-width: 40px;
}

.dist-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 4px;
}

.dist-count {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
  flex-shrink: 0;
  min-width: 28px;
  text-align: right;
}

/* ========== 最近添加 ========== */
.recent-card {
  background: #fff;
  border-radius: 12px;
  padding: 22px;
  border: 1px solid #eef0f4;
  margin-bottom: 20px;
  animation: fadeSlideUp 0.5s ease both;
  transition: all 0.3s ease;
}

.recent-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f2f5;
}

.recent-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 表格行悬停优化 */
.recent-card :deep(.el-table) {
  --el-table-row-hover-bg-color: #f5f7fa;
  border-radius: 8px;
  overflow: hidden;
}

.recent-card :deep(.el-table th.el-table__cell) {
  background: #fafbfc;
  font-weight: 600;
  font-size: 13px;
  color: #606266;
}

.recent-card :deep(.el-table .el-table__body-wrapper) {
  border-radius: 0 0 8px 8px;
}

/* ========== 移动端适配 ========== */
@media (max-width: 768px) {
  .user-card {
    padding: 20px 16px;
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .user-card-inner {
    gap: 12px;
  }

  .user-greeting {
    font-size: 16px;
  }

  .deco-circle.c1 {
    width: 120px;
    height: 120px;
    top: -40px;
    right: -20px;
  }

  .deco-circle.c2 {
    width: 80px;
    height: 80px;
    bottom: -30px;
    right: 50px;
  }

  .deco-circle.c3 {
    display: none;
  }

  .stat-value {
    font-size: 26px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    margin-bottom: 8px;
  }

  .stat-card {
    padding: 16px 12px 14px;
  }

  .dist-card {
    padding: 16px;
    margin-bottom: 0;
  }

  .dist-name {
    width: 56px;
    font-size: 12px;
  }

  .dist-bar-track {
    height: 8px;
  }

  .recent-card {
    padding: 16px;
  }
}
</style>
