/**
 * 会员中心页
 * 功能：用户信息展示、会员权益、资产概览、功能菜单导航
 */
const app = getApp();

Page({
  data: {
    userInfo: {
      isLogin: false,
      avatarUrl: '',
      nickName: ''
    },
    memberInfo: {
      level: 1,
      levelName: '普通会员',
      benefits: [
        { icon: '🎂', name: '生日特权' },
        { icon: '💝', name: '积分加倍' },
        { icon: '🎁', name: '专属优惠' }
      ]
    },
    assets: {
      points: 0,
      coupons: 0,
      balance: '0.00'
    },
    orderCounts: {
      pendingPay: 0,
      pendingShip: 0,
      pendingReceive: 0
    }
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    if (this.data.userInfo.isLogin) {
      this.loadUserData();
      this.loadOrderCounts();
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        'userInfo.isLogin': true,
        'userInfo.avatarUrl': userInfo.avatarUrl,
        'userInfo.nickName': userInfo.nickName
      });
      this.loadUserData();
      this.loadOrderCounts();
    }
  },

  // 获取用户信息
  onGetUserInfo(e) {
    if (e.detail.userInfo) {
      const userInfo = e.detail.userInfo;
      wx.setStorageSync('userInfo', userInfo);
      this.setData({
        'userInfo.isLogin': true,
        'userInfo.avatarUrl': userInfo.avatarUrl,
        'userInfo.nickName': userInfo.nickName
      });
      this.loadUserData();
      this.loadOrderCounts();
    }
  },

  // 选择头像
  chooseAvatar() {
    if (!this.data.userInfo.isLogin) return;
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.uploadAvatar(tempFilePath);
      }
    });
  },

  // 上传头像
  async uploadAvatar(filePath) {
    try {
      wx.showLoading({ title: '压缩上传中...' });

      // 压缩头像图片
      let uploadPath = filePath;
      try {
        const compressedRes = await wx.compressImage({
          src: filePath,
          quality: 70, // 头像质量可以稍低
          compressedWidth: 400 // 头像尺寸较小
        });
        uploadPath = compressedRes.tempFilePath;
        console.log('头像压缩成功');
      } catch (compressError) {
        console.error('头像压缩失败，使用原图:', compressError);
      }

      // 上传图片到云存储
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const { fileID } = await wx.cloud.uploadFile({
        cloudPath,
        filePath: uploadPath
      });

      // 更新用户头像
      const { result } = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          avatarUrl: fileID
        }
      });

      wx.hideLoading();

      if (result.code === 0) {
        this.setData({
          'userInfo.avatarUrl': fileID
        });
        wx.showToast({ title: '更新成功', icon: 'success' });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  // 加载用户数据
  async loadUserData() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getUserInfo'
      });

      if (result.code === 0) {
        const data = result.data;
        this.setData({
          'memberInfo.level': data.memberLevel || 1,
          'memberInfo.levelName': data.memberLevelName || '普通会员',
          'assets.points': data.points || 0,
          'assets.coupons': data.couponCount || 0,
          'assets.balance': data.balance || '0.00'
        });
      }
    } catch (error) {
      console.error('加载用户数据失败:', error);
      // 模拟数据
      this.setData({
        'assets.points': 1250,
        'assets.coupons': 3,
        'assets.balance': '50.00'
      });
    }
  },

  // 加载订单数量
  async loadOrderCounts() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getOrderStatusCounts'
      });

      if (result.code === 0) {
        this.setData({
          'orderCounts.pendingPay': result.data[0] || 0,
          'orderCounts.pendingShip': result.data[1] || 0,
          'orderCounts.pendingReceive': result.data[2] || 0
        });
      }
    } catch (error) {
      console.error('加载订单数量失败:', error);
      // 模拟数据
      this.setData({
        'orderCounts.pendingPay': 2,
        'orderCounts.pendingShip': 1,
        'orderCounts.pendingReceive': 0
      });
    }
  },

  // 跳转到订单列表
  goToOrderList(e) {
    const status = e.currentTarget.dataset.status;
    const url = status !== undefined 
      ? `/pages/order-list/order-list?status=${status}`
      : '/pages/order-list/order-list';
    wx.navigateTo({ url });
  },

  // 跳转到售后
  goToAfterSale() {
    wx.navigateTo({
      url: '/pages/after-sale/after-sale'
    });
  },

  // 跳转到积分页面
  goToPoints() {
    if (!this.checkLogin()) return;
    wx.navigateTo({
      url: '/pages/points/points'
    });
  },

  // 跳转到优惠券页面
  goToCoupon() {
    if (!this.checkLogin()) return;
    wx.navigateTo({
      url: '/pages/coupon/coupon'
    });
  },

  // 跳转到余额页面
  goToBalance() {
    if (!this.checkLogin()) return;
    wx.navigateTo({
      url: '/pages/balance/balance'
    });
  },

  // 跳转到地址管理
  goToAddress() {
    if (!this.checkLogin()) return;
    wx.navigateTo({
      url: '/pages/address/address'
    });
  },

  // 跳转到收藏
  goToCollection() {
    if (!this.checkLogin()) return;
    wx.navigateTo({
      url: '/pages/collection/collection'
    });
  },

  // 联系客服
  contactService() {
    // 触发隐藏的客服按钮
    const contactBtn = this.selectComponent('.contact-btn');
    if (contactBtn) {
      contactBtn.triggerEvent('tap');
    }
  },

  // 客服消息回调
  onContact(e) {
    console.log('客服消息:', e.detail);
  },

  // 跳转到设置
  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  },

  // 检查登录状态
  checkLogin() {
    if (!this.data.userInfo.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        success: (res) => {
          if (res.confirm) {
            // 触发登录
          }
        }
      });
      return false;
    }
    return true;
  }
});
