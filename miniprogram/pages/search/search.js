// 搜索页逻辑
const app = getApp()

Page({
  data: {
    // 状态栏高度
    statusBarHeight: 0,
    // 搜索关键词
    keyword: '',
    // 搜索建议
    suggestions: [],
    showSuggestions: false,
    // 搜索历史
    searchHistory: [],
    // 热门搜索
    hotKeywords: [],
    // 推荐分类
    recommendCategories: [],
    // 搜索结果
    hasSearched: false,
    products: [],
    totalCount: 0,
    // 排序
    sortType: 'default',
    priceSort: '',
    // 分页
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true,
    // 搜索延迟定时器
    searchTimer: null
  },

  onLoad() {
    // 获取状态栏高度
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight
    })

    // 加载搜索历史
    this.loadSearchHistory()

    // 加载热门搜索
    this.loadHotKeywords()

    // 加载推荐分类
    this.loadRecommendCategories()
  },

  // 加载搜索历史
  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || []
    this.setData({ searchHistory: history.slice(0, 10) })
  },

  // 保存搜索历史
  saveSearchHistory(keyword) {
    if (!keyword.trim()) return

    let history = wx.getStorageSync('searchHistory') || []

    // 移除重复项
    history = history.filter(item => item !== keyword)

    // 添加到开头
    history.unshift(keyword)

    // 限制数量
    history = history.slice(0, 10)

    wx.setStorageSync('searchHistory', history)
    this.setData({ searchHistory: history })
  },

  // 清空搜索历史
  onClearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory')
          this.setData({ searchHistory: [] })
        }
      }
    })
  },

  // 加载热门搜索
  async loadHotKeywords() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHomeData',
        data: { type: 'hotKeywords' }
      })

      if (result && result.code === 0) {
        this.setData({ hotKeywords: result.data })
      } else {
        // 使用模拟数据
        this.setData({
          hotKeywords: ['可颂', '吐司', '蛋糕', '贝果', '欧包', '马卡龙', '芝士', '巧克力']
        })
      }
    } catch (error) {
      this.setData({
        hotKeywords: ['可颂', '吐司', '蛋糕', '贝果', '欧包', '马卡龙', '芝士', '巧克力']
      })
    }
  },

  // 加载推荐分类
  async loadRecommendCategories() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHomeData',
        data: { type: 'categories' }
      })

      if (result && result.code === 0) {
        this.setData({
          recommendCategories: result.data.slice(0, 8)
        })
      } else {
        // 使用模拟数据
        this.loadMockCategories()
      }
    } catch (error) {
      this.loadMockCategories()
    }
  },

  // 加载模拟分类
  loadMockCategories() {
    const mockCategories = [
      { id: 1, name: '全部', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200' },
      { id: 2, name: '面包', image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=200' },
      { id: 3, name: '蛋糕', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=200' },
      { id: 4, name: '甜点', image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200' },
      { id: 5, name: '饮品', image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=200' },
      { id: 6, name: '礼盒', image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=200' }
    ]
    this.setData({ recommendCategories: mockCategories })
  },

  // 输入框输入
  onInput(e) {
    const keyword = e.detail.value
    this.setData({ keyword })

    // 清除之前的定时器
    if (this.data.searchTimer) {
      clearTimeout(this.data.searchTimer)
    }

    if (keyword.trim()) {
      // 延迟获取搜索建议
      const timer = setTimeout(() => {
        this.loadSuggestions(keyword)
      }, 300)
      this.setData({ searchTimer: timer })
    } else {
      this.setData({
        showSuggestions: false,
        suggestions: []
      })
    }
  },

  // 加载搜索建议
  async loadSuggestions(keyword) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getProducts',
        data: {
          type: 'suggestions',
          keyword
        }
      })

      if (result && result.code === 0) {
        this.setData({
          suggestions: result.data,
          showSuggestions: true
        })
      } else {
        // 使用本地模拟建议
        const mockSuggestions = ['可颂', '可颂面包', '可颂三明治', '巧克力可颂']
          .filter(item => item.includes(keyword))
          .slice(0, 5)
        this.setData({
          suggestions: mockSuggestions.length > 0 ? mockSuggestions : [keyword],
          showSuggestions: true
        })
      }
    } catch (error) {
      this.setData({
        suggestions: [keyword],
        showSuggestions: true
      })
    }
  },

  // 点击搜索建议
  onSuggestionTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({
      keyword,
      showSuggestions: false
    })
    this.onSearch()
  },

  // 执行搜索
  onSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      })
      return
    }

    // 保存搜索历史
    this.saveSearchHistory(keyword)

    // 隐藏建议
    this.setData({
      showSuggestions: false,
      hasSearched: true,
      page: 1,
      hasMore: true,
      products: []
    })

    // 加载搜索结果
    this.loadSearchResults()
  },

  // 加载搜索结果
  async loadSearchResults() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getProducts',
        data: {
          type: 'search',
          keyword: this.data.keyword,
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
          totalCount: result.data.total || 0,
          hasMore: products.length >= this.data.pageSize
        })
      } else {
        this.loadMockSearchResults()
      }
    } catch (error) {
      console.error('搜索失败:', error)
      this.loadMockSearchResults()
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载模拟搜索结果
  loadMockSearchResults() {
    const mockProducts = [
      {
        id: 1,
        name: '法式可颂',
        description: '层层酥脆，黄油香浓',
        price: 18,
        originalPrice: 22,
        sales: 1234,
        rating: 4.9,
        image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400'
      },
      {
        id: 2,
        name: '巧克力可颂',
        description: '浓郁巧克力夹心',
        price: 24,
        sales: 567,
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1555507029-9fff6b090ac3?w=400'
      },
      {
        id: 3,
        name: '杏仁可颂',
        description: '香脆杏仁片',
        price: 22,
        sales: 432,
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1585476263060-b7a6b710f2a1?w=400'
      }
    ]

    this.setData({
      products: this.data.page === 1 ? mockProducts : [...this.data.products, ...mockProducts],
      totalCount: mockProducts.length,
      hasMore: this.data.page < 2
    })
  },

  // 点击排序
  onSortTap(e) {
    const type = e.currentTarget.dataset.type
    let priceSort = this.data.priceSort

    if (type === 'price') {
      if (this.data.sortType === 'price') {
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

    this.loadSearchResults()
  },

  // 点击搜索历史
  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword })
    this.onSearch()
  },

  // 点击热门搜索
  onHotTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword })
    this.onSearch()
  },

  // 点击分类
  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id
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

    let cart = wx.getStorageSync('cart') || []
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

    wx.setStorageSync('cart', cart)

    // 更新tabBar购物车数量
    const count = cart.reduce((sum, cartItem) => sum + cartItem.quantity, 0)
    if (count > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: String(count > 99 ? '99+' : count)
      })
    }

    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1500
    })
  },

  // 清空输入
  onClearTap() {
    this.setData({
      keyword: '',
      showSuggestions: false,
      suggestions: []
    })
  },

  // 取消搜索
  onCancelTap() {
    wx.navigateBack()
  },

  // 加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading && this.data.hasSearched) {
      this.setData({ page: this.data.page + 1 })
      this.loadSearchResults()
    }
  }
})
