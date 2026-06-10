<template>
  <div class="detail-page" v-if="order">
    <!-- 订单状态 -->
    <div class="status-section">
      <van-tag :type="getStatusTag(order.status)" size="large">
        {{ order.statusName }}
      </van-tag>
      <div class="dispatch-no">{{ order.dispatchNo }}</div>
    </div>

    <!-- 配送进度条（已接单/配送中/已送达） -->
    <div class="section-card" v-if="[2, 3, 6].includes(order.status)">
      <van-steps :active="stepActive" active-color="#1890FF">
        <van-step>已接单</van-step>
        <van-step>配送中</van-step>
        <van-step>已送达</van-step>
      </van-steps>
    </div>

    <!-- 商品信息 -->
    <div class="section-card">
      <div class="section-title">商品信息</div>
      <div class="info-row">
        <span class="label">商品名称</span>
        <span class="value">{{ order.productName }}</span>
      </div>
      <div class="info-row">
        <span class="label">商品规格</span>
        <span class="value">{{ order.productSpec || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="label">派送数量</span>
        <span class="value">{{ order.quantity }}</span>
      </div>
      <div class="info-row">
        <span class="label">单价</span>
        <span class="value">¥{{ order.unitPrice?.toFixed(2) }}</span>
      </div>
      <div class="info-row">
        <span class="label">结算金额</span>
        <span class="value price">¥{{ order.settlementAmount?.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 客户信息 -->
    <div class="section-card">
      <div class="section-title">客户信息</div>
      <div class="info-row">
        <span class="label">客户姓名</span>
        <span class="value">{{ order.customerName || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="label">联系电话</span>
        <span class="value">
          {{ order.customerPhone }}
          <van-button size="mini" type="primary" @click="callPhone">拨打</van-button>
        </span>
      </div>
      <div class="info-row">
        <span class="label">配送地址</span>
        <span class="value address">{{ order.deliveryAddress }}</span>
      </div>
    </div>

    <!-- 时间信息 -->
    <div class="section-card">
      <div class="section-title">时间信息</div>
      <div class="info-row">
        <span class="label">派单时间</span>
        <span class="value">{{ formatTime(order.dispatchTime) }}</span>
      </div>
      <div class="info-row" v-if="order.acceptTime">
        <span class="label">接单时间</span>
        <span class="value">{{ formatTime(order.acceptTime) }}</span>
      </div>
      <div class="info-row" v-if="order.startDeliveryTime">
        <span class="label">开始配送</span>
        <span class="value">{{ formatTime(order.startDeliveryTime) }}</span>
      </div>
      <div class="info-row" v-if="order.completeTime">
        <span class="label">完成时间</span>
        <span class="value">{{ formatTime(order.completeTime) }}</span>
      </div>
    </div>

    <!-- 配送导航地图（有目的地坐标时显示） -->
    <div class="section-card" v-if="hasDestination">
      <div class="section-title">
        {{ order.status === 2 ? '配送导航' : '配送路线' }}
      </div>
      <div class="map-container" id="deliveryMap"></div>
      <!-- 交通工具切换 -->
      <div class="transport-switcher">
        <van-tag
          v-for="t in transportOptions"
          :key="t.value"
          :type="transportMode === t.value ? 'primary' : 'default'"
          size="medium"
          @click="switchTransport(t.value)"
          class="transport-tag"
        >
          <van-icon :name="t.icon" /> {{ t.label }}
        </van-tag>
      </div>
      <div class="map-info">
        <div class="distance-info">
          <van-icon name="location-o" />
          <span v-if="hasLocation && distanceText !== '计算中...'">{{ distanceText }}</span>
          <span v-else-if="hasLocation">正在规划路线...</span>
          <span v-else style="color: #FF9800;">正在获取位置...</span>
        </div>
        <van-button size="small" type="primary" @click="openNavigation">
          打开导航
        </van-button>
      </div>
      <!-- ETA 展示 -->
      <div class="eta-info" v-if="etaText">
        <van-icon name="clock-o" />
        <span>{{ etaText }}</span>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="action-bar" v-if="showActions">
      <!-- status=6: 已派给配送员，待接单 -->
      <template v-if="order.status === 6">
        <van-button block @click="handleReject">拒单</van-button>
        <van-button block type="primary" @click="handleAccept">接单</van-button>
      </template>
      <!-- status=2: 配送中 -->
      <template v-else-if="order.status === 2">
        <van-button block type="success" @click="handleComplete">确认送达</van-button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { getOrderDetail, acceptOrder, rejectOrder, startDelivery, completeOrder, getCurrentLocation } from '@/api/delivery'
import { useLocation } from '@/composables/useLocation'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()
const order = ref(null)

// 使用位置管理 composable
const { currentLng, currentLat, hasLocation, fetchLocation, startReport, stopReport, getLocation } = useLocation()

// 地图相关
const distanceText = ref('计算中...')
let mapInstance = null
let routePolyline = null

// 交通工具选项（只保留汽车和步行）
const transportOptions = [
  { value: 'driving', label: '汽车', icon: 'car' },
  { value: 'walking', label: '步行', icon: 'aim' }
]
// 根据配送员车辆类型确定默认交通工具
const getDefaultTransport = () => {
  const vt = userStore.vehicleType
  if (vt === '汽车') return 'driving'
  // 摩托车、电动车都走汽车路线（因为已删除电动车选项）
  if (vt === '摩托车' || vt === '电动车') return 'driving'
  return 'driving' // 默认汽车
}
const transportMode = ref(getDefaultTransport())

// ETA 预计送达时间
const etaText = ref('')

// 计算属性
const hasDestination = computed(() => {
  return order.value?.destinationLng && order.value?.destinationLat
})

const showActions = computed(() => {
  if (!order.value) return false
  return [2, 6].includes(order.value.status)
})

// 配送进度步骤
const stepActive = computed(() => {
  if (!order.value) return 0
  switch (order.value.status) {
    case 6: return 0  // 已接单（已派给配送员）
    case 2: return 1  // 配送中
    case 3: return 2  // 已送达
    default: return 0
  }
})

// 加载订单详情
const loadDetail = async () => {
  try {
    const res = await getOrderDetail(route.params.id)
    order.value = res.data
    
    // 有目的地坐标就初始化地图（不等定位）
    if (hasDestination.value) {
      nextTick(() => initMap())
    }
    
    // status=6 或 status=2 都启动位置上报
    if ([2, 6].includes(order.value.status)) {
      startReport(order.value.id)
    }
    
    // 异步获取位置并绘制路线（不阻塞地图显示）
    initLocationAndDrawRoute()
  } catch (error) {
    console.error('加载订单详情失败:', error)
  }
}

/**
 * 异步获取位置并绘制路线
 * 优先级：1. 浏览器GPS → 2. 高德IP定位 → 3. 后端最后已知位置 → 4. Store缓存
 */
const initLocationAndDrawRoute = async () => {
  if (!hasDestination.value) return
  const destLng = order.value.destinationLng
  const destLat = order.value.destinationLat
  
  // 1. 尝试浏览器/高德定位
  const success = await fetchLocation()
  if (success) {
    const { lng, lat } = getLocation()
    if (lng && lat) {
      console.log('[OrderDetail] 定位成功，绘制路线:', lng, lat)
      drawRoute(lng, lat, destLng, destLat)
      return
    }
  }
  
  console.warn('[OrderDetail] 浏览器定位失败，尝试后端位置')
  
  // 2. 从后端获取最后已知位置
  try {
    const res = await getCurrentLocation(order.value.id)
    if (res.data && res.data.longitude && res.data.latitude) {
      const lng = Number(res.data.longitude)
      const lat = Number(res.data.latitude)
      console.log('[OrderDetail] 使用后端位置:', lng, lat)
      // 同步到 composable 和 store
      hasLocation.value = true
      currentLng.value = lng
      currentLat.value = lat
      userStore.setCurrentLocation(lng, lat)
      drawRoute(lng, lat, destLng, destLat)
      return
    }
  } catch (err) {
    console.warn('[OrderDetail] 获取后端位置失败:', err)
  }
  
  // 3. 最后尝试 store 缓存
  if (userStore.currentLng && userStore.currentLat) {
    console.log('[OrderDetail] 使用缓存位置')
    drawRoute(userStore.currentLng, userStore.currentLat, destLng, destLat)
    hasLocation.value = true
    return
  }
  
  // 4. 完全没有位置
  console.warn('[OrderDetail] 所有定位方式均失败')
  distanceText.value = '无法获取位置，请检查定位权限'
}

// 初始化地图（以目的地为中心，不等定位）
const initMap = () => {
  const container = document.getElementById('deliveryMap')
  if (!container) return
  if (typeof AMap === 'undefined') {
    console.warn('高德地图API未加载')
    return
  }
  const destLng = order.value.destinationLng
  const destLat = order.value.destinationLat

  // 始终以目的地为中心初始化地图
  mapInstance = new AMap.Map('deliveryMap', {
    zoom: 13,
    center: [destLng, destLat]
  })

  // 目的地标记
  new AMap.Marker({
    map: mapInstance,
    position: [destLng, destLat],
    title: '配送地址',
    label: { content: '配送地址', direction: 'top' }
  })
  
  // 路线绘制由 initLocationAndDrawRoute 异步处理
}

// 绘制路线（使用高德路线规划）
const drawRoute = (fromLng, fromLat, toLng, toLat) => {
  if (!mapInstance) return

  // 移除旧路线
  if (routePolyline) {
    routePolyline.setMap(null)
    routePolyline = null
  }

  // 配送员标记 - 使用自定义图标
  const deliveryIconDataUri = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40"><ellipse cx="16" cy="38" rx="6" ry="2" fill="rgba(0,0,0,0.15)"/><path d="M16 0C10 0 5 5 5 10C5 15 16 28 16 28C16 28 27 15 27 10C27 5 22 0 16 0Z" fill="#1890FF"/><circle cx="16" cy="10" r="4" fill="white"/><path d="M13 9 L19 9 L16 13Z" fill="#1890FF" stroke="white" stroke-width="0.5"/></svg>')
  const deliveryIcon = new AMap.Icon({
    size: new AMap.Size(32, 40),
    image: deliveryIconDataUri,
    imageSize: new AMap.Size(32, 40)
  })
  new AMap.Marker({
    map: mapInstance,
    position: [fromLng, fromLat],
    title: '我的位置',
    icon: deliveryIcon,
    offset: new AMap.Pixel(-16, -40)
  })

  // 根据交通工具选择路线规划方式
  const origin = new AMap.LngLat(fromLng, fromLat)
  const destination = new AMap.LngLat(toLng, toLat)

  let routePlugin = null
  if (transportMode.value === 'driving') {
    routePlugin = new AMap.Driving({ map: null })
  } else {
    // walking
    routePlugin = new AMap.Walking({ map: null })
  }

  routePlugin.search(origin, destination, (status, result) => {
    console.log('[OrderDetail] 路线规划结果:', status, result)
    if (status === 'complete') {
      // 兼容多种返回结构
      // AMap 2.0: result.routes[0] 包含 steps/rides
      // 某些版本: result.data[0] 或 result.routes[0].routes[0]
      let routeData = result.routes?.[0]
      // 如果 routes[0] 内部还有 routes 数组（嵌套结构）
      if (routeData?.routes && Array.isArray(routeData.routes)) {
        routeData = routeData.routes[0]
      }
      // 回退到 data 数组
      if (!routeData) {
        routeData = result.data?.[0]
      }
      console.log('[OrderDetail] 路线数据:', routeData)
      
      if (!routeData) {
        console.warn('路线规划无数据，使用直线')
        drawStraightLine(fromLng, fromLat, toLng, toLat)
        return
      }
      
      const path = []
      // Driving/Walking 都使用 steps[].path[]
      const segments = routeData.steps
      console.log('[OrderDetail] 路段数量:', segments?.length)
      if (segments) {
        segments.forEach((seg) => {
          // step.path 是完整坐标数组，全部添加
          if (seg.path) {
            seg.path.forEach(p => {
              path.push([p.lng, p.lat])
            })
          }
        })
      }
      console.log('[OrderDetail] 路径坐标数:', path.length)
      // 起终点确保在路径中
      if (path.length === 0 || path[0][0] !== fromLng) {
        path.unshift([fromLng, fromLat])
      }
      if (path.length === 0 || path[path.length - 1][0] !== toLng) {
        path.push([toLng, toLat])
      }

      if (path.length > 0) {
        routePolyline = new AMap.Polyline({
          map: mapInstance,
          path: path,
          strokeColor: '#1890FF',
          strokeWeight: 6,
          strokeOpacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
          showDir: true
        })
      }

      // 显示距离、时间和 ETA
      const distance = routeData.distance
      const time = routeData.time
      let distText = distance > 1000 ? (distance / 1000).toFixed(1) + '公里' : Math.round(distance) + '米'
      let timeText = time > 3600 ? (time / 3600).toFixed(1) + '小时' : Math.round(time / 60) + '分钟'
      distanceText.value = distText + ' · 约' + timeText
      
      // 计算 ETA
      const now = new Date()
      const etaTime = new Date(now.getTime() + time * 1000)
      etaText.value = '预计 ' + etaTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + ' 送达'

      mapInstance.setFitView(null, false, [60, 60, 60, 60])
    } else {
      // 路线规划失败，回退到直线
      console.warn('路线规划失败:', status, result)
      drawStraightLine(fromLng, fromLat, toLng, toLat)
    }
  })
}

// 直线回退方案
const drawStraightLine = (fromLng, fromLat, toLng, toLat) => {
  if (!mapInstance) return
  routePolyline = new AMap.Polyline({
    map: mapInstance,
    path: [[fromLng, fromLat], [toLng, toLat]],
    strokeColor: '#1890FF',
    strokeWeight: 4,
    strokeStyle: 'dashed',
    strokeOpacity: 0.8
  })
  const distance = AMap.GeometryUtil.distance(
    [fromLng, fromLat],
    [toLng, toLat]
  )
  distanceText.value = distance > 1000 ? (distance / 1000).toFixed(1) + '公里(直线)' : Math.round(distance) + '米(直线)'
  mapInstance.setFitView(null, false, [50, 50, 50, 50])
}

// 切换交通工具
const switchTransport = (mode) => {
  if (mode === transportMode.value) return
  transportMode.value = mode
  distanceText.value = '计算中...'
  // 重新规划路线
  const { lng: myLng, lat: myLat } = getLocation()
  if (myLng && myLat && hasDestination.value) {
    drawRoute(myLng, myLat, order.value.destinationLng, order.value.destinationLat)
  }
}

// 打开高德导航
const openNavigation = () => {
  if (!hasDestination.value) {
    showToast('缺少目的地坐标信息')
    return
  }
  const destLng = order.value.destinationLng
  const destLat = order.value.destinationLat
  const address = encodeURIComponent(order.value.deliveryAddress || '配送地址')
  let url = `https://uri.amap.com/navigation?to=${destLng},${destLat},${address}&mode=car`
  // 优先使用实时GPS位置
  const { lng: fromLng, lat: fromLat } = getLocation()
  if (fromLng && fromLat) {
    url = `https://uri.amap.com/navigation?from=${fromLng},${fromLat},我的位置&to=${destLng},${destLat},${address}&mode=car`
  }
  window.open(url)
}

// 拨打电话
const callPhone = () => {
  if (order.value?.customerPhone) {
    window.location.href = `tel:${order.value.customerPhone}`
  }
}

// 接单
const handleAccept = async () => {
  try {
    await showDialog({
      title: '确认接单',
      message: `确定要接取订单 ${order.value.dispatchNo} 吗？`,
      showCancelButton: true
    })
    await acceptOrder(order.value.id)
    showToast('接单成功')
    loadDetail()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('接单失败:', error)
    }
  }
}

// 拒单
const handleReject = async () => {
  try {
    await showDialog({
      title: '确认拒单',
      message: '确定要拒绝此订单吗？',
      showCancelButton: true
    })
    await rejectOrder(order.value.id, { reason: '配送员拒单' })
    showToast('已拒单')
    loadDetail()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('拒单失败:', error)
    }
  }
}

// 确认送达
const handleComplete = async () => {
  try {
    await showDialog({
      title: '确认送达',
      message: '确认订单已送达客户？',
      showCancelButton: true
    })
    await completeOrder(order.value.id)
    showToast('已确认送达')
    stopReport()
    loadDetail()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('确认送达失败:', error)
    }
  }
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 状态标签类型
const getStatusTag = (status) => {
  const map = {
    2: 'primary',
    3: 'default',
    6: 'primary',
    7: 'danger'
  }
  return map[status] || 'default'
}

onMounted(() => {
  // 直接加载订单和地图，不等定位
  loadDetail()
})

onUnmounted(() => {
  stopReport()
  if (mapInstance) {
    mapInstance.destroy()
    mapInstance = null
  }
})
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 24px;
}

.status-section {
  background: linear-gradient(135deg, #1890FF 0%, #40A9FF 100%);
  padding: 24px 16px;
  text-align: center;

  .dispatch-no {
    margin-top: 12px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  }
}

.section-card {
  background: #FFFFFF;
  margin: 12px;
  padding: 16px;
  border-radius: 8px;

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: #333333;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #F5F5F5;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;

    .label {
      color: #999999;
      min-width: 80px;
    }

    .value {
      color: #333333;
      flex: 1;
      text-align: right;

      &.price {
        color: #FF6B6B;
        font-weight: 600;
        font-size: 16px;
      }

      &.address {
        text-align: right;
        max-width: 200px;
        word-break: break-all;
      }
    }
  }
}

.action-bar {
  margin: 32px 12px 12px;
  display: flex;
  gap: 12px;
}

.map-container {
  width: 100%;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
}

.transport-switcher {
  display: flex;
  gap: 8px;
  margin-top: 10px;

  .transport-tag {
    cursor: pointer;
    padding: 4px 10px;
    font-size: 13px;

    .van-icon {
      margin-right: 2px;
    }
  }
}

.map-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;

  .distance-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: #333333;
    font-weight: 500;
  }
}

.eta-info {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #1890FF;
  font-weight: 500;
}
</style>
