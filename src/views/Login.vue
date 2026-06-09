<template>
  <div class="login-page">
    <div class="login-header">
      <div class="logo">
        <van-icon name="logistics" size="60" color="#1890FF" />
      </div>
      <h1 class="title">泉速达配送端</h1>
      <p class="subtitle">高效配送，服务至上</p>
    </div>
    
    <div class="login-form">
      <van-form @submit="onSubmit">
        <van-cell-group inset>
          <van-field
            v-model="form.phone"
            name="phone"
            placeholder="请输入手机号"
            :rules="[{ required: true, message: '请输入手机号' }]"
          >
            <template #left-icon>
              <van-icon name="phone" size="20" />
            </template>
          </van-field>
          <van-field
            v-model="form.password"
            type="password"
            name="password"
            placeholder="请输入密码"
            :rules="[{ required: true, message: '请输入密码' }]"
          >
            <template #left-icon>
              <van-icon name="lock" size="20" />
            </template>
          </van-field>
        </van-cell-group>
        
        <div class="submit-btn">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            登 录
          </van-button>
        </div>
      </van-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { deliveryLogin } from '@/api/delivery'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)

const form = reactive({
  phone: '',
  password: ''
})

const onSubmit = async () => {
  loading.value = true
  try {
    const res = await deliveryLogin(form)
    userStore.setToken(res.data.token)
    userStore.setUserInfo(res.data)
    showToast('登录成功')
    router.push('/home')
  } catch (error) {
    console.error('登录失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1890FF 0%, #FFFFFF 40%);
  padding: 60px 24px 24px;
}

.login-header {
  text-align: center;
  margin-bottom: 60px;
  
  .logo {
    margin-bottom: 20px;
  }
  
  .title {
    font-size: 28px;
    font-weight: 600;
    color: #333333;
    margin-bottom: 8px;
  }
  
  .subtitle {
    font-size: 14px;
    color: #999999;
  }
}

.login-form {
  .submit-btn {
    margin-top: 32px;
    padding: 0 16px;
  }
}
</style>
