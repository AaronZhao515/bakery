/**
 * 订单详情页面
 * 面包烘焙小程序 - 显示订单详情
 */

const app = getApp();
const api = require('../../../utils/api.js');
const util = require('../../../utils/util.js');

// 订单状态映射
const ORDER_STATUS = {
  0: { text: '待支付', color: '#FF6B6B', bgColor: '#FFF0F0', icon: '⏰' },
  1: { text: '已支付', color: '#4ECDC4', bgColor: '#E8F8F7', icon: '✅' },
  2: { text: '备餐中', color: '#D4A96A', bgColor: '#FFF8EE', icon: '👨‍🍳' },
  3: { text: '配送中', color: '#9B7355', bgColor: '#F5EDE6', icon: '🚚' },
  4: { text: '已完成', color: '#52C41A', bgColor: '#F0F9EB', icon: '🎉' },
  '-1': { text: '已取消', color: '#999999', bgColor: '#F5F5F5', icon: '❌' },
  '-2': { text: '退款中', color: '#FAAD14', bgColor: '#FFFBE6', icon: '💰' },
  '-3': { text: '已退款', color: '#999999', bgColor: '#F5F5F5', icon: '↩️' }
};

Page({
  data: {
    // 订单ID
    orderId: '',
    // 订单数据
    order: null,
    // 是否加载中
    isLoading: true,
    // 是否显示操作菜单
    showActions: false,
    // Base64 icons
    icons: {}
  },

  onLoad(options) {
    console.log('[订单详情] 页面加载', options);

    // 加载图标
    const icons = require('../../../utils/icons.js');
    this.setData({ icons });

    const orderId = options.id;
    if (!orderId) {
      wx.showToast({ title: '订单ID不能为空', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({ orderId });
    this.loadOrderDetail();
  },

  onShow() {
    // 每次显示页面时刷新订单数据
    if (this.data.orderId) {
      this.loadOrderDetail();
    }
  },

  onPullDownRefresh() {
    this.loadOrderDetail().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载订单详情
   */
  async loadOrderDetail() {
    this.setData({ isLoading: true });

    try {
      const result = await api.order.getDetail(this.data.orderId);
      console.log('[订单详情] 订单数据:', result);

      if (result && result.success && result.data) {
        const order = result.data;

        // 格式化订单数据
        const formattedOrder = this.formatOrderData(order);

        this.setData({
          order: formattedOrder,
          isLoading: false
        });
      } else {
        wx.showToast({
          title: result.message || '加载订单失败',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    } catch (error) {
      console.error('[订单详情] 加载失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  /**
   * 格式化订单数据
   */
  formatOrderData(order) {
    const statusInfo = ORDER_STATUS[order.status] || ORDER_STATUS[0];

    // 格式化时间
    const createTime = order.createTime ? this.formatDate(order.createTime) : '';
    const payTime = order.payTime ? this.formatDate(order.payTime) : '';

    // 计算总数量
    const totalQty = order.products ? order.products.reduce((sum, p) => sum + p.quantity, 0) : 0;

    // 配送类型文字
    const deliveryTypeText = order.deliveryType === 1 ? '配送' : '自取';

    return {
      ...order,
      statusInfo,
      createTimeStr: createTime,
      payTimeStr: payTime,
      totalQty,
      deliveryTypeText,
      // 是否可以支付
      canPay: order.status === 0,
      // 是否可以取消
      canCancel: order.status === 0,
      // 是否已完成
      isCompleted: order.status === 4,
      // 是否已取消
      isCancelled: order.status === -1
    };
  },

  /**
   * 格式化日期
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  /**
   * 返回上一页
   */
  onBackTap() {
    wx.navigateBack();
  },

  /**
   * 去首页
   */
  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 去订单列表
   */
  goToOrderList() {
    wx.switchTab({
      url: '/pages/order/order'
    });
  },

  /**
   * 支付订单
   */
  async onPayOrder() {
    const { order } = this.data;

    if (!order.canPay) {
      wx.showToast({ title: '订单状态不支持支付', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '支付中...' });

    try {
      const result = await api.order.pay(order._id);
      wx.hideLoading();

      if (result && result.success) {
        wx.showToast({
          title: '支付成功',
          icon: 'success'
        });
        // 刷新订单数据
        this.loadOrderDetail();
      } else {
        wx.showToast({
          title: result.message || '支付失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[订单详情] 支付失败:', error);
      wx.showToast({ title: '支付失败', icon: 'none' });
    }
  },

  /**
   * 取消订单
   */
  onCancelOrder() {
    const { order } = this.data;

    if (!order.canCancel) {
      wx.showToast({ title: '订单状态不支持取消', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗？',
      confirmText: '取消订单',
      confirmColor: '#FF6B6B',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' });

          try {
            const result = await api.order.cancel(order._id, '用户主动取消');
            wx.hideLoading();

            if (result && result.success) {
              wx.showToast({
                title: '取消成功',
                icon: 'success'
              });
              // 刷新订单数据
              this.loadOrderDetail();
            } else {
              wx.showToast({
                title: result.message || '取消失败',
                icon: 'none'
              });
            }
          } catch (error) {
            wx.hideLoading();
            console.error('[订单详情] 取消失败:', error);
            wx.showToast({ title: '取消失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 复制订单号
   */
  onCopyOrderNo() {
    const { order } = this.data;
    if (order && order.orderNo) {
      wx.setClipboardData({
        data: order.orderNo,
        success: () => {
          wx.showToast({ title: '订单号已复制', icon: 'success' });
        }
      });
    }
  },

  /**
   * 联系客服
   */
  onContactService() {
    wx.showModal({
      title: '联系客服',
      content: '客服电话：400-123-4567\n工作时间：9:00-21:00',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 拨打电话
   */
  onCallPhone() {
    wx.makePhoneCall({
      phoneNumber: '4001234567'
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    const { order } = this.data;
    return {
      title: `小赵面食 - 订单 ${order ? order.orderNo : ''}`,
      path: `/package-order/pages/order-detail/order-detail?id=${this.data.orderId}`
    };
  }
});
