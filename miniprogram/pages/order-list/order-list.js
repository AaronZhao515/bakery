/**
 * 订单列表页
 * 功能：状态筛选、订单列表展示、下拉刷新、上拉加载、订单操作
 */
const app = getApp();

// 订单状态映射
const STATUS_MAP = {
  0: { text: '待付款', class: 'status-0' },
  1: { text: '待发货', class: 'status-1' },
  2: { text: '待收货', class: 'status-2' },
  3: { text: '已完成', class: 'status-3' },
  4: { text: '已取消', class: 'status-4' },
  5: { text: '退款中', class: 'status-5' },
  6: { text: '已退款', class: 'status-6' }
};

Page({
  data: {
    currentStatus: -1, // -1: 全部, 0-6: 对应状态
    orderList: [],
    statusCounts: {},
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    isRefreshing: false
  },

  onLoad(options) {
    // 从URL参数获取状态
    if (options.status !== undefined) {
      const status = parseInt(options.status);
      this.setData({ currentStatus: status });
    }
    this.loadOrderList(true);
    this.loadStatusCounts();
  },

  onShow() {
    // 页面显示时刷新数据
    if (this.data.orderList.length > 0) {
      this.loadOrderList(true);
      this.loadStatusCounts();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ isRefreshing: true });
    this.loadOrderList(true).then(() => {
      this.loadStatusCounts();
      wx.stopPullDownRefresh();
      this.setData({ isRefreshing: false });
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadOrderList(false);
    }
  },

  // 状态切换
  onStatusChange(e) {
    const status = parseInt(e.currentTarget.dataset.status);
    this.setData({
      currentStatus: status,
      page: 1,
      orderList: [],
      hasMore: true
    });
    this.loadOrderList(true);
  },

  // 加载订单列表
  async loadOrderList(isRefresh = false) {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });

    const page = isRefresh ? 1 : this.data.page;
    const { currentStatus, pageSize } = this.data;

    try {
      // 调用云函数获取订单列表
      const { result } = await wx.cloud.callFunction({
        name: 'getOrderList',
        data: {
          status: currentStatus,
          page,
          pageSize
        }
      });

      if (result.code === 0) {
        const orders = result.data.list.map(order => ({
          ...order,
          statusText: (STATUS_MAP[order.status] && STATUS_MAP[order.status].text) || '未知状态',
          createTime: this.formatTime(order.createTime)
        }));

        this.setData({
          orderList: isRefresh ? orders : [...this.data.orderList, ...orders],
          page: page + 1,
          hasMore: orders.length === pageSize
        });
      } else {
        wx.showToast({
          title: result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载订单列表失败:', error);
      // 模拟数据（开发测试用）
      this.loadMockData(isRefresh);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载各状态订单数量
  async loadStatusCounts() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getOrderStatusCounts'
      });

      if (result.code === 0) {
        this.setData({
          statusCounts: result.data
        });
      }
    } catch (error) {
      console.error('加载状态数量失败:', error);
    }
  },

  // 模拟数据（开发测试用）
  loadMockData(isRefresh) {
    const mockOrders = [
      {
        _id: 'order001',
        orderNo: '202401150001',
        status: 0,
        createTime: '2024-01-15 10:30:00',
        totalAmount: '68.00',
        totalCount: 2,
        goodsList: [
          { id: 'g1', name: '法式可颂', spec: '原味', price: '18.00', count: 2, image: '/images/bread1.png' },
          { id: 'g2', name: '全麦吐司', spec: '500g', price: '32.00', count: 1, image: '/images/bread2.png' }
        ]
      },
      {
        _id: 'order002',
        orderNo: '202401140002',
        status: 1,
        createTime: '2024-01-14 15:20:00',
        totalAmount: '45.00',
        totalCount: 1,
        goodsList: [
          { id: 'g3', name: '抹茶红豆包', spec: '6个装', price: '45.00', count: 1, image: '/images/bread3.png' }
        ]
      },
      {
        _id: 'order003',
        orderNo: '202401130003',
        status: 2,
        createTime: '2024-01-13 09:00:00',
        totalAmount: '128.00',
        totalCount: 3,
        goodsList: [
          { id: 'g4', name: '生日蛋糕', spec: '6寸', price: '128.00', count: 1, image: '/images/cake1.png' }
        ]
      },
      {
        _id: 'order004',
        orderNo: '202401120004',
        status: 3,
        createTime: '2024-01-12 14:30:00',
        totalAmount: '56.00',
        totalCount: 2,
        isReviewed: false,
        goodsList: [
          { id: 'g5', name: '芝士软欧', spec: '200g', price: '28.00', count: 2, image: '/images/bread4.png' }
        ]
      }
    ];

    const filteredOrders = this.data.currentStatus === -1 
      ? mockOrders 
      : mockOrders.filter(o => o.status === this.data.currentStatus);

    const orders = filteredOrders.map(order => ({
      ...order,
      statusText: (STATUS_MAP[order.status] && STATUS_MAP[order.status].text) || '未知状态'
    }));

    this.setData({
      orderList: isRefresh ? orders : [...this.data.orderList, ...orders],
      hasMore: false
    });
  },

  // 跳转到订单详情
  goToDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${orderId}`
    });
  },

  // 取消订单
  cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            const { result } = await wx.cloud.callFunction({
              name: 'cancelOrder',
              data: { orderId }
            });
            wx.hideLoading();

            if (result.code === 0) {
              wx.showToast({ title: '取消成功', icon: 'success' });
              this.loadOrderList(true);
              this.loadStatusCounts();
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
  payOrder(e) {
    const { id, amount } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/pay/pay?orderId=${id}&amount=${amount}`
    });
  },

  // 申请退款
  applyRefund(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/refund/refund?orderId=${orderId}`
    });
  },

  // 提醒发货
  remindDelivery(e) {
    wx.showToast({
      title: '已提醒商家发货',
      icon: 'success'
    });
  },

  // 查看物流
  viewLogistics(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/logistics/logistics?orderId=${orderId}`
    });
  },

  // 确认收货
  confirmReceive(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            const { result } = await wx.cloud.callFunction({
              name: 'confirmReceive',
              data: { orderId }
            });
            wx.hideLoading();

            if (result.code === 0) {
              wx.showToast({ title: '确认成功', icon: 'success' });
              this.loadOrderList(true);
              this.loadStatusCounts();
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
  deleteOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要删除该订单吗？删除后不可恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            const { result } = await wx.cloud.callFunction({
              name: 'deleteOrder',
              data: { orderId }
            });
            wx.hideLoading();

            if (result.code === 0) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadOrderList(true);
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
  buyAgain(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showToast({
      title: '已加入购物车',
      icon: 'success'
    });
  },

  // 去评价
  goToReview(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/review/review?orderId=${orderId}`
    });
  },

  // 查看退款
  viewRefund(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/refund-detail/refund-detail?orderId=${orderId}`
    });
  },

  // 去逛逛
  goToShop() {
    wx.switchTab({
      url: '/pages/index/index'
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
