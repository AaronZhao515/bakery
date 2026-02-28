/**
 * 会员中心页面
 * 面包烘焙小程序 - VIP会员中心
 */

const app = getApp();
const auth = require('../../../utils/auth');
const util = require('../../../utils/util');
const icons = require('../../../utils/icons');
const api = require('../../../utils/api');

// 会员等级配置
const LEVEL_CONFIG = [
  { name: '普通会员', min: 0, max: 99, icon: '⭐' },
  { name: '银卡会员', min: 100, max: 499, icon: '⭐⭐' },
  { name: '黄金会员', min: 500, max: 1999, icon: '⭐⭐⭐' },
  { name: '钻石会员', min: 2000, max: Infinity, icon: '💎' }
];

Page({
  data: {
    // 登录状态
    isLogin: false,

    // 用户信息
    userInfo: null,

    // 会员等级信息
    levelInfo: {
      name: '普通会员',
      level: 0,
      progress: 0,
      nextLevel: null
    },

    // 统计数据
    stats: {
      couponCount: 0,
      points: 0,
      balance: 0
    },

    // 专属礼包优惠券（从CloudBase获取）
    newCoupons: [],

    // 积分明细
    pointsHistory: [],

    // 获取积分方式
    earnMethods: [
      {
        label: '每日签到',
        pts: '+10积分',
        icon: icons.clock,
        color: '#D4A96A'
      },
      {
        label: '消费返利',
        pts: '1元=1积分',
        icon: icons.vipCard,
        color: '#9B7355'
      },
      {
        label: '分享好友',
        pts: '+20积分',
        icon: icons.gift,
        color: '#C8A882'
      },
      {
        label: '完善资料',
        pts: '+50积分',
        icon: icons.user,
        color: '#7A5533'
      }
    ],

    // 图标
    icons: {
      chevronLeft: icons.chevronLeft,
      chevronRight: icons.chevronRight,
      wheat: icons.wheat,
      star: icons.star,
      starFilled: icons.star,
      award: icons.vipCard,
      gift: icons.gift,
      clock: icons.clock,
      wallet: icons.wallet,
      crown: icons.crown
    }
  },

  onLoad(options) {
    console.log('[会员中心] 页面加载', options);
    this.checkLoginStatus();
  },

  onShow() {
    console.log('[会员中心] 页面显示');
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    const isLogin = auth.isLogin();
    const userInfo = auth.getUserInfo();

    console.log('[会员中心] 登录状态:', isLogin);
    console.log('[会员中心] 用户信息:', userInfo);

    this.setData({
      isLogin,
      userInfo: userInfo || null
    });

    if (isLogin && userInfo) {
      // 计算会员等级
      const points = userInfo.points || 0;
      const levelInfo = this.getLevelInfo(points);

      this.setData({
        levelInfo,
        'stats.points': points,
        'stats.balance': userInfo.balance || 0
      });

      // 加载积分明细
      this.loadPointsHistory();

      // 从服务器实时获取优惠券数量
      this.loadUserStats();
    }

    // 无论登录与否都加载优惠券
    this.loadCouponsFromCloud();
  },

  /**
   * 点击积分 - 跳转到积分明细
   */
  onPointsTap() {
    if (!this.data.isLogin) {
      util.showToast('请先登录', 'none');
      return;
    }
    const points = this.data.userInfo.points || 0;
    wx.navigateTo({
      url: `/package-user/pages/points-history/points-history?points=${points}`
    });
  },

  /**
   * 点击优惠券 - 跳转到优惠券中心
   */
  onCouponTap() {
    if (!this.data.isLogin) {
      util.showToast('请先登录', 'none');
      return;
    }
    const couponCount = this.data.stats.couponCount || 0;
    const tab = couponCount > 0 ? 'unused' : 'available';
    wx.navigateTo({
      url: `/package-user/pages/coupon/coupon?tab=${tab}`
    });
  },

  /**
   * 从服务器加载用户统计（优惠券数量等）
   */
  async loadUserStats() {
    try {
      const result = await api.user.getUserInfo();
      console.log('[会员中心] 服务器用户信息:', result);

      if (result && result.success && result.data) {
        const stats = result.data.stats || {};
        this.setData({
          'stats.couponCount': stats.couponCount || 0,
          'stats.points': result.data.points || 0,
          'stats.balance': result.data.balance || 0
        });

        // 同时更新本地用户信息
        const userInfo = auth.getUserInfo() || {};
        userInfo.couponCount = stats.couponCount || 0;
        userInfo.points = result.data.points || 0;
        userInfo.balance = result.data.balance || 0;
        wx.setStorageSync('user_info', userInfo);
      }
    } catch (error) {
      console.error('[会员中心] 加载用户统计失败:', error);
    }
  },

  /**
   * 获取会员等级信息
   */
  getLevelInfo(points) {
    let currentLevel = LEVEL_CONFIG[0];
    let nextLevel = null;
    let progress = 0;

    for (let i = 0; i < LEVEL_CONFIG.length; i++) {
      const level = LEVEL_CONFIG[i];
      if (points >= level.min) {
        currentLevel = level;
        // 检查是否有下一级
        if (i < LEVEL_CONFIG.length - 1) {
          nextLevel = LEVEL_CONFIG[i + 1];
        }
      }
    }

    // 计算进度
    if (nextLevel) {
      const range = nextLevel.min - currentLevel.min;
      const current = points - currentLevel.min;
      progress = Math.min(100, Math.max(0, (current / range) * 100));
    } else {
      progress = 100;
    }

    return {
      name: currentLevel.name,
      level: LEVEL_CONFIG.indexOf(currentLevel),
      progress: Math.round(progress),
      nextLevel: nextLevel ? {
        name: nextLevel.name,
        min: nextLevel.min
      } : null
    };
  },

  /**
   * 加载积分明细
   */
  async loadPointsHistory() {
    try {
      // 调用API获取积分明细
      const result = await api.points.getList({ pageSize: 5 });
      console.log('[会员中心] 积分明细API返回:', result);

      if (result && result.success && result.data && result.data.list) {
        const list = result.data.list;

        // 格式化积分明细数据
        const pointsHistory = list.map((item, index) => {
          const isEarn = item.type === 'earn' || item.points > 0;
          const pts = item.points > 0 ? `+${item.points}` : `${item.points}`;

          // 根据类型选择图标和颜色
          let icon = icons.star;
          let bgColor = '#E8F5E9';
          let color = '#7A9B55';

          if (item.label && item.label.includes('签到')) {
            icon = icons.clock;
            bgColor = '#E3F2FD';
          } else if (item.label && item.label.includes('兑换')) {
            icon = icons.gift;
            bgColor = '#FFF3E0';
            color = '#D4A96A';
          } else if (item.label && item.label.includes('完善')) {
            icon = icons.user;
            bgColor = '#FFF8E1';
          }

          return {
            id: item._id || index,
            label: item.label || (isEarn ? '积分获取' : '积分使用'),
            date: this.formatDate(item.createTime || item.date),
            pts: pts,
            color: color,
            bgColor: bgColor,
            icon: icon
          };
        });

        this.setData({ pointsHistory });
      } else {
        // API返回失败或空数据，显示空状态
        this.setData({ pointsHistory: [] });
      }
    } catch (error) {
      console.error('[会员中心] 加载积分历史失败:', error);
      this.setData({ pointsHistory: [] });
    }
  },

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 从CloudBase加载优惠券
   */
  async loadCouponsFromCloud() {
    try {
      wx.showLoading({ title: '加载中...', mask: true });

      // 获取专属礼包和限时优惠的优惠券
      // type: 'newcomer' 获取专属礼包 (scope: 'gift')
      // type: 'limited' 获取普通优惠券 (scope: 'all' 或 'product')
      const [newcomerRes, limitedRes] = await Promise.all([
        api.coupon.getList({ type: 'newcomer', pageSize: 10 }),
        api.coupon.getList({ type: 'limited', pageSize: 10 })
      ]);

      let coupons = [];

      // 处理新人优惠券
      if (newcomerRes.success && newcomerRes.data && newcomerRes.data.list) {
        const newcomerCoupons = newcomerRes.data.list.map(item => this.formatCoupon(item, 'newcomer'));
        coupons = coupons.concat(newcomerCoupons);
      }

      // 处理限时优惠券
      if (limitedRes.success && limitedRes.data && limitedRes.data.list) {
        const limitedCoupons = limitedRes.data.list.map(item => this.formatCoupon(item, 'limited'));
        coupons = coupons.concat(limitedCoupons);
      }

      console.log('[会员中心] 加载到的优惠券:', coupons);

      // 检查用户是否已领取（仅登录用户）- 从CloudBase查询
      if (this.data.isLogin && coupons.length > 0) {
        try {
          // 获取用户已领取的所有优惠券
          const userCouponsRes = await api.coupon.getUserCoupons();
          if (userCouponsRes.success && userCouponsRes.data && userCouponsRes.data.list) {
            const claimedCouponIds = userCouponsRes.data.list.map(uc => uc.couponId);
            console.log('[会员中心] 用户已领取的优惠券ID:', claimedCouponIds);

            // 标记已领取的优惠券
            coupons = coupons.map(coupon => ({
              ...coupon,
              claimed: claimedCouponIds.includes(coupon.id)
            }));

            // 同步到本地存储（保持数据一致性）
            wx.setStorageSync('claimed_coupons', claimedCouponIds);
          }
        } catch (err) {
          console.error('[会员中心] 查询用户已领取优惠券失败:', err);
          // 降级使用本地存储
          const claimedCoupons = wx.getStorageSync('claimed_coupons') || [];
          coupons = coupons.map(coupon => ({
            ...coupon,
            claimed: claimedCoupons.includes(coupon.id)
          }));
        }
      }

      this.setData({ newCoupons: coupons });
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('[会员中心] 加载优惠券失败:', error);
      this.setData({ newCoupons: [] });
    }
  },

  /**
   * 格式化优惠券数据
   */
  formatCoupon(item, type) {
    // 根据优惠类型生成显示金额（兼容 minSpend 和 minAmount 两种字段名）
    const minAmount = item.minAmount || item.minSpend || 0;
    let amountText = '';
    if (item.discountType === 'amount') {
      amountText = `满${minAmount}减${item.amount}`;
    } else if (item.discountType === 'discount') {
      amountText = `${item.amount}折`;
    }

    // 专属礼包使用特殊标签
    const isGift = type === 'newcomer' || item.scope === 'gift';

    return {
      id: item._id,
      title: item.title,
      amount: amountText,
      desc: item.desc,
      tag: isGift ? '新人专属' : (item.tag || '限时优惠'),
      icon: icons.gift,
      iconColor: isGift ? '#E91E63' : (item.iconColor || '#D4A96A'),
      iconBg: isGift ? '#FCE4EC' : (item.iconBg || '#FFF8E1'),
      tagColor: isGift ? '#E91E63' : (item.tagColor || '#D4A96A'),
      tagBg: isGift ? '#FCE4EC' : (item.tagBg || '#FFF8E1'),
      amountColor: isGift ? '#E91E63' : (item.amountColor || '#D4A96A'),
      claimed: false,
      type: type,
      minAmount: minAmount,
      discountType: item.discountType,
      discountValue: item.amount
    };
  },

  /**
   * 领取优惠券
   */
  async claimCoupon(e) {
    const index = e.currentTarget.dataset.index;
    const coupon = this.data.newCoupons[index];

    if (coupon.claimed) return;

    if (!this.data.isLogin) {
      util.showToast('请先登录', 'none');
      return;
    }

    wx.showLoading({ title: '领取中...' });

    try {
      // 调用云函数领取优惠券
      const result = await api.coupon.receive(coupon.id);

      if (result.success) {
        // 更新优惠券状态
        const newCoupons = [...this.data.newCoupons];
        newCoupons[index].claimed = true;

        // 保存到本地存储
        const claimedCoupons = wx.getStorageSync('claimed_coupons') || [];
        claimedCoupons.push(coupon.id);
        wx.setStorageSync('claimed_coupons', claimedCoupons);

        this.setData({ newCoupons });

        // 从服务器刷新最新的优惠券数量
        this.loadUserStats();

        wx.hideLoading();
        util.showToast('领取成功', 'success');
      } else {
        wx.hideLoading();
        util.showToast(result.message || '领取失败', 'none');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[会员中心] 领取优惠券失败:', error);
      util.showToast('领取失败', 'none');
    }
  },

  /**
   * 返回上一页
   */
  onBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/user/user' });
      }
    });
  },

  /**
   * 跳转到登录页
   */
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  /**
   * 积分说明
   */
  onPointsHelp() {
    wx.showModal({
      title: '积分说明',
      content: '1. 消费1元可获得1积分\n2. 每日签到可获得10积分\n3. 积分可用于兑换优惠券\n4. 积分有效期为一年',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 会员等级说明
   */
  onLevelHelp() {
    const content = LEVEL_CONFIG.map(level =>
      `${level.icon} ${level.name}: ${level.min}积分起`
    ).join('\n');

    wx.showModal({
      title: '会员等级',
      content: content + '\n\n等级越高，享受的优惠越多！',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '小赵面食会员中心 - 积分换好礼',
      path: '/package-user/pages/vip-center/vip-center'
    };
  },

  /**
   * 储值咨询
   */
  onRechargeConsult() {
    wx.showModal({
      title: '储值咨询',
      content: '如需储值或了解更多会员权益，请拨打客服电话或添加微信咨询。',
      confirmText: '联系客服',
      cancelText: '稍后再说',
      success: (res) => {
        if (res.confirm) {
          // 拨打客服电话
          wx.makePhoneCall({
            phoneNumber: '400-888-8888',
            fail: () => {
              wx.showToast({
                title: '拨打失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  /**
   * 查看全部积分历史
   */
  viewAllHistory() {
    if (!this.data.isLogin) {
      util.showToast('请先登录', 'none');
      return;
    }
    const points = this.data.userInfo.points || 0;
    wx.navigateTo({
      url: `/package-user/pages/points-history/points-history?points=${points}`
    });
  },

  /**
   * 点击获取积分方式
   */
  onEarnTap(e) {
    const item = e.currentTarget.dataset.item;
    util.showToast(`点击了${item.label}`, 'none');
  }
});
