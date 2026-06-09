<template>
  <div class="profile-page">
    <!-- 用户信息卡片 -->
    <div class="user-card">
      <div class="user-avatar">
        <van-icon name="manager" size="50" color="#1890FF" />
      </div>
      <div class="user-info">
        <div class="user-name">{{ userInfo.realName || '配送员' }}</div>
        <div class="user-detail">工号：{{ userInfo.employeeNo || '-' }}</div>
        <div class="user-detail">所属站点：{{ userInfo.stationName || '-' }}</div>
      </div>
    </div>
    
    <!-- 功能列表 -->
    <van-cell-group inset>
      <van-cell title="今日统计" icon="bar-chart-o" is-link @click="goToStats" />
      <van-cell title="我的订单" icon="orders" is-link @click="goToOrders" />
      <van-cell title="修改密码" icon="lock" is-link @click="showPasswordDialog" />
      <van-cell title="健康证信息" icon="certificate" is-link />
    </van-cell-group>
    
    <!-- 退出登录 -->
    <div class="logout-btn">
      <van-button block plain @click="handleLogout">退出登录</van-button>
    </div>
    
    <!-- 修改密码对话框 -->
    <van-dialog
      v-model:show="passwordDialogVisible"
      title="修改密码"
      show-cancel-button
      @confirm="handleChangePassword"
    >
      <van-form>
        <van-cell-group inset>
          <van-field
            v-model="passwordForm.oldPassword"
            type="password"
            label="旧密码"
            placeholder="请输入旧密码"
          />
          <van-field
            v-model="passwordForm.newPassword"
            type="password"
            label="新密码"
            placeholder="请输入新密码"
          />
          <van-field
            v-model="passwordForm.confirmPassword"
            type="password"
            label="确认密码"
            placeholder="请再次输入新密码"
          />
        </van-cell-group>
      </van-form>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const userInfo = userStore.userInfo

const passwordDialogVisible = ref(false)
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const goToStats = () => {
  router.push('/stats')
}

const goToOrders = () => {
  router.push('/orders')
}

const showPasswordDialog = () => {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordDialogVisible.value = true
}

const handleChangePassword = async () => {
  if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    showToast('请填写完整')
    return false
  }
  
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showToast('两次密码输入不一致')
    return false
  }
  
  if (passwordForm.newPassword.length < 6) {
    showToast('密码长度不能少于6位')
    return false
  }
  
  // TODO: 调用修改密码接口
  showToast('密码修改成功')
  passwordDialogVisible.value = false
  return true
}

const handleLogout = async () => {
  try {
    await showDialog({
      title: '确认退出',
      message: '确定要退出登录吗？',
      showCancelButton: true
    })
    userStore.clearUser()
    showToast('已退出登录')
    router.push('/login')
  } catch (error) {
    // 取消退出
  }
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 24px;
}

.user-card {
  background: linear-gradient(135deg, #1890FF 0%, #40A9FF 100%);
  padding: 32px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  
  .user-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .user-info {
    flex: 1;
    
    .user-name {
      font-size: 20px;
      font-weight: 600;
      color: #333333;
      margin-bottom: 8px;
    }
    
    .user-detail {
      font-size: 14px;
      color: #666666;
      margin-bottom: 4px;
    }
  }
}

.logout-btn {
  margin: 32px 12px 12px;
  
  .van-button {
    color: #666666;
    border-color: #DCDFE6;
  }
}
</style>
