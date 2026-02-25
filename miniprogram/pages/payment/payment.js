/**
 * 支付页面逻辑
 * 功能：展示支付信息、调起微信支付、处理支付结果
 */

const payUtil = require('../../utils/payUtil');

Page({
  data: {
    // 订单ID
    orderId: '',
    // 订单号
    orderNo: '',
    // 支付金额
    payAmount: '0.00',
    // 商品总额
    goodsTotal: '0.00',
    // 配送费
    deliveryFee: '0.00',
    // 优惠金额
    discountAmount: '0.00',
    // 选中的支付方式
    selectedMethod: 'points',
    // 支付中状态
    paying: false,
    // 积分相关
    requiredPoints: 0,      // 所需积分
    userPoints: 0,          // 用户当前积分
    hasEnoughPoints: true   // 积分是否足够
  },

  onLoad(options) {
    const { orderId, orderNo, amount, requiredPoints, userPoints, hasEnoughPoints } = options;

    if (!orderId || !orderNo || !amount) {
      wx.showToast({ title: '订单信息不完整', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 解析积分信息
    const pointsRequired = parseInt(requiredPoints) || Math.ceil(parseFloat(amount));
    const pointsUser = parseInt(userPoints) || 0;
    const enoughPoints = hasEnoughPoints === 'true' || pointsUser >= pointsRequired;

    this.setData({
      orderId,
      orderNo,
      payAmount: amount,
      goodsTotal: amount,
      requiredPoints: pointsRequired,
      userPoints: pointsUser,
      hasEnoughPoints: enoughPoints,
      // 积分不足时默认选择线下支付
      selectedMethod: enoughPoints ? 'points' : 'offline'
    });

    // 加载订单详情
    this.loadOrderDetail(orderId);
  },

  /**
   * 加载订单详情
   */
  async loadOrderDetail(orderId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'checkPayStatus',
        data: { orderId }
      });
      
      if (result.code === 0 && result.data) {
        const order = result.data;
        this.setData({
          goodsTotal: order.goodsTotal || this.data.payAmount,
          deliveryFee: order.deliveryFee || '0.00',
          discountAmount: order.discountAmount || '0.00'
        });
      }
    } catch (error) {
      console.error('加载订单详情失败:', error);
    }
  },

  /**
   * 选择支付方式
   */
  selectMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({ selectedMethod: method });
  },

  /**
   * 确认支付
   */
  async confirmPay() {
    if (this.data.paying) return;

    const { selectedMethod, hasEnoughPoints } = this.data;

    // 线下支付处理
    if (selectedMethod === 'offline' || !hasEnoughPoints) {
      this.handleOfflinePay();
      return;
    }

    // 积分支付处理
    this.setData({ paying: true });

    try {
      // 调用订单支付云函数
      const { result } = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'pay',
          data: {
            orderId: this.data.orderId
          }
        }
      });

      if (result.code !== 0) {
        throw new Error(result.message || '支付失败');
      }

      // 支付成功
      this.onPaySuccess(result.data);

    } catch (error) {
      console.error('支付失败:', error);
      wx.showToast({
        title: error.message || '支付失败',
        icon: 'none'
      });
      this.setData({ paying: false });
    }
  },

  /**
   * 线下支付处理
   */
  handleOfflinePay() {
    wx.showModal({
      title: '线下支付确认',
      content: '请到店内出示订单号进行支付\n订单号: ' + this.data.orderNo,
      confirmText: '我知道了',
      showCancel: false,
      success: () => {
        // 跳转到订单详情页
        wx.redirectTo({
          url: `/pages/order-detail/order-detail?id=${this.data.orderId}`
        });
      }
    });
  },

  /**
   * 支付成功处理
   */
  onPaySuccess(payData = {}) {
    const pointsDeducted = payData.pointsDeducted || this.data.requiredPoints;

    wx.showToast({
      title: '支付成功',
      icon: 'success'
    });

    // 跳转到支付成功页面
    setTimeout(() => {
      wx.redirectTo({
        url: `/pages/pay-result/pay-result?status=success&orderId=${this.data.orderId}&orderNo=${this.data.orderNo}&amount=${this.data.payAmount}&points=${pointsDeducted}`
      });
    }, 1500);
  },

  /**
   * 支付失败处理
   */
  onPayFail(err) {
    this.setData({ paying: false });
    
    // 用户取消支付
    if (err.errCode === 1002) {
      wx.showModal({
        title: '提示',
        content: '您取消了支付，是否重新支付？',
        confirmText: '重新支付',
        cancelText: '查看订单',
        success: (res) => {
          if (!res.confirm) {
            // 查看订单
            wx.redirectTo({
              url: `/pages/order-detail/order-detail?id=${this.data.orderId}`
            });
          }
        }
      });
      return;
    }
    
    // 其他支付失败情况
    wx.showToast({
      title: '支付失败，请重试',
      icon: 'none'
    });
  }
});
