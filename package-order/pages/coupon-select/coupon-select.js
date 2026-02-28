/**
 * 优惠券选择页面
 * 从订单确认页面跳转，选择要使用的优惠券
 */

const app = getApp();
const api = require('../../../utils/api.js');

Page({
  data: {
    // 订单金额
    orderAmount: 0,
    // 当前选中的优惠券
    selectedCoupon: null,
    // 可用优惠券列表
    availableCoupons: [],
    // 不可用优惠券列表
    unavailableCoupons: [],
    // 页面状态
    isLoading: true,
    // Base64 icons
    icons: {}
  },

  onLoad(options) {
    console.log('[优惠券选择] 页面加载', options);

    // 加载图标
    const icons = require('../../../utils/icons.js');
    this.setData({ icons });

    // 获取订单金额
    const orderAmount = parseFloat(options.amount) || 0;
    this.setData({ orderAmount });

    // 加载优惠券
    this.loadCoupons(orderAmount);
  },

  onShow() {
    console.log('[优惠券选择] 页面显示');
  },

  /**
   * 加载优惠券
   */
  async loadCoupons(orderAmount) {
    this.setData({ isLoading: true });

    try {
      // 调用API获取可用优惠券
      const result = await api.coupon.getAvailable(orderAmount);
      console.log('[优惠券选择] 可用优惠券:', result);

      if (result && result.success && result.data) {
        const { availableList = [], unavailableList = [] } = result.data;

        // 格式化优惠券数据
        const formattedAvailable = this.formatCoupons(availableList, true, orderAmount);
        const formattedUnavailable = this.formatCoupons(unavailableList, false, orderAmount);

        this.setData({
          availableCoupons: formattedAvailable,
          unavailableCoupons: formattedUnavailable,
          isLoading: false
        });

        // 如果有可用的优惠券，默认选择优惠力度最大的
        if (formattedAvailable.length > 0) {
          const bestCoupon = formattedAvailable[0];
          console.log('[优惠券选择] 自动选择最佳优惠券:', bestCoupon);
          this.setData({ selectedCoupon: bestCoupon });
        }
      } else {
        this.setData({
          availableCoupons: [],
          unavailableCoupons: [],
          isLoading: false
        });
      }
    } catch (error) {
      console.error('[优惠券选择] 加载优惠券失败:', error);
      this.setData({
        availableCoupons: [],
        unavailableCoupons: [],
        isLoading: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化优惠券
   */
  formatCoupons(couponList, isAvailable, orderAmount) {
    return couponList.map(item => {
      const coupon = item.coupon || {};
      const userCouponId = item._id || item.userCouponId;

      // 计算优惠金额
      let discountAmount = 0;
      let displayValue = '';
      let displayType = '';

      if (coupon.type === 1 || coupon.discountType === 'discount') {
        // 折扣券
        const discountRate = coupon.amount || 10;
        discountAmount = (orderAmount * (1 - discountRate / 10));
        displayValue = discountRate + '折';
        displayType = 'discount';
      } else {
        // 满减券
        discountAmount = coupon.amount || 0;
        displayValue = '¥' + discountAmount;
        displayType = 'amount';
      }

      return {
        id: userCouponId,
        couponId: item.couponId,
        title: coupon.title || coupon.name || '优惠券',
        desc: coupon.desc || coupon.description || `满${coupon.minAmount || coupon.minSpend || 0}元可用`,
        amount: parseFloat(discountAmount.toFixed(2)),
        displayValue,
        displayType,
        minAmount: coupon.minAmount || coupon.minSpend || 0,
        endTime: coupon.endTime,
        endTimeStr: this.formatTime(coupon.endTime),
        reason: item.reason || '',
        isAvailable: isAvailable
      };
    });
  },

  /**
   * 格式化时间
   */
  formatTime(endTime) {
    if (!endTime) return '';
    const date = new Date(endTime);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  },

  /**
   * 选择优惠券
   */
  onSelectCoupon(e) {
    const { id } = e.currentTarget.dataset;
    const coupon = this.data.availableCoupons.find(c => c.id === id);

    if (!coupon) return;

    this.setData({
      selectedCoupon: coupon
    });

    console.log('[优惠券选择] 选中优惠券:', coupon);
  },

  /**
   * 不使用优惠券
   */
  onNotUseCoupon() {
    this.setData({
      selectedCoupon: null
    });
  },

  /**
   * 确认选择
   */
  onConfirm() {
    const { selectedCoupon } = this.data;

    // 存储选中的优惠券
    if (selectedCoupon) {
      wx.setStorageSync('selectedCouponForOrder', selectedCoupon);
    } else {
      wx.removeStorageSync('selectedCouponForOrder');
    }

    // 标记用户已做出选择
    wx.setStorageSync('couponSelectionMade', true);

    console.log('[优惠券选择] 确认选择:', selectedCoupon);

    // 返回上一页
    wx.navigateBack();
  },

  /**
   * 返回上一页
   */
  onBackTap() {
    wx.navigateBack();
  },

  /**
   * 去优惠券中心
   */
  goToCouponCenter() {
    wx.navigateTo({
      url: '/package-user/pages/coupon/coupon'
    });
  }
});
