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
        <div class="user-detail">所属供货商：{{ userInfo.supplierName || '-' }}</div>
      </div>
    </div>
    
    <!-- 功能列表 -->
    <van-cell-group inset>
      <van-cell title="今日统计" icon="bar-chart-o" is-link @click="goToStats" />
      <van-cell title="我的订单" icon="orders" is-link @click="goToOrders" />
      <van-cell title="修改密码" icon="lock" is-link @click="showPasswordDialog" />
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
      :before-close="onPasswordDialogBeforeClose"
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
            placeholder="至少10位，含大小写字母和数字"
          />
          <van-field
            v-model="passwordForm.confirmPassword"
            type="password"
            label="确认密码"
            placeholder="请再次输入新密码"
          />
        </van-cell-group>
        <div style="padding: 8px 16px 4px; font-size: 12px; color: #969799; line-height: 1.6;">
          密码规则：长度至少 10 位，且须同时包含大写字母、小写字母和数字。
        </div>
      </van-form>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { showDialog, showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { getProfile, changePassword, deliveryLogout } from '@/api/delivery'
import { locationService } from '@/services/locationService'

const router = useRouter()
const userStore = useUserStore()
// 用 storeToRefs 保持响应式：原来直接取 userStore.userInfo 是快照，
// loadProfile 更新 store 后页面姓名/工号不会刷新
const { userInfo } = storeToRefs(userStore)

const loadProfile = async () => {
  try {
    const res = await getProfile()
    if (res.data) {
      userStore.setUserInfo(res.data)
    }
  } catch (e) {
    console.error('加载个人信息失败:', e)
  }
}

onMounted(() => {
  loadProfile()
})

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

// 修改密码：对话框关闭前真正调用后端改密接口（BUG-01 / XS-06）。
// 校验或接口任何一步失败都返回 false 保持弹窗打开，且不显示成功提示；
// 错误文案由请求层统一提示后端 message。成功后旧会话应失效，强制重新登录。
const onPasswordDialogBeforeClose = async (action) => {
  if (action !== 'confirm') return true

  if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    showToast('请填写完整')
    return false
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showToast('两次密码输入不一致')
    return false
  }
  // 与后端 PasswordPolicy 对齐（V-5）：≥10 位且含大写、小写、数字，
  // 避免弱口令提交后才被后端拒绝
  if (passwordForm.newPassword.length < 10) {
    showToast('新密码长度至少为10位')
    return false
  }
  if (!/[A-Z]/.test(passwordForm.newPassword)
    || !/[a-z]/.test(passwordForm.newPassword)
    || !/\d/.test(passwordForm.newPassword)) {
    showToast('新密码须同时包含大写字母、小写字母和数字')
    return false
  }
  if (passwordForm.newPassword === passwordForm.oldPassword) {
    showToast('新密码不能与旧密码相同')
    return false
  }

  try {
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })
  } catch (error) {
    console.error('修改密码失败:', error)
    return false
  }

  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  showToast('密码修改成功，请重新登录')
  await doLogout()
  return true
}

// 统一登出编排：先停位置服务全部定时器 → 服务端吊销（best-effort）→ 清本地会话 → 跳登录
// 无论服务端吊销成败，本地必须清干净且位置上报必须停止（BUG-02 / XS-08）
const doLogout = async () => {
  locationService.stopAll()
  try {
    await deliveryLogout()
  } catch (error) {
    console.warn('服务端登出失败，仍继续本地退出:', error)
  }
  userStore.clearUser()
  await router.replace('/login')
}

const handleLogout = async () => {
  try {
    await showDialog({
      title: '确认退出',
      message: '确定要退出登录吗？',
      showCancelButton: true
    })
  } catch (error) {
    // 取消退出
    return
  }
  await doLogout()
  showToast('已退出登录')
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
