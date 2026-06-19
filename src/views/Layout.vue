<template>
  <div class="layout">
    <van-nav-bar
      :title="route.meta.title"
      fixed
      placeholder
    >
      <template #left v-if="route.name !== 'Home'">
        <van-icon name="arrow-left" @click="router.back()" />
      </template>
    </van-nav-bar>
    
    <div class="layout-content">
      <router-view />
    </div>
    
    <van-tabbar v-model="activeTab" active-color="#333333" inactive-color="#999999">
      <van-tabbar-item name="home" icon="wap-home" to="/home">工作台</van-tabbar-item>
      <van-tabbar-item name="orders" icon="orders-o" to="/orders">我的订单</van-tabbar-item>
      <van-tabbar-item name="profile" icon="contact" to="/profile">个人中心</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const activeTab = ref('home')

// 根据路由更新tab
watch(() => route.path, (path) => {
  if (path.startsWith('/home')) {
    activeTab.value = 'home'
  } else if (path.startsWith('/orders')) {
    activeTab.value = 'orders'
  } else if (path.startsWith('/profile')) {
    activeTab.value = 'profile'
  }
}, { immediate: true })
</script>

<style lang="scss" scoped>
.layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-content {
  flex: 1;
  overflow-y: auto;
  padding-top: 46px;
  padding-bottom: 50px;
}
</style>
