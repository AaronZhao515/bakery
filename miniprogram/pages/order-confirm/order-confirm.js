/**
 * 确认订单页面逻辑
 * 功能：地址选择、配送方式选择、优惠券选择、价格计算、提交订单
 */

const app = getApp();

Page({
  data: {
    // 订单商品列表
    orderItems: [],
    // 商品总额
    goodsTotal: '0.00',
    // 配送方式: delivery-配送, selfpickup-自取
    deliveryType: 'delivery',
    // 配送费
    deliveryFee: '8.00',
    // 预计配送时间
    deliveryTime: '明天 10:00-12:00',
    // 店铺地址
    storeAddress: '北京市朝阳区烘焙街88号',
    // 收货地址
    address: null,
    // 地址列表
    addressList: [],
    // 显示地址选择弹窗
    showAddressModal: false,
    // 选中的地址ID
    selectedAddressId: '',
    // 优惠券列表
    couponList: [],
    // 选中的优惠券
    selectedCoupon: null,
    // 选中的优惠券ID
    selectedCouponId: '',
    // 显示优惠券弹窗
    showCouponModal: false,
    // 优惠券优惠金额
    couponAmount: '0.00',
    // 商品优惠金额
    discountAmount: '0.00',
    // 实付金额
    payAmount: '0.00',
    // 订单备注
    remark: '',
    // 提交中状态
    submitting: false,
    // 自取时间范围
    pickupTimeRange: [[], []],
    // 选中的自取时间
    selectedPickupTime: ''
  },

  onLoad() {
    this.loadCheckoutData();
    this.loadAddressList();
    this.loadCouponList();
    this.initPickupTimeRange();
  },

  /**
   * 加载结算数据
   */
  loadCheckoutData() {
    const checkoutData = wx.getStorageSync('checkoutData');
    if (!checkoutData || !checkoutData.items || checkoutData.items.length === 0) {
      wx.showToast({ title: '订单数据异常', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      orderItems: checkoutData.items,
      goodsTotal: checkoutData.totalPrice,
      discountAmount: checkoutData.discount
    }, () => {
      this.calculatePayAmount();
    });
  },

  /**
   * 加载地址列表
   */
  loadAddressList() {
    // 模拟地址数据
    const mockAddressList = [
      {
        _id: 'addr_001',
        name: '张三',
        phone: '138****8888',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国路88号SOHO现代城1号楼1201室',
        isDefault: true
      },
      {
        _id: 'addr_002',
        name: '李四',
        phone: '139****9999',
        province: '北京市',
        city: '北京市',
        district: '海淀区',
        detail: '中关村大街1号海龙大厦1502室',
        isDefault: false
      }
    ];

    const defaultAddress = mockAddressList.find(item => item.isDefault) || mockAddressList[0];
    
    this.setData({
      addressList: mockAddressList,
      address: defaultAddress,
      selectedAddressId: defaultAddress ? defaultAddress._id : ''
    });
  },

  /**
   * 加载优惠券列表
   */
  loadCouponList() {
    // 模拟优惠券数据
    const mockCouponList = [
      {
        _id: 'coupon_001',
        name: '新用户专享券',
        amount: '10.00',
        minAmount: 50,
        expireTime: '2024-12-31'
      },
      {
        _id: 'coupon_002',
        name: '满减优惠券',
        amount: '20.00',
        minAmount: 100,
        expireTime: '2024-12-31'
      }
    ];

    this.setData({ couponList: mockCouponList });
  },

  /**
   * 初始化自取时间范围
   */
  initPickupTimeRange() {
    const days = [];
    const times = [];
    
    // 生成未来7天的日期
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
      days.push(`${month}月${day}日 ${weekDay}`);
    }
    
    // 生成时间段
    const timeSlots = [
      '09:00-10:00',
      '10:00-11:00',
      '11:00-12:00',
      '14:00-15:00',
      '15:00-16:00',
      '16:00-17:00',
      '17:00-18:00'
    ];
    
    this.setData({
      pickupTimeRange: [days, timeSlots]
    });
  },

  /**
   * 选择配送方式
   */
  selectDeliveryType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ deliveryType: type }, () => {
      this.calculatePayAmount();
    });
  },

  /**
   * 选择自取时间
   */
  onPickupTimeChange(e) {
    const [dayIndex, timeIndex] = e.detail.value;
    const { pickupTimeRange } = this.data;
    const selectedTime = `${pickupTimeRange[0][dayIndex]} ${pickupTimeRange[1][timeIndex]}`;
    
    this.setData({ selectedPickupTime: selectedTime });
  },

  onPickupTimeColumnChange(e) {
    // 列变化时的处理（如有需要）
  },

  /**
   * 选择地址
   */
  selectAddress() {
    this.setData({ showAddressModal: true });
  },

  /**
   * 确认选择地址
   */
  confirmAddress(e) {
    const index = e.currentTarget.dataset.index;
    const address = this.data.addressList[index];
    
    this.setData({
      address,
      selectedAddressId: address._id,
      showAddressModal: false
    });
  },

  /**
   * 关闭地址弹窗
   */
  closeAddressModal() {
    this.setData({ showAddressModal: false });
  },

  /**
   * 添加新地址
   */
  addNewAddress() {
    wx.navigateTo({
      url: '/pages/address-edit/address-edit'
    });
    this.setData({ showAddressModal: false });
  },

  /**
   * 选择优惠券
   */
  selectCoupon() {
    this.setData({ showCouponModal: true });
  },

  /**
   * 确认选择优惠券
   */
  confirmCoupon(e) {
    const index = e.currentTarget.dataset.index;
    const coupon = this.data.couponList[index];
    
    // 检查是否满足使用条件
    const goodsTotal = parseFloat(this.data.goodsTotal);
    if (goodsTotal < coupon.minAmount) {
      wx.showToast({
        title: `满${coupon.minAmount}元可用`,
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      selectedCoupon: coupon,
      selectedCouponId: coupon._id,
      couponAmount: coupon.amount,
      showCouponModal: false
    }, () => {
      this.calculatePayAmount();
    });
  },

  /**
   * 不使用优惠券
   */
  notUseCoupon() {
    this.setData({
      selectedCoupon: null,
      selectedCouponId: '',
      couponAmount: '0.00',
      showCouponModal: false
    }, () => {
      this.calculatePayAmount();
    });
  },

  /**
   * 关闭优惠券弹窗
   */
  closeCouponModal() {
    this.setData({ showCouponModal: false });
  },

  /**
   * 输入备注
   */
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  /**
   * 计算实付金额
   */
  calculatePayAmount() {
    const { goodsTotal, deliveryType, deliveryFee, discountAmount, couponAmount } = this.data;
    
    let payAmount = parseFloat(goodsTotal);
    
    // 配送费
    if (deliveryType === 'delivery') {
      payAmount += parseFloat(deliveryFee);
    }
    
    // 减去优惠
    payAmount -= parseFloat(discountAmount);
    payAmount -= parseFloat(couponAmount);
    
    // 确保不小于0
    payAmount = Math.max(0, payAmount);
    
    this.setData({
      payAmount: payAmount.toFixed(2)
    });
  },

  /**
   * 提交订单
   */
  async submitOrder() {
    const { address, deliveryType, selectedPickupTime, orderItems, payAmount, remark, submitting } = this.data;
    
    if (submitting) return;
    
    // 验证
    if (deliveryType === 'delivery' && !address) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }
    
    if (deliveryType === 'selfpickup' && !selectedPickupTime) {
      wx.showToast({ title: '请选择自取时间', icon: 'none' });
      return;
    }
    
    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });
    
    try {
      // 构建订单数据
      const orderData = {
        items: orderItems.map(item => ({
          productId: item._id,
          name: item.name,
          spec: item.spec,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl
        })),
        deliveryType,
        address: deliveryType === 'delivery' ? address : null,
        pickupTime: deliveryType === 'selfpickup' ? selectedPickupTime : null,
        remark,
        goodsTotal: this.data.goodsTotal,
        deliveryFee: deliveryType === 'delivery' ? this.data.deliveryFee : '0.00',
        discountAmount: this.data.discountAmount,
        couponAmount: this.data.couponAmount,
        payAmount
      };
      
      // 调用云函数创建订单
      const { result } = await wx.cloud.callFunction({
        name: 'createOrder',
        data: orderData
      });
      
      if (result.code !== 0) {
        throw new Error(result.message || '创建订单失败');
      }
      
      const { orderId, orderNo, requiredPoints, userPoints, hasEnoughPoints } = result.data;

      // 保存订单信息
      wx.setStorageSync('currentOrder', {
        orderId,
        orderNo,
        payAmount,
        requiredPoints,
        userPoints,
        hasEnoughPoints
      });

      // 清除购物车中已购买的商品
      this.removePurchasedItemsFromCart(orderItems);

      wx.hideLoading();

      // 跳转到支付页面，传递积分信息
      wx.redirectTo({
        url: `/pages/payment/payment?orderId=${orderId}&orderNo=${orderNo}&amount=${payAmount}&requiredPoints=${requiredPoints}&userPoints=${userPoints}&hasEnoughPoints=${hasEnoughPoints}`
      });
      
    } catch (error) {
      console.error('提交订单失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '提交订单失败',
        icon: 'none'
      });
      this.setData({ submitting: false });
    }
  },

  /**
   * 从购物车移除已购买的商品
   */
  removePurchasedItemsFromCart(purchasedItems) {
    const cartData = wx.getStorageSync('cartData') || [];
    const purchasedIds = purchasedItems.map(item => item._id);
    
    const newCartData = cartData.filter(item => !purchasedIds.includes(item._id));
    wx.setStorageSync('cartData', newCartData);
  }
});
