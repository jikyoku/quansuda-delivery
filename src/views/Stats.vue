<template>
  <div class="stats-page">
    <!-- 今日数据概览 -->
    <div class="stats-overview">
      <div class="overview-card">
        <div class="card-icon">
          <van-icon name="success" size="30" color="#07C160" />
        </div>
        <div class="card-content">
          <div class="card-value">{{ stats.completedCount || 0 }}</div>
          <div class="card-label">已完成单数</div>
        </div>
      </div>
      
      <div class="overview-card">
        <div class="card-icon">
          <van-icon name="clock-o" size="30" color="#FF976A" />
        </div>
        <div class="card-content">
          <div class="card-value">{{ stats.deliveringCount || 0 }}</div>
          <div class="card-label">配送中单数</div>
        </div>
      </div>
      
      <div class="overview-card">
        <div class="card-icon">
          <van-icon name="todo-list" size="30" color="#1989FA" />
        </div>
        <div class="card-content">
          <div class="card-value">{{ stats.pendingCount || 0 }}</div>
          <div class="card-label">待接单数</div>
        </div>
      </div>
      
      <div class="overview-card highlight">
        <div class="card-icon">
          <van-icon name="gold-coin" size="30" color="#1890FF" />
        </div>
        <div class="card-content">
          <div class="card-value">¥{{ stats.todayIncome?.toFixed(2) || '0.00' }}</div>
          <div class="card-label">今日收入</div>
        </div>
      </div>
    </div>
    
    <!-- 统计说明 -->
    <div class="stats-tip">
      <van-icon name="info-o" />
      <span>数据统计范围：当日 00:00 - 23:59</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getTodayStats } from '@/api/delivery'

const stats = ref({})

const loadStats = async () => {
  try {
    const res = await getTodayStats()
    stats.value = res.data
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style lang="scss" scoped>
.stats-page {
  min-height: 100vh;
  background: #F5F5F5;
  padding: 12px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
  
  .overview-card {
    background: #FFFFFF;
    border-radius: 8px;
    padding: 20px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    
    .card-icon {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      background: #F5F5F5;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .card-content {
      flex: 1;
      
      .card-value {
        font-size: 24px;
        font-weight: 600;
        color: #333333;
        margin-bottom: 4px;
      }
      
      .card-label {
        font-size: 12px;
        color: #999999;
      }
    }
    
    &.highlight {
      background: linear-gradient(135deg, #1890FF 0%, #40A9FF 100%);
      
      .card-value {
        color: #FFFFFF;
      }
      
      .card-label {
        color: rgba(255, 255, 255, 0.8);
      }
    }
  }
}

.stats-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #FFFFFF;
  border-radius: 8px;
  font-size: 13px;
  color: #999999;
}
</style>
