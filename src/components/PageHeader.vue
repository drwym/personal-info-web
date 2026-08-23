<template>
  <div class="page-header">
    <div class="page-title-left">
      <el-button v-if="showBack" text @click="$emit('back')" class="back-btn">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <h1 class="page-title">
        {{ title }}
        <el-tag v-if="statusText" :type="statusTagType" effect="light" round size="small">
          {{ statusText }}
        </el-tag>
      </h1>
    </div>
    <div class="user-info">
      <el-avatar :size="32" style="background:#409eff;">{{ (displayUsername || 'U').charAt(0).toUpperCase() }}</el-avatar>
      <span>欢迎，<span class="username">{{ displayUsername }}</span></span>
      <el-button size="small" type="danger" plain @click="$emit('logout')">退出登录</el-button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '客户信息表'
  },
  showBack: {
    type: Boolean,
    default: true
  },
  statusText: String,
  statusTagType: String,
  displayUsername: String
})

const emit = defineEmits(['back', 'logout'])
</script>

<style scoped>
.page-title-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-btn {
  padding: 4px;
  font-size: 18px;
}
</style>
