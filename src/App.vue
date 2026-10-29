<template>
  <router-view />
</template>

<script setup>
import { useUserStore } from '@/stores/user'
import { locationService } from '@/services/locationService'

const userStore = useUserStore()

// App 冷启动时若本地仍有会话（被杀进程后重开），恢复位置服务的监视/上报，
// 不依赖用户先进入某个页面（BUG-04 生命周期补齐）
if (userStore.token) {
  locationService.bootstrap()
}
</script>

<style lang="scss">
#app {
  width: 100%;
  height: 100vh;
  overflow-y: auto;
}
</style>
