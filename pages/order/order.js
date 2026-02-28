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
    // 订单状态标签
    // 待自取: status=1(已支付) 或 status=2(制作中) + deliveryType=0(自取)
    // 待配送: status=1(已支付) 或 status=2(制作中) 或 status=3(配送中) + deliveryType=1
    tabs: [
      { code: 'all', name: 'all', label: '全部' },
      { code: 0, name: 'pending_payment', label: '待付款' },
      { code: 'pending_pickup', name: 'pending_pickup', label: '待自取', filter: { statusList: [1, 2], deliveryType: 0 } },
      { code: 'pending_delivery', name: 'pending_delivery', label: '待配送', filter: { statusList: [1, 2, 3], deliveryType: 1 } },
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
    icons: icons,

    // Header visibility on scroll
    headerHidden: false,
    lastScrollTop: 0,
    scrollTimer: null
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
   * 获取当月日期范围
   */
  getCurrentMonthRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // 当月第一天 00:00:00
    const startOfMonth = new Date(year, month, 1, 0, 0, 0);
    // 当月最后一天 23:59:59
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    return {
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString()
    };
  },

  /**
   * 加载订单列表
   */
  async loadOrders() {
    this.setData({ isLoading: true, hasError: false });

    try {
      const { activeTab, page, pageSize } = this.data;

      // 获取当月日期范围
      const { startDate, endDate } = this.getCurrentMonthRange();

      const params = {
        page,
        pageSize,
        startDate,
        endDate
      };

      if (activeTab !== 'all') {
        const activeTabItem = this.data.tabs.find(tab => tab.code === activeTab);
        if (activeTabItem && activeTabItem.filter) {
          // 使用filter配置进行复合查询
          params.filter = activeTabItem.filter;
        } else {
          params.status = activeTab;
        }
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

      // 加载产品图片映射
      const productImageMap = await this.loadProductImages(orders);

      const processedOrders = orders.map(order => {
        const statusInfo = getOrderStatusByCode(order.status, order.deliveryType);
        // Map status codes to Figma-style status text and colors
        let statusText = statusInfo.label;
        let statusColor = '#B08860';

        // 云函数状态码: 0待支付, 1已支付, 2制作中, 3配送中, 4已完成, 5线下支付, -1已取消, -2退款中, -3已退款
        // 待自取: status=1 + deliveryType=0
        // 待配送: status=1 + deliveryType=1
        switch(order.status) {
          case 0: // pending payment
            statusText = '待付款';
            statusColor = '#D4A96A';
            break;
          case 5: // offline pay
            statusText = '线下支付';
            statusColor = '#D4A96A';
            break;
          case 1: // paid (待自取或待配送)
            if (order.deliveryType === 0) {
              statusText = '待自取';
              statusColor = '#26C6DA';
            } else {
              statusText = '待配送';
              statusColor = '#9B7355';
            }
            break;
          case 2: // preparing
            statusText = '制作中';
            statusColor = '#AB47BC';
            break;
          case 3: // delivering
            statusText = '配送中';
            statusColor = '#29B6F6';
            break;
          case 4: // completed
            statusText = '已完成';
            statusColor = '#7A9B55';
            break;
          case -1: // cancelled
            statusText = '已取消';
            statusColor = '#999999';
            break;
          case -2: // refunding
            statusText = '退款中';
            statusColor = '#EF5350';
            break;
          case -3: // refunded
            statusText = '已退款';
            statusColor = '#BDBDBD';
            break;
          default:
            statusText = statusInfo.label;
            statusColor = '#B08860';
        }

        // 为订单产品添加图片
        const items = (order.items || order.products || []).map(item => ({
          ...item,
          image: productImageMap[item.productId] || item.image || ''
        }));

        return {
          ...order,
          items,
          statusInfo,
          statusText,
          statusColor,
          productCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0)
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
   * 加载产品图片映射（实时从 products 集合获取）
   */
  async loadProductImages(orders) {
    if (!orders || orders.length === 0) {
      return {};
    }

    try {
      // 提取所有 productIds
      const productIds = new Set();
      orders.forEach(order => {
        const items = order.items || order.products || [];
        items.forEach(item => {
          if (item.productId) {
            productIds.add(item.productId);
          }
        });
      });

      if (productIds.size === 0) {
        return {};
      }

      // 批量获取产品信息
      const { result } = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getList',
          page: 1,
          pageSize: 100
        }
      });

      if (result.code !== 0 || !result.data || !result.data.list) {
        console.warn('[订单] 获取产品信息失败');
        return {};
      }

      // 构建 productId -> image 映射
      const productMap = {};
      result.data.list.forEach(product => {
        let image = product.image || (product.images && product.images[0]);
        if (image) {
          productMap[product._id] = image;
        }
      });

      return productMap;

    } catch (error) {
      console.error('[订单] 加载产品图片失败:', error);
      return {};
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

      // 获取当月日期范围
      const { startDate, endDate } = this.getCurrentMonthRange();

      const params = {
        page: page + 1,
        pageSize,
        startDate,
        endDate
      };

      if (activeTab !== 'all') {
        const activeTabItem = this.data.tabs.find(tab => tab.code === activeTab);
        if (activeTabItem && activeTabItem.filter) {
          // 使用filter配置进行复合查询
          params.filter = activeTabItem.filter;
        } else {
          params.status = activeTab;
        }
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

      // 加载产品图片映射
      const productImageMap = await this.loadProductImages(newOrders);

      const processedOrders = newOrders.map(order => {
        const statusInfo = getOrderStatusByCode(order.status, order.deliveryType);
        let statusText = statusInfo.label;
        let statusColor = '#B08860';

        switch(order.status) {
          case 0:
            statusText = '待付款';
            statusColor = '#D4A96A';
            break;
          case 5:
            statusText = '线下支付';
            statusColor = '#D4A96A';
            break;
          case 1:
            if (order.deliveryType === 0) {
              statusText = '待自取';
              statusColor = '#26C6DA';
            } else {
              statusText = '待配送';
              statusColor = '#9B7355';
            }
            break;
          case 2:
            statusText = '制作中';
            statusColor = '#AB47BC';
            break;
          case 3:
            statusText = '配送中';
            statusColor = '#29B6F6';
            break;
          case 4:
            statusText = '已完成';
            statusColor = '#7A9B55';
            break;
          case -1:
            statusText = '已取消';
            statusColor = '#999999';
            break;
          case -2:
            statusText = '退款中';
            statusColor = '#EF5350';
            break;
          case -3:
            statusText = '已退款';
            statusColor = '#BDBDBD';
            break;
          default:
            statusText = statusInfo.label;
            statusColor = '#B08860';
        }

        // 为订单产品添加图片
        const items = (order.items || order.products || []).map(item => ({
          ...item,
          image: productImageMap[item.productId] || item.image || ''
        }));

        // 判断是否可以取消
        // 制作中(2)和配送中(3)不允许用户取消
        const canCancel = [0, 1].includes(order.status);
        const cannotCancelReason = (order.status === 2 || order.status === 3)
          ? '商品已经制作，如需取消，请联系客服'
          : '';

        return {
          ...order,
          items,
          statusInfo,
          statusText,
          statusColor,
          productCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
          canCancel,
          cannotCancelReason,
          showActions: [0, 1, 2, 3].includes(order.status) // 显示操作按钮的状态
        };
      });

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
      const result = await api.order.cancel(id, '用户取消');

      if (result.success) {
        util.showToast('已取消', 'success');
        this.refreshOrders();
      } else {
        // 显示后端返回的具体错误信息
        util.showToast(result.message || '取消失败', 'error');
      }
    } catch (error) {
      // 显示具体的错误信息
      const errorMsg = error.message || '取消失败';
      util.showToast(errorMsg, 'error');
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
  },

  /**
   * 监听页面滚动事件 - 控制表头显示/隐藏
   */
  onPageScroll(e) {
    const scrollTop = e.scrollTop;
    const { lastScrollTop, scrollTimer, headerHidden } = this.data;

    // 清除之前的定时器
    if (scrollTimer) {
      clearTimeout(scrollTimer);
    }

    // 判断滚动方向
    if (scrollTop > lastScrollTop && scrollTop > 50) {
      // 向下滑动且滚动距离超过50px，隐藏表头
      if (!headerHidden) {
        this.setData({ headerHidden: true });
      }
    } else if (scrollTop < lastScrollTop) {
      // 向上滑动，显示表头
      if (headerHidden) {
        this.setData({ headerHidden: false });
      }
    }

    // 设置新的定时器，停止滚动500ms后显示表头
    const newTimer = setTimeout(() => {
      if (this.data.headerHidden) {
        this.setData({
          headerHidden: false,
          scrollTimer: null
        });
      }
    }, 500);

    // 更新滚动位置
    this.setData({
      lastScrollTop: scrollTop,
      scrollTimer: newTimer
    });
  }
});
