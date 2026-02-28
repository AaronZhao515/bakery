/**
 * Admin 订单详情页
 */
const app = getApp();

// 订单状态映射
const ORDER_STATUS_MAP = {
  0: { text: '待支付', class: 'pending', icon: '⏳', desc: '等待客户支付' },
  1: { text: '已支付', class: 'paid', icon: '💰', desc: '客户已支付，请开始制作' },
  2: { text: '制作中', class: 'preparing', icon: '🍳', desc: '正在制作中' },
  3: { text: '配送中', class: 'delivering', icon: '🚚', desc: '配送员正在配送' },
  4: { text: '已完成', class: 'completed', icon: '✅', desc: '订单已完成' },
  5: { text: '线下支付', class: 'offline', icon: '💵', desc: '客户选择到店付款' },
  '-1': { text: '已取消', class: 'cancelled', icon: '❌', desc: '订单已取消' },
  '-2': { text: '退款中', class: 'refunding', icon: '💸', desc: '退款处理中' },
  '-3': { text: '已退款', class: 'refunded', icon: '↩️', desc: '已退款' }
};

// 支付方式映射
const PAY_TYPE_MAP = {
  'wechat': '微信支付',
  'points': '积分支付',
  'offline': '线下支付'
};

Page({
  data: {
    orderId: '',
    order: null,
    isLoading: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.loadOrderDetail();
    } else {
      wx.showToast({
        title: '订单ID不能为空',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
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

    // 刷新订单详情
    if (this.data.orderId && this.data.order) {
      this.loadOrderDetail();
    }
  },

  // 加载订单详情
  async loadOrderDetail() {
    this.setData({ isLoading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'orderManage',
          operation: 'get',
          orderId: this.data.orderId
        }
      });

      console.log('[订单详情] 加载结果:', result);

      if (result.result.code === 0) {
        const order = result.result.data;
        // 加载产品图片
        const productsWithImages = await this.loadProductImages(order.products);
        order.products = productsWithImages;
        const formattedOrder = this.formatOrderData(order);
        this.setData({ order: formattedOrder });
      } else {
        wx.showToast({
          title: result.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('[订单详情] 加载失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载产品图片（实时从 products 集合获取）
  async loadProductImages(orderProducts) {
    if (!orderProducts || orderProducts.length === 0) {
      return orderProducts;
    }

    try {
      // 提取 productIds
      const productIds = orderProducts.map(p => p.productId).filter(Boolean);
      console.log('[订单详情] 提取的 productIds:', productIds);

      if (productIds.length === 0) {
        console.warn('[订单详情] 没有有效的 productId');
        return orderProducts;
      }

      // 批量获取产品信息（包括下架商品，用于显示历史订单图片）
      const { result } = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getList',
          data: {
            page: 1,
            pageSize: 100,
            status: null  // null 表示查询所有状态的产品
          }
        }
      });

      console.log('[订单详情] 产品查询结果:', result);

      if (result.code !== 0 || !result.data || !result.data.list) {
        console.warn('[订单详情] 获取产品信息失败');
        return orderProducts;
      }

      // 构建 productId -> image 映射
      const productMap = {};
      result.data.list.forEach(product => {
        const image = product.image || (product.images && product.images[0]);
        console.log(`[订单详情] 产品 ${product._id} 图片:`, image);
        if (image) {
          productMap[product._id] = image;
        }
      });

      console.log('[订单详情] productMap:', productMap);

      // 为订单产品添加图片和计算总价
      const result_products = orderProducts.map(item => {
        const image = productMap[item.productId] || '';
        console.log(`[订单详情] 订单产品 ${item.name} (ID: ${item.productId}) 匹配图片:`, image);
        return {
          ...item,
          image: image,
          totalPrice: ((item.price || 0) * (item.quantity || 1)).toFixed(2)
        };
      });

      return result_products;

    } catch (error) {
      console.error('[订单详情] 加载产品图片失败:', error);
      return orderProducts;
    }
  },

  // 格式化订单数据
  formatOrderData(order) {
    const statusInfo = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP[0];

    return {
      ...order,
      statusText: statusInfo.text,
      statusClass: statusInfo.class,
      statusIcon: statusInfo.icon,
      statusDesc: statusInfo.desc,
      payTypeText: PAY_TYPE_MAP[order.payType] || '未知',
      createTimeStr: this.formatDateTime(order.createTime),
      payTimeStr: order.payTime ? this.formatDateTime(order.payTime) : '',
      totalQuantity: order.products ? order.products.reduce((sum, p) => sum + (p.quantity || 1), 0) : 0,
      totalPrice: order.products ? order.products.reduce((sum, p) => sum + ((p.price || 0) * (p.quantity || 1)), 0).toFixed(2) : '0.00'
    };
  },

  // 格式化日期时间
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 返回上一页
  onBack() {
    wx.navigateBack();
  },

  // 复制订单号
  copyOrderNo() {
    const { orderNo } = this.data.order;
    wx.setClipboardData({
      data: orderNo,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        });
      }
    });
  },

  // 联系客户
  contactCustomer() {
    const { order } = this.data;
    if (order.userInfo && order.userInfo.phone) {
      wx.makePhoneCall({
        phoneNumber: order.userInfo.phone,
        fail: () => {
          wx.showToast({
            title: '拨打电话失败',
            icon: 'none'
          });
        }
      });
    } else if (order.address && order.address.phone) {
      wx.makePhoneCall({
        phoneNumber: order.address.phone,
        fail: () => {
          wx.showToast({
            title: '拨打电话失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '暂无客户电话',
        icon: 'none'
      });
    }
  },

  // 处理订单 - 跳转到订单管理页面并打开处理弹窗
  processOrder() {
    const { order } = this.data;
    wx.navigateTo({
      url: `/package-admin/pages/order-manage/order-manage?processOrderId=${order._id}&status=${order.status}`
    });
  },

  // 取消订单
  cancelOrder() {
    const { order } = this.data;

    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？取消后不可恢复。',
      confirmColor: '#f44336',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中' });

          try {
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'updateOrderStatus',
                orderId: order._id,
                status: -1,
                remark: '管理员取消'
              }
            });

            if (result.result.code === 0) {
              wx.showToast({
                title: '订单已取消',
                icon: 'success'
              });
              // 刷新订单详情
              this.loadOrderDetail();
            } else {
              wx.showToast({
                title: result.result.message || '取消失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('[订单详情] 取消订单失败:', error);
            wx.showToast({
              title: '取消失败，请重试',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  }
});
