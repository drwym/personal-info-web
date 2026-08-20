<template>
  <el-dialog
    :model-value="visible"
    :title="editingId === null ? '添加来源' : '编辑来源'"
    :width="isMobile ? '94vw' : '360px'"
    :close-on-click-modal="false"
    append-to-body
    align-center
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form label-width="80px" label-position="right">
      <el-form-item label="来源名称">
        <el-input v-model="localName" placeholder="请输入来源名称" maxlength="30" show-word-limit></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="$emit('submit')">
        {{ editingId === null ? '确认添加' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  editingId: [Number, String, null],
  name: String,
  loading: Boolean,
  isMobile: Boolean
})
const emit = defineEmits(['submit', 'update:visible', 'update:name'])

const localName = computed({
  get: () => props.name,
  set: (val) => emit('update:name', val)
})
</script>
