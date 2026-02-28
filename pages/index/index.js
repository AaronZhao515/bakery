/**
 * 首页
 * 面包烘焙小程序 - 首页
 */

const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const auth = require('../../utils/auth');

Page({
  data: {
    // 页面数据
    banners: [],
    categories: [],
    hotProducts: [],
    newProducts: [],
    recommendProducts: [],
    notices: [],

    // 页面状态
    isLoading: true,
    isRefreshing: false,
    hasError: false,
    errorMsg: '',

    // 购物车数量
    cartCount: 0,

    // 登录状态
    isLogin: false,

    // Tab bar
    activeTab: 'home',

    // Base64 图标
    icons: icons
  },

  onLoad(options) {
    console.log('[首页] 页面加载', options);
    // 分阶段加载：先加载关键数据渲染首屏，再加载非关键数据
    this.loadCriticalData();
    // 延迟加载非关键数据，提升首屏渲染速度
    setTimeout(() => {
      this.loadNonCriticalData();
    }, 300);
  },

  onShow() {
    console.log('[首页] 页面显示');
    // 检查登录状态
    this.checkLoginStatus();
    // 更新购物车数量（未登录时清空显示）
    const isLogin = auth.isLogin();
    if (!isLogin) {
      this.setData({ cartCount: 0 });
      // 清空全局 store 中的购物车数据
      const cartStore = app.store && app.store.cartStore;
      if (cartStore) {
        cartStore.set('items', []);
        cartStore.set('totalPrice', 0);
        cartStore.set('totalCount', 0);
      }
    } else {
      this.updateCartCount();
    }
    // 设置自定义 tabBar 选中状态
    this.setTabBarSelected();

    // 检查是否需要刷新商品数据（从商品编辑页返回）
    const needRefresh = wx.getStorageSync('home_products_need_refresh');
    if (needRefresh) {
      console.log('[首页] 检测到商品更新，刷新推荐商品');
      this.refreshProducts();
      wx.removeStorageSync('home_products_need_refresh');
    }
  },

  /**
   * 刷新商品数据
   */
  async refreshProducts() {
    try {
      const [recommendRes, newRes] = await Promise.all([
        this.loadRecommendProducts(),
        this.loadNewProducts()
      ]);

      this.setData({
        recommendProducts: recommendRes,
        newProducts: newRes
      });

      console.log('[首页] 商品数据刷新完成');
    } catch (error) {
      console.error('[首页] 刷新商品数据失败', error);
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const isLogin = auth.isLogin();
    console.log('[首页] 登录状态:', isLogin);
    this.setData({ isLogin });
  },

  /**
   * 设置自定义 tabBar 选中状态
   */
  setTabBarSelected() {
    console.log('[首页] 设置 tabBar 选中');
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected(0);
      console.log('[首页] tabBar 选中状态已设置为 0');
    } else {
      console.log('[首页] getTabBar 不可用');
    }
  },

  onReady() {
    console.log('[首页] 页面就绪');
  },

  onHide() {
    console.log('[首页] 页面隐藏');
  },

  onUnload() {
    console.log('[首页] 页面卸载');
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    console.log('[首页] 下拉刷新');
    this.setData({ isRefreshing: true });

    try {
      // 先刷新关键数据
      await this.loadCriticalData();
      // 再刷新非关键数据
      await this.loadNonCriticalData();
    } finally {
      this.setData({ isRefreshing: false });
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 上拉加载
   */
  onReachBottom() {
    console.log('[首页] 上拉加载');
    // 加载更多推荐商品
    this.loadMoreProducts();
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '暖心烘焙 - 温暖你的每一天',
      path: '/pages/index/index',
      imageUrl: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/share-cover.png'
    };
  },

  /**
   * 加载关键数据（首屏）
   * 优先加载用户第一眼看到的内容
   */
  async loadCriticalData() {
    this.setData({ isLoading: true, hasError: false });

    try {
      // 首屏关键数据：Banner和分类是用户最先看到的
      const [bannersRes, categoriesRes] = await Promise.all([
        this.loadBanners(),
        this.loadCategories()
      ]);

      this.setData({
        banners: bannersRes,
        categories: categoriesRes,
        isLoading: false
      });

    } catch (error) {
      console.error('[首页] 加载关键数据失败', error);
      this.setData({
        isLoading: false,
        hasError: true,
        errorMsg: error.message || '加载失败'
      });
    }
  },

  /**
   * 加载非关键数据（延迟加载）
   * 首屏渲染后再加载推荐商品等
   */
  async loadNonCriticalData() {
    try {
      // 非关键数据：推荐商品、新品、公告
      const [recommendRes, noticeRes] = await Promise.all([
        this.loadRecommendProducts(),
        this.loadNotices()
      ]);

      this.setData({
        recommendProducts: recommendRes,
        notices: noticeRes
      });

      console.log('[首页] 非关键数据加载完成');
    } catch (error) {
      console.error('[首页] 加载非关键数据失败', error);
      // 非关键数据加载失败不影响主页面
    }
  },

  /**
   * @deprecated 使用 loadCriticalData + loadNonCriticalData 替代
   */
  async loadPageData() {
    await this.loadCriticalData();
    await this.loadNonCriticalData();
  },

  /**
   * 加载轮播图
   */
  async loadBanners() {
    // 云存储图片地址（使用 cloud:// 协议，小程序自动鉴权）
    return [
      { id: 1, image: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/banner1.jpg', link: '/pages/product/detail?id=1' },
      { id: 2, image: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/banner2.jpg', link: '/pages/product/detail?id=2' },
      { id: 3, image: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/banner3.jpg', link: '/pages/activity/sale' }
    ];
  },

  /**
   * 加载分类
   */
  async loadCategories() {
    const { PRODUCT_CATEGORY } = require('../../utils/constants');
    return Object.values(PRODUCT_CATEGORY).map(cat => ({
      id: cat.code,
      name: cat.label,
      icon: cat.icon,
      path: `/package-product/pages/category/category?id=${cat.code}`
    }));
  },

  /**
   * 加载推荐商品（今日推荐）
   */
  async loadRecommendProducts() {
    const { result } = await api.product.getRecommend(10);
    const products = (result && result.data) || [];

    // 云存储图片直接使用原路径（文件名已包含时间戳）
    return products.map(item => {
      let imageUrl = '';
      if (item.images && item.images.length > 0) {
        imageUrl = item.images[0];
      } else if (item.image) {
        imageUrl = item.image;
      } else if (item.coverImage) {
        imageUrl = item.coverImage;
      }

      return {
        ...item,
        images: imageUrl ? [imageUrl] : (item.images || [])
      };
    });
  },

  /**
   * 加载热销商品（预留）
   */
  async loadHotProducts() {
    const { result } = await api.product.getRecommend(6);
    return (result && result.data) || [];
  },

  /**
   * 加载新品（预留）
   */
  async loadNewProducts() {
    const { result } = await api.product.getList({ isNew: true, limit: 6 });
    return (result && result.data && result.data.list) || [];
  },

  /**
   * 加载公告
   */
  async loadNotices() {
    // 模拟数据
    return [
      { id: 1, content: '新用户首单立减10元' },
      { id: 2, content: '满88元免配送费' },
      { id: 3, content: '每日新鲜出炉，欢迎预定' }
    ];
  },

  /**
   * 加载更多商品
   */
  async loadMoreProducts() {
    // 实现加载更多逻辑
  },

  /**
   * 更新购物车数量
   */
  updateCartCount() {
    const cartStore = app.store && app.store.cartStore;
    if (cartStore) {
      this.setData({
        cartCount: cartStore.get('totalCount') || 0
      });
    }
  },

  /**
   * 点击轮播图
   */
  onBannerTap(e) {
    const { item } = e.currentTarget.dataset;
    if (item.link) {
      wx.navigateTo({ url: item.link });
    }
  },

  /**
   * 点击分类
   */
  onCategoryTap(e) {
    const { item } = e.currentTarget.dataset;
    wx.navigateTo({ url: item.path });
  },

  /**
   * 点击商品
   */
  onProductTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/package-product/pages/product-detail/product-detail?id=${id}`
    });
  },

  /**
   * 加入购物车
   */
  async onAddCart(e) {
    const { product } = e.detail;

    // 检查登录状态
    const app = getApp();
    const userStore = app.store && app.store.userStore;
    const storeLogin = userStore && userStore.get('isLogin');
    const authLogin = this.data.isLogin;
    const isLogin = storeLogin || authLogin;

    if (!isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再添加商品到购物车',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/user' });
          }
        }
      });
      return;
    }

    try {
      const { success } = await api.cart.add({
        productId: product._id || product.id,
        quantity: 1
      });

      if (success) {
        util.showToast('已加入购物车', 'success');
        this.updateCartCount();
      }
    } catch (error) {
      util.showToast('添加失败', 'error');
    }
  },

  /**
   * 点击搜索
   */
  onSearchTap() {
    wx.navigateTo({
      url: '/package-product/pages/product-list/product-list'
    });
  },

  /**
   * 点击公告
   */
  onNoticeTap(e) {
    const { item } = e.currentTarget.dataset;
    // 处理公告点击
  },

  /**
   * 重新加载
   */
  onReload() {
    this.loadPageData();
  },

  /**
   * Tab切换
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;

    switch (tab) {
      case 'home':
        // Already on home
        break;
      case 'reserve':
        wx.switchTab({ url: '/pages/reserve/reserve' });
        break;
      case 'order':
        wx.switchTab({ url: '/pages/order/order' });
        break;
      case 'user':
        wx.switchTab({ url: '/pages/user/user' });
        break;
    }
  },

  /**
   * 点击预定自取
   */
  onPickupTap() {
    // 设置订单类型为自取，存入全局store
    const app = getApp();
    if (app.store && app.store.appStore) {
      app.store.appStore.set('orderType', 'pickup');
    }
    wx.setStorageSync('orderType', 'pickup');
    wx.switchTab({ url: '/pages/reserve/reserve' });
  },

  /**
   * 点击预定配送
   */
  onDeliveryTap() {
    // 设置订单类型为配送，存入全局store
    const app = getApp();
    if (app.store && app.store.appStore) {
      app.store.appStore.set('orderType', 'delivery');
    }
    wx.setStorageSync('orderType', 'delivery');
    wx.switchTab({ url: '/pages/reserve/reserve' });
  },

  /**
   * 点击会员储值 - 跳转到会员中心
   */
  onMemberTap() {
    wx.navigateTo({ url: '/package-user/pages/vip-center/vip-center' });
  },

  /**
   * 点击领券中心
   */
  onCouponTap() {
    wx.navigateTo({ url: '/package-user/pages/coupon/coupon' });
  },

  /**
   * 点击更多商品
   */
  onMoreProducts() {
    wx.navigateTo({
      url: '/package-product/pages/product-list/product-list'
    });
  },

  /**
   * 点击商品
   */
  onProductTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/package-product/pages/product-detail/product-detail?id=${id}`
    });
  },

  /**
   * 加入购物车
   */
  async onAddToCart(e) {
    const { product } = e.currentTarget.dataset;
    try {
      const { success } = await api.cart.add({
        productId: product._id,
        quantity: 1
      });
      if (success) {
        util.showToast('已加入购物车', 'success');
        this.updateCartCount();
      }
    } catch (error) {
      util.showToast('添加失败', 'error');
    }
  }
});
