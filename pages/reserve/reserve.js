/**
 * 预定页面
 * 面包烘焙小程序 - 预定页面 (匹配Figma设计)
 */

const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const auth = require('../../utils/auth');

Page({
  data: {
    // 订单类型: pickup=自取, delivery=配送
    orderType: 'pickup',
    pageTitle: '预定自取',

    // Sub tabs
    activeSubTab: 0,
    subTabs: [
      { label: '会员', sub: 'Member' },
      { label: '充值', sub: 'Recharge' },
      { label: '积分', sub: 'Integral' }
    ],

    // Categories
    activeCategory: 'handmade',
    categories: [
      { id: 'afternoon', label: '下午茶甜品', iconUrl: icons.cart },
      { id: 'handmade', label: '手作面包', iconUrl: icons.bread },
      { id: 'custom', label: '定制甜品台', iconUrl: icons.vipCard },
      { id: 'snack', label: '常温点心', iconUrl: icons.package }
    ],

    // Products
    products: [],

    // Cart
    cartCount: 0,
    cartItems: [],
    cartTotal: 0,

    // Page state
    isLoading: true,
    hasError: false,

    // Base64 icons
    icons: icons,

    // Quantity selector modal
    showQuantityModal: false,
    selectedProduct: null,
    selectedQuantity: 1,
    totalPrice: '0.00',
    cartTotal: '0.00'
  },

  onLoad(options) {
    console.log('[预定] 页面加载', options);
    this.loadOrderType();
    this.loadProducts();
  },

  onShow() {
    console.log('[预定] 页面显示');
    // 加载订单类型
    this.loadOrderType();
    // 刷新购物车数据
    this.refreshCartList();
    // 设置自定义 tabBar 选中状态
    this.setTabBarSelected();
  },

  /**
   * 加载订单类型
   */
  loadOrderType() {
    // 从全局 store 或本地存储读取订单类型
    let orderType = 'pickup';
    const app = getApp();

    if (app.store && app.store.appStore) {
      orderType = app.store.appStore.get('orderType') || 'pickup';
    } else {
      orderType = wx.getStorageSync('orderType') || 'pickup';
    }

    const pageTitle = orderType === 'delivery' ? '预定配送' : '预定自取';

    console.log('[预定] 订单类型:', orderType, '页面标题:', pageTitle);

    this.setData({
      orderType: orderType,
      pageTitle: pageTitle
    });
  },

  /**
   * 设置自定义 tabBar 选中状态
   */
  setTabBarSelected() {
    console.log('[预定] 设置 tabBar 选中');
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected(1);
      console.log('[预定] tabBar 选中状态已设置为 1');
    } else {
      console.log('[预定] getTabBar 不可用');
    }
  },

  /**
   * 从 CloudBase 加载商品列表
   */
  async loadProducts() {
    this.setData({ isLoading: true, hasError: false });

    try {
      const res = await api.product.getList({
        canReserve: true,
        limit: 50
      });

      console.log('[预定] API返回数据:', res);

      // 处理不同的返回格式
      let productList = [];
      if (res && res.data && Array.isArray(res.data.list)) {
        productList = res.data.list;
      } else if (res && res.data && Array.isArray(res.data.data)) {
        productList = res.data.data;
      } else if (Array.isArray(res)) {
        productList = res;
      } else if (res && Array.isArray(res.data)) {
        productList = res.data;
      }

      // Format products to match Figma design
      const products = productList.map(item => ({
        ...item,
        _id: item._id || item.id,
        name: item.name || '未命名商品',
        price: item.price || 0,
        image: item.image || (item.images && item.images[0]) || 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/product-default.png',
        desc: item.description || item.desc || '精选原料 · 手工制作'
      }));

      this.setData({
        products: products,
        isLoading: false
      });

      console.log('[预定] 从 CloudBase 加载产品成功:', products.length, '个');
    } catch (error) {
      console.error('[预定] 加载商品失败', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.setData({
        isLoading: false,
        hasError: true
      });
    }
  },

  /**
   * 更新购物车信息
   */
  updateCartInfo() {
    const cartStore = app.store && app.store.cartStore;
    if (cartStore) {
      const items = cartStore.get('items') || [];
      const totalPrice = cartStore.get('totalPrice') || 0;
      const count = items.reduce((sum, i) => sum + (i.quantity || i.qty || 1), 0);
      console.log('[预定] 更新购物车信息:', count, '件商品, 总价:', totalPrice);
      this.setData({
        cartItems: items,
        cartCount: count,
        cartTotal: parseFloat(totalPrice).toFixed(2)
      });
    } else {
      console.log('[预定] cartStore 不可用');
    }
  },

  /**
   * 刷新购物车列表
   */
  async refreshCartList() {
    try {
      const result = await api.cart.getList();
      console.log('[预定] 刷新购物车结果:', result);
      if (result && result.success && result.data) {
        const cartData = result.data;
        const items = cartData.list || [];
        const totalAmount = cartData.totalAmount || 0;
        const count = items.reduce((sum, i) => sum + (i.quantity || i.qty || 1), 0);
        console.log('[预定] 购物车数据:', count, '件商品, 总价:', totalAmount);
        this.setData({
          cartItems: items,
          cartCount: count,
          cartTotal: parseFloat(totalAmount).toFixed(2)
        });
        // 同时更新 store
        const cartStore = app.store && app.store.cartStore;
        if (cartStore) {
          cartStore.set('items', items);
          cartStore.set('totalPrice', totalAmount);
          cartStore.set('totalCount', count);
        }
      }
    } catch (error) {
      console.error('[预定] 刷新购物车失败:', error);
    }
  },

  /**
   * Sub tab change
   */
  onSubTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeSubTab: index });
  },

  /**
   * Category change
   */
  onCategoryChange(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ activeCategory: id });
    // Could filter products by category here
  },

  /**
   * 显示数量选择弹窗
   */
  onAddToCart(e) {
    console.log('[预定] 点击购物车按钮', e);
    const { product } = e.currentTarget.dataset;
    console.log('[预定] 产品数据', product);

    if (!product) {
      console.error('[预定] 产品数据为空');
      wx.showToast({ title: '商品数据错误', icon: 'none' });
      return;
    }

    const productId = product._id || product.id;
    if (!productId) {
      console.error('[预定] 商品ID为空', product);
      wx.showToast({ title: '商品信息不完整', icon: 'none' });
      return;
    }

    console.log('[预定] 显示数量选择弹窗', productId);
    const totalPrice = (product.price * 1).toFixed(2);
    this.setData({
      showQuantityModal: true,
      selectedProduct: product,
      selectedQuantity: 1,
      totalPrice: totalPrice
    }, () => {
      console.log('[预定] setData 完成，showQuantityModal:', this.data.showQuantityModal);
    });
  },

  /**
   * 关闭数量选择弹窗
   */
  onCloseQuantityModal() {
    this.setData({
      showQuantityModal: false,
      selectedProduct: null,
      selectedQuantity: 1
    });
  },

  /**
   * 减少数量
   */
  onDecreaseQuantity() {
    const { selectedQuantity, selectedProduct } = this.data;
    if (selectedQuantity > 1) {
      const newQuantity = selectedQuantity - 1;
      const totalPrice = (selectedProduct.price * newQuantity).toFixed(2);
      this.setData({
        selectedQuantity: newQuantity,
        totalPrice: totalPrice
      });
    }
  },

  /**
   * 增加数量
   */
  onIncreaseQuantity() {
    const { selectedQuantity, selectedProduct } = this.data;
    if (selectedQuantity < 99) {
      const newQuantity = selectedQuantity + 1;
      const totalPrice = (selectedProduct.price * newQuantity).toFixed(2);
      this.setData({
        selectedQuantity: newQuantity,
        totalPrice: totalPrice
      });
    }
  },

  /**
   * 输入数量
   */
  onQuantityInput(e) {
    const { selectedProduct } = this.data;
    let value = parseInt(e.detail.value) || 1;
    if (value < 1) value = 1;
    if (value > 99) value = 99;
    const totalPrice = (selectedProduct.price * value).toFixed(2);
    this.setData({
      selectedQuantity: value,
      totalPrice: totalPrice
    });
  },

  /**
   * 确认添加到购物车
   */
  async onConfirmAddToCart() {
    console.log('[预定] 点击确认添加按钮');

    // 检查登录状态 - 同时检查 store 和 auth 模块
    const userStore = app.store && app.store.userStore;
    const storeLogin = userStore && userStore.get('isLogin');
    const authLogin = auth.isLogin();
    const isLogin = storeLogin || authLogin;

    console.log('[预定] 登录状态检查:', { storeLogin, authLogin, isLogin });

    if (!isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再添加商品到购物车',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/user' });
          }
        }
      });
      return;
    }

    const { selectedProduct, selectedQuantity } = this.data;
    console.log('[预定] 选中产品:', selectedProduct, '数量:', selectedQuantity);

    if (!selectedProduct) {
      console.error('[预定] 未选择产品');
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }

    const productId = selectedProduct._id || selectedProduct.id;
    console.log('[预定] 产品ID:', productId);

    wx.showLoading({ title: '添加中...' });

    try {
      const result = await api.cart.add({
        productId: productId,
        quantity: selectedQuantity,
        orderType: this.data.orderType
      });
      console.log('[预定] 添加购物车结果:', result);

      wx.hideLoading();

      if (result && result.success) {
        wx.showToast({ title: '已加入购物车', icon: 'success' });
        // 重新获取购物车列表
        await this.refreshCartList();
        this.onCloseQuantityModal();
      } else {
        const errorMsg = result && result.message ? result.message : '';
        if (errorMsg.includes('未登录')) {
          wx.showModal({
            title: '提示',
            content: '请先登录后再添加商品到购物车',
            confirmText: '去登录',
            success: (res) => {
              if (res.confirm) {
                wx.switchTab({ url: '/pages/user/user' });
              }
            }
          });
        } else {
          wx.showToast({ title: errorMsg || '添加失败', icon: 'none' });
        }
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[预定] 添加购物车失败:', error);
      const errorMsg = error.message || '';
      if (errorMsg.includes('未登录')) {
        wx.showModal({
          title: '提示',
          content: '请先登录后再添加商品到购物车',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({ url: '/pages/user/user' });
            }
          }
        });
      } else {
        wx.showToast({ title: '添加失败，请重试', icon: 'none' });
      }
    }
  },

  /**
   * 去结算
   */
  onCheckout() {
    if (this.data.cartItems.length === 0) {
      util.showToast('请先选择商品');
      return;
    }

    const orderType = this.data.orderType || 'pickup';
    wx.navigateTo({
      url: `/package-order/pages/order-confirm/order-confirm?type=${orderType}`
    });
  },

  /**
   * 购物车浮标点击 - 查看购物车并预定
   */
  onGoToCart() {
    // 跳转到购物车页面查看内容
    wx.navigateTo({
      url: '/pages/cart/cart'
    });
  },

  /**
   * Back button
   */
  onBackTap() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '暖心烘焙 - 新鲜预定',
      path: '/pages/reserve/reserve'
    };
  },

  /**
   * 阻止事件冒泡
   */
  onModalTap() {
    // 阻止事件冒泡，防止点击弹窗内容时关闭弹窗
  }
});
