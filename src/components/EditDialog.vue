<template>
  <el-dialog
    :model-value="visible"
    :title="editingId === null ? '添加客户信息' : '修改客户信息'"
    :width="isMobile ? '94vw' : '520px'"
    :close-on-click-modal="false"
    align-center
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form :model="form" label-width="90px" label-position="right">
      <el-form-item label="用户编码">
        <el-input v-model="form.userCode" :disabled="true" :placeholder="editingId === null ? '自动生成' : ''"></el-input>
      </el-form-item>
      <el-form-item label="国家" required>
        <div style="display:flex;gap:10px;width:100%;">
          <el-select
            v-model="form.country"
            filterable
            allow-create
            default-first-option
            placeholder="输入或选择国家"
            style="flex:1;"
            @change="$emit('update-country-code')"
          >
            <el-option v-for="(info, code) in countryData" :key="code" :label="info.name" :value="code"></el-option>
          </el-select>
          <el-input v-model="form.countryCode" placeholder="区号" readonly style="width:110px;"></el-input>
        </div>
      </el-form-item>
      <el-form-item label="跟进时间" required>
        <el-date-picker v-model="form.time" type="date" placeholder="选择日期"
                        value-format="YYYY-MM-DD" style="width:100%;"></el-date-picker>
      </el-form-item>
      <el-form-item label="公司">
        <el-input v-model="form.company" placeholder="公司名称"></el-input>
      </el-form-item>
      <el-form-item label="客户名">
        <el-input v-model="form.clientName" placeholder="客户姓名"></el-input>
      </el-form-item>
      <el-form-item label="联系方式">
        <el-input v-model="form.phone" placeholder="例如: 13800138000"></el-input>
      </el-form-item>
      <el-form-item label="来源">
        <el-select v-model="form.source" placeholder="请选择来源" style="width:100%;" clearable>
          <el-option v-for="s in sourceList" :key="s" :label="s" :value="s"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="当前状态">
        <el-select v-model="form.status" placeholder="请选择状态" style="width:100%;">
          <el-option label="☆潜在客户" value="潜在客户"></el-option>
          <el-option label="☆重点跟进" value="重点跟进"></el-option>
          <el-option label="☆下单完成" value="下单完成"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="下单">
        <el-checkbox v-model="form.isOrdered">已下单</el-checkbox>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="备注信息"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="$emit('submit')">
        {{ editingId === null ? '确认添加' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
defineProps({
  visible: Boolean,
  editingId: [Number, String, null],
  form: Object,
  countryData: Object,
  sourceList: Array,
  submitLoading: Boolean,
  isMobile: Boolean
})
defineEmits(['submit', 'update:visible', 'update-country-code'])
</script>
