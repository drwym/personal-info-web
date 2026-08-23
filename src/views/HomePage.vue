<template>
  <div class="home-page">
    <PageHeader
      title="个人中心"
      :show-back="false"
      :status-text="statusText"
      :status-tag-type="statusTagType"
      :display-username="displayUsername"
      @logout="$emit('logout')"
    />

    <div class="home-cards">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="8" v-for="item in menuItems" :key="item.path">
          <el-card
            class="home-card"
            shadow="hover"
            @click="$router.push(item.path)"
          >
            <div class="home-card-inner">
              <el-icon :size="48" :color="item.color">
                <component :is="item.icon" />
              </el-icon>
              <h3 class="home-card-title">{{ item.title }}</h3>
              <p class="home-card-desc">{{ item.desc }}</p>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import PageHeader from '../components/PageHeader.vue'

defineProps({
  statusText: String,
  statusTagType: String,
  displayUsername: String
})

defineEmits(['logout'])

const menuItems = [
  {
    path: '/clients',
    title: '客户信息表',
    desc: '管理客户数据、筛选与导出',
    icon: 'User',
    color: '#409eff'
  },
  {
    path: '/calendar',
    title: '国家日历',
    desc: '查看各国节假日日历',
    icon: 'Calendar',
    color: '#67c23a'
  },
  {
    path: '/sources',
    title: '来源配置',
    desc: '管理客户来源选项',
    icon: 'Setting',
    color: '#e6a23c'
  },
  {
    path: '/price',
    title: '启迅价格表',
    desc: '查看启迅科技产品价格',
    icon: 'PriceTag',
    color: '#f56c6c'
  }
]
</script>

<style scoped>
.home-page {
  padding: 0;
}

.home-cards {
  margin-top: 24px;
}

.home-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: 20px;
}

.home-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.home-card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
}

.home-card-title {
  margin: 16px 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.home-card-desc {
  margin: 0;
  font-size: 14px;
  color: #909399;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .home-cards {
    margin-top: 16px;
  }

  .home-card-inner {
    padding: 20px 12px;
  }

  .home-card-title {
    font-size: 16px;
  }

  .home-card-desc {
    font-size: 13px;
  }
}
</style>
