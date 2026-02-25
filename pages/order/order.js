/**
 * 订单页面
 * 面包烘焙小程序 - 订单页面
 */

const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
console.log('[订单] 加载的图标:', Object.keys(icons));
const { ORDER_STATUS, getOrderStatusByCode } = require('../../utils/constants');

Page({
  data: {
    // 订单状态标签 - 匹配云函数状态码: 0待支付, 1已支付, 2备餐中, 3配送中, 4已完成, -1已取消
    tabs: [
      { code: 'all', name: 'all', label: '全部' },
      { code: 0, name: 'pending_payment', label: '待付款' },
      { code: 2, name: 'preparing', label: '备货中' },
      { code: 4, name: 'completed', label: '已完成' },
      { code: -1, name: 'cancelled', label: '已取消' }
    ],

    // 当前选中标签
    activeTab: 'all',

    // 订单列表
    orders: [],

    // 分页
    page: 1,
    pageSize: 10,
    hasMore: true,

    // 页面状态
    isLoading: true,
    isLoadingMore: false,
    hasError: false,

    // 登录状态
    isLogin: false,

    // Navigation tab
    activeNavTab: 'order',

    // Base64 icons
    icons: icons
  },

  onLoad(options) {
    console.log('[订单] 页面加载', options);
    // 检查登录状态
    const auth = require('../../utils/auth');
    const isLogin = auth.isLogin();
    console.log('[订单] 登录状态:', isLogin);

    this.setData({ isLogin });

    if (!isLogin) {
      console.log('[订单] 用户未登录，显示空状态');
      this.setData({ isLoading: false, orders: [] });
      return;
    }

    this.loadOrders();
  },

  onShow() {
    console.log('[订单] 页面显示');
    // 检查登录状态
    const auth = require('../../utils/auth');
    const isLogin = auth.isLogin();

    if (!isLogin) {
      // 未登录状态：清空订单数据
      this.setData({
        isLogin: false,
        orders: [],
        hasMore: false,
        isLoading: false
      });
    } else {
      // 已登录状态：刷新订单列表
      this.setData({ isLogin: true });
      this.refreshOrders();
    }

    // 设置自定义 tabBar 选中状态
    this.setTabBarSelected();
  },

  /**
   * 设置自定义 tabBar 选中状态
   */
  setTabBarSelected() {
    console.log('[订单] 设置 tabBar 选中');
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected(2);
      console.log('[订单] tabBar 选中状态已设置为 2');
    } else {
      console.log('[订单] getTabBar 不可用');
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.refreshOrders();
  },

  /**
   * 上拉加载更多
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoadingMore) {
      this.loadMoreOrders();
    }
  },

  /**
   * 切换标签
   */
  onTabChange(e) {
    const { code } = e.currentTarget.dataset;
    this.setData({
      activeTab: code,
      orders: [],
      page: 1,
      hasMore: true
    });
    this.loadOrders();
  },

  /**
   * 加载订单列表
   */
  async loadOrders() {
    this.setData({ isLoading: true, hasError: false });
    
    try {
      const { activeTab, page, pageSize } = this.data;
      
      const params = {
        page,
        pageSize
      };
      
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      
      const res = await api.order.getList(params);
      console.log('[订单] API返回结果:', res);

      // 处理不同的返回格式
      let orders = [];
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.list)) {
          orders = res.data.list;
        } else if (Array.isArray(res.data)) {
          orders = res.data;
        }
      }
      console.log('[订单] 解析后的订单列表:', orders.length, '条');
      const processedOrders = orders.map(order => {
        const statusInfo = getOrderStatusByCode(order.status);
        // Map status codes to Figma-style status text and colors
        let statusText = statusInfo.label;
        let statusColor = '#B08860';

        // 云函数状态码: 0待支付, 1已支付, 2备餐中, 3配送中, 4已完成, -1已取消, 5线下支付
        switch(order.status) {
          case 0: // pending payment
            statusText = '待付款';
            statusColor = '#D4A96A';
            break;
          case 5: // offline pay
            statusText = '线下支付';
            statusColor = '#D4A96A';
            break;
          case 1: // paid
            statusText = '已支付';
            statusColor = '#4ECDC4';
            break;
          case 2: // preparing
            statusText = '备货中';
            statusColor = '#9B7355';
            break;
          case 3: // delivering
            statusText = '配送中';
            statusColor = '#9B7355';
            break;
          case 4: // completed
            statusText = '已完成';
            statusColor = '#7A9B55';
            break;
          case -1: // cancelled
            statusText = '已取消';
            statusColor = '#999999';
            break;
          default:
            statusText = statusInfo.label;
            statusColor = '#B08860';
        }

        return {
          ...order,
          statusInfo,
          statusText,
          statusColor,
          productCount: (order.items && order.items.reduce((sum, item) => sum + item.quantity, 0)) || 0
        };
      });
      
      this.setData({
        orders: processedOrders,
        hasMore: orders.length >= pageSize,
        isLoading: false
      });
    } catch (error) {
      console.error('[订单] 加载失败', error);
      this.setData({
        isLoading: false,
        hasError: true
      });
    }
  },

  /**
   * 刷新订单列表
   */
  async refreshOrders() {
    this.setData({ page: 1, hasMore: true });
    await this.loadOrders();
    wx.stopPullDownRefresh();
  },

  /**
   * 加载更多订单
   */
  async loadMoreOrders() {
    this.setData({ isLoadingMore: true });
    
    try {
      const { activeTab, page, pageSize, orders } = this.data;
      
      const params = {
        page: page + 1,
        pageSize
      };
      
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      
      const res = await api.order.getList(params);

      let newOrders = [];
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.list)) {
          newOrders = res.data.list;
        } else if (Array.isArray(res.data)) {
          newOrders = res.data;
        }
      }

      const processedOrders = newOrders.map(order => ({
        ...order,
        statusInfo: getOrderStatusByCode(order.status),
        productCount: (order.items && order.items.reduce((sum, item) => sum + item.quantity, 0)) || 0
      }));

      this.setData({
        orders: [...orders, ...processedOrders],
        page: page + 1,
        hasMore: newOrders.length >= pageSize,
        isLoadingMore: false
      });
    } catch (error) {
      console.error('[订单] 加载更多失败', error);
      this.setData({ isLoadingMore: false });
    }
  },

  /**
   * 点击订单
   */
  onOrderTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/package-order/pages/order-detail/order-detail?id=${id}`
    });
  },

  /**
   * 取消订单
   */
  async onCancelOrder(e) {
    const { id } = e.currentTarget.dataset;
    
    const { confirm } = await util.showModal({
      title: '取消订单',
      content: '确定要取消这个订单吗？'
    });
    
    if (!confirm) return;
    
    try {
      const { success } = await api.order.cancel(id, '用户取消');
      
      if (success) {
        util.showToast('已取消', 'success');
        this.refreshOrders();
      }
    } catch (error) {
      util.showToast('取消失败', 'error');
    }
  },

  /**
   * 支付订单
   */
  async onPayOrder(e) {
    const { id } = e.currentTarget.dataset;
    
    try {
      const { success } = await api.order.pay(id);
      
      if (success) {
        util.showToast('支付成功', 'success');
        this.refreshOrders();
      }
    } catch (error) {
      util.showToast('支付失败', 'error');
    }
  },

  /**
   * 确认收货
   */
  async onConfirmReceive(e) {
    const { id } = e.currentTarget.dataset;
    
    const { confirm } = await util.showModal({
      title: '确认收货',
      content: '确认已收到商品吗？'
    });
    
    if (!confirm) return;
    
    try {
      const { success } = await api.order.confirmReceive(id);
      
      if (success) {
        util.showToast('已确认', 'success');
        this.refreshOrders();
      }
    } catch (error) {
      util.showToast('确认失败', 'error');
    }
  },

  /**
   * 再次购买
   */
  onBuyAgain(e) {
    const { order } = e.currentTarget.dataset;
    // 将订单商品加入购物车
    order.items.forEach(item => {
      api.cart.add({
        productId: item.productId,
        quantity: item.quantity
      });
    });
    
    util.showToast('已加入购物车', 'success');
    
    // 跳转到购物车
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 申请退款
   */
  async onRefund(e) {
    const { id } = e.currentTarget.dataset;
    
    wx.navigateTo({
      url: `/package-order/pages/refund/refund?orderId=${id}`
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '小赵面食 - 我的订单',
      path: '/pages/order/order'
    };
  },

  /**
   * 去预定/去登录
   */
  onGoReserve() {
    const auth = require('../../utils/auth');
    const isLogin = auth.isLogin();

    if (!isLogin) {
      wx.switchTab({ url: '/pages/user/user' });
      return;
    }

    wx.switchTab({ url: '/pages/reserve/reserve' });
  },

  /**
   * Navigation tab change
   */
  onNavTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeNavTab) return;

    switch (tab) {
      case 'home':
        wx.switchTab({ url: '/pages/index/index' });
        break;
      case 'reserve':
        wx.switchTab({ url: '/pages/reserve/reserve' });
        break;
      case 'order':
        // Already on order
        break;
      case 'user':
        wx.switchTab({ url: '/pages/user/user' });
        break;
    }
  }
});
