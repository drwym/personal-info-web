<template>
  <div class="action-bar">
    <div class="left-group">
      <el-tooltip
        :content="hasSelection ? '删除已勾选的客户数据' : '请先在表格中勾选数据'"
        placement="top"
      >
        <el-button type="danger" :disabled="!hasSelection" @click="$emit('batch-delete')">
          <el-icon><Delete /></el-icon> 批量删除
        </el-button>
      </el-tooltip>
      <el-button type="primary" @click="$emit('export-excel')">
        <el-icon><Download /></el-icon> 导出Excel
      </el-button>
      <el-button type="warning" @click="$emit('export-data')">
        <el-icon><Files /></el-icon> 备份数据
      </el-button>
      <el-upload
        :show-file-list="false"
        accept=".json"
        :before-upload="(file) => $emit('import-data', file)"
      >
        <el-button type="warning" plain>
          <el-icon><Upload /></el-icon> 恢复数据
        </el-button>
      </el-upload>
    </div>
    <div class="right-group">
      <el-button type="success" size="large" @click="$emit('add')">
        <el-icon><Plus /></el-icon> 添加数据
      </el-button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  hasSelection: { type: Boolean, default: false }
})

defineEmits(['batch-delete', 'export-excel', 'export-data', 'import-data', 'add'])
</script>
