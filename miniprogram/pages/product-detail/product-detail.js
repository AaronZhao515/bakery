
// 商品详情页逻辑
const app = getApp()

Page({
  data: {
    // 导航栏
    navBarHeight: 0,
    statusBarHeight: 0,
    showNavBg: false,
    // 商品数据
    product: {},
    // 规格
    selectedSku: {},
    // 数量
    quantity: 1,
    // 当前图片索引
    currentImageIndex: 0,
    // 图片总数
    imageCount: 0,
    // 标签页
    activeTab: 'detail',
    // 收藏状态
    isCollected: false,
    // 购物车数量
    cartCount: 0,
    // 评价列表
    reviews: [],
    // 弹窗显示
    showSkuPopup: false
  },

  onLoad(options) {
    // 获取导航栏高度
    this.setData({
      navBarHeight: app.globalData.navBarHeight,
      statusBarHeight: app.globalData.statusBarHeight
    })

    // 获取商品ID
    const productId = options.id
    if (productId) {
      this.loadProductDetail(productId)
    }

    // 获取购物车数量
    this.updateCartCount()

    // 检查收藏状态
    this.checkCollectStatus(productId)
  },

  onShow() {
    this.updateCartCount()
  },

  onPageScroll(e) {
    // 控制导航栏背景显示
    const showNavBg = e.scrollTop > 200
    if (showNavBg !== this.data.showNavBg) {
      this.setData({ showNavBg })
    }
  },

  // 加载商品详情
  async loadProductDetail(productId) {
    wx.showLoading({ title: '加载中...' })

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getProductDetail',
        data: { productId }
      })

      if (result && result.code === 0) {
        const product = result.data
        const images = product.images || [product.image]
        this.setData({
          product,
          selectedSku: product.skus && product.skus.length > 0 ? product.skus[0] : {},
          imageCount: images.length
        })
        // 加载评价
        this.loadReviews(productId)
      } else {
        this.loadMockProduct(productId)
      }
    } catch (error) {
      console.error('加载商品详情失败:', error)
      this.loadMockProduct(productId)
    } finally {
      wx.hideLoading()
    }
  },

  // 加载模拟商品数据
  loadMockProduct(productId) {
    const mockProduct = {
      id: productId || 1,
      name: '法式可颂',
      description: '采用法国进口黄油，层层酥脆，奶香浓郁。每日现烤，新鲜出炉。经典法式风味，搭配咖啡的绝佳选择。',
      price: 18,
      originalPrice: 22,
      sales: 1234,
      rating: 4.9,
      stock: 99,
      reviewCount: 328,
      goodReviewCount: 312,
      imageReviewCount: 156,
      image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
      images: [
        'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
        'https://images.unsplash.com/photo-1555507029-9fff6b090ac3?w=600',
        'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600'
      ],
      tags: [
        { name: '热销', color: '#E57373' },
        { name: '新品', color: '#81C784' }
      ],
      skus: [
        { id: 1, name: '原味', price: 18, originalPrice: 22, stock: 50 },
        { id: 2, name: '杏仁', price: 22, originalPrice: 26, stock: 30 },
        { id: 3, name: '巧克力', price: 24, originalPrice: 28, stock: 0 },
        { id: 4, name: '抹茶', price: 24, originalPrice: 28, stock: 20 }
      ],
      detailImages: [
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
        'https://images.unsplash.com/photo-1585476263060-b7a6b710f2a1?w=800',
        'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800'
      ],
      params: [
        { name: '品牌', value: '暖心烘焙' },
        { name: '产地', value: '中国大陆' },
        { name: '净含量', value: '80g/个' },
        { name: '保质期', value: '3天' },
        { name: '储存方式', value: '常温避光' },
        { name: '配料', value: '小麦粉、黄油、牛奶、鸡蛋、酵母、糖' }
      ]
    }

    this.setData({
      product: mockProduct,
      selectedSku: mockProduct.skus[0],
      imageCount: mockProduct.images.length
    })

    // 加载模拟评价
    this.loadMockReviews()
  },

  // 加载评价
  async loadReviews(productId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getProductDetail',
        data: { type: 'reviews', productId }
      })

      if (result && result.code === 0) {
        this.setData({ reviews: result.data })
      } else {
        this.loadMockReviews()
      }
    } catch (error) {
      this.loadMockReviews()
    }
  },

  // 加载模拟评价
  loadMockReviews() {
    const mockReviews = [
      {
        id: 1,
        nickname: '烘焙爱好者',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
        rating: 5,
        date: '2024-01-15',
        content: '超级好吃！酥脆可口，黄油香味很浓，每天早上都要来一个配咖啡。强烈推荐！',
        images: [
          'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=200',
          'https://images.unsplash.com/photo-1585476263060-b7a6b710f2a1?w=200'
        ],
        sku: '原味'
      },
      {
        id: 2,
        nickname: '美食达人',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
        rating: 5,
        date: '2024-01-14',
        content: '包装很用心，送过来还是热的，口感非常好，会回购的！',
        images: [],
        sku: '杏仁'
      },
      {
        id: 3,
        nickname: '下午茶控',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
        rating: 4,
        date: '2024-01-13',
        content: '味道不错，就是稍微有点甜，如果能减糖就更好了。',
        images: [],
        sku: '原味'
      }
    ]

    this.setData({ reviews: mockReviews })
  },

  // 检查收藏状态
  checkCollectStatus(productId) {
    const collects = wx.getStorageSync('collects') || []
    const isCollected = collects.some(item => item.id === parseInt(productId))
    this.setData({ isCollected })
  },

  // 更新购物车数量
  updateCartCount() {
    const cart = wx.getStorageSync('cart') || []
    const count = cart.reduce((sum, item) => sum + item.quantity, 0)
    this.setData({ cartCount: count })
    app.globalData.cartCount = count
  },

  // 轮播图切换
  onSwiperChange(e) {
    this.setData({ currentImageIndex: e.detail.current })
  },

  // 预览图片
  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.product.images || [this.data.product.image]
    wx.previewImage({
      current: url,
      urls
    })
  },

  // 预览评价图片
  onPreviewReviewImage(e) {
    const { images, current } = e.currentTarget.dataset
    wx.previewImage({
      current,
      urls: images
    })
  },

  // 选择规格
  onSkuSelect(e) {
    const sku = e.currentTarget.dataset.sku
    if (sku.stock === 0) return

    this.setData({ selectedSku: sku })
  },

  // 数量变化
  onQuantityChange(e) {
    const action = e.currentTarget.dataset.action
    let quantity = this.data.quantity

    if (action === 'increase') {
      quantity++
    } else if (action === 'decrease' && quantity > 1) {
      quantity--
    }

    this.setData({ quantity })
  },

  // 数量输入
  onQuantityInput(e) {
    let value = parseInt(e.detail.value)
    if (isNaN(value) || value < 1) {
      value = 1
    }
    this.setData({ quantity: value })
  },

  // 切换标签
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // 返回上一页
  onBackTap() {
    wx.navigateBack()
  },

  // 分享
  onShareTap() {
    // 触发系统分享
  },

  // 回到首页
  onHomeTap() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 进入购物车
  onCartTap() {
    wx.switchTab({
      url: '/pages/cart/cart'
    })
  },

  // 收藏/取消收藏
  onCollectTap() {
    const { product, isCollected } = this.data
    let collects = wx.getStorageSync('collects') || []

    if (isCollected) {
      // 取消收藏
      collects = collects.filter(item => item.id !== product.id)
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      // 添加收藏
      collects.unshift({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        collectTime: new Date().toISOString()
      })
      wx.showToast({ title: '收藏成功', icon: 'success' })
    }

    wx.setStorageSync('collects', collects)
    this.setData({ isCollected: !isCollected })
  },

  // 加入购物车
  onAddCart() {
    const { product, selectedSku, quantity } = this.data

    // 检查库存
    const stock = selectedSku.stock || product.stock
    if (stock === 0) {
      wx.showToast({ title: '商品已售罄', icon: 'none' })
      return
    }

    // 获取当前购物车
    let cart = wx.getStorageSync('cart') || []

    // 构建购物车项
    const cartItem = {
      id: product.id,
      skuId: selectedSku.id,
      name: product.name,
      skuName: selectedSku.name,
      price: selectedSku.price || product.price,
      image: product.image,
      quantity,
      selected: true
    }

    // 查找是否已存在
    const existingIndex = cart.findIndex(
      item => item.id === cartItem.id && item.skuId === cartItem.skuId
    )

    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity
    } else {
      cart.push(cartItem)
    }

    // 保存到本地存储
    wx.setStorageSync('cart', cart)

    // 更新购物车数量
    this.updateCartCount()

    // 关闭弹窗
    this.setData({ showSkuPopup: false })

    // 显示提示
    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1500
    })
  },

  // 立即购买
  onBuyNow() {
    const { product, selectedSku, quantity } = this.data

    // 检查库存
    const stock = selectedSku.stock || product.stock
    if (stock === 0) {
      wx.showToast({ title: '商品已售罄', icon: 'none' })
      return
    }

    // 构建订单商品
    const orderProduct = {
      id: product.id,
      skuId: selectedSku.id,
      name: product.name,
      skuName: selectedSku.name,
      price: selectedSku.price || product.price,
      image: product.image,
      quantity
    }

    // 跳转到确认订单页
    wx.navigateTo({
      url: `/package-order/pages/order-confirm/order-confirm?products=${encodeURIComponent(JSON.stringify([orderProduct]))}`
    })
  },

  // 显示规格弹窗
  onShowSkuPopup() {
    this.setData({ showSkuPopup: true })
  },

  // 关闭规格弹窗
  onCloseSkuPopup() {
    this.setData({ showSkuPopup: false })
  },

  // 阻止冒泡
  onPreventBubble() {
    // 什么都不做，阻止事件冒泡
  },

  // 分享配置
  onShareAppMessage() {
    const { product } = this.data
    return {
      title: product.name,
      path: `/pages/product-detail/product-detail?id=${product.id}`,
      imageUrl: product.image
    }
  }
})
