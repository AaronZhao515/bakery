/**
 * 商品管理页
 * 功能：商品列表、搜索、筛选、批量操作、新增商品
 */
const app = getApp();

Page({
  data: {
    // 搜索和筛选
    searchKeyword: '',
    currentCategory: 'all',
    statusFilter: 'all',
    categories: [],

    // 商品列表
    products: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,

    // 批量操作
    isBatchMode: false,
    selectedProducts: [],

    // 返回顶部
    showBackToTop: false,
    scrollTop: 0
  },

  onLoad(options) {
    this.loadCategories();
    this.loadProducts();
  },

  onShow() {
    // 从编辑页返回时刷新列表
    if (this.data.needRefresh) {
      this.refreshList();
      this.setData({ needRefresh: false });
    }
  },

  onPageScroll(e) {
    // 控制返回顶部按钮显示
    this.setData({
      showBackToTop: e.scrollTop > 500,
      scrollTop: e.scrollTop
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreProducts();
    }
  },

  onPullDownRefresh() {
    this.refreshList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载商品分类
  async loadCategories() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getCategories'
        }
      });

      if (result.result.code === 0) {
        this.setData({
          categories: result.result.data
        });
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      // 使用模拟数据
      this.setData({
        categories: [
          { id: 'bread', name: '面包' },
          { id: 'cake', name: '蛋糕' },
          { id: 'pastry', name: '点心' },
          { id: 'drink', name: '饮品' }
        ]
      });
    }
  },

  // 加载商品列表
  async loadProducts() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true, page: 1 });

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getProductList',
          page: 1,
          pageSize: this.data.pageSize,
          keyword: this.data.searchKeyword,
          category: this.data.currentCategory === 'all' ? '' : this.data.currentCategory,
          status: this.data.statusFilter === 'all' ? '' : this.data.statusFilter
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        this.setData({
          products: list.map(item => ({ ...item, selected: false })),
          hasMore: list.length < total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载商品列表失败:', error);
      // 使用模拟数据
      this.setMockData();
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载更多商品
  async loadMoreProducts() {
    if (this.data.isLoading) return;

    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getProductList',
          page: nextPage,
          pageSize: this.data.pageSize,
          keyword: this.data.searchKeyword,
          category: this.data.currentCategory === 'all' ? '' : this.data.currentCategory,
          status: this.data.statusFilter === 'all' ? '' : this.data.statusFilter
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        this.setData({
          products: [...this.data.products, ...list.map(item => ({ ...item, selected: false }))],
          page: nextPage,
          hasMore: this.data.products.length + list.length < total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载更多商品失败:', error);
      this.setData({ isLoading: false, hasMore: false });
    }
  },

  // 设置模拟数据
  setMockData() {
    const mockProducts = [
      {
        id: '1',
        name: '招牌吐司',
        categoryName: '面包',
        price: 28,
        originalPrice: 32,
        stock: 50,
        sales: 156,
        status: 'on',
        images: []
      },
      {
        id: '2',
        name: '法式长棍',
        categoryName: '面包',
        price: 18,
        originalPrice: 18,
        stock: 8,
        sales: 128,
        status: 'on',
        images: []
      },
      {
        id: '3',
        name: '可颂面包',
        categoryName: '面包',
        price: 15,
        originalPrice: 18,
        stock: 25,
        sales: 98,
        status: 'on',
        images: []
      },
      {
        id: '4',
        name: '提拉米苏',
        categoryName: '蛋糕',
        price: 38,
        originalPrice: 45,
        stock: 12,
        sales: 76,
        status: 'on',
        images: []
      },
      {
        id: '5',
        name: '芝士蛋糕',
        categoryName: '蛋糕',
        price: 35,
        originalPrice: 40,
        stock: 0,
        sales: 65,
        status: 'off',
        images: []
      }
    ];

    this.setData({
      products: mockProducts.map(item => ({ ...item, selected: false })),
      hasMore: false
    });
  },

  // 刷新列表
  async refreshList() {
    this.setData({ page: 1, hasMore: true });
    await this.loadProducts();
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  // 执行搜索
  onSearch() {
    this.refreshList();
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      searchKeyword: ''
    });
    this.refreshList();
  },

  // 按分类筛选
  filterByCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      currentCategory: category
    });
    this.refreshList();
  },

  // 按状态筛选
  filterByStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      statusFilter: status
    });
    this.refreshList();
  },

  // 进入批量模式
  enterBatchMode() {
    this.setData({
      isBatchMode: true,
      selectedProducts: []
    });
  },

  // 退出批量模式
  exitBatchMode() {
    this.setData({
      isBatchMode: false,
      selectedProducts: [],
      products: this.data.products.map(item => ({ ...item, selected: false }))
    });
  },

  // 切换商品选择
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const products = this.data.products.map(item => {
      if (item.id === id) {
        return { ...item, selected: !item.selected };
      }
      return item;
    });

    const selectedProducts = products
      .filter(item => item.selected)
      .map(item => item.id);

    this.setData({
      products,
      selectedProducts
    });
  },

  // 批量上架
  batchOnShelf() {
    this.batchUpdateStatus('on');
  },

  // 批量下架
  batchOffShelf() {
    this.batchUpdateStatus('off');
  },

  // 批量更新状态
  async batchUpdateStatus(status) {
    const { selectedProducts } = this.data;
    if (selectedProducts.length === 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '处理中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'batchUpdateStatus',
          ids: selectedProducts,
          status
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: status === 'on' ? '上架成功' : '下架成功',
          icon: 'success'
        });
        this.exitBatchMode();
        this.refreshList();
      }
    } catch (error) {
      console.error('批量更新失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 批量删除
  batchDelete() {
    const { selectedProducts } = this.data;
    if (selectedProducts.length === 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedProducts.length} 个商品吗？`,
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          this.doBatchDelete();
        }
      }
    });
  },

  // 执行批量删除
  async doBatchDelete() {
    wx.showLoading({ title: '删除中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'batchDeleteProducts',
          ids: this.data.selectedProducts
        }
      });

      if (result.result.code === 0) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.exitBatchMode();
        this.refreshList();
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  // 点击商品
  onProductTap(e) {
    if (this.data.isBatchMode) {
      this.toggleSelect(e);
    } else {
      this.editProduct(e);
    }
  },

  // 编辑商品
  editProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/product-edit/product-edit?id=${id}`
    });
  },

  // 切换商品状态
  async toggleStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const newStatus = status === 'on' ? 'off' : 'on';

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'updateProductStatus',
          id,
          status: newStatus
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: newStatus === 'on' ? '上架成功' : '下架成功',
          icon: 'success'
        });
        this.refreshList();
      }
    } catch (error) {
      console.error('切换状态失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 删除商品
  deleteProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个商品吗？删除后不可恢复。',
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteProduct(id);
        }
      }
    });
  },

  // 执行删除
  async doDeleteProduct(id) {
    wx.showLoading({ title: '删除中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'deleteProduct',
          id
        }
      });

      if (result.result.code === 0) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.refreshList();
      }
    } catch (error) {
      console.error('删除失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  // 新增商品
  addProduct() {
    wx.navigateTo({
      url: '/pages/admin/product-edit/product-edit'
    });
  },

  // 返回顶部
  backToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
  },

  // 阻止事件冒泡
  stopPropagation() {}
});
