/**
 * 优惠券页
 * 功能：优惠券列表展示、状态筛选、兑换码兑换、使用优惠券
 */
const app = getApp();

Page({
  data: {
    currentTab: 0, // 0: 未使用, 1: 已使用, 2: 已过期
    tabText: ['未使用', '已使用', '已过期'],
    couponList: [],
    counts: {
      unused: 0,
      used: 0,
      expired: 0
    },
    exchangeCode: '',
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false
  },

  onLoad() {
    this.loadCouponList();
    this.loadCouponCounts();
  },

  onShow() {
    this.loadCouponList();
    this.loadCouponCounts();
  },

  // 切换标签
  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    this.setData({
      currentTab: tab,
      page: 1,
      couponList: [],
      hasMore: true
    });
    this.loadCouponList();
  },

  // 加载优惠券列表
  async loadCouponList(isRefresh = false) {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });

    const page = isRefresh ? 1 : this.data.page;
    const { currentTab, pageSize } = this.data;

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getCouponList',
        data: {
          status: currentTab,
          page,
          pageSize
        }
      });

      if (result.code === 0) {
        const coupons = result.data.list.map(coupon => ({
          ...coupon,
          expireTime: this.formatDate(coupon.expireTime),
          isExpiringSoon: this.checkExpiringSoon(coupon.expireTime)
        }));

        this.setData({
          couponList: isRefresh ? coupons : [...this.data.couponList, ...coupons],
          page: page + 1,
          hasMore: coupons.length === pageSize,
          isLoading: false
        });
      } else {
        wx.showToast({
          title: result.message || '加载失败',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    } catch (error) {
      console.error('加载优惠券列表失败:', error);
      // 模拟数据（开发测试用）
      this.loadMockData();
    }
  },

  // 加载优惠券数量
  async loadCouponCounts() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getCouponCounts'
      });

      if (result.code === 0) {
        this.setData({
          counts: result.data
        });
      }
    } catch (error) {
      console.error('加载优惠券数量失败:', error);
    }
  },

  // 模拟数据（开发测试用）
  loadMockData() {
    const mockCoupons = [
      {
        _id: 'coupon001',
        name: '新用户专享券',
        amount: '20',
        minSpend: '100',
        scope: '全场通用',
        status: 0,
        expireTime: '2024-02-15',
        isExpiringSoon: true
      },
      {
        _id: 'coupon002',
        name: '满减优惠券',
        amount: '10',
        minSpend: '50',
        scope: '面包类商品',
        status: 0,
        expireTime: '2024-03-01',
        isExpiringSoon: false
      },
      {
        _id: 'coupon003',
        name: '生日特权券',
        amount: '50',
        minSpend: '200',
        scope: '全场通用',
        status: 0,
        expireTime: '2024-06-01',
        isExpiringSoon: false
      }
    ];

    const usedCoupons = [
      {
        _id: 'coupon004',
        name: '节日特惠券',
        amount: '15',
        minSpend: '80',
        scope: '全场通用',
        status: 1,
        expireTime: '2024-01-01',
        isExpiringSoon: false
      }
    ];

    const expiredCoupons = [
      {
        _id: 'coupon005',
        name: '限时优惠券',
        amount: '30',
        minSpend: '150',
        scope: '蛋糕类商品',
        status: 2,
        expireTime: '2023-12-31',
        isExpiringSoon: false
      }
    ];

    let coupons = [];
    switch (this.data.currentTab) {
      case 0:
        coupons = mockCoupons;
        break;
      case 1:
        coupons = usedCoupons;
        break;
      case 2:
        coupons = expiredCoupons;
        break;
    }

    this.setData({
      couponList: coupons,
      hasMore: false,
      isLoading: false,
      'counts.unused': 3,
      'counts.used': 1,
      'counts.expired': 1
    });
  },

  // 检查是否即将过期（7天内）
  checkExpiringSoon(expireTime) {
    if (!expireTime) return false;
    const expire = new Date(expireTime);
    const now = new Date();
    const diffDays = Math.ceil((expire - now) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays > 0;
  },

  // 格式化日期
  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadCouponList();
    }
  },

  // 使用优惠券
  useCoupon(e) {
    const couponId = e.currentTarget.dataset.id;
    
    // 如果从订单页面进入，返回并应用优惠券
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    
    if (prevPage && prevPage.route.includes('order')) {
      const coupon = this.data.couponList.find(item => item._id === couponId);
      prevPage.setData({
        selectedCoupon: coupon
      });
      wx.navigateBack();
    } else {
      // 跳转到首页购物
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  // 兑换码输入
  onExchangeInput(e) {
    this.setData({
      exchangeCode: e.detail.value
    });
  },

  // 兑换优惠券
  async exchangeCoupon() {
    const { exchangeCode } = this.data;
    
    if (!exchangeCode.trim()) {
      wx.showToast({
        title: '请输入兑换码',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '兑换中...' });

      const { result } = await wx.cloud.callFunction({
        name: 'exchangeCoupon',
        data: {
          code: exchangeCode.trim()
        }
      });

      wx.hideLoading();

      if (result.code === 0) {
        wx.showToast({
          title: '兑换成功',
          icon: 'success',
          success: () => {
            this.setData({
              exchangeCode: ''
            });
            this.loadCouponList(true);
            this.loadCouponCounts();
          }
        });
      } else {
        wx.showToast({
          title: result.message || '兑换失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '兑换失败',
        icon: 'none'
      });
    }
  },

  // 跳转到领券中心
  goToGetCoupon() {
    wx.navigateTo({
      url: '/pages/coupon-center/coupon-center'
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      couponList: [],
      hasMore: true
    });
    this.loadCouponList(true).then(() => {
      this.loadCouponCounts();
      wx.stopPullDownRefresh();
    });
  }
});
