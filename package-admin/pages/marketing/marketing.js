/**
 * 营销配置页
 * 功能：轮播图配置、优惠券管理、会员等级设置
 */
const app = getApp();

Page({
  data: {
    // Tab切换
    currentTab: 'banner', // banner, coupon, member

    // 轮播图
    banners: [],
    showBannerModal: false,
    editingBannerId: '',
    bannerForm: {
      image: '',
      linkType: '',
      linkTypeName: '',
      linkValue: ''
    },
    bannerLinkTypeIndex: 0,
    linkTypes: [
      { id: '', name: '无链接' },
      { id: 'product', name: '商品详情' },
      { id: 'category', name: '商品分类' },
      { id: 'url', name: '自定义链接' }
    ],

    // 优惠券
    coupons: [],
    showCouponModal: false,
    editingCouponId: '',
    couponForm: {
      name: '',
      type: 'amount',
      typeName: '满减券',
      value: '',
      minAmount: '',
      totalCount: '',
      startTime: '',
      endTime: ''
    },
    couponTypeIndex: 0,
    couponTypes: [
      { id: 'amount', name: '满减券' },
      { id: 'discount', name: '折扣券' }
    ],

    // 会员等级
    memberLevels: []
  },

  onLoad(options) {
    this.loadBanners();
    this.loadCoupons();
    this.loadMemberLevels();
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
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadBanners(),
      this.loadCoupons(),
      this.loadMemberLevels()
    ]).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // 加载轮播图
  async loadBanners() {
    // admin 云函数暂无轮播图功能，使用模拟数据
    this.setData({
      banners: [
        { id: '1', image: '', linkType: 'product', linkTypeName: '商品详情', linkValue: 'product_001' },
        { id: '2', image: '', linkType: 'category', linkTypeName: '商品分类', linkValue: 'bread' }
      ]
    });
  },

  // 加载优惠券
  async loadCoupons() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          operation: 'list',
          page: 1,
          pageSize: 100
        }
      });

      if (result.result.code === 0) {
        const coupons = result.result.data.list.map(item => ({
          ...item,
          id: item._id,
          minAmount: item.minSpend,
          statusText: this.getCouponStatusText(item)
        }));
        this.setData({ coupons });
      }
    } catch (error) {
      console.error('加载优惠券失败:', error);
      this.setData({ coupons: [] });
    }
  },

  // 获取优惠券状态文本
  getCouponStatusText(coupon) {
    const now = new Date();
    const startTime = new Date(coupon.startTime);
    const endTime = new Date(coupon.endTime);
    if (now < startTime) return '未开始';
    if (now > endTime) return '已结束';
    return '进行中';
  },

  // 加载会员等级
  async loadMemberLevels() {
    // admin 云函数暂无会员等级功能，使用模拟数据
    this.setData({
      memberLevels: [
          {
            id: '1',
            name: '普通会员',
            level: 1,
            minGrowth: 0,
            discount: 9.8,
            color: '#8d6e63',
            privileges: ['积分累计', '生日礼遇']
          },
          {
            id: '2',
            name: '银卡会员',
            level: 2,
            minGrowth: 500,
            discount: 9.5,
            color: '#90a4ae',
            privileges: ['积分累计', '生日礼遇', '专属客服', '优先发货']
          },
          {
            id: '3',
            name: '金卡会员',
            level: 3,
            minGrowth: 2000,
            discount: 9.0,
            color: '#ffd700',
            privileges: ['积分累计', '生日礼遇', '专属客服', '优先发货', '专属折扣', '新品试吃']
          },
          {
            id: '4',
            name: '钻石会员',
            level: 4,
            minGrowth: 5000,
            discount: 8.5,
            color: '#e91e63',
            privileges: ['积分累计', '生日礼遇', '专属客服', '优先发货', '专属折扣', '新品试吃', '免邮特权', '专属活动']
          }
        ]
      });
  },

  // ========== 轮播图操作 ==========

  // 添加轮播图
  addBanner() {
    this.setData({
      showBannerModal: true,
      editingBannerId: '',
      bannerForm: {
        image: '',
        linkType: '',
        linkTypeName: '',
        linkValue: ''
      },
      bannerLinkTypeIndex: 0
    });
  },

  // 编辑轮播图
  editBanner(e) {
    const id = e.currentTarget.dataset.id;
    const banner = this.data.banners.find(item => item.id === id);
    if (banner) {
      const linkTypeIndex = this.data.linkTypes.findIndex(t => t.id === banner.linkType);
      this.setData({
        showBannerModal: true,
        editingBannerId: id,
        bannerForm: { ...banner },
        bannerLinkTypeIndex: linkTypeIndex >= 0 ? linkTypeIndex : 0
      });
    }
  },

  // 删除轮播图
  deleteBanner(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张轮播图吗？',
      confirmColor: '#f44336',
      success: async (res) => {
        if (res.confirm) {
          // 本地删除轮播图（admin 云函数暂不支持）
          const banners = this.data.banners.filter(b => b.id !== id);
          this.setData({ banners });
          wx.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  },

  // 选择轮播图图片
  async chooseBannerImage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      });

      wx.showLoading({ title: '压缩上传中...' });

      const file = res.tempFiles[0];
      let uploadPath = file.tempFilePath;

      // 压缩图片
      try {
        const compressedRes = await wx.compressImage({
          src: file.tempFilePath,
          quality: 75, // 压缩质量 0-100，75平衡画质和体积
          compressedWidth: 1080 // 压缩后的最大宽度，高度自动等比缩放
        });
        uploadPath = compressedRes.tempFilePath;
        console.log('轮播图压缩成功');
      } catch (compressError) {
        console.error('图片压缩失败，使用原图上传:', compressError);
        // 压缩失败时使用原图
      }

      const cloudPath = `banners/${Date.now()}_${Math.random().toString(36).substr(2)}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: uploadPath
      });

      this.setData({
        'bannerForm.image': uploadRes.fileID
      });

      wx.hideLoading();
      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (error) {
      console.error('上传图片失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  // 轮播图链接类型选择
  onBannerLinkTypeChange(e) {
    const index = e.detail.value;
    const linkType = this.data.linkTypes[index];
    this.setData({
      bannerLinkTypeIndex: index,
      'bannerForm.linkType': linkType.id,
      'bannerForm.linkTypeName': linkType.name
    });
  },

  // 轮播图链接值输入
  onBannerLinkValueInput(e) {
    this.setData({
      'bannerForm.linkValue': e.detail.value
    });
  },

  // 保存轮播图（本地模式，admin 云函数暂不支持）
  async saveBanner() {
    const { bannerForm, editingBannerId, banners } = this.data;

    if (!bannerForm.image) {
      wx.showToast({ title: '请上传轮播图图片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中' });

    try {
      if (editingBannerId) {
        // 更新现有轮播图
        const index = banners.findIndex(b => b.id === editingBannerId);
        if (index >= 0) {
          banners[index] = { ...banners[index], ...bannerForm };
        }
      } else {
        // 添加新轮播图
        banners.push({
          id: Date.now().toString(),
          ...bannerForm
        });
      }

      this.setData({ banners });
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.hideModal();
    } catch (error) {
      console.error('保存轮播图失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // ========== 优惠券操作 ==========

  // 添加优惠券
  addCoupon() {
    const today = new Date();
    const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    this.setData({
      showCouponModal: true,
      editingCouponId: '',
      couponForm: {
        name: '',
        type: 'amount',
        typeName: '满减券',
        value: '',
        minAmount: '',
        totalCount: '',
        startTime: this.formatDate(today),
        endTime: this.formatDate(endDate)
      },
      couponTypeIndex: 0
    });
  },

  // 编辑优惠券
  editCoupon(e) {
    const id = e.currentTarget.dataset.id;
    const coupon = this.data.coupons.find(item => item.id === id);
    if (coupon) {
      const typeIndex = this.data.couponTypes.findIndex(t => t.id === coupon.type);
      this.setData({
        showCouponModal: true,
        editingCouponId: id,
        couponForm: { ...coupon },
        couponTypeIndex: typeIndex >= 0 ? typeIndex : 0
      });
    }
  },

  // 删除优惠券
  deleteCoupon(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张优惠券吗？删除后不可恢复。',
      confirmColor: '#f44336',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'couponManage',
                operation: 'delete',
                couponId: id
              }
            });

            if (result.result.code === 0) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadCoupons();
            }
          } catch (error) {
            console.error('删除优惠券失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 优惠券名称输入
  onCouponNameInput(e) {
    this.setData({ 'couponForm.name': e.detail.value });
  },

  // 优惠券类型选择
  onCouponTypeChange(e) {
    const index = e.detail.value;
    const type = this.data.couponTypes[index];
    this.setData({
      couponTypeIndex: index,
      'couponForm.type': type.id,
      'couponForm.typeName': type.name
    });
  },

  // 优惠券面值输入
  onCouponValueInput(e) {
    this.setData({ 'couponForm.value': e.detail.value });
  },

  // 优惠券最低消费输入
  onCouponMinAmountInput(e) {
    this.setData({ 'couponForm.minAmount': e.detail.value });
  },

  // 优惠券总量输入
  onCouponTotalCountInput(e) {
    this.setData({ 'couponForm.totalCount': e.detail.value });
  },

  // 优惠券开始时间选择
  onCouponStartTimeChange(e) {
    this.setData({ 'couponForm.startTime': e.detail.value });
  },

  // 优惠券结束时间选择
  onCouponEndTimeChange(e) {
    this.setData({ 'couponForm.endTime': e.detail.value });
  },

  // 保存优惠券
  async saveCoupon() {
    const { couponForm, editingCouponId } = this.data;

    if (!couponForm.name.trim()) {
      wx.showToast({ title: '请输入优惠券名称', icon: 'none' });
      return;
    }

    if (!couponForm.value || parseFloat(couponForm.value) <= 0) {
      wx.showToast({ title: '请输入正确的面值', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中' });

    try {
      const saveData = {
        name: couponForm.name.trim(),
        type: couponForm.type,
        value: parseFloat(couponForm.value),
        minSpend: parseFloat(couponForm.minAmount) || 0,
        totalCount: parseInt(couponForm.totalCount) || 0,
        limitPerUser: 1,
        startTime: couponForm.startTime,
        endTime: couponForm.endTime,
        scope: 'all',
        description: ''
      };

      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          operation: editingCouponId ? 'update' : 'create',
          couponId: editingCouponId,
          ...saveData
        }
      });

      if (result.result.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.hideModal();
        this.loadCoupons();
      } else {
        wx.showToast({ title: result.result.message || '保存失败', icon: 'none' });
      }
    } catch (error) {
      console.error('保存优惠券失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showBannerModal: false,
      showCouponModal: false
    });
  },

  // 编辑会员等级
  editMemberLevel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 添加会员等级
  addMemberLevel() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  }
});
