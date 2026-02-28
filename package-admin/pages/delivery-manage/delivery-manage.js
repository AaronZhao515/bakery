/**
 * 配送管理页
 * 功能：订单打包、配送分配、配送状态跟踪
 */
const app = getApp();

// 订单状态（配送管理内部状态）
const ORDER_STATUS = {
  PAID: 1,          // 已支付，待打包
  PACKING: 2,       // 打包中
  PACKED: 3,        // 已打包，待配送
  DELIVERING: 4,    // 配送中
  COMPLETED: 5      // 已完成
};

// 状态映射
const STATUS_MAP = {
  [ORDER_STATUS.PAID]: { text: '待打包', class: 'status-pending' },
  [ORDER_STATUS.PACKING]: { text: '打包中', class: 'status-packing' },
  [ORDER_STATUS.PACKED]: { text: '待配送', class: 'status-waiting' },
  [ORDER_STATUS.DELIVERING]: { text: '配送中', class: 'status-delivering' },
  [ORDER_STATUS.COMPLETED]: { text: '已完成', class: 'status-completed' }
};

Page({
  data: {
    // 统计数据
    stats: {
      pendingPack: 0,
      pendingDelivery: 0,
      delivering: 0,
      completedToday: 0
    },
    // 当前标签
    currentTab: 'pending',
    // 订单列表
    orders: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    // 配送员选择弹窗（已禁用）
    // showDeliveryModal: false,
    // deliverymen: [],
    // selectedDeliveryman: null,
    // currentOrderId: null,
    // 从其他页面传入的订单ID
    targetOrderId: null,
    // 订单详情弹窗
    showOrderDetailModal: false,
    currentOrder: null
  },

  onLoad(options) {
    console.log('[配送管理] 页面加载, options:', options);

    // 保存目标订单ID（从订单管理页面跳转过来）
    if (options.orderId) {
      this.setData({ targetOrderId: options.orderId });
    }

    this.loadStats();
    this.loadOrders();
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

    this.loadStats();
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    Promise.all([
      this.loadStats(),
      this.loadOrders()
    ]).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreOrders();
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'deliveryManage',
          data: { operation: 'getStats' }
        }
      });

      if (result.result.code === 0) {
        this.setData({
          stats: result.result.data
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      page: 1,
      hasMore: true,
      orders: []
    });
    this.loadOrders();
  },

  // 加载订单列表
  async loadOrders() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true, page: 1 });

    try {
      const result = await this.fetchOrders(1);

      if (result.code === 0) {
        // 加载产品图片映射
        const productImageMap = await this.loadProductImages(result.data.list);
        const orders = this.processOrderData(result.data.list, productImageMap);
        this.setData({
          orders,
          hasMore: orders.length < result.data.total,
          isLoading: false
        });

        // 如果有目标订单ID，尝试定位并高亮
        if (this.data.targetOrderId) {
          this.locateTargetOrder(orders);
        }
      }
    } catch (error) {
      console.error('加载订单失败:', error);
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
        console.warn('[配送管理] 获取产品信息失败');
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
      console.error('[配送管理] 加载产品图片失败:', error);
      return {};
    }
  },

  // 定位目标订单
  locateTargetOrder(orders) {
    const targetId = this.data.targetOrderId;
    if (!targetId) return;

    console.log('[配送管理] 尝试定位订单:', targetId);

    // 在当前列表中查找
    const targetIndex = orders.findIndex(order => order._id === targetId);

    if (targetIndex !== -1) {
      // 找到订单，高亮显示
      console.log('[配送管理] 在当前列表中找到订单，索引:', targetIndex);

      // 高亮订单（添加 highlighted 字段）
      const updatedOrders = orders.map((order, index) => ({
        ...order,
        highlighted: index === targetIndex
      }));

      this.setData({ orders: updatedOrders });

      // 延迟后清除高亮
      setTimeout(() => {
        const clearedOrders = this.data.orders.map(order => ({
          ...order,
          highlighted: false
        }));
        this.setData({ orders: clearedOrders });
      }, 3000);

      // 滚动到订单位置（使用 selector query）
      this.scrollToOrder(targetId);
    } else {
      // 当前标签页未找到，尝试在其他标签页查找
      console.log('[配送管理] 当前列表未找到订单，尝试搜索其他状态');
      this.searchOrderInAllTabs(targetId);
    }
  },

  // 滚动到指定订单
  scrollToOrder(orderId) {
    wx.createSelectorQuery()
      .select(`.order-item[data-id="${orderId}"]`)
      .boundingClientRect(rect => {
        if (rect) {
          wx.pageScrollTo({
            scrollTop: rect.top - 100,
            duration: 500
          });
        }
      })
      .exec();
  },

  // 在所有标签页中搜索订单
  async searchOrderInAllTabs(orderId) {
    try {
      // 尝试获取所有待处理订单来查找
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'deliveryManage',
          data: {
            operation: 'getOrders',
            page: 1,
            pageSize: 100, // 获取更多订单
            statusList: [ORDER_STATUS.PAID, ORDER_STATUS.PACKING, ORDER_STATUS.PACKED, ORDER_STATUS.DELIVERING]
          }
        }
      });

      if (result.result.code === 0) {
        const allOrders = result.result.data.list || [];
        const targetOrder = allOrders.find(o => o._id === orderId);

        if (targetOrder) {
          console.log('[配送管理] 找到订单，状态:', targetOrder.status);

          // 根据订单状态切换到对应标签
          let targetTab = 'pending';
          if (targetOrder.status === ORDER_STATUS.DELIVERING) {
            targetTab = 'delivering';
          } else if (targetOrder.status === ORDER_STATUS.COMPLETED) {
            targetTab = 'completed';
          }

          // 切换到对应标签并重新加载
          this.setData({
            currentTab: targetTab,
            orders: [],
            page: 1,
            hasMore: true
          }, () => {
            this.loadOrders();
          });
        } else {
          console.log('[配送管理] 未找到订单，可能已完成或不存在');
          wx.showToast({
            title: '订单不在当前配送列表中',
            icon: 'none'
          });
          // 清除目标订单ID
          this.setData({ targetOrderId: null });
        }
      }
    } catch (error) {
      console.error('[配送管理] 搜索订单失败:', error);
    }
  },

  // 加载更多订单
  async loadMoreOrders() {
    if (this.data.isLoading) return;

    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const result = await this.fetchOrders(nextPage);

      if (result.code === 0) {
        // 加载产品图片映射
        const productImageMap = await this.loadProductImages(result.data.list);
        const newOrders = this.processOrderData(result.data.list, productImageMap);
        this.setData({
          orders: [...this.data.orders, ...newOrders],
          page: nextPage,
          hasMore: this.data.orders.length + newOrders.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载更多失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 获取订单数据
  async fetchOrders(page) {
    const { currentTab } = this.data;

    let statusList = [];
    switch (currentTab) {
      case 'pending':
        statusList = [ORDER_STATUS.PAID, ORDER_STATUS.PACKING, ORDER_STATUS.PACKED];
        break;
      case 'delivering':
        statusList = [ORDER_STATUS.DELIVERING];
        break;
      case 'completed':
        statusList = [ORDER_STATUS.COMPLETED];
        break;
    }

    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'deliveryManage',
        data: {
          operation: 'getOrders',
          page,
          pageSize: this.data.pageSize,
          statusList
        }
      }
    });

    return result.result;
  },

  // 处理订单数据
  processOrderData(list, productImageMap = {}) {
    return list.map(item => {
      const statusInfo = STATUS_MAP[item.status] || { text: '未知', class: '' };

      // 为产品添加实时图片
      const products = (item.products || []).map(p => ({
        ...p,
        image: productImageMap[p.productId] || p.image || '/images/default-product.png'
      }));

      return {
        ...item,
        statusText: statusInfo.text,
        statusClass: statusInfo.class,
        createTime: this.formatDateTime(item.createTime),
        completeTime: item.completeTime ? this.formatDateTime(item.completeTime) : '',
        products,
        userName: item.userName || item.userInfo?.nickName || '未知用户',
        userPhone: item.userPhone || item.userInfo?.phone || '',
        address: item.address ? this.formatAddress(item.address) : ''
      };
    });
  },

  // 格式化地址
  formatAddress(address) {
    if (typeof address === 'string') return address;
    return `${address.region || ''}${address.detail || ''}`;
  },

  // 格式化日期时间
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  // 打印订单
  printOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showToast({
      title: '打印功能开发中',
      icon: 'none'
    });
  },

  // 开始打包
  async startPack(e) {
    const orderId = e.currentTarget.dataset.id;

    wx.showLoading({ title: '处理中' });

    try {
      const result = await this.updateOrderStatus(orderId, ORDER_STATUS.PACKING);

      if (result.code === 0) {
        wx.showToast({ title: '开始打包', icon: 'success' });
        this.loadStats();
        this.loadOrders();
      } else {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' });
      }
    } catch (error) {
      console.error('开始打包失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 完成打包
  async finishPack(e) {
    const orderId = e.currentTarget.dataset.id;

    wx.showLoading({ title: '处理中' });

    try {
      const result = await this.updateOrderStatus(orderId, ORDER_STATUS.PACKED);

      if (result.code === 0) {
        wx.showToast({ title: '打包完成', icon: 'success' });
        this.loadStats();
        this.loadOrders();
      } else {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' });
      }
    } catch (error) {
      console.error('完成打包失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 联系用户
  contactUser(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) {
      wx.showToast({ title: '用户未留电话', icon: 'none' });
      return;
    }

    wx.makePhoneCall({
      phoneNumber: phone
    });
  },

  // 开始配送 - 直接进入配送中状态（不选择配送员）
  async startDelivery(e) {
    const orderId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认开始配送',
      content: '确定要开始配送该订单吗？',
      confirmColor: '#8B6347',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中' });

          try {
            const result = await this.updateOrderStatus(orderId, ORDER_STATUS.DELIVERING);

            if (result.code === 0) {
              wx.showToast({ title: '开始配送', icon: 'success' });
              this.loadStats();
              this.loadOrders();
            } else {
              wx.showToast({ title: result.message || '操作失败', icon: 'none' });
            }
          } catch (error) {
            console.error('开始配送失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },


  // 完成配送
  async completeDelivery(e) {
    const orderId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认完成',
      content: '确定该订单已完成配送吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中' });

          try {
            const result = await this.updateOrderStatus(orderId, ORDER_STATUS.COMPLETED);

            if (result.code === 0) {
              wx.showToast({ title: '配送完成', icon: 'success' });
              this.loadStats();
              this.loadOrders();
            } else {
              wx.showToast({ title: result.message || '操作失败', icon: 'none' });
            }
          } catch (error) {
            console.error('完成配送失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // 查看详情
  viewDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/package-admin/pages/order-detail/order-detail?id=${orderId}`
    });
  },

  // 添加配送员
  addDeliveryman() {
    wx.showToast({
      title: '请在员工管理中添加配送员',
      icon: 'none'
    });
  },

  // 更新订单状态
  async updateOrderStatus(orderId, status) {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'deliveryManage',
        data: {
          operation: 'updateStatus',
          orderId,
          status
        }
      }
    });

    return result.result;
  },

  // 显示订单详情
  showOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(item => item._id === orderId);

    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }

    this.setData({
      showOrderDetailModal: true,
      currentOrder: order
    });
  },

  // 隐藏订单详情
  hideOrderDetail() {
    this.setData({
      showOrderDetailModal: false,
      currentOrder: null
    });
  }
});
