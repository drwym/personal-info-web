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
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  showBack: {
    type: Boolean,
    default: false
  },
  statusText: String,
  statusTagType: String
})

defineEmits(['back'])
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
