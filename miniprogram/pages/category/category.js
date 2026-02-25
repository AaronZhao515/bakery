// 商品分类页逻辑
const app = getApp()

Page({
  data: {
    // 分类数据
    categories: [],
    activeCategory: 1,
    currentCategory: null,
    // 子分类
    activeSubCategory: 'all',
    // 商品列表
    products: [],
    // 排序
    sortType: 'default',
    priceSort: '', // asc-升序 desc-降序
    // 分页
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true,
    scrollTop: 0
  },

  onLoad(options) {
    // 初始化数据
    this.initData()
  },

  onShow() {
    // 更新购物车数量
    this.updateCartCount()
  },

  // 初始化数据
  async initData() {
    wx.showLoading({ title: '加载中...' })

    try {
      await this.loadCategories()
      await this.loadProducts()
    } catch (error) {
      console.error('初始化数据失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载分类数据
  async loadCategories() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHomeData',
        data: { type: 'categories' }
      })

      if (result && result.code === 0) {
        const categories = result.data
        this.setData({
          categories,
          currentCategory: categories.find(item => item.id === this.data.activeCategory) || categories[0]
        })
      } else {
        // 使用模拟数据
        this.loadMockCategories()
      }
    } catch (error) {
      console.error('加载分类失败:', error)
      this.loadMockCategories()
    }
  },

  // 加载模拟分类数据
  loadMockCategories() {
    const mockCategories = [
      {
        id: 1,
        name: '全部',
        count: 156,
        banner: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
        description: '精选各类烘焙美食',
        children: []
      },
      {
        id: 2,
        name: '面包',
        count: 48,
        banner: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600',
        description: '新鲜出炉，香气四溢',
        children: [
          { id: 21, name: '吐司' },
          { id: 22, name: '欧包' },
          { id: 23, name: '甜面包' },
          { id: 24, name: '全麦' }
        ]
      },
      {
        id: 3,
        name: '蛋糕',
        count: 36,
        banner: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600',
        description: '甜蜜滋味，幸福时光',
        children: [
          { id: 31, name: '芝士' },
          { id: 32, name: '慕斯' },
          { id: 33, name: '奶油' },
          { id: 34, name: '千层' }
        ]
      },
      {
        id: 4,
        name: '甜点',
        count: 42,
        banner: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600',
        description: '精致小点，下午茶首选',
        children: [
          { id: 41, name: '马卡龙' },
          { id: 42, name: '泡芙' },
          { id: 43, name: '蛋挞' },
          { id: 44, name: '曲奇' }
        ]
      },
      {
        id: 5,
        name: '饮品',
        count: 30,
        banner: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600',
        description: '现磨咖啡，鲜榨果汁',
        children: [
          { id: 51, name: '咖啡' },
          { id: 52, name: '奶茶' },
          { id: 53, name: '果汁' }
        ]
      },
      {
        id: 6,
        name: '礼盒',
        count: 15,
        banner: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=600',
        description: '精美包装，送礼佳品',
        children: []
      }
    ]

    this.setData({
      categories: mockCategories,
      currentCategory: mockCategories[0]
    })
  },

  // 加载商品数据
  async loadProducts() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getProducts',
        data: {
          categoryId: this.data.activeCategory,
          subCategoryId: this.data.activeSubCategory === 'all' ? null : this.data.activeSubCategory,
          sortType: this.data.sortType,
          priceSort: this.data.priceSort,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      })

      if (result && result.code === 0) {
        const products = result.data.list || []
        this.setData({
          products: this.data.page === 1 ? products : [...this.data.products, ...products],
          hasMore: products.length >= this.data.pageSize
        })
      } else {
        this.loadMockProducts()
      }
    } catch (error) {
      console.error('加载商品失败:', error)
      this.loadMockProducts()
    } finally {
      this.setData({ loading: false })
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
        rating: 4.9,
        image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',
        badge: '热销',
        badgeColor: '#E57373'
      },
      {
        id: 2,
        name: '全麦吐司',
        description: '健康低糖，营养早餐',
        price: 28,
        sales: 856,
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=400',
        badge: '新品',
        badgeColor: '#81C784'
      },
      {
        id: 3,
        name: '巧克力麦芬',
        description: '浓郁巧克力，松软可口',
        price: 15,
        originalPrice: 18,
        sales: 2341,
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400',
        badge: '特惠',
        badgeColor: '#FFB74D'
      },
      {
        id: 4,
        name: '蓝莓贝果',
        description: '手工制作，嚼劲十足',
        price: 22,
        sales: 567,
        rating: 4.6,
        image: 'https://images.unsplash.com/photo-1621236378699-8597fab6a5b1?w=400'
      },
      {
        id: 5,
        name: '肉桂卷',
        description: '香甜肉桂，温暖治愈',
        price: 20,
        sales: 789,
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=400',
        badge: '限量',
        badgeColor: '#BA68C8'
      },
      {
        id: 6,
        name: '芝士蛋糕',
        description: '入口即化，奶香浓郁',
        price: 35,
        sales: 432,
        rating: 4.9,
        image: 'https://images.unsplash.com/photo-1524351199678-941a58a3df26?w=400'
      },
      {
        id: 7,
        name: '提拉米苏',
        description: '意式经典，咖啡香浓',
        price: 38,
        sales: 321,
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400'
      },
      {
        id: 8,
        name: '草莓千层',
        description: '层层香滑，草莓鲜甜',
        price: 42,
        sales: 298,
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
        badge: '新品',
        badgeColor: '#81C784'
      }
    ]

    // 根据排序类型排序
    let sortedProducts = [...mockProducts]
    if (this.data.sortType === 'sales') {
      sortedProducts.sort((a, b) => b.sales - a.sales)
    } else if (this.data.sortType === 'price') {
      if (this.data.priceSort === 'asc') {
        sortedProducts.sort((a, b) => a.price - b.price)
      } else {
        sortedProducts.sort((a, b) => b.price - a.price)
      }
    }

    this.setData({
      products: this.data.page === 1 ? sortedProducts : [...this.data.products, ...sortedProducts],
      hasMore: this.data.page < 3
    })
  },

  // 点击分类
  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id
    const category = this.data.categories.find(item => item.id === id)

    this.setData({
      activeCategory: id,
      currentCategory: category,
      activeSubCategory: 'all',
      page: 1,
      hasMore: true,
      scrollTop: 0,
      products: []
    })

    this.loadProducts()
  },

  // 点击子分类
  onSubCategoryTap(e) {
    const id = e.currentTarget.dataset.id

    this.setData({
      activeSubCategory: id,
      page: 1,
      hasMore: true,
      products: []
    })

    this.loadProducts()
  },

  // 点击排序
  onSortTap(e) {
    const type = e.currentTarget.dataset.type
    let priceSort = this.data.priceSort

    if (type === 'price') {
      if (this.data.sortType === 'price') {
        // 切换价格排序方向
        priceSort = priceSort === 'asc' ? 'desc' : 'asc'
      } else {
        priceSort = 'asc'
      }
    }

    this.setData({
      sortType: type,
      priceSort,
      page: 1,
      hasMore: true,
      products: []
    })

    this.loadProducts()
  },

  // 点击商品
  onProductTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${id}`
    })
  },

  // 点击搜索
  onSearchTap() {
    wx.navigateTo({
      url: '/pages/search/search'
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
  },

  // 更新购物车数量
  updateCartCount() {
    const cart = wx.getStorageSync('cart') || []
    const count = cart.reduce((sum, item) => sum + item.quantity, 0)
    app.globalData.cartCount = count

    if (count > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: String(count > 99 ? '99+' : count)
      })
    } else {
      wx.removeTabBarBadge({ index: 2 })
    }
  },

  // 商品列表滚动
  onProductScroll(e) {
    // 可以在这里实现滚动监听
  },

  // 加载更多
  onLoadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 })
      this.loadProducts()
    }
  }
})
