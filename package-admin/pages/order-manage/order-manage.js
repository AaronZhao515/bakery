/**
 * 订单管理页面
 * 功能：订单列表、筛选查询、订单处理
 */
const app = getApp();

// 订单状态映射
const ORDER_STATUS_MAP = {
  0: { text: '待支付', class: 'pending' },
  1: { text: '已支付', class: 'paid' },
  2: { text: '制作中', class: 'preparing' },
  3: { text: '配送中', class: 'delivering' },
  4: { text: '已完成', class: 'completed' },
  5: { text: '线下支付', class: 'offline' },
  '-1': { text: '已取消', class: 'cancelled' },
  '-2': { text: '退款中', class: 'refunding' },
  '-3': { text: '已退款', class: 'refunded' }
};

// 配送类型映射
const DELIVERY_TYPE_MAP = {
  0: { text: '自取', class: 'self-pickup' },
  1: { text: '配送', class: 'delivery' }
};

Page({
  data: {
    // 页面标题
    pageTitle: '订单管理',
    // 筛选条件
    startDate: '',
    endDate: '',
    status: '',
    // 订单列表
    orderList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    // 统计数据
    orderStats: {
      total: 0,
      totalAmount: 0
    },
    // 处理弹窗
    showProcessModal: false,
    currentOrder: {},
    processRemark: ''
  },

  onLoad(options) {
    console.log('[订单管理] 页面加载, options:', options);

    // 解析URL参数
    if (options.startDate) {
      this.setData({ startDate: options.startDate });
    }
    if (options.endDate) {
      this.setData({ endDate: options.endDate });
    }
    if (options.status !== undefined) {
      this.setData({ status: options.status });
    }
    if (options.title) {
      this.setData({ pageTitle: options.title });
      wx.setNavigationBarTitle({ title: options.title });
    }

    // 加载订单列表
    this.loadOrderList();
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

    // 刷新数据
    if (this.data.orderList.length > 0) {
      this.refreshOrderList();
    }
  },

  /**
   * 返回后台管理系统主页面
   */
  goBack() {
    wx.redirectTo({
      url: '/package-admin/pages/dashboard/dashboard',
      fail: (err) => {
        console.error('[订单管理] 返回首页失败:', err);
        // 如果 redirectTo 失败，尝试 navigateBack
        wx.navigateBack({
          fail: () => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
      }
    });
  },

  onPullDownRefresh() {
    this.refreshOrderList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreOrders();
    }
  },

  // 刷新订单列表
  async refreshOrderList() {
    this.setData({ page: 1, hasMore: true });
    await this.loadOrderList();
  },

  // 加载订单列表
  async loadOrderList() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });

    try {
      const { startDate, endDate, status, page, pageSize } = this.data;

      console.log('[订单管理] 查询参数:', { startDate, endDate, status, page, pageSize });

      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'orderManage',
          operation: 'list',
          page: page,
          pageSize: pageSize,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: status !== '' && status !== undefined ? parseInt(status) : undefined
        }
      });

      console.log('[订单管理] 加载结果:', result);

      // 检查云函数返回结果
      if (!result || !result.result) {
        throw new Error('云函数返回数据异常');
      }

      if (result.result.code === 0) {
        const { list = [], total = 0 } = result.result.data || {};

        // 加载产品图片映射
        const productImageMap = await this.loadProductImages(list);

        // 处理订单数据
        const orders = list.map(order => this.formatOrderData(order, productImageMap));

        // 计算总金额（仅当前页）
        const totalAmount = list.reduce((sum, order) => sum + (order.payAmount || 0), 0);

        this.setData({
          orderList: orders,
          hasMore: orders.length < total,
          orderStats: {
            total: total,
            totalAmount: totalAmount.toFixed(2)
          }
        });
      } else if (result.result.code === -1 && result.result.message === '无管理员权限') {
        wx.showToast({
          title: '无管理员权限',
          icon: 'none',
          duration: 2000
        });
        // 延迟返回登录页
        setTimeout(() => {
          wx.redirectTo({
            url: '/package-admin/pages/login/login'
          });
        }, 1500);
      } else {
        wx.showToast({
          title: result.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('[订单管理] 加载失败:', error);
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载更多订单
  async loadMoreOrders() {
    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const { startDate, endDate, status, pageSize } = this.data;

      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'orderManage',
          operation: 'list',
          page: nextPage,
          pageSize: pageSize,
          startDate: startDate,
          endDate: endDate,
          status: status !== '' ? parseInt(status) : undefined
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;

        // 加载产品图片映射
        const productImageMap = await this.loadProductImages(list);

        const newOrders = list.map(order => this.formatOrderData(order, productImageMap));

        const allOrders = [...this.data.orderList, ...newOrders];

        this.setData({
          orderList: allOrders,
          page: nextPage,
          hasMore: allOrders.length < total,
          orderStats: {
            total: total,
            totalAmount: allOrders.reduce((sum, order) => sum + (order.payAmount || 0), 0).toFixed(2)
          }
        });
      }
    } catch (error) {
      console.error('[订单管理] 加载更多失败:', error);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载产品图片映射（实时从 products 集合获取）
  async loadProductImages(orders) {
    if (!orders || orders.length === 0) {
      return {};
    }

    try {
      // 提取所有 productIds
      const productIds = new Set();
      orders.forEach(order => {
        const products = order.products || [];
        products.forEach(p => {
          if (p.productId) {
            productIds.add(p.productId);
          }
        });
      });

      if (productIds.size === 0) {
        return {};
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
        console.warn('[订单管理] 获取产品信息失败');
        return {};
      }

      // 构建 productId -> image 映射
      const productMap = {};
      result.data.list.forEach(product => {
        const image = product.image || (product.images && product.images[0]);
        if (image) {
          productMap[product._id] = image;
        }
      });

      return productMap;

    } catch (error) {
      console.error('[订单管理] 加载产品图片失败:', error);
      return {};
    }
  },

  // 格式化订单数据
  formatOrderData(order, productImageMap = {}) {
    if (!order || typeof order !== 'object') {
      console.warn('[订单管理] 无效的订单数据:', order);
      return {
        _id: '',
        orderNo: '未知订单',
        statusText: '未知',
        statusClass: 'pending',
        createTime: '-',
        productCount: 0,
        products: [],
        payAmount: 0,
        deliveryType: 0,
        deliveryTypeText: '自取',
        deliveryTypeClass: 'self-pickup'
      };
    }

    // 确保 products 是数组
    const products = Array.isArray(order.products) ? order.products : [];

    // 获取用户信息
    const userInfo = order.userInfo || {};

    // 获取配送类型信息
    const deliveryType = order.deliveryType !== undefined ? order.deliveryType : 0;
    const deliveryTypeInfo = DELIVERY_TYPE_MAP[deliveryType] || DELIVERY_TYPE_MAP[0];

    return {
      ...order,
      statusText: ORDER_STATUS_MAP[order.status]?.text || '未知',
      statusClass: ORDER_STATUS_MAP[order.status]?.class || 'pending',
      createTime: this.formatTime(order.createTime),
      productCount: products.length,
      // 只显示前2个商品，从 productImageMap 获取实时图片
      products: products.slice(0, 2).map(p => ({
        name: p.name || '未知商品',
        image: productImageMap[p.productId] || p.image || '/images/default-product.png',
        price: p.price || 0,
        quantity: p.quantity || 1,
        spec: p.spec || ''
      })),
      // 确保金额是数字
      payAmount: parseFloat(order.payAmount) || 0,
      // 格式化用户信息
      userInfo: {
        nickName: userInfo.nickName || '未知用户',
        avatarUrl: userInfo.avatarUrl || '/images/default-avatar.png',
        phone: userInfo.phone || ''
      },
      // 配送类型信息
      deliveryType: deliveryType,
      deliveryTypeText: deliveryTypeInfo.text,
      deliveryTypeClass: deliveryTypeInfo.class
    };
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '-';

    let d;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date.replace(/-/g, '/'));
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return '-';
    }

    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      return '-';
    }

    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  // 开始日期选择
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  // 结束日期选择
  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
  },

  // 应用日期筛选
  applyDateFilter() {
    const { startDate, endDate } = this.data;

    if (startDate && endDate && startDate > endDate) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none'
      });
      return;
    }

    this.refreshOrderList();
  },

  // 按状态筛选
  filterByStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ status: status }, () => {
      this.refreshOrderList();
    });
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      startDate: '',
      endDate: '',
      status: ''
    }, () => {
      this.refreshOrderList();
    });
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    if (!orderId) {
      wx.showToast({
        title: '订单信息错误',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/package-admin/pages/order-detail/order-detail?id=${orderId}`,
      fail: (err) => {
        console.error('[订单管理] 跳转详情页失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 联系客户
  contactCustomer(e) {
    // 阻止事件冒泡，防止触发卡片点击
    e.stopPropagation && e.stopPropagation();

    const orderId = e.currentTarget.dataset.id;
    if (!orderId) {
      wx.showToast({
        title: '订单信息错误',
        icon: 'none'
      });
      return;
    }

    const order = this.data.orderList.find(item => item._id === orderId);

    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }

    const phone = order.userInfo?.phone || order.phone;

    if (phone) {
      wx.makePhoneCall({
        phoneNumber: String(phone),
        fail: (err) => {
          console.error('[订单管理] 拨打电话失败:', err);
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

  // 处理订单（显示处理弹窗）
  processOrder(e) {
    // 阻止事件冒泡，防止触发卡片点击
    e.stopPropagation && e.stopPropagation();

    const orderId = e.currentTarget.dataset.id;
    if (!orderId) {
      wx.showToast({
        title: '订单信息错误',
        icon: 'none'
      });
      return;
    }

    const order = this.data.orderList.find(item => item._id === orderId);

    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }

    // 如果是配送订单且状态为制作中，跳转到配送管理
    if (order.deliveryType === 1 && order.status === 2) {
      this.goToDelivery(e);
      return;
    }

    // 只能处理已支付、制作中、配送中的订单
    if (![1, 2, 3].includes(order.status)) {
      wx.showToast({
        title: '该订单状态不可处理',
        icon: 'none'
      });
      return;
    }

    this.setData({
      showProcessModal: true,
      currentOrder: order,
      processRemark: ''
    });
  },

  // 去配送 - 跳转到配送管理页面
  goToDelivery(e) {
    // 阻止事件冒泡，防止触发卡片点击
    e.stopPropagation && e.stopPropagation();

    const orderId = e.currentTarget.dataset.id;
    if (!orderId) {
      wx.showToast({
        title: '订单信息错误',
        icon: 'none'
      });
      return;
    }

    const order = this.data.orderList.find(item => item._id === orderId);

    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }

    // 检查是否是配送订单
    if (order.deliveryType !== 1) {
      wx.showToast({
        title: '只有配送订单可去配送',
        icon: 'none'
      });
      return;
    }

    // 跳转到配送管理页面，带上订单ID
    wx.navigateTo({
      url: `/package-admin/pages/delivery-manage/delivery-manage?orderId=${orderId}`,
      fail: (err) => {
        console.error('[订单管理] 跳转配送管理页失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 隐藏处理弹窗
  hideProcessModal(e) {
    if (e) {
      e.stopPropagation && e.stopPropagation();
    }
    this.setData({ showProcessModal: false });
  },

  // 阻止弹窗内容点击事件冒泡
  onModalContentTap(e) {
    // 阻止事件冒泡，防止点击弹窗内容时关闭弹窗
    if (e) {
      e.stopPropagation && e.stopPropagation();
    }
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({ processRemark: e.detail.value });
  },

  // 更新订单状态
  async updateOrderStatus(e) {
    const status = parseInt(e.currentTarget.dataset.status);
    const { currentOrder, processRemark } = this.data;

    // 检查状态流转是否合法
    if (status <= currentOrder.status) {
      wx.showToast({
        title: '订单状态不能回退',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '处理中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'updateOrderStatus',
          orderId: currentOrder._id,
          status: status,
          remark: processRemark
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: '状态更新成功',
          icon: 'success'
        });

        // 更新本地数据
        const updatedList = this.data.orderList.map(order => {
          if (order._id === currentOrder._id) {
            return {
              ...order,
              status: status,
              statusText: ORDER_STATUS_MAP[status]?.text,
              statusClass: ORDER_STATUS_MAP[status]?.class
            };
          }
          return order;
        });

        this.setData({
          orderList: updatedList,
          showProcessModal: false
        });
      } else {
        wx.showToast({
          title: result.result.message || '更新失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('[订单管理] 更新状态失败:', error);
      wx.showToast({
        title: '更新失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 取消订单
  async cancelOrder() {
    const { currentOrder, processRemark } = this.data;

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
                action: 'cancelOrder',
                orderId: currentOrder._id,
                remark: processRemark || '管理员取消'
              }
            });

            if (result.result.code === 0) {
              wx.showToast({
                title: '订单已取消',
                icon: 'success'
              });

              // 更新本地数据
              const updatedList = this.data.orderList.map(order => {
                if (order._id === currentOrder._id) {
                  return {
                    ...order,
                    status: -1,
                    statusText: '已取消',
                    statusClass: 'cancelled'
                  };
                }
                return order;
              });

              this.setData({
                orderList: updatedList,
                showProcessModal: false
              });
            } else {
              wx.showToast({
                title: result.result.message || '取消失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('[订单管理] 取消订单失败:', error);
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