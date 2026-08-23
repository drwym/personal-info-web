<template>
  <div v-loading.fullscreen.lock="fullscreenLoading" element-loading-text="正在从云端加载数据...">
    <PageHeader
      title="各国节日日历"
      :display-username="displayUsername"
      @back="$router.push('/')"
      @logout="handleLogout"
    />

    <HolidayCalendar />
  </div>
</template>

<script setup>
import { useAuth } from '../composables/useAuth'
import PageHeader from '../components/PageHeader.vue'
import HolidayCalendar from '../components/HolidayCalendar.vue'

const {
  displayUsername,
  fullscreenLoading,
  handleLogout
} = useAuth()
</script>
