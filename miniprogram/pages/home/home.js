// 首页逻辑
const app = getApp()

Page({
  data: {
    // 导航栏高度
    navBarHeight: 0,
    statusBarHeight: 0,
    // 位置信息
    location: '北京市朝阳区',
    // 轮播图数据
    banners: [],
    // 快捷入口
    quickEntries: [],
    // 配送方式
    deliveryType: 'pickup',
    deliveryTime: '12:30',
    // 推荐商品
    recommendProducts: [],
    // 加载状态
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  onLoad() {
    // 获取导航栏高度
    this.setData({
      navBarHeight: app.globalData.navBarHeight,
      statusBarHeight: app.globalData.statusBarHeight
    })

    // 初始化数据
    this.initData()
  },

  onShow() {
    // 更新购物车数量
    this.updateCartCount()
  },

  onPullDownRefresh() {
    // 下拉刷新
    this.setData({
      page: 1,
      hasMore: true,
      recommendProducts: []
    })
    this.initData()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    // 上拉加载更多
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreProducts()
    }
  },

  // 初始化数据
  async initData() {
    wx.showLoading({ title: '加载中...' })

    try {
      // 并行加载数据
      await Promise.all([
        this.loadBanners(),
        this.loadQuickEntries(),
        this.loadRecommendProducts()
      ])
    } catch (error) {
      console.error('初始化数据失败:', error)
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载轮播图数据
  async loadBanners() {
    try {
      // 调用云函数获取数据
      const { result } = await wx.cloud.callFunction({
        name: 'getHomeData',
        data: { type: 'banners' }
      })

      if (result && result.code === 0) {
        this.setData({ banners: result.data })
      } else {
        // 使用模拟数据
        this.setData({
          banners: [
            {
              id: 1,
              image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
              title: '新品上市',
              subtitle: '法式可颂 酥脆香甜',
              link: '/pages/product-detail/product-detail?id=1'
            },
            {
              id: 2,
              image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
              title: '会员专享',
              subtitle: '充值享8折优惠',
              link: '/pages/member/member'
            },
            {
              id: 3,
              image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=800',
              title: '每日限量',
              subtitle: '手工欧包 每日现烤',
              link: '/pages/category/category'
            }
          ]
        })
      }
    } catch (error) {
      console.error('加载轮播图失败:', error)
      // 使用模拟数据
      this.setData({
        banners: [
          {
            id: 1,
            image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
            title: '新品上市',
            subtitle: '法式可颂 酥脆香甜'
          }
        ]
      })
    }
  },

  // 加载快捷入口
  async loadQuickEntries() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHomeData',
        data: { type: 'quickEntries' }
      })

      if (result && result.code === 0) {
        this.setData({ quickEntries: result.data })
      } else {
        // 使用模拟数据
        this.setData({
          quickEntries: [
            { id: 1, name: '会员储值', icon: '💳', bgColor: 'linear-gradient(135deg, #FFE0B2, #FFCC80)', link: '/pages/member/member' },
            { id: 2, name: '领券中心', icon: '🎫', bgColor: 'linear-gradient(135deg, #FFCDD2, #EF9A9A)', link: '/pages/coupon/coupon' },
            { id: 3, name: '每日限量', icon: '🔥', bgColor: 'linear-gradient(135deg, #FFCCBC, #FFAB91)', link: '/pages/category/category?type=limited' },
            { id: 4, name: '新品推荐', icon: '✨', bgColor: 'linear-gradient(135deg, #C8E6C9, #A5D6A7)', link: '/pages/category/category?type=new' }
          ]
        })
      }
    } catch (error) {
      console.error('加载快捷入口失败:', error)
      // 使用模拟数据
      this.setData({
        quickEntries: [
          { id: 1, name: '会员储值', icon: '💳', bgColor: 'linear-gradient(135deg, #FFE0B2, #FFCC80)' },
          { id: 2, name: '领券中心', icon: '🎫', bgColor: 'linear-gradient(135deg, #FFCDD2, #EF9A9A)' }
        ]
      })
    }
  },

  // 加载推荐商品
  async loadRecommendProducts() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getProducts',
        data: {
          type: 'recommend',
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      })

      if (result && result.code === 0) {
        const products = result.data.list || []
        this.setData({
          recommendProducts: this.data.page === 1 ? products : [...this.data.recommendProducts, ...products],
          hasMore: products.length >= this.data.pageSize
        })
      } else {
        // 使用模拟数据
        this.loadMockProducts()
      }
    } catch (error) {
      console.error('加载推荐商品失败:', error)
      this.loadMockProducts()
    }
  },

  // 加载模拟商品数据
  loadMockProducts() {
    const mockProducts = [
      {
        id: 1,
        name: '法式可颂',
        description: '层层酥脆，黄油香浓',
        price: 18,
        originalPrice: 22,
        sales: 1234,
        image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',
        tag: '热销',
        tagColor: '#E57373'
      },
      {
        id: 2,
        name: '全麦吐司',
        description: '健康低糖，营养早餐',
        price: 28,
        sales: 856,
        image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=400',
        tag: '新品',
        tagColor: '#81C784'
      },
      {
        id: 3,
        name: '巧克力麦芬',
        description: '浓郁巧克力，松软可口',
        price: 15,
        originalPrice: 18,
        sales: 2341,
        image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400',
        tag: '特惠',
        tagColor: '#FFB74D'
      },
      {
        id: 4,
        name: '蓝莓贝果',
        description: '手工制作，嚼劲十足',
        price: 22,
        sales: 567,
        image: 'https://images.unsplash.com/photo-1621236378699-8597fab6a5b1?w=400'
      },
      {
        id: 5,
        name: '肉桂卷',
        description: '香甜肉桂，温暖治愈',
        price: 20,
        sales: 789,
        image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=400',
        tag: '限量',
        tagColor: '#BA68C8'
      },
      {
        id: 6,
        name: '芝士蛋糕',
        description: '入口即化，奶香浓郁',
        price: 35,
        sales: 432,
        image: 'https://images.unsplash.com/photo-1524351199678-941a58a3df26?w=400'
      }
    ]

    this.setData({
      recommendProducts: this.data.page === 1 ? mockProducts : [...this.data.recommendProducts, ...mockProducts],
      hasMore: this.data.page < 3
    })
  },

  // 加载更多商品
  async loadMoreProducts() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      this.setData({ page: this.data.page + 1 })
      await this.loadRecommendProducts()
    } finally {
      this.setData({ loading: false })
    }
  },

  // 更新购物车数量
  updateCartCount() {
    // 从本地存储获取购物车数量
    const cart = wx.getStorageSync('cart') || []
    const count = cart.reduce((sum, item) => sum + item.quantity, 0)
    app.globalData.cartCount = count

    // 设置tabBar徽章
    if (count > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: String(count > 99 ? '99+' : count)
      })
    } else {
      wx.removeTabBarBadge({ index: 2 })
    }
  },

  // 点击位置
  onLocationTap() {
    wx.navigateTo({
      url: '/pages/location/location'
    })
  },

  // 点击搜索栏
  onSearchTap() {
    wx.navigateTo({
      url: '/pages/search/search'
    })
  },

  // 点击轮播图
  onBannerTap(e) {
    const item = e.currentTarget.dataset.item
    if (item.link) {
      wx.navigateTo({ url: item.link })
    }
  },

  // 点击快捷入口
  onQuickEntryTap(e) {
    const item = e.currentTarget.dataset.item
    if (item.link) {
      wx.navigateTo({ url: item.link })
    }
  },

  // 切换配送方式
  onDeliveryTypeChange(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ deliveryType: type })

    // 更新预计送达时间
    const now = new Date()
    if (type === 'pickup') {
      now.setMinutes(now.getMinutes() + 30)
    } else {
      now.setMinutes(now.getMinutes() + 60)
    }
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    this.setData({ deliveryTime: `${hours}:${minutes}` })
  },

  // 点击更多
  onMoreTap() {
    wx.switchTab({
      url: '/pages/category/category'
    })
  },

  // 点击商品
  onProductTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${id}`
    })
  },

  // 加入购物车
  onAddCart(e) {
    const item = e.currentTarget.dataset.item

    // 获取当前购物车
    let cart = wx.getStorageSync('cart') || []

    // 查找是否已存在
    const existingIndex = cart.findIndex(cartItem => cartItem.id === item.id)

    if (existingIndex > -1) {
      cart[existingIndex].quantity += 1
    } else {
      cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: 1,
        selected: true
      })
    }

    // 保存到本地存储
    wx.setStorageSync('cart', cart)

    // 更新购物车数量
    this.updateCartCount()

    // 显示提示
    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1500
    })
  }
})
