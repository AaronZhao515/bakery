/**
 * Admin 仪表板
 * 功能：数据概览、快捷入口、最近订单
 */
const app = getApp();
const api = require('../../../utils/api.js');

// 订单状态映射
const ORDER_STATUS_MAP = {
  0: { text: '待支付', class: 'pending' },
  1: { text: '已支付', class: 'paid' },
  2: { text: '制作中', class: 'preparing' },
  3: { text: '配送中', class: 'delivering' },
  4: { text: '已完成', class: 'completed' },
  '-1': { text: '已取消', class: 'cancelled' },
  '-2': { text: '退款中', class: 'refunding' },
  '-3': { text: '已退款', class: 'refunded' }
};

Page({
  data: {
    // 管理员信息
    adminInfo: {},
    // 当前日期
    currentDate: '',
    // 统计数据
    statistics: {
      today: { salesAmount: 0, orderCount: 0 },
      yesterday: { salesAmount: 0 },
      week: { salesAmount: 0 },
      month: { salesAmount: 0 },
      pendingOrderCount: 0,
      productCount: 0,
      stockWarningCount: 0,
      userCount: 0
    },
    // 趋势百分比
    trendPercent: 0,
    // 最近订单
    recentOrders: [],
    // 是否正在加载
    isLoading: false
  },

  onLoad(options) {
    this.checkAdminAuth();
    this.setCurrentDate();
    this.loadDashboardData();
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

    // 每次显示页面时刷新数据
    this.loadDashboardData();
  },

  onPullDownRefresh() {
    this.loadDashboardData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 检查管理员权限
  checkAdminAuth() {
    const adminInfo = wx.getStorageSync('admin_info');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.redirectTo({
        url: '/package-admin/pages/login/login'
      });
      return;
    }
    this.setData({ adminInfo });
  },

  // 设置当前日期
  setCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekDay = weekDays[now.getDay()];

    this.setData({
      currentDate: `${year}年${month}月${day}日 ${weekDay}`
    });
  },

  // 加载仪表板数据
  async loadDashboardData() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });

    try {
      // 并行加载统计数据和最近订单
      const [statsResult, ordersResult] = await Promise.all([
        this.loadStatistics(),
        this.loadRecentOrders()
      ]);

      if (statsResult.code === 0) {
        const stats = statsResult.data;
        // 计算趋势百分比
        const trendPercent = stats.yesterday.salesAmount > 0
          ? Math.round(((stats.today.salesAmount - stats.yesterday.salesAmount) / stats.yesterday.salesAmount) * 100)
          : 0;

        this.setData({
          statistics: stats,
          trendPercent
        });
      }

      if (ordersResult.code === 0) {
        // 加载产品图片映射
        const productImageMap = await this.loadProductImages(ordersResult.data.list);

        const orders = ordersResult.data.list.map(order => ({
          ...order,
          statusText: ORDER_STATUS_MAP[order.status]?.text || '未知',
          statusClass: ORDER_STATUS_MAP[order.status]?.class || 'pending',
          createTime: this.formatTime(order.createTime),
          // 为产品添加实时图片
          products: (order.products || []).map(p => ({
            ...p,
            image: productImageMap[p.productId] || p.image || '/images/default-product.png'
          }))
        }));

        this.setData({
          recentOrders: orders
        });
      }
    } catch (error) {
      console.error('加载仪表板数据失败:', error);
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载统计数据
  async loadStatistics() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'getStatistics'
        }
      });
      return result.result;
    } catch (error) {
      console.error('加载统计数据失败:', error);
      return { code: -1, message: '加载失败' };
    }
  },

  // 加载最近订单
  async loadRecentOrders() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'orderManage',
          data: {
            operation: 'list',
            page: 1,
            pageSize: 5
          }
        }
      });
      return result.result;
    } catch (error) {
      console.error('加载最近订单失败:', error);
      return { code: -1, message: '加载失败' };
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
        console.warn('[Dashboard] 获取产品信息失败');
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
      console.error('[Dashboard] 加载产品图片失败:', error);
      return {};
    }
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  // 刷新数据
  refreshData() {
    wx.showLoading({ title: '刷新中' });
    this.loadDashboardData().then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    });
  },

  // 前往设置
  goToSettings() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 前往待处理订单
  goToPendingOrders() {
    wx.navigateTo({
      url: '/package-admin/pages/order-manage/order-manage?status=1'
    });
  },

  // 前往今日订单
  goToTodayOrders() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    wx.navigateTo({
      url: `/package-admin/pages/order-manage/order-manage?startDate=${todayStr}&endDate=${todayStr}&title=今日订单`
    });
  },

  // 前往销售统计
  goToSalesStatistics() {
    wx.navigateTo({
      url: '/package-admin/pages/statistics/statistics'
    });
  },

  // 前往库存预警
  goToStockWarning() {
    wx.navigateTo({
      url: '/package-admin/pages/stock/stock?filter=warning'
    });
  },

  // 快捷前往库存预警（快捷操作入口）
  quickStockWarning() {
    this.goToStockWarning();
  },

  // 前往商品管理
  goToProductManage() {
    wx.navigateTo({
      url: '/package-admin/pages/product-list/product-list'
    });
  },

  // 前往订单管理
  goToOrderManage() {
    wx.navigateTo({
      url: '/package-admin/pages/order-manage/order-manage'
    });
  },

  // 前往优惠券管理
  goToCouponManage() {
    wx.navigateTo({
      url: '/package-admin/pages/coupon-manage/coupon-manage'
    });
  },

  // 前往积分管理
  goToPointsManage() {
    wx.navigateTo({
      url: '/package-admin/pages/points-manage/points-manage'
    });
  },

  // 前往配送管理
  goToDeliveryManage() {
    wx.navigateTo({
      url: '/package-admin/pages/delivery-manage/delivery-manage'
    });
  },

  // 前往自取管理
  goToPickupManage() {
    wx.navigateTo({
      url: '/package-admin/pages/pickup-manage/pickup-manage'
    });
  },

  // 前往数据统计
  goToStatistics() {
    wx.navigateTo({
      url: '/package-admin/pages/statistics/statistics'
    });
  },

  // 前往库存管理
  goToStockManage() {
    wx.navigateTo({
      url: '/package-admin/pages/stock/stock'
    });
  },

  // 前往用户管理
  goToUserManage() {
    wx.navigateTo({
      url: '/package-admin/pages/user-manage/user-manage'
    });
  },

  // 前往图片工具
  goToImageTools() {
    wx.navigateTo({
      url: '/package-admin/pages/image-tools/image-tools'
    });
  },

  // 快速添加商品
  quickAddProduct() {
    wx.navigateTo({
      url: '/package-admin/pages/product-edit/product-edit'
    });
  },

  // 快速创建优惠券
  quickCreateCoupon() {
    wx.navigateTo({
      url: '/package-admin/pages/coupon-manage/coupon-manage?action=create'
    });
  },

  // 快速充值积分
  quickChargePoints() {
    wx.navigateTo({
      url: '/package-admin/pages/points-manage/points-manage?action=charge'
    });
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/package-admin/pages/order-detail/order-detail?id=${orderId}`
    });
  }
});
