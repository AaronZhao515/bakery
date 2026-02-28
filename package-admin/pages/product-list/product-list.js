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
    // 检查管理员权限
    const adminInfo = wx.getStorageSync('admin_info');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.redirectTo({
        url: '/package-admin/pages/login/login'
      });
      return;
    }

    // 从编辑页返回时刷新列表
    if (this.data.needRefresh) {
      this.refreshList();
      this.setData({ needRefresh: false });
    } else {
      // 检查全局刷新标记（从任意编辑页返回都需要刷新）
      const needRefreshGlobal = wx.getStorageSync('product_list_need_refresh');
      if (needRefreshGlobal) {
        this.refreshList();
        wx.removeStorageSync('product_list_need_refresh');
      }
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
        name: 'admin',
        data: {
          action: 'categoryManage',
          operation: 'list',
          status: 1
        }
      });

      if (result.result.code === 0) {
        const categories = result.result.data.list.map(cat => ({
          id: cat._id,
          name: cat.name
        }));
        this.setData({ categories });
      } else {
        // 使用默认分类
        this.setDefaultCategories();
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      this.setDefaultCategories();
    }
  },

  // 设置默认分类
  setDefaultCategories() {
    this.setData({
      categories: [
        { id: 'bread', name: '面包' },
        { id: 'cake', name: '蛋糕' },
        { id: 'pastry', name: '点心' },
        { id: 'drink', name: '饮品' }
      ]
    });
  },

  // 加载商品列表
  async loadProducts() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true, page: 1 });

    try {
      // 构建查询参数
      const params = {
        action: 'productCRUD',
        operation: 'list',
        page: 1,
        pageSize: this.data.pageSize,
        keyword: this.data.searchKeyword,
        categoryId: this.data.currentCategory === 'all' ? '' : this.data.currentCategory
      };

      // 状态筛选：all=全部, on=上架(1), off=下架(0)
      if (this.data.statusFilter !== 'all') {
        params.status = this.data.statusFilter === 'on' ? 1 : 0;
      }

      console.log('加载商品列表参数:', params);

      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: params
      });

      console.log('加载商品列表结果:', result);

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        // 确保商品数据有 id 字段（兼容 _id），并转换状态格式
        const products = list.map(item => {
          // 处理图片路径 - 优先使用 images[0]，其次是 coverImage/mainImage
          let displayImage = item.images && item.images.length > 0 && item.images[0]
            ? item.images[0]
            : (item.coverImage || item.mainImage || '');

          // 注意：云存储路径 cloud:// 不支持查询参数，直接使用原路径
          // 云存储文件名本身已包含时间戳，具有唯一性

          return {
            ...item,
            id: item._id || item.id,
            status: item.status === 1 ? 'on' : 'off', // 转换为前端格式
            selected: false,
            displayImage: displayImage || '/images/default-product.png'
          };
        });
        this.setData({
          products,
          total: total || list.length,
          hasMore: list.length < total,
          isLoading: false
        });
      } else {
        console.error('加载商品列表失败:', result.result.message);
        this.setData({ products: [], total: 0, hasMore: false });
      }
    } catch (error) {
      console.error('加载商品列表失败:', error);
      // 使用模拟数据（仅开发时使用）
      // this.setMockData();
      this.setData({ products: [], total: 0, hasMore: false });
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
      // 构建查询参数
      const params = {
        action: 'productCRUD',
        operation: 'list',
        page: nextPage,
        pageSize: this.data.pageSize,
        keyword: this.data.searchKeyword,
        categoryId: this.data.currentCategory === 'all' ? '' : this.data.currentCategory
      };

      // 状态筛选
      if (this.data.statusFilter !== 'all') {
        params.status = this.data.statusFilter === 'on' ? 1 : 0;
      }

      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: params
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        // 确保商品数据有 id 字段（兼容 _id），并转换状态格式
        const newProducts = list.map(item => {
          // 处理图片路径 - 优先使用 images[0]，其次是 coverImage/mainImage
          let displayImage = item.images && item.images.length > 0 && item.images[0]
            ? item.images[0]
            : (item.coverImage || item.mainImage || '');

          // 注意：云存储路径 cloud:// 不支持查询参数，直接使用原路径
          // 云存储文件名本身已包含时间戳，具有唯一性

          return {
            ...item,
            id: item._id || item.id,
            status: item.status === 1 ? 'on' : 'off',
            selected: false,
            displayImage: displayImage || '/images/default-product.png'
          };
        });
        this.setData({
          products: [...this.data.products, ...newProducts],
          page: nextPage,
          hasMore: this.data.products.length + list.length < total,
          isLoading: false
        });
      } else {
        this.setData({ isLoading: false, hasMore: false });
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
      // 批量更新商品状态 - 使用 admin 云函数逐个更新
      const updatePromises = selectedProducts.map(id =>
        wx.cloud.callFunction({
          name: 'admin',
          data: {
            action: 'productCRUD',
            operation: 'update',
            productId: id,
            productData: { status: status === 'on' ? 1 : 0 }
          }
        })
      );
      const results = await Promise.all(updatePromises);

      // 检查是否全部成功
      const failedCount = results.filter(r => r.result.code !== 0).length;

      if (failedCount === 0) {
        wx.showToast({
          title: status === 'on' ? '上架成功' : '下架成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: `${selectedProducts.length - failedCount}个成功，${failedCount}个失败`,
          icon: 'none'
        });
      }
      this.exitBatchMode();
      this.refreshList();
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
      // 使用 admin 云函数逐个删除
      const deletePromises = this.data.selectedProducts.map(id =>
        wx.cloud.callFunction({
          name: 'admin',
          data: {
            action: 'productCRUD',
            operation: 'delete',
            productId: id
          }
        })
      );
      await Promise.all(deletePromises);

      wx.showToast({ title: '删除成功', icon: 'success' });
      this.exitBatchMode();
      this.refreshList();
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
      url: `/package-admin/pages/product-edit/product-edit?id=${id}`
    });
  },

  // 切换商品状态
  async toggleStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const newStatus = status === 'on' ? 0 : 1;

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'productCRUD',
          operation: 'update',
          productId: id,
          productData: { status: newStatus }
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: newStatus === 1 ? '上架成功' : '下架成功',
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
        name: 'admin',
        data: {
          action: 'productCRUD',
          operation: 'delete',
          productId: id
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
      url: '/package-admin/pages/product-edit/product-edit'
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
  stopPropagation() {},

  // 图片加载失败处理
  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    const { products } = this.data;

    // 更新该商品的图片为默认图片
    if (products[index] && products[index].displayImage !== '/images/default-product.png') {
      products[index].displayImage = '/images/default-product.png';
      this.setData({ products });
    }
  }
});
