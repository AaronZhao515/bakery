/**
 * 购物车页面逻辑
 * 功能：商品列表展示、数量调整、选择管理、左滑删除、价格计算
 */

const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    // 购物车商品列表
    cartList: [],
    // 是否全选
    isAllSelected: false,
    // 选中商品数量
    selectedCount: 0,
    // 商品总额
    totalPrice: '0.00',
    // 优惠金额
    discount: '0.00',
    // 删除弹窗显示状态
    showDeleteModal: false,
    // 待删除的商品索引
    deleteIndex: -1,
    // 推荐商品列表
    recommendList: [],
    // 触摸起始位置
    touchStartX: 0,
    // 当前滑动的商品索引
    slidingIndex: -1,
    // 是否正在加载
    isLoading: true
  },

  onLoad() {
    this.loadCartData();
    this.loadRecommendData();
  },

  onShow() {
    // 每次显示页面时刷新购物车数据
    this.loadCartData();
  },

  /**
   * 加载购物车数据（从 CloudBase）
   */
  async loadCartData() {
    wx.showLoading({ title: '加载中' });

    try {
      // 从 CloudBase 获取购物车数据
      const result = await api.cart.getList();
      console.log('[购物车] 获取数据:', result);

      if (result && result.success && result.data) {
        const cartData = result.data.list || [];

        // 初始化滑动位置和选中状态
        const cartList = cartData.map(item => ({
          ...item,
          _id: item._id || item.cartId,
          name: item.productName || item.name,
          imageUrl: item.productImage || item.image || item.imageUrl,
          price: item.price || 0,
          quantity: item.quantity || 1,
          selected: item.selected !== false, // 默认选中
          slideX: 0
        }));

        this.setData({
          cartList,
          isLoading: false
        }, () => {
          this.updateSelectAllStatus();
          this.calculateTotal();
        });
      } else {
        this.setData({
          cartList: [],
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载购物车数据失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ isLoading: false });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 加载推荐商品数据
   */
  async loadRecommendData() {
    try {
      // 模拟推荐商品数据
      const mockRecommendData = [
        {
          _id: 'prod_004',
          name: '经典可颂',
          price: '18.00',
          imageUrl: '/images/bread-4.jpg'
        },
        {
          _id: 'prod_005',
          name: '巧克力麦芬',
          price: '15.00',
          imageUrl: '/images/bread-5.jpg'
        },
        {
          _id: 'prod_006',
          name: '肉桂卷',
          price: '22.00',
          imageUrl: '/images/bread-6.jpg'
        },
        {
          _id: 'prod_007',
          name: '蓝莓贝果',
          price: '16.00',
          imageUrl: '/images/bread-7.jpg'
        }
      ];
      
      this.setData({ recommendList: mockRecommendData });
    } catch (error) {
      console.error('加载推荐商品失败:', error);
    }
  },

  /**
   * 切换单个商品选择状态
   */
  async toggleItemSelect(e) {
    const index = e.currentTarget.dataset.index;
    const { cartList } = this.data;
    const item = cartList[index];

    const newSelected = !item.selected;

    try {
      // 调用 API 更新选中状态
      const result = await api.cart.update(item._id, { selected: newSelected });
      if (result && result.success) {
        item.selected = newSelected;
        this.setData({ cartList }, () => {
          this.updateSelectAllStatus();
          this.calculateTotal();
        });
      }
    } catch (error) {
      console.error('更新选中状态失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  /**
   * 切换全选状态
   */
  async toggleSelectAll() {
    const { cartList, isAllSelected } = this.data;
    const newSelectedStatus = !isAllSelected;

    // 获取所有购物车项ID
    const cartIds = cartList.map(item => item._id);

    try {
      // 调用 API 批量更新选中状态
      const result = await api.cart.updateSelected(cartIds, newSelectedStatus);
      if (result && result.success) {
        cartList.forEach(item => {
          item.selected = newSelectedStatus;
        });
        this.setData({
          cartList,
          isAllSelected: newSelectedStatus
        }, () => {
          this.calculateTotal();
        });
      }
    } catch (error) {
      console.error('更新全选状态失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  /**
   * 更新全选状态
   */
  updateSelectAllStatus() {
    const { cartList } = this.data;
    const allSelected = cartList.length > 0 && cartList.every(item => item.selected);
    
    this.setData({ isAllSelected: allSelected });
  },

  /**
   * 计算总价
   */
  calculateTotal() {
    const { cartList } = this.data;
    let total = 0;
    let selectedCount = 0;
    
    cartList.forEach(item => {
      if (item.selected) {
        total += parseFloat(item.price) * item.quantity;
        selectedCount += item.quantity;
      }
    });
    
    // 计算优惠（示例：满100减10）
    let discount = 0;
    if (total >= 100) {
      discount = 10;
    }
    
    this.setData({
      totalPrice: total.toFixed(2),
      discount: discount.toFixed(2),
      selectedCount
    });
  },

  /**
   * 增加数量
   */
  async increaseQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const { cartList } = this.data;
    const item = cartList[index];

    // 检查库存
    if (item.quantity >= item.stock) {
      wx.showToast({ title: '库存不足', icon: 'none' });
      return;
    }

    const newQuantity = item.quantity + 1;

    try {
      // 调用 API 更新数量
      const result = await api.cart.update(item._id, { quantity: newQuantity });
      if (result && result.success) {
        item.quantity = newQuantity;
        this.setData({ cartList }, () => {
          this.calculateTotal();
        });
      }
    } catch (error) {
      console.error('更新数量失败:', error);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  /**
   * 减少数量
   */
  async decreaseQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const { cartList } = this.data;
    const item = cartList[index];

    if (item.quantity <= 1) {
      return;
    }

    const newQuantity = item.quantity - 1;

    try {
      // 调用 API 更新数量
      const result = await api.cart.update(item._id, { quantity: newQuantity });
      if (result && result.success) {
        item.quantity = newQuantity;
        this.setData({ cartList }, () => {
          this.calculateTotal();
        });
      }
    } catch (error) {
      console.error('更新数量失败:', error);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  /**
   * 数量输入
   */
  onQuantityInput(e) {
    const index = e.currentTarget.dataset.index;
    let value = parseInt(e.detail.value);
    const { cartList } = this.data;
    const item = cartList[index];
    
    // 验证输入
    if (isNaN(value) || value < 1) {
      value = 1;
    } else if (value > item.stock) {
      value = item.stock;
      wx.showToast({
        title: '超出库存限制',
        icon: 'none'
      });
    }
    
    item.quantity = value;
    
    this.setData({ cartList }, () => {
      this.calculateTotal();
      this.saveCartData();
    });
  },

  /**
   * 触摸开始
   */
  touchStart(e) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      slidingIndex: e.currentTarget.dataset.index
    });
  },

  /**
   * 触摸结束
   */
  touchEnd(e) {
    const touchEndX = e.changedTouches[0].clientX;
    const touchStartX = this.data.touchStartX;
    const index = e.currentTarget.dataset.index;
    const { cartList } = this.data;
    
    // 计算滑动距离
    const diff = touchStartX - touchEndX;
    
    // 滑动超过60rpx显示删除按钮
    if (diff > 30) {
      // 左滑显示删除
      cartList[index].slideX = -160;
      // 关闭其他项的滑动
      cartList.forEach((item, i) => {
        if (i !== index) {
          item.slideX = 0;
        }
      });
    } else if (diff < -30) {
      // 右滑关闭
      cartList[index].slideX = 0;
    }
    
    this.setData({ cartList });
  },

  /**
   * 删除商品
   */
  deleteItem(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      showDeleteModal: true,
      deleteIndex: index
    });
  },

  /**
   * 确认删除
   */
  async confirmDelete() {
    const { cartList, deleteIndex } = this.data;
    const item = cartList[deleteIndex];

    try {
      // 调用 API 删除商品
      const result = await api.cart.remove([item._id]);
      if (result && result.success) {
        cartList.splice(deleteIndex, 1);
        this.setData({
          cartList,
          showDeleteModal: false,
          deleteIndex: -1
        }, () => {
          this.updateSelectAllStatus();
          this.calculateTotal();
          wx.showToast({ title: '删除成功', icon: 'success' });
        });
      } else {
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    } catch (error) {
      console.error('删除商品失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  /**
   * 取消删除
   */
  cancelDelete() {
    const { cartList, deleteIndex } = this.data;
    
    // 恢复滑动位置
    if (deleteIndex >= 0) {
      cartList[deleteIndex].slideX = 0;
    }
    
    this.setData({
      cartList,
      showDeleteModal: false,
      deleteIndex: -1
    });
  },

  /**
   * 保存购物车数据到本地
   */
  saveCartData() {
    // 已废弃，现在使用 CloudBase API
  },

  /**
   * 前往结算
   */
  goToCheckout() {
    const { cartList, selectedCount, totalPrice } = this.data;
    
    if (selectedCount === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    
    // 获取选中的商品
    const selectedItems = cartList.filter(item => item.selected);
    
    // 检查库存
    const stockInsufficient = selectedItems.some(item => item.quantity > item.stock);
    if (stockInsufficient) {
      wx.showToast({ title: '部分商品库存不足', icon: 'none' });
      return;
    }
    
    // 保存结算商品数据
    wx.setStorageSync('checkoutData', {
      items: selectedItems,
      totalPrice,
      discount: this.data.discount,
      payPrice: (parseFloat(totalPrice) - parseFloat(this.data.discount)).toFixed(2)
    });
    
    // 跳转到确认订单页（从主包）
    wx.navigateTo({
      url: '/package-order/pages/order-confirm/order-confirm?type=pickup'
    });
  },

  /**
   * 去逛逛
   */
  goToShop() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 查看商品详情
   */
  goToProduct(e) {
    const productId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${productId}`
    });
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadCartData();
    wx.stopPullDownRefresh();
  }
});
