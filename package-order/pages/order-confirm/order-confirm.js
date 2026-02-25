/**
 * 订单确认页面
 * 面包烘焙小程序 - 预定订单确认
 */

const app = getApp();
const api = require('../../../utils/api.js');
const util = require('../../../utils/util.js');

Page({
  data: {
    // 订单类型 pickup/delivery
    orderType: 'pickup',
    // 订单商品
    orderItems: [],
    // 商品总数
    totalQty: 0,
    // 商品总价
    totalPrice: '0.00',
    // 优惠金额
    discount: '0.00',
    // 应付金额
    payPrice: '0.00',
    // 选择的优惠券
    selectedCoupon: null,
    // 可用优惠券列表
    availableCoupons: [],
    // 不可用优惠券列表
    unavailableCoupons: [],
    // 选择的地址（配送时）
    selectedAddress: null,
    // 选择的取餐时间（自取时）
    selectedTime: '',
    // 订单备注
    remark: '',
    // 是否正在提交
    isSubmitting: false,
    // Base64 icons
    icons: {}
  },

  onLoad(options) {
    console.log('[订单确认] 页面加载', options);

    // 加载图标
    const icons = require('../../../utils/icons.js');
    this.setData({ icons });

    // 获取订单类型
    const orderType = options.type || 'pickup';
    this.setData({ orderType });

    // 加载订单数据
    this.loadOrderData().then(() => {
      // 订单数据加载完成后，加载可用优惠券
      this.loadAvailableCoupons();
    });

    // 加载默认地址
    if (orderType === 'delivery') {
      this.loadDefaultAddress();
    }

    // 检查是否有从优惠券页面返回的选中优惠券
    this.checkSelectedCouponFromStorage();
  },

  onUnload() {
    // 清除临时存储的选中优惠券和标记
    wx.removeStorageSync('selectedCouponForOrder');
    wx.removeStorageSync('couponSelectionMade');
  },

  onShow() {
    console.log('[订单确认] 页面显示');
    // 检查是否有从优惠券页面返回的选中优惠券
    this.checkSelectedCouponFromStorage();
  },

  /**
   * 加载订单数据
   */
  loadOrderData() {
    return new Promise((resolve) => {
      try {
        const checkoutData = wx.getStorageSync('checkoutData');
        console.log('[订单确认] 订单数据:', checkoutData);

        if (checkoutData && checkoutData.items) {
          const { items, totalPrice, discount = '0.00' } = checkoutData;

          // 计算总数量
          const totalQty = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

          // 计算应付金额（先不计算优惠券折扣，等优惠券加载完再计算）
          const payPrice = (parseFloat(totalPrice) - parseFloat(discount)).toFixed(2);

          this.setData({
            orderItems: items,
            totalQty,
            totalPrice,
            discount,
            payPrice: payPrice > 0 ? payPrice : '0.00'
          }, () => {
            resolve(true);
          });
        } else {
          // 没有订单数据，返回购物车
          wx.showToast({
            title: '请先选择商品',
            icon: 'none',
            complete: () => {
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          });
          resolve(false);
        }
      } catch (error) {
        console.error('[订单确认] 加载订单数据失败:', error);
        resolve(false);
      }
    });
  },

  /**
   * 检查从优惠券页面返回的选中优惠券
   */
  checkSelectedCouponFromStorage() {
    // 检查是否有 couponSelectionMade 标记，表示用户从优惠券页面返回
    const selectionMade = wx.getStorageSync('couponSelectionMade');
    if (!selectionMade) return;

    // 清除标记
    wx.removeStorageSync('couponSelectionMade');

    const selectedCoupon = wx.getStorageSync('selectedCouponForOrder');
    if (selectedCoupon) {
      console.log('[订单确认] 从优惠券页面返回，选中优惠券:', selectedCoupon);
      this.selectCoupon(selectedCoupon);
    } else {
      // 用户选择了"不使用优惠券"
      console.log('[订单确认] 用户选择不使用优惠券');
      this.cancelSelectCoupon();
    }
  },

  /**
   * 加载可用优惠券
   */
  async loadAvailableCoupons() {
    const { totalPrice } = this.data;
    const totalAmount = parseFloat(totalPrice);

    try {
      // 调用API获取可用优惠券
      const result = await api.coupon.getAvailable(totalAmount);
      console.log('[订单确认] 可用优惠券:', result);

      if (result && result.success && result.data) {
        const { availableList = [], unavailableList = [] } = result.data;

        // 格式化优惠券数据
        const formattedAvailable = this.formatCouponsForDisplay(availableList, true);
        const formattedUnavailable = this.formatCouponsForDisplay(unavailableList, false);

        this.setData({
          availableCoupons: formattedAvailable,
          unavailableCoupons: formattedUnavailable
        });

        // 如果有可用的优惠券，默认选择优惠力度最大的
        if (formattedAvailable.length > 0 && !this.data.selectedCoupon) {
          // 按优惠金额排序，选择最大的
          const bestCoupon = formattedAvailable[0];
          console.log('[订单确认] 自动选择最佳优惠券:', bestCoupon);
          this.selectCoupon(bestCoupon);
        }
      } else {
        console.warn('[订单确认] 获取优惠券失败:', result?.message);
      }
    } catch (error) {
      console.error('[订单确认] 加载优惠券失败:', error);
      wx.showToast({
        title: '优惠券加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化优惠券用于显示
   */
  formatCouponsForDisplay(couponList, isAvailable = true) {
    return couponList.map(item => {
      const coupon = item.coupon || {};
      const userCouponId = item._id || item.userCouponId;

      // 计算优惠金额
      let discountAmount = 0;
      let displayValue = '';
      let displayType = '';

      if (coupon.type === 1 || coupon.discountType === 'discount') {
        // 折扣券
        const discountRate = coupon.amount || 10;
        discountAmount = (this.data.totalPrice * (1 - discountRate / 10)).toFixed(2);
        displayValue = discountRate + '折';
        displayType = 'discount';
      } else {
        // 满减券
        discountAmount = coupon.amount || 0;
        displayValue = '¥' + discountAmount;
        displayType = 'amount';
      }

      return {
        id: userCouponId,
        couponId: item.couponId,
        title: coupon.title || coupon.name || '优惠券',
        desc: coupon.desc || coupon.description || `满${coupon.minAmount || 0}元可用`,
        amount: parseFloat(discountAmount),
        displayValue,
        displayType,
        minAmount: coupon.minAmount || 0,
        endTime: coupon.endTime,
        endTimeStr: this.formatCouponTime(coupon.endTime),
        // 不可用原因
        reason: item.reason || '',
        isAvailable: isAvailable
      };
    });
  },

  /**
   * 格式化优惠券时间
   */
  formatCouponTime(endTime) {
    if (!endTime) return '';
    const date = new Date(endTime);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  },

  /**
   * 选择优惠券
   */
  selectCoupon(coupon) {
    const { totalPrice, discount } = this.data;
    const totalAmount = parseFloat(totalPrice);
    const activityDiscount = parseFloat(discount);
    const couponDiscount = coupon ? coupon.amount : 0;

    // 计算实付金额
    let payPrice = totalAmount - activityDiscount - couponDiscount;
    if (payPrice < 0) payPrice = 0;

    this.setData({
      selectedCoupon: coupon,
      payPrice: payPrice.toFixed(2)
    });

    console.log('[订单确认] 选择优惠券:', coupon, '实付金额:', payPrice.toFixed(2));
  },

  /**
   * 取消选择优惠券
   */
  cancelSelectCoupon() {
    const { totalPrice, discount } = this.data;
    const totalAmount = parseFloat(totalPrice);
    const activityDiscount = parseFloat(discount);

    this.setData({
      selectedCoupon: null,
      payPrice: (totalAmount - activityDiscount).toFixed(2)
    });
  },

  /**
   * 加载默认地址
   */
  async loadDefaultAddress() {
    try {
      const result = await api.address.getList();
      console.log('[订单确认] 地址列表:', result);

      if (result && result.success && result.data) {
        const addresses = result.data;
        const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];

        if (defaultAddress) {
          this.setData({
            selectedAddress: {
              id: defaultAddress._id,
              name: defaultAddress.name,
              phone: defaultAddress.phone,
              address: `${defaultAddress.province}${defaultAddress.city}${defaultAddress.district}${defaultAddress.address}`
            }
          });
        }
      }
    } catch (error) {
      console.error('[订单确认] 加载地址失败:', error);
    }
  },

  /**
   * 返回上一页
   */
  onBackTap() {
    wx.navigateBack();
  },

  /**
   * 选择取餐时间
   */
  onSelectTime() {
    const times = ['尽快取餐', '15分钟后', '30分钟后', '1小时后', '2小时后'];

    wx.showActionSheet({
      itemList: times,
      success: (res) => {
        this.setData({
          selectedTime: times[res.tapIndex]
        });
      }
    });
  },

  /**
   * 选择配送地址
   */
  onSelectAddress() {
    wx.navigateTo({
      url: '/package-user/pages/address/address?select=true'
    });
  },

  /**
   * 选择优惠券 - 跳转到优惠券选择页面
   */
  onSelectCoupon() {
    const { totalPrice } = this.data;
    wx.navigateTo({
      url: `/package-order/pages/coupon-select/coupon-select?amount=${totalPrice}`
    });
  },

  /**
   * 输入备注
   */
  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  /**
   * 提交订单
   */
  async onSubmitOrder() {
    if (this.data.isSubmitting) return;

    const { orderType, orderItems, selectedAddress, remark, payPrice } = this.data;

    // 配送订单检查地址
    if (orderType === 'delivery' && !selectedAddress) {
      wx.showToast({ title: '请选择配送地址', icon: 'none' });
      return;
    }

    // 检查商品
    if (orderItems.length === 0) {
      wx.showToast({ title: '订单商品不能为空', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      // 构建订单数据 - 匹配云函数期望的格式
      const products = orderItems.map(item => {
        const productId = item.productId || item._id;
        console.log('[订单确认] 商品ID:', productId, '数量:', item.quantity);
        return {
          productId: productId,
          quantity: parseInt(item.quantity) || 1
        };
      });

      // 处理优惠券ID - 使用userCouponId
      let userCouponId = '';
      if (this.data.selectedCoupon) {
        // selectedCoupon.id 应该是 userCouponId
        userCouponId = this.data.selectedCoupon.id || '';
        console.log('[订单确认] 使用优惠券:', this.data.selectedCoupon.title, 'ID:', userCouponId);
      }

      const orderData = {
        products: products,
        addressId: orderType === 'delivery' ? (selectedAddress ? selectedAddress.id : '') : '',
        deliveryType: orderType === 'delivery' ? 1 : 0,
        pickupTime: orderType === 'pickup' ? (this.data.selectedTime || '尽快取餐') : '',
        remark: remark || '',
        userCouponId: userCouponId
      };

      console.log('[订单确认] 提交订单:', orderData);

      // 调用创建订单 API
      const result = await api.order.create(orderData);
      console.log('[订单确认] 创建结果:', result);

      wx.hideLoading();

      if (result && result.success) {
        const { orderId, payParams } = result.data;

        wx.showToast({
          title: '订单创建成功',
          icon: 'success'
        });

        // 清除购物车数据
        this.clearCartItems();

        // 跳转到订单详情页
        wx.redirectTo({
          url: `/package-order/pages/order-detail/order-detail?id=${orderId}`
        });
      } else {
        this.setData({ isSubmitting: false });
        wx.showToast({
          title: result.message || '创建订单失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
      console.error('[订单确认] 提交订单失败:', error);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 清空购物车中已下单的商品
   */
  async clearCartItems() {
    try {
      const { orderItems } = this.data;
      const cartIds = orderItems
        .filter(item => item.cartId || item._id)
        .map(item => item.cartId || item._id);

      if (cartIds.length > 0) {
        await api.cart.remove(cartIds);
      }

      // 清除结算数据
      wx.removeStorageSync('checkoutData');
    } catch (error) {
      console.error('[订单确认] 清空购物车失败:', error);
    }
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '暖心烘焙 - 确认订单',
      path: '/package-order/pages/order-confirm/order-confirm'
    };
  }
});
