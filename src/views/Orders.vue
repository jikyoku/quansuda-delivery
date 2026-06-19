<template>
  <div class="orders-page">
    <van-tabs v-model:active="activeTab" @change="onTabChange" sticky>
      <van-tab title="全部" name="all" />
      <van-tab title="待接单" name="pending" />
      <van-tab title="已接单" name="accepted" />
      <van-tab title="配送中" name="delivering" />
      <van-tab title="已完成" name="completed" />
    </van-tabs>
    
    <!-- 时间筛选器 -->
    <div class="filter-bar">
      <van-cell-group inset>
        <van-cell title="时间筛选" is-link @click="showDatePicker = true">
          <template #default>
            <span class="filter-value">{{ filterLabel }}</span>
          </template>
        </van-cell>
      </van-cell-group>
    </div>
    
    <!-- 快捷选项弹窗 -->
    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <div class="date-picker-popup">
        <div class="picker-header">
          <span>选择时间范围</span>
          <van-icon name="cross" @click="showDatePicker = false" />
        </div>
            
        <!-- 快捷选项 -->
        <div class="quick-options">
          <van-button
            v-for="option in dateOptions"
            :key="option.value"
            size="small"
            :type="dateRange === option.value ? 'primary' : 'default'"
            @click="selectQuickDate(option.value)"
          >
            {{ option.label }}
          </van-button>
        </div>
            
        <div class="picker-footer">
          <van-button block @click="clearDateFilter">清除筛选</van-button>
        </div>
      </div>
    </van-popup>
        
    <!-- 自定义日历弹窗（独立弹窗，不嵌套） -->
    <van-calendar
      v-model:show="showCalendar"
      type="range"
      :min-date="minDate"
      :max-date="maxDate"
      @confirm="onConfirmRangeDate"
      confirm-text="确定"
      confirm-disabled-text="选择范围"
      :range-prompt="rangePrompt"
      allow-same-day
    />
    
    <div class="order-list">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="onLoad"
      >
        <div
          v-for="order in orderList"
          :key="order.id"
          class="order-card"
          @click="goToDetail(order.id)"
        >
          <div class="order-header">
            <span class="order-no">{{ order.dispatchNo }}</span>
            <van-tag :type="getStatusTag(order.status)" size="medium">
              {{ order.statusName }}
            </van-tag>
          </div>
          
          <div class="order-body">
            <div class="product-info">
              <span class="product-name">{{ order.productName }}</span>
              <span class="product-qty">× {{ order.quantity }}</span>
            </div>
            <div class="address-info">
              <van-icon name="location-o" />
              <span>{{ order.deliveryAddress }}</span>
            </div>
            <div class="time-info">
              <span>派单时间：{{ formatTime(order.dispatchTime) }}</span>
            </div>
          </div>
          
          <div class="order-footer">
            <span class="settlement-amount">结算金额：¥{{ order.settlementAmount?.toFixed(2) }}</span>
            <div class="action-btns" v-if="order.status === 6">
              <van-button size="small" @click.stop="handleReject(order)">拒单</van-button>
              <van-button size="small" type="primary" @click.stop="handleAccept(order)">接单</van-button>
            </div>
            <div class="action-btns" v-else-if="order.status === 1">
              <van-button size="small" type="success" @click.stop="handleStartDelivery(order)">开始配送</van-button>
            </div>
            <div class="action-btns" v-else-if="order.status === 2">
              <van-button size="small" type="success" @click.stop="handleComplete(order)">确认送达</van-button>
            </div>
            <div class="action-btns" v-else-if="order.status === 7">
              <van-tag type="danger" size="medium">已拒单</van-tag>
            </div>
          </div>
        </div>
        
        <van-empty v-if="!loading && orderList.length === 0" description="暂无订单" />
      </van-list>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { getOrderList, acceptOrder, rejectOrder, startDelivery, completeOrder } from '@/api/delivery'

const router = useRouter()
const activeTab = ref('all')
const orderList = ref([])
const loading = ref(false)
const finished = ref(false)

// 时间筛选相关
const showDatePicker = ref(false)
const showCalendar = ref(false)
const dateRange = ref('') // 快捷选项：last_month, last_3_months, custom
const customStartDate = ref('')
const customEndDate = ref('')
const minDate = new Date(new Date().getFullYear() - 1, 0, 1) // 最早可选：一年前
const maxDate = new Date()
const rangePrompt = '选择范围不能超过3个月'

const dateOptions = [
  { label: '最近一个月', value: 'last_month' },
  { label: '最近3个月', value: 'last_3_months' },
  { label: '自定义', value: 'custom' }
]

// 筛选显示标签
const filterLabel = computed(() => {
  if (!dateRange.value) return '全部时间'
  if (dateRange.value === 'last_month') return '最近一个月'
  if (dateRange.value === 'last_3_months') return '最近3个月'
  if (dateRange.value === 'custom' && customStartDate.value && customEndDate.value) {
    return `${customStartDate.value} ~ ${customEndDate.value}`
  }
  return '全部时间'
})

// 计算时间参数
const getDateParams = () => {
  const params = {}
  const today = new Date()
  
  if (dateRange.value === 'last_month') {
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 1)
    params.startDate = formatDate(startDate)
    params.endDate = formatDate(today)
  } else if (dateRange.value === 'last_3_months') {
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 3)
    params.startDate = formatDate(startDate)
    params.endDate = formatDate(today)
  } else if (dateRange.value === 'custom' && customStartDate.value && customEndDate.value) {
    params.startDate = customStartDate.value
    params.endDate = customEndDate.value
  }
  
  return params
}

// 格式化日期 yyyy-MM-dd
const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const statusMap = {
  all: null,
  pending: 6,
  accepted: 1,
  delivering: 2,
  completed: 3
}

// 加载订单列表
const onLoad = async () => {
  try {
    const status = statusMap[activeTab.value]
    const params = { ...getDateParams() }
    if (status !== null) {
      params.status = status
    }
    const res = await getOrderList(params)
    orderList.value = res.data
    finished.value = true
  } catch (error) {
    console.error('加载订单失败:', error)
  } finally {
    loading.value = false
  }
}

// Tab切换
const onTabChange = () => {
  orderList.value = []
  finished.value = false
  onLoad()
}

// 选择快捷日期
const selectQuickDate = (value) => {
  dateRange.value = value
  showDatePicker.value = false
  
  if (value === 'custom') {
    // 延迟打开日历，避免弹窗冲突
    setTimeout(() => {
      showCalendar.value = true
    }, 300)
    return
  }
  
  customStartDate.value = ''
  customEndDate.value = ''
  orderList.value = []
  finished.value = false
  onLoad()
}

// 确认区间日期选择
const onConfirmRangeDate = (values) => {
  const [start, end] = values
  const startDateStr = formatDate(start)
  const endDateStr = formatDate(end)
  
  // 前端验证：跨度不超过93天（3个日历月最长92天）
  const startMs = new Date(startDateStr).getTime()
  const endMs = new Date(endDateStr).getTime()
  const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
  
  if (diffDays > 93) {
    showToast('时间跨度不能超过3个月')
    return
  }
  
  customStartDate.value = startDateStr
  customEndDate.value = endDateStr
  dateRange.value = 'custom'
  orderList.value = []
  finished.value = false
  onLoad()
}

// （applyCustomDate 已废弃，日历确认直接在 onConfirmRangeDate 中处理）

// 清除时间筛选
const clearDateFilter = () => {
  dateRange.value = ''
  customStartDate.value = ''
  customEndDate.value = ''
  showDatePicker.value = false
  orderList.value = []
  finished.value = false
  onLoad()
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
    onTabChange()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('接单失败:', error)
    }
  }
}

// 拒单
const handleReject = async (order) => {
  try {
    await showDialog({
      title: '确认拒单',
      message: '确定要拒绝此订单吗？',
      showCancelButton: true
    })
    await rejectOrder(order.id, { reason: '配送员拒单' })
    showToast('已拒单')
    onTabChange()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('拒单失败:', error)
    }
  }
}

// 开始配送
const handleStartDelivery = async (order) => {
  try {
    await showDialog({
      title: '开始配送',
      message: `确定开始配送订单 ${order.dispatchNo} 吗？`,
      showCancelButton: true
    })
    await startDelivery(order.id)
    showToast('已开始配送')
    onTabChange()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('开始配送失败:', error)
    }
  }
}

// 确认送达
const handleComplete = async (order) => {
  try {
    await showDialog({
      title: '确认送达',
      message: `确认订单 ${order.dispatchNo} 已送达？`,
      showCancelButton: true
    })
    await completeOrder(order.id)
    showToast('已确认送达')
    onTabChange()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('确认送达失败:', error)
    }
  }
}

// 跳转详情
const goToDetail = (id) => {
  router.push(`/orders/${id}`)
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 状态标签类型
const getStatusTag = (status) => {
  const map = {
    1: 'warning',   // 已接单
    2: 'primary',   // 配送中
    3: 'default',   // 已完成
    6: 'primary',   // 已派给配送员
    7: 'danger'     // 配送员拒单
  }
  return map[status] || 'default'
}

onMounted(() => {
  onLoad()
})
</script>

<style lang="scss" scoped>
.orders-page {
  min-height: 100vh;
  background: #F5F5F5;
}

.filter-bar {
  padding: 12px 0;
  
  .filter-value {
    color: #1890FF;
    font-weight: 500;
  }
}

.date-picker-popup {
  padding: 24px 16px;
  
  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    font-size: 18px;
    font-weight: 600;
    color: #333333;
    
    .van-icon {
      font-size: 20px;
      color: #999999;
      cursor: pointer;
    }
  }
  
  .quick-options {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    
    .van-button {
      flex: 1;
    }
  }
  
  .picker-footer {
    margin-top: 16px;
  }
}

.order-list {
  padding: 12px;
  
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
      
      .product-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        
        .product-name {
          font-size: 14px;
          color: #333333;
        }
        
        .product-qty {
          font-size: 14px;
          color: #999999;
        }
      }
      
      .address-info {
        display: flex;
        align-items: flex-start;
        gap: 4px;
        margin-bottom: 8px;
        font-size: 13px;
        color: #666666;
      }
      
      .time-info {
        font-size: 12px;
        color: #999999;
      }
    }
    
    .order-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #F5F5F5;
      
      .settlement-amount {
        font-size: 14px;
        color: #FF6B6B;
        font-weight: 600;
      }
      
      .action-btns {
        display: flex;
        gap: 8px;
      }
    }
  }
}
</style>
