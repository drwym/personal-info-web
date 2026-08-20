<template>
  <el-dialog
    :model-value="visible"
    title="来源选项管理"
    :width="isMobile ? '94vw' : '480px'"
    :close-on-click-modal="false"
    align-center
    @update:model-value="$emit('update:visible', $event)"
  >
    <div style="margin-bottom:12px;display:flex;gap:10px;align-items:center;">
      <el-button type="success" @click="$emit('add-source')">
        <el-icon><Plus /></el-icon> 添加来源
      </el-button>
      <span style="font-size:12px;color:#909399;">共 {{ sourceOptions.length }} 个来源选项</span>
    </div>
    <el-table
      v-loading="loading"
      :data="sourceOptions"
      stripe
      border
      size="small"
      style="width:100%;"
      empty-text="暂无来源选项"
    >
      <el-table-column type="index" label="序号" width="60" align="center"></el-table-column>
      <el-table-column label="来源名称" prop="name" align="center">
        <template #default="{ row }">
          {{ row.name }}
          <el-tag v-if="row.isGlobal" size="small" type="warning" effect="plain" style="margin-left:4px;">全局</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" :disabled="row.isGlobal" @click="$emit('edit-source', row)">
            <el-icon><Edit /></el-icon> 编辑
          </el-button>
          <el-button link type="danger" size="small" :disabled="row.isGlobal" @click="$emit('delete-source', row)">
            <el-icon><Delete /></el-icon> 删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
defineProps({
  visible: Boolean,
  sourceOptions: Array,
  loading: Boolean,
  isMobile: Boolean
})
defineEmits(['update:visible', 'add-source', 'edit-source', 'delete-source'])
</script>
