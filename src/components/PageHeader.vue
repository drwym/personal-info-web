<template>
  <div class="page-header">
    <h1 class="page-title">
      客户信息表
      <el-tag :type="statusTagType" effect="light" round size="small">
        {{ statusText }}
      </el-tag>
    </h1>
    <div class="user-info">
      <el-avatar :size="32" style="background:#409eff;">{{ (displayUsername || 'U').charAt(0).toUpperCase() }}</el-avatar>
      <span>欢迎，<span class="username">{{ displayUsername }}</span></span>
      <el-button size="small" type="danger" plain @click="$emit('logout')">退出登录</el-button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  statusText: String,
  statusTagType: String,
  displayUsername: String
})
defineEmits(['logout'])
</script>
