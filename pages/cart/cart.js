/**
 * 购物车页面逻辑
 * 功能：商品列表展示、数量调整、选择管理、价格计算、立即预定
 */

const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    // 购物车商品列表
    cartList: [],
    // 订单类型 pickup/delivery
    orderType: 'pickup',
    // 商品总额
    totalPrice: '0.00',
    // 优惠金额
    discount: '0.00',
    // 是否正在加载
    isLoading: true,
    // Base64 icons
    icons: {}
  },

  onLoad() {
    // 加载图标
    const icons = require('../../utils/icons.js');
    this.setData({ icons });
    // 加载订单类型
    this.loadOrderType();
    this.loadCartData();
  },

  onShow() {
    // 每次显示页面时刷新购物车数据
    this.loadCartData();
    // 刷新订单类型
    this.loadOrderType();
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

    console.log('[购物车] 订单类型:', orderType);
    this.setData({ orderType });
  },

  /**
   * 加载购物车数据（从 CloudBase）
   */
  async loadCartData() {
    // 检查登录状态
    const auth = require('../../utils/auth');
    const isLogin = auth.isLogin();

    if (!isLogin) {
      // 未登录状态：清空购物车数据
      this.setData({
        cartList: [],
        totalPrice: '0.00',
        discount: '0.00',
        isLoading: false
      });
      return;
    }

    wx.showLoading({ title: '加载中' });

    try {
      // 从 CloudBase 获取购物车数据
      const result = await api.cart.getList();
      console.log('[购物车] 获取原始数据:', JSON.stringify(result, null, 2));

      if (result && result.success && result.data) {
        const cartData = result.data.list || [];
        console.log('[购物车] 商品数量:', cartData.length);

        // 初始化选中状态
        const cartList = cartData.map((item, index) => {
          // 详细日志每个商品的 _id
          console.log(`[购物车] 商品${index}:`, {
            name: item.productName,
            _id: item._id,
            _idType: typeof item._id,
            cartId: item.cartId
          });

          // 确保 _id 是字符串（CloudBase 返回的 _id 可能是对象）
          let cartId = '';
          if (item._id) {
            // 如果是对象，尝试取 _id 属性，否则转为字符串
            cartId = typeof item._id === 'object' ? (item._id._id || item._id.toString()) : String(item._id);
          } else if (item.cartId) {
            cartId = String(item.cartId);
          }

          console.log('[购物车] 处理后ID:', cartId);

          // 处理图片URL（云存储路径直接使用原路径）
          let imageUrl = item.productImage || item.image || item.imageUrl;

          return {
            ...item,
            _id: cartId,
            cartId: cartId,
            productId: item.productId || cartId, // 确保有 productId
            name: item.productName || item.name,
            imageUrl: imageUrl,
            price: item.price || 0,
            quantity: item.quantity || 1,
            selected: item.selected !== false, // 默认选中
          };
        });

        console.log('[购物车] 最终列表:', cartList.map(i => ({ name: i.name, id: i._id })));

        this.setData({
          cartList,
          isLoading: false
        }, () => {
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
   * 计算总价
   */
  calculateTotal() {
    const { cartList } = this.data;
    let total = 0;
    let totalQty = 0;

    cartList.forEach(item => {
      total += parseFloat(item.price) * item.quantity;
      totalQty += item.quantity;
    });

    this.setData({
      totalPrice: total.toFixed(2),
      totalQty
    });
  },

  /**
   * 增加数量
   */
  async increaseQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const { cartList } = this.data;
    const item = cartList[index];

    // 检查 cartId
    if (!item._id) {
      console.error('[购物车] 商品ID为空:', item);
      wx.showToast({ title: '商品ID无效', icon: 'none' });
      return;
    }

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

    // 检查 cartId
    if (!item._id) {
      console.error('[购物车] 商品ID为空:', item);
      wx.showToast({ title: '商品ID无效', icon: 'none' });
      return;
    }

    if (item.quantity <= 1) {
      // 数量为1时，询问是否删除
      wx.showModal({
        title: '提示',
        content: '是否从购物车删除该商品？',
        confirmText: '删除',
        confirmColor: '#9B7355',
        success: async (res) => {
          if (res.confirm) {
            await this.deleteCartItem(item._id, index);
          }
        }
      });
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
   * 删除购物车商品
   */
  async deleteCartItem(cartId, index) {
    try {
      // 调用 API 删除商品
      const result = await api.cart.remove([cartId]);
      if (result && result.success) {
        const { cartList } = this.data;
        cartList.splice(index, 1);
        this.setData({ cartList }, () => {
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
   * 返回上一页
   */
  onBackTap() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    });
  },

  /**
   * 删除单个商品
   */
  onDeleteItem(e) {
    const index = e.currentTarget.dataset.index;
    const { cartList } = this.data;
    const item = cartList[index];

    wx.showModal({
      title: '提示',
      content: '是否从购物车删除该商品？',
      confirmText: '删除',
      confirmColor: '#9B7355',
      success: async (res) => {
        if (res.confirm) {
          await this.deleteCartItem(item._id, index);
        }
      }
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
   * 立即预定
   */
  goToCheckout() {
    const { cartList, totalPrice } = this.data;

    if (cartList.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }

    // 检查库存
    const stockInsufficient = cartList.some(item => item.quantity > item.stock);
    if (stockInsufficient) {
      wx.showToast({ title: '部分商品库存不足', icon: 'none' });
      return;
    }

    // 保存结算商品数据
    wx.setStorageSync('checkoutData', {
      items: cartList,
      totalPrice,
      discount: this.data.discount,
      payPrice: (parseFloat(totalPrice) - parseFloat(this.data.discount)).toFixed(2)
    });

    // 跳转到确认订单页，使用当前订单类型
    const orderType = this.data.orderType || 'pickup';
    wx.navigateTo({
      url: `/package-order/pages/order-confirm/order-confirm?type=${orderType}`
    });
  },

  /**
   * 图片加载失败处理
   */
  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    const { cartList } = this.data;
    const defaultImage = 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/product-default.png';

    // 更新该商品的图片为默认图片
    if (cartList[index] && cartList[index].imageUrl !== defaultImage) {
      cartList[index].imageUrl = defaultImage;
      this.setData({ cartList });
    }
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '暖心烘焙 - 我的购物车',
      path: '/pages/cart/cart'
    };
  }
});
