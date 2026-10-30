<template>
  <div class="detail-page" v-if="order">
    <!-- 订单状态 -->
    <div class="status-section">
      <van-tag :type="getStatusTag(order.status)" size="large">
        {{ order.statusName }}
      </van-tag>
      <div class="dispatch-no">{{ order.dispatchNo }}</div>
    </div>

    <!-- 审核驳回提示 -->
    <div class="section-card reject-notice" v-if="order.status === 10">
      <van-icon name="warning-o" color="#ee0a24" />
      <span class="reject-title">平台审核驳回</span>
      <div class="reject-reason">驳回原因：{{ order.reviewRemark || '未说明' }}</div>
      <div class="reject-tip">请根据驳回原因调整后重新提交</div>
    </div>

    <!-- 审核中提示 -->
    <div class="section-card review-notice" v-if="order.status === 9">
      <van-icon name="clock-o" color="#ff976a" />
      <span>凭证已提交，等待平台审核，请耐心等待</span>
    </div>

    <!-- 配送进度条（已接单/配送中/已送达/审核） -->
    <div class="section-card" v-if="[2, 3, 6, 8, 9, 10].includes(order.status)">
      <van-steps :active="stepActive" active-color="#1890FF">
        <van-step>已接单</van-step>
        <van-step>配送中</van-step>
        <van-step>已送达</van-step>
        <van-step>平台审核</van-step>
      </van-steps>
    </div>

    <!-- 商品信息 -->
    <div class="section-card">
      <div class="section-title">商品信息</div>
      <div class="info-row">
        <span class="label">商品名称</span>
        <span class="value">{{ order.skuName || order.productName }}</span>
      </div>
      <div class="info-row" v-if="order.productSpec">
        <span class="label">商品规格</span>
        <span class="value">{{ order.productSpec }}</span>
      </div>
      <div class="info-row" v-if="order.packageType">
        <span class="label">包装类型</span>
        <span class="value">{{ order.packageType }}</span>
      </div>
      <div class="info-row">
        <span class="label">派送数量</span>
        <span class="value">{{ order.quantity }}</span>
      </div>
      <div class="info-row" v-if="order.dispatchReason">
        <span class="label">备注</span>
        <span class="value remark-value">{{ order.dispatchReason }}</span>
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
        <span class="label">供货商接单</span>
        <span class="value">{{ formatTime(order.acceptTime) }}</span>
      </div>
      <div class="info-row" v-if="order.deliveryAcceptTime">
        <span class="label">配送员接单</span>
        <span class="value">{{ formatTime(order.deliveryAcceptTime) }}</span>
      </div>
      <div class="info-row" v-if="order.startDeliveryTime">
        <span class="label">开始配送</span>
        <span class="value">{{ formatTime(order.startDeliveryTime) }}</span>
      </div>
      <div class="info-row" v-if="order.completeTime">
        <span class="label">完成时间</span>
        <span class="value">{{ formatTime(order.completeTime) }}</span>
      </div>
      <div class="info-row" v-if="order.borrowBucketCount > 0">
        <span class="label">借桶数量</span>
        <span class="value">{{ order.borrowBucketCount }}个</span>
      </div>
      <div class="info-row" v-if="order.returnBucketCount > 0">
        <span class="label">还桶数量</span>
        <span class="value">{{ order.returnBucketCount }}个</span>
      </div>
    </div>

    <!-- 桶借还管理（仅配送中显示） -->
    <div class="section-card" v-if="showBucketSection">
      <div class="section-title">
        <van-icon name="bag-o" /> 桶借还管理
      </div>
      <div class="bucket-info">
        <div class="bucket-item">
          <div class="bucket-label">本次借桶数量</div>
          <van-stepper
            v-model="borrowQuantity"
            :min="0"
            :max="maxBorrowQuantity"
            theme="round"
            button-size="28px"
            input-width="60px"
            @change="handleBorrowQuantityChange"
          />
          <div class="bucket-hint">客户需要借用的空桶数量（最多{{ maxBorrowQuantity }}个）</div>
        </div>
        <div class="bucket-item">
          <div class="bucket-label">本次还桶数量</div>
          <van-stepper
            v-model="returnQuantity"
            :min="0"
            :max="99"
            theme="round"
            button-size="28px"
            input-width="60px"
          />
          <div class="bucket-hint">客户归还的空桶数量</div>
        </div>
      </div>
    </div>

    <!-- 配送导航地图（有目的地坐标且未送达时显示） -->
    <div class="section-card" v-if="hasDestination && order.status !== 3">
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

    <!-- 配送完成凭证（配送中可上传，已完成后只读查看） -->
    <div class="section-card proof-photo-section" v-if="showProofPhotoSection">
      <div class="section-title">
        <van-icon name="photograph" /> 配送完成凭证
        <span class="proof-required-tag" v-if="!isProofReadonly">必填</span>
      </div>
      <div class="proof-photo-tip" v-if="!isProofReadonly">
        <van-icon name="info-o" />
        <span>请上传配送完成的现场照片或客户签收凭证，完成后需提交凭证才能确认送达</span>
      </div>
      <!-- 配送中：使用 uploader 可上传 -->
      <van-uploader
        v-if="!isProofReadonly"
        v-model="proofPhotoList"
        :max-count="MAX_PHOTOS"
        :max-size="10 * 1024 * 1024"
        accept="image/*"
        :deletable="true"
        :show-upload="true"
        :after-read="handleAfterRead"
        @delete="handleDelete"
        @oversize="handleOversize"
      />
      <!-- 已完成：只读模式，用img展示，点击触发预览 -->
      <div class="proof-readonly-grid" v-else-if="completedPhotoCount > 0">
        <img
          v-for="(photo, index) in proofPhotoList"
          :key="photo.attachmentId || index"
          :src="photo.url"
          class="proof-thumb"
          @click="handleClickPreview(index)"
        />
      </div>
      <div class="proof-photo-count">
        已上传 <span class="count-num">{{ completedPhotoCount }}</span> / {{ MAX_PHOTOS }} 张
        <span class="count-hint" v-if="!isProofReadonly && !hasProofPhotos">（至少上传1张）</span>
        <span class="count-tip" v-if="isProofReadonly && completedPhotoCount > 0">（点击图片可放大查看）</span>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="action-bar" v-if="showActions">
      <!-- status=6: 已派给配送员，待接单 -->
      <template v-if="order.status === 6">
        <van-button block @click="handleReject">拒单</van-button>
        <van-button block type="primary" @click="handleAccept">接单</van-button>
      </template>
      <!-- status=8: 配送员已接单，等待开始配送 -->
      <template v-else-if="order.status === 8">
        <van-button block type="success" @click="handleStartDelivery">开始配送</van-button>
      </template>
      <!-- status=2: 配送中 -->
      <template v-else-if="order.status === 2">
        <van-button 
          block 
          type="success" 
          :disabled="!hasProofPhotos"
          @click="handleComplete"
        >
          确认送达
        </van-button>
        <div class="action-tip" v-if="!hasProofPhotos">
          <van-icon name="warning-o" /> 请先上传配送完成凭证
        </div>
      </template>
      <!-- status=10: 审核驳回，可重新提交 -->
      <template v-else-if="order.status === 10">
        <van-button 
          block 
          type="warning" 
          :disabled="!hasProofPhotos"
          @click="handleComplete"
        >
          重新提交凭证
        </van-button>
        <div class="action-tip" v-if="!hasProofPhotos">
          <van-icon name="warning-o" /> 请先上传配送完成凭证
        </div>
      </template>
    </div>

    <!-- 确认送达弹窗：必须上传客户签收凭证后才能提交 -->
    <van-dialog
      v-model:show="completeDialogVisible"
      title="确认送达"
      :show-confirm-button="false"
      close-on-click-overlay
    >
      <div class="complete-dialog-content">
        <div class="complete-tip">
          <van-icon name="info-o" />
          <span>请客户签收后，上传现场签收凭证（至少1张），确认送达后才能提交</span>
        </div>
        <div class="complete-proof-upload">
          <van-uploader
            v-model="proofPhotoList"
            :max-count="MAX_PHOTOS"
            :max-size="10 * 1024 * 1024"
            accept="image/*"
            :after-read="handleAfterRead"
            @delete="handleDelete"
            @oversize="handleOversize"
          />
          <div class="proof-photo-count">
            已上传 <span class="count-num">{{ completedPhotoCount }}</span> / {{ MAX_PHOTOS }} 张
            <span class="count-hint" v-if="!hasProofPhotos">（至少上传1张）</span>
            <span class="count-tip" v-else>（点击图片可放大查看）</span>
          </div>
        </div>
        <div class="complete-bucket-info" v-if="borrowQuantity > 0 || returnQuantity > 0">
          <div class="bucket-line">本次借桶：<b>{{ borrowQuantity }}</b> 个　本次还桶：<b>{{ returnQuantity }}</b> 个</div>
        </div>
      </div>
      <template #footer>
        <van-button @click="completeDialogVisible = false">取消</van-button>
        <van-button type="primary" :disabled="!hasProofPhotos" :loading="completing" @click="completeDialogConfirm">
          确认送达
        </van-button>
      </template>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showDialog, showToast, showImagePreview } from 'vant'
import { getOrderDetail, acceptOrder, rejectOrder, startDelivery, completeOrder, getCurrentLocation, uploadProofPhoto, getProofPhotos, deleteProofPhoto, fetchProofPhoto } from '@/api/delivery'
import { useLocation } from '@/composables/useLocation'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()
const order = ref(null)

// 桶借还数量
const borrowQuantity = ref(0)
const returnQuantity = ref(0)
const completeDialogVisible = ref(false)
const completing = ref(false)

// 配送完成凭证
const proofPhotoList = ref([])
const proofPhotoLoading = ref(false)
const MAX_PHOTOS = 9

// 待上传文件缓存（处理竞态：用户选图早于订单数据加载完成）
const pendingUploadFiles = ref([])
const processingUpload = ref(false)
let pendingRetryTimer = null
let pageDisposed = false

// 处理待上传文件的核心函数
const processUploadFiles = async (fileList) => {
  for (const file of fileList) {
    try {
      const rawFile = file.file || file
      if (!(rawFile instanceof Blob)) {
        console.warn('[handleAfterRead] rawFile is not a Blob:', typeof rawFile, rawFile)
        continue
      }
      file.status = 'uploading'
      file.message = '上传中'
      
      const res = await uploadProofPhoto(order.value.id, rawFile)

      // 后端必须回 attachmentId 才算真上传成功：否则 hasProofPhotos 会误判、
      // 且该文件删除时无 ID 可删，前后端状态从此不一致
      if (!res.data?.attachmentId) {
        throw new Error('上传响应缺少 attachmentId')
      }
      file.status = 'done'
      file.message = ''
      file.attachmentId = res.data.attachmentId
      file.fileName = res.data.fileName
      file.fileSize = res.data.fileSize
      // 确保 objectUrl 存在（Vant 通常在 after-read 前已设置，但兜底再设一次）
      if (!file.objectUrl && rawFile instanceof Blob) {
        file.objectUrl = URL.createObjectURL(rawFile)
      }
      // 同时设置 url 属性，确保 Vant 预览正常
      if (!file.url && file.objectUrl) {
        file.url = file.objectUrl
      }
    } catch (error) {
      console.error('[handleAfterRead] upload failed:', error)
      file.status = 'failed'
      file.message = '上传失败'
      showToast('上传失败，请重试')
    }
  }
}

// 待上传文件的统一消费入口（V-6 竞态修复）：watch 触发与 3 秒兜底重试
// 都必须走这里，由 processingUpload 守卫串行化——任一路径进入时先置位、
// 先把缓存整体摘走再处理，另一路径看到守卫或空缓存即退出，
// 同一文件不会被两条路径各上传一次。
const drainPendingUploads = async () => {
  if (pageDisposed || !order.value || processingUpload.value || pendingUploadFiles.value.length === 0) {
    return
  }
  processingUpload.value = true
  const files = [...pendingUploadFiles.value]
  pendingUploadFiles.value = []
  console.log('[drainPendingUploads] processing', files.length, 'pending files')
  try {
    await processUploadFiles(files)
  } finally {
    processingUpload.value = false
  }
}

// 当 order 变为可用时，自动处理缓存的待上传文件
watch(order, (newVal) => {
  if (newVal) {
    drainPendingUploads()
  }
})

// 计算最大借桶数量（不能超过订单商品总量）
const maxBorrowQuantity = computed(() => {
  return order.value?.quantity || 0
})

// 使用位置管理 composable
const { currentLng, currentLat, hasLocation, fetchLocation, startReport, stopReport, getLocation, setKnownLocation, refreshActiveDispatches } = useLocation()

// 地图相关
const distanceText = ref('计算中...')
let mapInstance = null
let routePolyline = null
let deliveryMarker = null
// 路线规划插件实例复用（V-6）：Driving/Walking 每次 new 都会注册内部回调与
// 结果渲染器，不销毁会随重绘次数累积；改为每种模式各持一个单例，重绘前
// clear 上次结果，组件卸载时清理并置空。
let drivingService = null
let walkingService = null

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
  return [2, 6, 8, 10].includes(order.value.status)
})

// 是否显示桶借还板块（仅配送中显示）
const showBucketSection = computed(() => {
  if (!order.value) return false
  return order.value.status === 2
})

// 是否显示凭证区域（配送中/审核中/审核驳回/已完成都显示）
const showProofPhotoSection = computed(() => {
  if (!order.value) return false
  return [2, 3, 9, 10].includes(order.value.status)
})

// 是否为只读模式（审核中/已完成不能上传/删除，审核驳回可以重新上传）
const isProofReadonly = computed(() => {
  return order.value?.status === 3 || order.value?.status === 9
})

// 是否已上传凭证（使用attachmentId判断，更可靠）
const hasProofPhotos = computed(() => {
  return proofPhotoList.value.some(p => p.attachmentId || p.status === 'done')
})

// 已完成上传的凭证数量
const completedPhotoCount = computed(() => {
  return proofPhotoList.value.filter(p => p.attachmentId || p.status === 'done').length
})

// 只读模式下用于 van-image 预览的图片 URL 列表
const previewImageList = computed(() => {
  return proofPhotoList.value.filter(p => p.url).map(p => p.url)
})

// 点击缩略图时，手动触发带关闭按钮的图片预览
const handleClickPreview = (index) => {
  showImagePreview({
    images: previewImageList.value,
    startPosition: index,
    closeable: true,
  })
}

// 配送进度步骤
const stepActive = computed(() => {
  if (!order.value) return 0
  switch (order.value.status) {
    case 6: return 0  // 已派给配送员
    case 8: return 0  // 配送员已接单待配送
    case 2: return 1  // 配送中
    case 9: return 3  // 待平台审核
    case 10: return 3 // 审核驳回
    case 3: return 4  // 已完成(审核通过)
    default: return 0
  }
})

// 加载订单详情
const loadDetail = async () => {
  try {
    const res = await getOrderDetail(route.params.id)
    order.value = res.data
    
    // 重置桶借还数量
    borrowQuantity.value = 0
    returnQuantity.value = 0
    
    // 有目的地坐标就初始化地图（不等定位）
    if (hasDestination.value) {
      nextTick(() => initMap())
    }
    
    // status=1 或 status=2 都启动位置上报
    if ([1, 2].includes(order.value.status)) {
      startReport(order.value.id)
    }
    
    // 异步获取位置并绘制路线（不阻塞地图显示）
    initLocationAndDrawRoute()
    
    // 加载已上传的凭证
    if ([2, 3, 9, 10].includes(order.value.status)) {
      loadProofPhotos()
    }
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
      // 同步到位置服务单例（内部会同步 store）
      setKnownLocation(lng, lat)
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

  // 地图实例只创建一次：loadDetail 会在接单/拒单/开始配送后反复调用，
  // 重复 new AMap.Map 会在同一容器叠加画布与标记且旧实例无人销毁。
  // 已有实例时只更新中心点并复用。
  if (mapInstance) {
    mapInstance.setCenter([destLng, destLat])
    return
  }

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
  // 配送员标记复用同一个实例，只更新位置，避免每次重绘路线都叠加一个新标记
  if (deliveryMarker) {
    deliveryMarker.setPosition([fromLng, fromLat])
  } else {
    deliveryMarker = new AMap.Marker({
      map: mapInstance,
      position: [fromLng, fromLat],
      title: '我的位置',
      icon: deliveryIcon,
      offset: new AMap.Pixel(-16, -40)
    })
  }

  // 根据交通工具选择路线规划方式
  const origin = new AMap.LngLat(fromLng, fromLat)
  const destination = new AMap.LngLat(toLng, toLat)

  // 插件实例复用：首次按模式懒创建，之后重绘只 clear 上次结果再 search，
  // 不再每次新建实例（V-6）
  let routePlugin = null
  if (transportMode.value === 'driving') {
    if (!drivingService) {
      drivingService = new AMap.Driving({ map: null })
    }
    routePlugin = drivingService
  } else {
    // walking
    if (!walkingService) {
      walkingService = new AMap.Walking({ map: null })
    }
    routePlugin = walkingService
  }
  routePlugin.clear?.()

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

// 开始配送
const handleStartDelivery = async () => {
  try {
    await showDialog({
      title: '开始配送',
      message: `确定开始配送订单 ${order.value.dispatchNo} 吗？`,
      showCancelButton: true
    })
    await startDelivery(order.value.id)
    showToast('已开始配送')
    loadDetail()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('开始配送失败:', error)
    }
  }
}

// 确认送达：点击打开弹窗，强制上传客户凭证后提交
const handleComplete = () => {
  completeDialogVisible.value = true
}

// 弹窗内确认提交（XS-10 定版口径）
// 桶账由后端在 completeOrder 的同一事务内统一记账：配送端只把借/还桶数量
// 随完成请求提交（borrowBucketCount / returnBucketCount），不再前置调用
// /api/bucket/borrow、/api/bucket/return 独立记账——旧的前置记账会与后端
// 事务内记账撞防重校验，导致带桶订单永远无法确认送达。
// 因此这里只有一次请求：失败即整单未完成（后端事务回滚，桶账也不会落），
// 直接重试即可，不存在「部分步骤已成功需跳过」的中间状态。
// 订单完成入口全系统只剩详情页这一处（列表页已收敛，见 Orders.vue）。
const completeDialogConfirm = async () => {
  if (!hasProofPhotos.value) {
    showToast('请先上传配送完成凭证')
    return
  }
  if (completing.value) return
  completing.value = true
  try {
    const currentOrder = order.value
    try {
      await completeOrder(currentOrder.id, borrowQuantity.value, returnQuantity.value)
    } catch (error) {
      console.error('确认送达失败:', error)
      showToast('确认送达失败，请重试')
      return
    }

    showToast('已确认送达')
    completeDialogVisible.value = false
    stopReport()
    // 该单已离开在途集合：立即刷新，位置服务会随之自动停止/调整上报，
    // 不必等 60 秒监视轮询才发现
    refreshActiveDispatches()
    loadDetail()
  } finally {
    completing.value = false
  }
}

// 借桶数量变化时的校验
const handleBorrowQuantityChange = (value) => {
  const maxQty = maxBorrowQuantity.value
  if (value > maxQty) {
    showToast(`借桶数量不能超过订单总量（${maxQty}个）`)
    borrowQuantity.value = maxQty
  }
}

// 释放已创建的 blob 预览地址
const revokeProofObjectUrls = () => {
  proofPhotoList.value.forEach(p => {
    if (p.objectUrl) {
      URL.revokeObjectURL(p.objectUrl)
      p.objectUrl = null
    }
  })
}

// 加载已上传的凭证照片
const loadProofPhotos = async () => {
  if (!order.value) return
  try {
    proofPhotoLoading.value = true
    const res = await getProofPhotos(order.value.id)
    // 先释放旧的 blob 预览地址
    revokeProofObjectUrls()

    // 逐张带认证加载图片二进制，生成 blob 预览地址（<img> 无法携带 Authorization 头）
    const list = await Promise.all((res.data || []).map(async (photo) => {
      const item = {
        isImage: true,
        status: 'done',
        message: '',
        attachmentId: photo.attachmentId,
        fileName: photo.fileName,
        fileSize: photo.fileSize,
        url: ''
      }
      try {
        const rawBlob = await fetchProofPhoto(photo.attachmentId)
        const blob = rawBlob?.type?.includes('image/')
          ? rawBlob
          : new Blob([rawBlob], { type: rawBlob?.type || 'image/jpeg' })
        if (blob && blob.type && blob.type.startsWith('image/')) {
          item.objectUrl = URL.createObjectURL(blob)
          item.url = item.objectUrl
        } else {
          console.error('凭证图片加载失败: 非图片响应', photo.attachmentId, blob?.type)
        }
      } catch (error) {
        console.error('凭证图片加载失败:', photo.attachmentId, error)
      }
      return item
    }))
    proofPhotoList.value = list
  } catch (error) {
    console.error('加载凭证失败:', error)
  } finally {
    proofPhotoLoading.value = false
  }
}

// Vant uploader after-read 处理（多选模式下 files 为数组）
const handleAfterRead = async (files) => {
  console.log('[handleAfterRead] called, order.value:', !!order.value, 'files:', Array.isArray(files) ? files.length : 1)
  
  const fileList = Array.isArray(files) ? files : [files]
  
  // 核心修复：如果 order 还没加载好，缓存文件等待 watch 触发
  if (!order.value) {
    console.warn('[handleAfterRead] order not ready, caching', fileList.length, 'files')
    pendingUploadFiles.value.push(...fileList)
    // 同时在 loadDetail 完成后会自动触发 watch 处理
    // 这里设置一个兜底：3秒后如果还没处理再重试一次；重试同样走
    // drainPendingUploads 的 processingUpload 守卫，不与 watch 路径重复处理（V-6）
    if (pendingRetryTimer) clearTimeout(pendingRetryTimer)
    pendingRetryTimer = setTimeout(() => {
      pendingRetryTimer = null
      console.log('[handleAfterRead] retry processing cached files')
      drainPendingUploads()
    }, 3000)
    return
  }
  
  await processUploadFiles(fileList)
}

// Vant uploader delete 处理（凭证删除与后端强一致）：
// 只有后端删除成功才 resolve（Vant 才会把该项从列表移除）；
// 失败 reject 保持列表原样并提示，绝不在前端单方面移除（防前后端状态不一致）。
// 同一凭证删除中再次触发直接 reject，避免重复删除请求。
const deletingAttachmentIds = new Set()
const handleDelete = (item) => {
  return new Promise((resolve, reject) => {
    if (!item.attachmentId) {
      resolve()
      return
    }
    if (deletingAttachmentIds.has(item.attachmentId)) {
      reject(new Error('正在删除中'))
      return
    }
    deletingAttachmentIds.add(item.attachmentId)
    deleteProofPhoto(item.attachmentId).then(() => {
      if (item.objectUrl) {
        URL.revokeObjectURL(item.objectUrl)
        item.objectUrl = null
      }
      resolve()
    }).catch(error => {
      console.error('删除凭证失败:', error)
      showToast('删除失败，请重试')
      reject(error)
    }).finally(() => {
      deletingAttachmentIds.delete(item.attachmentId)
    })
  })
}

// Vant uploader oversize 处理
const handleOversize = () => {
  showToast('文件大小不能超过10MB')
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
    1: 'warning',   // 供货商已接单
    2: 'primary',   // 配送中
    3: 'success',   // 已完成(审核通过)
    6: 'primary',   // 已派给配送员
    7: 'danger',    // 配送员拒单
    8: 'warning',   // 配送员已接单待配送
    9: 'warning',   // 待平台审核
    10: 'danger'    // 审核驳回
  }
  return map[status] || 'default'
}

onMounted(() => {
  // 直接加载订单和地图，不等定位
  loadDetail()
})

onUnmounted(() => {
  pageDisposed = true
  if (pendingRetryTimer) {
    clearTimeout(pendingRetryTimer)
    pendingRetryTimer = null
  }
  stopReport()
  revokeProofObjectUrls()
  // 路线规划插件实例清理（V-6）：clear 掉渲染结果后置空，下次进入页面重新懒创建
  if (drivingService) {
    drivingService.clear?.()
    drivingService = null
  }
  if (walkingService) {
    walkingService.clear?.()
    walkingService = null
  }
  if (mapInstance) {
    mapInstance.destroy()
    mapInstance = null
  }
  routePolyline = null
  deliveryMarker = null
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

    &:has(.remark-value) {
      align-items: flex-start;
    }

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

      &.remark-value {
        text-align: left;
        word-break: break-all;
        white-space: pre-wrap;
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

// 桶借还管理样式
.bucket-info {
  .bucket-item {
    margin-bottom: 20px;
    padding: 12px;
    background: #F7F8FA;
    border-radius: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .bucket-label {
      font-size: 14px;
      color: #333333;
      font-weight: 500;
      margin-bottom: 10px;
    }

    .van-stepper {
      margin-bottom: 8px;
    }

    .bucket-hint {
      font-size: 12px;
      color: #999999;
      margin-top: 6px;
    }
  }
}

// 配送完成凭证样式
.proof-photo-section {
  // 确保上传预览为方形（防止被全局样式改成圆形头像）
  :deep(.van-uploader__preview) {
    border-radius: 6px;
    overflow: hidden;
  }
  :deep(.van-uploader__preview img) {
    border-radius: 0;
    object-fit: cover;
  }

  .proof-required-tag {
    margin-left: 8px;
    font-size: 12px;
    color: #fff;
    background: #ee0a24;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: normal;
    vertical-align: middle;
  }

  .proof-photo-tip {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 12px;
    background: #fffbe8;
    border: 1px solid #ffe58f;
    border-radius: 6px;
    font-size: 12px;
    color: #ad6800;
    margin-bottom: 12px;
    line-height: 1.5;

    .van-icon {
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  .proof-readonly-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;

    .proof-thumb {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      object-fit: cover;
      cursor: pointer;
      background: #f7f8fa;
      display: block;
    }
  }
}

// 凭证计数样式（主页面和弹窗共用）
.proof-photo-count {
  margin-top: 12px;
  font-size: 12px;
  color: #646566;
  text-align: center;

  .count-num {
    color: #1989fa;
    font-weight: 600;
    font-size: 14px;
  }

  .count-hint {
    color: #ee0a24;
    margin-left: 4px;
  }

  .count-tip {
    color: #969799;
    margin-left: 4px;
  }
}

// 确认送达弹窗样式
.complete-dialog-content {
  padding: 0;

  :deep(.van-uploader) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  :deep(.van-uploader__preview) {
    width: 72px;
    height: 72px;
    border-radius: 8px;
    overflow: hidden;
  }
  :deep(.van-uploader__preview img) {
    border-radius: 0;
    object-fit: cover;
    width: 100%;
    height: 100%;
  }

  :deep(.van-uploader__upload) {
    width: 72px;
    height: 72px;
    border-radius: 8px;
  }

  .complete-tip {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    color: #e6a23c;
    background: #fdf6ec;
    border: 1px solid #faecd8;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 16px;
    line-height: 1.6;

    .van-icon {
      flex-shrink: 0;
      margin-top: 2px;
      font-size: 16px;
    }
  }

  .complete-proof-upload {
    width: 100%;

    .proof-photo-count {
      margin-top: 12px;
    }
  }

  .complete-bucket-info {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px dashed #ebedf0;
    font-size: 14px;
    color: #606266;
    text-align: center;

    b {
      color: #1989fa;
      font-size: 16px;
      margin: 0 2px;
    }
  }
}

// 确认送达弹窗 van-dialog 样式
:deep(.van-dialog) {
  width: 92%;
  max-width: 420px;
  border-radius: 16px;
  overflow: hidden;

  .van-dialog__header {
    padding: 20px 16px 8px;
    font-size: 17px;
    font-weight: 600;
    color: #333;
    text-align: center;
  }

  .van-dialog__body {
    padding: 8px 20px 0;
    max-height: 60vh;
    overflow-y: auto;
  }

  .van-dialog__footer {
    padding: 16px 20px 20px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    border-top: none;

    .van-button {
      flex: none;
      min-width: 96px;
    }
  }
}

.action-tip {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: #ee0a24;

  .van-icon {
    font-size: 14px;
  }
}

// 审核驳回提示
.reject-notice {
  background: #fff1f0;
  border: 1px solid #ffa39e;
  border-radius: 8px;
  margin: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-direction: column;

  .reject-title {
    font-size: 15px;
    font-weight: 600;
    color: #ee0a24;
  }

  .reject-reason {
    font-size: 13px;
    color: #333;
    line-height: 1.6;
  }

  .reject-tip {
    font-size: 12px;
    color: #999;
  }
}

// 审核中提示
.review-notice {
  background: #fffbe8;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  margin: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #ad6800;
}
</style>
