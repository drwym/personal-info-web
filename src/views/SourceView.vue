<template>
  <div v-loading.fullscreen.lock="fullscreenLoading" element-loading-text="正在从云端加载数据...">
    <PageHeader title="来源配置" />

    <el-card shadow="never" style="margin-top: 16px;">
      <div class="source-toolbar">
        <el-button type="success" @click="openSourceForm()">
          <el-icon><Plus /></el-icon> 添加来源
        </el-button>
        <span class="source-count">共 {{ sourceOptions.length }} 个来源选项</span>
      </div>

      <el-table
        v-loading="sourceLoading"
        :data="sourceOptions"
        stripe
        border
        size="small"
        style="width: 100%;"
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
            <el-button link type="primary" size="small" :disabled="row.isGlobal" @click="openSourceForm(row)">
              <el-icon><Edit /></el-icon> 编辑
            </el-button>
            <el-button link type="danger" size="small" :disabled="row.isGlobal" @click="deleteSourceOption(row)">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 来源添加/编辑弹窗 -->
    <SourceFormDialog
      :visible="sourceFormVisible"
      :editing-id="sourceEditingId"
      :name="sourceFormName"
      :loading="sourceLoading"
      :is-mobile="isMobile"
      @submit="submitSourceForm"
      @update:visible="sourceFormVisible = $event"
      @update:name="sourceFormName = $event"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { supabase, SOURCE_TABLE_NAME } from '../config/supabase'
import { useAuth } from '../composables/useAuth'
import { useResponsive } from '../composables/useResponsive'
import { useSourceOptions } from '../composables/useSourceOptions'
import PageHeader from '../components/PageHeader.vue'
import SourceFormDialog from '../components/SourceFormDialog.vue'

const { currentUser, fullscreenLoading } = useAuth()
const { isMobile } = useResponsive()
const { sourceOptions, sourceLoading, fetchSourceOptions } = useSourceOptions()

// ========== 来源表单 ==========
const sourceFormVisible = ref(false)
const sourceEditingId = ref(null)
const sourceFormName = ref('')

const openSourceForm = (item = null) => {
  if (item) {
    sourceEditingId.value = item.id
    sourceFormName.value = item.name
  } else {
    sourceEditingId.value = null
    sourceFormName.value = ''
  }
  sourceFormVisible.value = true
}

const submitSourceForm = async () => {
  const name = sourceFormName.value.trim()
  if (!name) { ElMessage.warning('请输入来源名称'); return }
  if (!sourceEditingId.value && sourceOptions.value.some(o => o.name === name)) {
    ElMessage.warning('该来源已存在'); return
  }
  sourceLoading.value = true
  try {
    if (sourceEditingId.value) {
      const { error } = await supabase.from(SOURCE_TABLE_NAME).update({ name }).eq('id', sourceEditingId.value)
      if (error) throw error
      ElMessage.success('修改来源成功')
    } else {
      const maxSort = sourceOptions.value.length > 0
        ? Math.max(...sourceOptions.value.map(o => o.sortOrder)) + 1 : 1
      const { error } = await supabase.from(SOURCE_TABLE_NAME)
        .insert([{ user_id: currentUser.value.id, name, sort_order: maxSort, is_global: false }])
      if (error) throw error
      ElMessage.success('添加来源成功')
    }
    sourceFormVisible.value = false
    sourceEditingId.value = null
    sourceFormName.value = ''
    await fetchSourceOptions(currentUser.value.id)
  } catch (err) {
    ElMessage.error('操作失败: ' + (err.message || err))
  } finally {
    sourceLoading.value = false
  }
}

const deleteSourceOption = async (item) => {
  try {
    await ElMessageBox.confirm(`确定要删除来源「${item.name}」吗？`, '删除确认', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
    sourceLoading.value = true
    const { error } = await supabase.from(SOURCE_TABLE_NAME).delete().eq('id', item.id)
    if (error) throw error
    ElMessage.success('删除成功')
    await fetchSourceOptions(currentUser.value.id)
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败: ' + (err.message || err))
  } finally {
    sourceLoading.value = false
  }
}

// ========== 生命周期 ==========
onMounted(async () => {
  if (currentUser.value) {
    await fetchSourceOptions(currentUser.value.id)
  }
})
</script>

<style scoped>
.source-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.source-count {
  font-size: 12px;
  color: #909399;
}
</style>
