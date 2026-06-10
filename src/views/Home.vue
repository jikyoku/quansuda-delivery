<template>
  <div class="home-page">
    <!-- 在线状态卡片 -->
    <div class="status-card">
      <div class="status-header">
        <span class="status-label">当前状态</span>
        <van-switch
          v-model="isOnline"
          active-color="#07C160"
          inactive-color="#CCCCCC"
          @change="onStatusChange"
        />
      </div>
      <div class="status-text">{{ isOnline ? '在线接单中' : '已离线' }}</div>
    </div>
    
    <!-- 今日数据卡片 -->
    <div class="stats-card">
      <div class="stats-title">今日数据</div>
      <div class="stats-grid">
        <div class="stats-item">
          <div class="stats-value">{{ stats.completedCount || 0 }}</div>
          <div class="stats-label">已完成</div>
        </div>
        <div class="stats-item">
          <div class="stats-value">{{ stats.deliveringCount || 0 }}</div>
          <div class="stats-label">配送中</div>
        </div>
        <div class="stats-item">
          <div class="stats-value">{{ stats.pendingCount || 0 }}</div>
          <div class="stats-label">待接单</div>
        </div>
        <div class="stats-item">
          <div class="stats-value">¥{{ stats.todayIncome?.toFixed(2) || '0.00' }}</div>
          <div class="stats-label">今日收入</div>
        </div>
      </div>
    </div>
    
    <!-- 待接单列表 -->
    <div class="pending-section">
      <div class="section-header">
        <span class="section-title">待接单</span>
        <van-tag type="primary" round>{{ pendingOrders.length }}</van-tag>
      </div>
      
      <div v-if="pendingOrders.length === 0" class="empty-tip">
        <van-empty description="暂无待接订单" />
      </div>
      
      <div v-else class="order-list">
        <div
          v-for="order in pendingOrders"
          :key="order.id"
          class="order-card"
          @click="goToDetail(order.id)"
        >
          <div class="order-header">
            <span class="order-no">{{ order.dispatchNo }}</span>
            <van-tag type="primary" size="medium">待接单</van-tag>
          </div>
          <div class="order-body">
            <div class="order-info">
              <div class="info-row">
                <span class="label">商品：</span>
                <span class="value">{{ order.productName }} × {{ order.quantity }}</span>
              </div>
              <div class="info-row">
                <span class="label">结算：</span>
                <span class="value price">¥{{ order.settlementAmount?.toFixed(2) }}</span>
              </div>
              <div class="info-row">
                <span class="label">地址：</span>
                <span class="value">{{ order.deliveryAddress }}</span>
              </div>
            </div>
          </div>
          <div class="order-actions">
            <van-button size="small" @click.stop="handleReject(order)">拒单</van-button>
            <van-button size="small" type="primary" @click.stop="handleAccept(order)">接单</van-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { getTodayStats, getOrderList, acceptOrder, rejectOrder, updateOnlineStatus } from '@/api/delivery'
import { useUserStore } from '@/stores/user'
import { useLocation } from '@/composables/useLocation'

const router = useRouter()
const userStore = useUserStore()
const { fetchLocation, startGlobalReport, stopGlobalReport } = useLocation()
const isOnline = ref(userStore.userInfo.onlineStatus === 1)
const stats = ref({})
const orders = ref([])

const pendingOrders = computed(() => {
  return orders.value.filter(order => order.status === 6)
})

// 加载数据
const loadData = async () => {
  try {
    const [statsRes, ordersRes] = await Promise.all([
      getTodayStats(),
      getOrderList({ status: 6 })
    ])
    stats.value = statsRes.data
    orders.value = ordersRes.data
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

// 在线状态切换
const onStatusChange = async (value) => {
  try {
    await updateOnlineStatus(value ? 1 : 0)
    const info = { ...userStore.userInfo, onlineStatus: value ? 1 : 0 }
    userStore.setUserInfo(info)
    showToast(value ? '已上线，开始接单' : '已离线')
    // 上线时启动全局位置上报，离线时停止
    if (value) {
      startGlobalReport()
    } else {
      stopGlobalReport()
    }
  } catch (error) {
    console.error('切换在线状态失败:', error)
    isOnline.value = !value // 回滚状态
  }
}

// 接单
const handleAccept = async (order) => {
  try {
    await showDialog({
      title: '确认接单',
      message: `确定要接取订单 ${order.dispatchNo} 吗？`
    })
    await acceptOrder(order.id)
    showToast('接单成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('接单失败:', error)
    }
  }
}

// 拒单
const handleReject = async (order) => {
  try {
    const result = await showDialog({
      title: '拒单原因',
      message: '请输入拒单原因',
      showCancelButton: true,
      showConfirmButton: false,
      beforeClose: (action) => {
        if (action === 'confirm') {
          return false
        }
        return true
      }
    })
  } catch (error) {
    if (error !== 'cancel') {
      console.error('拒单失败:', error)
    }
  }
}

// 跳转订单详情
const goToDetail = (id) => {
  router.push(`/orders/${id}`)
}

onMounted(async () => {
  await loadData()
  // 获取配送员当前位置
  await fetchLocation()
  // 如果已在线，启动全局位置上报
  if (isOnline.value) {
    startGlobalReport()
  }
})
</script>

<style lang="scss" scoped>
.home-page {
  padding: 12px;
}

.status-card {
  background: linear-gradient(135deg, #1890FF 0%, #40A9FF 100%);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  
  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    
    .status-label {
      font-size: 16px;
      font-weight: 600;
      color: #333333;
    }
  }
  
  .status-text {
    font-size: 14px;
    color: #666666;
  }
}

.stats-card {
  background: #FFFFFF;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  
  .stats-title {
    font-size: 16px;
    font-weight: 600;
    color: #333333;
    margin-bottom: 16px;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    
    .stats-item {
      text-align: center;
      
      .stats-value {
        font-size: 20px;
        font-weight: 600;
        color: #1890FF;
        margin-bottom: 4px;
      }
      
      .stats-label {
        font-size: 12px;
        color: #999999;
      }
    }
  }
}

.pending-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #333333;
    }
  }
  
  .order-list {
    .order-card {
      background: #FFFFFF;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      
      .order-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #F5F5F5;
        
        .order-no {
          font-size: 14px;
          font-weight: 600;
          color: #333333;
        }
      }
      
      .order-body {
        margin-bottom: 12px;
        
        .order-info {
          .info-row {
            display: flex;
            margin-bottom: 8px;
            font-size: 14px;
            
            .label {
              color: #999999;
              min-width: 50px;
            }
            
            .value {
              color: #333333;
              flex: 1;
              
              &.price {
                color: #FF6B6B;
                font-weight: 600;
              }
            }
          }
        }
      }
      
      .order-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    }
  }
  
  .empty-tip {
    background: #FFFFFF;
    border-radius: 8px;
    padding: 40px 0;
  }
}
</style>
