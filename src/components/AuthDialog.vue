<template>
  <el-dialog
    :model-value="visible"
    title="登录"
    :width="isMobile ? '94vw' : '380px'"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="auth-dialog"
    align-center
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="auth-error">{{ error }}</div>
    <el-form :model="form" label-position="top" size="large">
      <el-form-item>
        <el-input v-model="form.email" placeholder="邮箱" type="email" autocomplete="email"
                  @keyup.enter="$refs.pwdInput?.focus()"></el-input>
      </el-form-item>
      <el-form-item>
        <el-input ref="pwdInput" v-model="form.password" placeholder="密码（至少6位）" type="password"
                  autocomplete="current-password" show-password
                  @keyup.enter="$emit('login')"></el-input>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" style="width:100%;" :loading="loading" @click="$emit('login')">
          登录
        </el-button>
      </el-form-item>
    </el-form>
  </el-dialog>
</template>

<script setup>
defineProps({
  visible: Boolean,
  error: String,
  loading: Boolean,
  form: Object,
  isMobile: Boolean
})
defineEmits(['login', 'update:visible'])

import { ref } from 'vue'
const pwdInput = ref(null)
</script>
