/**
 * 订单详情页
 * 功能：订单状态展示、物流信息、商品清单、价格明细、订单操作
 */
const app = getApp();

// 订单状态映射
const STATUS_MAP = {
  0: { text: '待付款', icon: '⏰', desc: '请在30分钟内完成支付' },
  1: { text: '待发货', icon: '📦', desc: '商家正在准备商品' },
  2: { text: '待收货', icon: '🚚', desc: '商品正在配送中' },
  3: { text: '已完成', icon: '✅', desc: '订单已完成，感谢您的购买' },
  4: { text: '已取消', icon: '❌', desc: '订单已取消' },
  5: { text: '退款中', icon: '💰', desc: '退款申请处理中' },
  6: { text: '已退款', icon: '💳', desc: '退款已完成' }
};

Page({
  data: {
    orderId: '',
    order: null,
    address: {},
    logistics: null,
    isLoading: true
  },

  onLoad(options) {
    const orderId = options.id;
    if (!orderId) {
      wx.showToast({
        title: '订单ID不能为空',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }
    this.setData({ orderId });
    this.loadOrderDetail();
  },

  // 加载订单详情
  async loadOrderDetail() {
    this.setData({ isLoading: true });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getOrderDetail',
        data: {
          orderId: this.data.orderId
        }
      });

      if (result.code === 0) {
        const order = result.data;
        const statusInfo = STATUS_MAP[order.status] || {};

        // 加载产品图片（实时从 products 获取）
        const goodsListWithImages = await this.loadProductImages(order.goodsList || order.items || order.products || []);

        this.setData({
          order: {
            ...order,
            goodsList: goodsListWithImages,
            statusText: statusInfo.text,
            createTime: this.formatTime(order.createTime),
            payTime: order.payTime ? this.formatTime(order.payTime) : ''
          },
          address: order.address || {},
          logistics: order.logistics || null,
          statusIcon: statusInfo.icon,
          statusDesc: statusInfo.desc
        });
      } else {
        wx.showToast({
          title: result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载订单详情失败:', error);
      // 模拟数据（开发测试用）
      this.loadMockData();
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载产品图片（实时从 products 集合获取）
  async loadProductImages(orderItems) {
    if (!orderItems || orderItems.length === 0) {
      return orderItems;
    }

    try {
      // 提取 productIds（可能是 id、productId 或 _id）
      const productIds = orderItems.map(item => item.productId || item.id || item._id).filter(Boolean);

      if (productIds.length === 0) {
        return orderItems;
      }

      // 批量获取产品信息（包括下架商品，用于显示历史订单图片）
      const { result } = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getList',
          page: 1,
          pageSize: 100,
          status: null  // null 表示查询所有状态的产品
        }
      });

      if (result.code !== 0 || !result.data || !result.data.list) {
        console.warn('[订单详情] 获取产品信息失败');
        return orderItems;
      }

      // 构建 productId -> image 映射
      const productMap = {};
      result.data.list.forEach(product => {
        const image = product.image || (product.images && product.images[0]);
        if (image) {
          productMap[product._id] = image;
        }
      });

      // 为订单产品添加图片
      return orderItems.map(item => ({
        ...item,
        image: productMap[item.productId || item.id || item._id] || item.image || ''
      }));

    } catch (error) {
      console.error('[订单详情] 加载产品图片失败:', error);
      return orderItems;
    }
  },

  // 模拟数据（开发测试用）
  loadMockData() {
    const mockOrder = {
      _id: 'order001',
      orderNo: '202401150001',
      status: 2,
      createTime: '2024-01-15 10:30:00',
      payTime: '2024-01-15 10:35:00',
      payType: '微信支付',
      deliveryType: '快递配送',
      goodsAmount: '68.00',
      freightAmount: '0.00',
      discountAmount: '5.00',
      totalAmount: '63.00',
      remark: '请尽快发货',
      isReviewed: false,
      goodsList: [
        {
          id: 'g1',
          name: '法式可颂',
          spec: '原味',
          price: '18.00',
          count: 2,
          image: '/images/bread1.png'
        },
        {
          id: 'g2',
          name: '全麦吐司',
          spec: '500g',
          price: '32.00',
          count: 1,
          image: '/images/bread2.png'
        }
      ],
      address: {
        name: '张三',
        phone: '138****8888',
        fullAddress: '北京市朝阳区某某街道某某小区1号楼101室'
      },
      logistics: {
        status: '运输中',
        time: '2024-01-15 14:30:00'
      }
    };

    const statusInfo = STATUS_MAP[mockOrder.status];

    this.setData({
      order: {
        ...mockOrder,
        statusText: statusInfo.text
      },
      address: mockOrder.address,
      logistics: mockOrder.logistics,
      statusIcon: statusInfo.icon,
      statusDesc: statusInfo.desc,
      isLoading: false
    });
  },

  // 重新加载
  reloadData() {
    this.loadOrderDetail();
  },

  // 复制订单号
  copyOrderNo() {
    wx.setClipboardData({
      data: this.data.order.orderNo,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        });
      }
    });
  },

  // 取消订单
  cancelOrder() {
    wx.showModal({
      title: '提示',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            const { result } = await wx.cloud.callFunction({
              name: 'cancelOrder',
              data: { orderId: this.data.orderId }
            });
            wx.hideLoading();

            if (result.code === 0) {
              wx.showToast({ title: '取消成功', icon: 'success' });
              this.loadOrderDetail();
            } else {
              wx.showToast({ title: result.message || '取消失败', icon: 'none' });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '取消失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 立即付款
  payOrder() {
    const { orderId, totalAmount } = this.data.order;
    wx.navigateTo({
      url: `/pages/pay/pay?orderId=${orderId}&amount=${totalAmount}`
    });
  },

  // 申请退款
  applyRefund() {
    wx.navigateTo({
      url: `/pages/refund/refund?orderId=${this.data.orderId}`
    });
  },

  // 提醒发货
  remindDelivery() {
    wx.showToast({
      title: '已提醒商家发货',
      icon: 'success'
    });
  },

  // 查看物流
  viewLogistics() {
    wx.navigateTo({
      url: `/pages/logistics/logistics?orderId=${this.data.orderId}`
    });
  },

  // 确认收货
  confirmReceive() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            const { result } = await wx.cloud.callFunction({
              name: 'confirmReceive',
              data: { orderId: this.data.orderId }
            });
            wx.hideLoading();

            if (result.code === 0) {
              wx.showToast({ title: '确认成功', icon: 'success' });
              this.loadOrderDetail();
            } else {
              wx.showToast({ title: result.message || '确认失败', icon: 'none' });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '确认失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 删除订单
  deleteOrder() {
    wx.showModal({
      title: '提示',
      content: '确定要删除该订单吗？删除后不可恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            const { result } = await wx.cloud.callFunction({
              name: 'deleteOrder',
              data: { orderId: this.data.orderId }
            });
            wx.hideLoading();

            if (result.code === 0) {
              wx.showToast({
                title: '删除成功',
                icon: 'success',
                success: () => {
                  setTimeout(() => {
                    wx.navigateBack();
                  }, 1500);
                }
              });
            } else {
              wx.showToast({ title: result.message || '删除失败', icon: 'none' });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 再次购买
  buyAgain() {
    wx.showToast({
      title: '已加入购物车',
      icon: 'success'
    });
  },

  // 去评价
  goToReview() {
    wx.navigateTo({
      url: `/pages/review/review?orderId=${this.data.orderId}`
    });
  },

  // 查看退款
  viewRefund() {
    wx.navigateTo({
      url: `/pages/refund-detail/refund-detail?orderId=${this.data.orderId}`
    });
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
});
