/**
 * 优惠券中心页面
 * 面包烘焙小程序 - 优惠券中心
 */

const app = getApp();
const api = require('../../../utils/api');
const util = require('../../../utils/util');
const auth = require('../../../utils/auth');

Page({
  data: {
    // 当前选中的Tab: available可领取, unused未使用, used已使用/已过期
    activeTab: 'available',

    // 优惠券列表
    coupons: [],

    // 页面状态
    isLoading: true,
    isRefreshing: false,

    // 空状态提示文字
    emptyText: '',

    // 是否是选择模式（从订单确认页跳转）
    isSelectMode: false,

    // 订单金额（用于判断优惠券是否可用）
    orderAmount: 0
  },

  onLoad(options) {
    console.log('[优惠券中心] 页面加载', options);

    // 检查登录状态
    const isLogin = auth.isLogin();
    if (!isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再查看优惠券',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/user' });
          } else {
            wx.navigateBack();
          }
        }
      });
      return;
    }

    // 根据传入参数设置默认标签页
    if (options.tab) {
      const validTabs = ['available', 'unused', 'used'];
      if (validTabs.includes(options.tab)) {
        this.setData({ activeTab: options.tab });
      }
    }

    // 判断是否是选择模式（从订单确认页跳转）
    const isSelectMode = options.select === 'true';
    const orderAmount = parseFloat(options.amount) || 0;

    if (isSelectMode) {
      // 选择模式下默认显示未使用标签
      this.setData({
        isSelectMode: true,
        orderAmount: orderAmount,
        activeTab: 'unused'
      });
    }

    // 设置默认空状态文字
    this.updateEmptyText();

    // 加载优惠券数据
    this.loadCoupons();
  },

  onShow() {
    console.log('[优惠券中心] 页面显示');
    // 刷新数据
    if (auth.isLogin()) {
      this.loadCoupons();
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({ isRefreshing: true });
    this.loadCoupons().then(() => {
      wx.stopPullDownRefresh();
      this.setData({ isRefreshing: false });
    });
  },

  /**
   * 更新空状态文字
   */
  updateEmptyText() {
    const { activeTab } = this.data;
    let emptyText = '';
    switch (activeTab) {
      case 'available':
        emptyText = '暂无可领取的优惠券（含新人专属）';
        break;
      case 'unused':
        emptyText = '暂无未使用的优惠券';
        break;
      case 'used':
        emptyText = '暂无已使用或过期的优惠券';
        break;
    }
    this.setData({ emptyText });
  },

  /**
   * Tab 切换
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;

    this.setData({
      activeTab: tab,
      coupons: [],
      isLoading: true
    }, () => {
      this.updateEmptyText();
      this.loadCoupons();
    });
  },

  /**
   * 加载优惠券数据
   */
  async loadCoupons() {
    this.setData({ isLoading: true });

    try {
      const { activeTab } = this.data;
      let coupons = [];

      if (activeTab === 'available') {
        // 加载可领取的优惠券（包含新人专属和限时优惠，与VIP中心保持一致）
        const [newcomerRes, limitedRes] = await Promise.all([
          api.coupon.getList({ type: 'newcomer', pageSize: 10 }),
          api.coupon.getList({ type: 'limited', pageSize: 10 })
        ]);
        console.log('[优惠券中心] 新人优惠券:', newcomerRes);
        console.log('[优惠券中心] 限时优惠券:', limitedRes);

        // 合并两种类型的优惠券
        let allCoupons = [];
        if (newcomerRes && newcomerRes.success && newcomerRes.data) {
          const newcomerCoupons = newcomerRes.data.list || [];
          // 标记为新人专属类型
          newcomerCoupons.forEach(c => c.couponType = 'newcomer');
          allCoupons = allCoupons.concat(newcomerCoupons);
        }
        if (limitedRes && limitedRes.success && limitedRes.data) {
          const limitedCoupons = limitedRes.data.list || [];
          // 标记为限时优惠类型
          limitedCoupons.forEach(c => c.couponType = 'limited');
          allCoupons = allCoupons.concat(limitedCoupons);
        }

        // 去重（避免同一优惠券同时存在于两种类型中）
        const seen = new Set();
        coupons = allCoupons.filter(item => {
          if (seen.has(item._id)) return false;
          seen.add(item._id);
          return true;
        });

        // 格式化时间并检查是否已领取
        coupons = await this.formatCoupons(coupons, true);

        console.log('[优惠券中心] 可领取优惠券总数:', coupons.length);
      } else {
        // 加载用户优惠券
        const status = activeTab === 'unused' ? 0 : undefined; // 0未使用, undefined查询所有
        const result = await api.coupon.getUserCoupons(status);
        console.log('[优惠券中心] 用户优惠券:', result);

        if (result && result.success && result.data) {
          let userCoupons = result.data.list || [];
          console.log('[优惠券中心] 用户优惠券原始数据:', userCoupons);

          // 根据tab过滤状态
          if (activeTab === 'unused') {
            // 未使用：只显示status为0的（未使用且未过期）
            userCoupons = userCoupons.filter(item => item.status === 0);
          } else if (activeTab === 'used') {
            // 已使用/已过期：显示status为1或2的
            userCoupons = userCoupons.filter(item => item.status === 1 || item.status === 2);
          }

          console.log('[优惠券中心] 过滤后数据:', userCoupons.length, '张');

          // 将用户优惠券格式化为统一格式
          coupons = userCoupons.map(item => {
            const coupon = item.coupon || {};
            console.log('[优惠券中心] 处理优惠券:', item.couponId, '状态:', item.status, '优惠券信息:', coupon);
            return {
              ...coupon,
              _id: item.couponId,
              userCouponId: item._id,
              status: item.status,
              useTime: item.useTime,
              received: true
            };
          });
          // 格式化时间
          coupons = await this.formatCoupons(coupons, false);
        }
      }

      this.setData({
        coupons: coupons,
        isLoading: false
      });

      console.log('[优惠券中心] 加载完成:', coupons.length, '张优惠券');
    } catch (error) {
      console.error('[优惠券中心] 加载失败:', error);
      this.setData({
        coupons: [],
        isLoading: false
      });
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化优惠券数据
   */
  async formatCoupons(coupons, checkReceived) {
    // 如果是可领取列表，需要检查用户是否已领取
    let userCouponIds = [];
    if (checkReceived) {
      try {
        const result = await api.coupon.getUserCoupons();
        if (result && result.success && result.data) {
          userCouponIds = result.data.list.map(item => item.couponId);
        }
      } catch (e) {
        console.log('[优惠券中心] 获取用户优惠券失败:', e);
      }
    }

    return coupons.map(item => {
      // 格式化时间
      let endTimeStr = '';
      const endTime = item.endTime;
      if (endTime) {
        const date = new Date(endTime);
        endTimeStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
      }

      // 判断是否已领取（优先使用 checkReceived 参数获取的 userCouponIds，忽略数据库中的 received 字段）
      const received = checkReceived
        ? userCouponIds.includes(item._id)
        : (item.received || false);

      // 统一使用固定颜色，不读取数据库中的颜色配置
      const bgColor = '#B08860';
      const bgColorDark = '#8B5A3C';

      // 确定优惠券显示值（兼容 minSpend 和 minAmount 两种字段名）
      const displayAmount = item.amount || 0;
      const displayMinAmount = item.minAmount || item.minSpend || 0;
      const displayTitle = item.title || item.name || '优惠券';
      const displayDesc = item.desc || item.description || '全场通用';
      const discountType = item.discountType || (item.type === 1 ? 'discount' : 'amount');

      return {
        ...item,
        endTimeStr,
        received,
        bgColor,
        bgColorDark,
        displayAmount,
        displayMinAmount,
        displayTitle,
        displayDesc,
        discountType
      };
    });
  },

  /**
   * 获取优惠券颜色
   */
  getCouponColor(type) {
    // type: 0满减券 1折扣券
    const colorMap = [
      { bg: '#B08860', dark: '#9B7355' },
      { bg: '#D4A96A', dark: '#C49A5A' },
      { bg: '#7A9B55', dark: '#6A8B45' },
      { bg: '#E07B6E', dark: '#D06B5E' }
    ];
    return colorMap[type % colorMap.length] || colorMap[0];
  },

  /**
   * 领取优惠券
   */
  async onReceive(e) {
    const couponId = e.currentTarget.dataset.id;
    console.log('[优惠券中心] 领取优惠券:', couponId);

    // 检查是否已领取
    const coupon = this.data.coupons.find(item => item._id === couponId);
    if (coupon && coupon.received) {
      wx.showToast({ title: '您已领取过该优惠券', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '领取中...' });

    try {
      const result = await api.coupon.receive(couponId);
      console.log('[优惠券中心] 领取结果:', result);

      wx.hideLoading();

      if (result && result.success) {
        wx.showToast({
          title: '领取成功',
          icon: 'success'
        });

        // 更新领取状态
        const coupons = this.data.coupons.map(item => {
          if (item._id === couponId) {
            return { ...item, received: true };
          }
          return item;
        });
        this.setData({ coupons });
      } else {
        wx.showToast({
          title: result.message || '领取失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[优惠券中心] 领取失败:', error);
      wx.showToast({
        title: '领取失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 去使用优惠券
   */
  goToUse() {
    wx.switchTab({
      url: '/pages/reserve/reserve'
    });
  },

  /**
   * 选择优惠券（用于订单确认页）
   */
  onSelectCouponForOrder(e) {
    if (!this.data.isSelectMode) return;

    const { id } = e.currentTarget.dataset;
    const coupon = this.data.coupons.find(item => item._id === id);

    if (!coupon) return;

    // 检查是否满足最低消费
    if (this.data.orderAmount > 0 && coupon.displayMinAmount > this.data.orderAmount) {
      wx.showToast({
        title: `满${coupon.displayMinAmount}元可用`,
        icon: 'none'
      });
      return;
    }

    // 构建选中的优惠券数据
    let discountAmount = 0;
    let displayValue = '';
    let displayType = '';

    if (coupon.discountType === 'discount' || coupon.type === 1) {
      // 折扣券
      const discountRate = coupon.displayAmount || 10;
      discountAmount = (this.data.orderAmount * (1 - discountRate / 10));
      displayValue = discountRate + '折';
      displayType = 'discount';
    } else {
      // 满减券
      discountAmount = coupon.displayAmount || 0;
      displayValue = '¥' + discountAmount;
      displayType = 'amount';
    }

    const selectedCoupon = {
      id: coupon.userCouponId || id,
      couponId: id,
      title: coupon.displayTitle,
      desc: coupon.displayDesc,
      amount: parseFloat(discountAmount.toFixed(2)),
      displayValue,
      displayType,
      minAmount: coupon.displayMinAmount || 0,
      endTime: coupon.endTime,
      endTimeStr: coupon.endTimeStr
    };

    console.log('[优惠券中心] 选择优惠券:', selectedCoupon);

    // 存储到本地
    wx.setStorageSync('selectedCouponForOrder', selectedCoupon);

    // 返回上一页
    wx.navigateBack();
  },

  /**
   * 返回上一页
   */
  onBackTap() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '小赵面食 - 优惠券中心',
      path: '/package-user/pages/coupon/coupon'
    };
  }
});
