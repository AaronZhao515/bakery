/**
 * 个人中心页面
 * 面包烘焙小程序 - 个人中心
 */

const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');
const auth = require('../../utils/auth');
const icons = require('../../utils/icons');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,

    // 登录按钮状态: idle, loading, success
    status: 'idle',

    // 临时头像（未登录时选择）
    tempAvatarUrl: null,

    // 用户统计数据
    stats: {
      couponCount: 0,
      points: 0,
      balance: 0
    },

    // 订单统计
    orderStats: {
      total: 0,
      pendingPayment: 0,
      pendingDelivery: 0,
      pendingReceive: 0,
      pendingComment: 0
    },

    // Base64 图标
    icons: icons,

    // 功能菜单 - 匹配 Figma 设计
    menuItems: [
      { icon: icons.order, label: '我的订单', sub: '查看全部订单', bgColor: '#E8F5E9', path: '/pages/order/order' },
      { icon: icons.scissors, label: '优惠券', sub: '查看我的优惠券', bgColor: '#FFF3E0', path: '/package-user/pages/coupon/coupon' },
      { icon: icons.mapPin, label: '收货地址', sub: '管理配送地址', bgColor: '#E3F2FD', path: '/package-user/pages/address/address' },
      { icon: icons.phone, label: '手机号', sub: '绑定手机号', bgColor: '#FFF8E1', path: '', action: 'bindPhone' },
      { icon: icons.feedback, label: '意见反馈', sub: '帮助我们改进', bgColor: '#FCE4EC', path: '/package-user/pages/feedback/feedback' }
    ],

    // 管理员菜单（仅在用户是管理员时显示）
    adminMenuItem: { icon: icons.setting, label: '管理后台', sub: '进入商家管理后台', bgColor: '#D4A574', path: '/package-admin/pages/login/login' }
  },

  onLoad(options) {
    console.log('[个人中心] 页面加载', options);
  },

  onShow() {
    console.log('[个人中心] 页面显示');
    this.checkLoginStatus();
    // 设置自定义 tabBar 选中状态
    this.setTabBarSelected();
  },

  /**
   * 设置自定义 tabBar 选中状态
   */
  setTabBarSelected() {
    console.log('[个人中心] 设置 tabBar 选中');
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected(3);
      console.log('[个人中心] tabBar 选中状态已设置为 3');
    } else {
      console.log('[个人中心] getTabBar 不可用');
    }
  },

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    console.log('[个人中心] 检查登录状态...');

    // 获取本地登录状态
    const isLogin = auth.isLogin();
    const userInfo = auth.getUserInfo();

    console.log('[个人中心] 本地登录状态:', isLogin);
    console.log('[个人中心] 本地用户信息:', userInfo);

    // 检查是否是管理员，如果是则添加管理员入口
    let menuItems = this.data.menuItems;
    if (userInfo?.isAdmin && !menuItems.find(item => item.label === '管理后台')) {
      menuItems = [...menuItems, this.data.adminMenuItem];
    }

    // 更新页面状态
    this.setData({
      isLogin,
      userInfo: userInfo || null,
      menuItems
    });

    if (isLogin) {
      // 加载用户数据
      this.loadUserStats();
      this.loadOrderStats();

      // 同步检查服务器端状态（可选，用于刷新用户信息）
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'user',
          data: { action: 'getUserInfo' }
        });

        if (result.code === 0 && result.data) {
          // 更新本地存储
          auth.setUserInfo(result.data);

          // 更新页面状态（包括统计数据）
          const stats = result.data.stats || {};

          // 检查是否是管理员，如果是则添加管理员入口
          let menuItems = this.data.menuItems;
          if (result.data.isAdmin && !menuItems.find(item => item.label === '管理后台')) {
            menuItems = [...menuItems, this.data.adminMenuItem];
          }

          this.setData({
            userInfo: result.data,
            menuItems,
            'stats.couponCount': stats.couponCount || 0,
            'stats.points': result.data.points || 0,
            'stats.balance': result.data.balance || 0
          });

          // 更新全局 store
          if (app.store && app.store.userStore) {
            app.store.userStore.update({
              userInfo: result.data
            });
          }
        }
      } catch (error) {
        console.log('[个人中心] 刷新用户信息失败:', error);
        // 不影响当前显示
      }
    }
  },

  /**
   * 加载用户统计
   */
  async loadUserStats() {
    try {
      // 加载优惠券数量、积分、余额等
      const result = await api.user.getUserInfo();
      console.log('[个人中心] 用户信息:', result);

      if (result && result.success && result.data) {
        const stats = result.data.stats || {};
        this.setData({
          'stats.couponCount': stats.couponCount || 0,
          'stats.points': result.data.points || 0,
          'stats.balance': result.data.balance || 0
        });
      }
    } catch (error) {
      console.error('[个人中心] 加载用户统计失败', error);
    }
  },

  /**
   * 加载订单统计
   */
  async loadOrderStats() {
    try {
      const result = await api.order.getList({ page: 1, pageSize: 100 });
      console.log('[个人中心] 订单列表:', result);

      if (result && result.success && result.data && result.data.list) {
        const orders = result.data.list;

        this.setData({
          'orderStats.total': orders.length,
          'orderStats.pendingPayment': orders.filter(o => o.status === 0).length,
          'orderStats.pendingDelivery': orders.filter(o => o.status === 2).length,
          'orderStats.pendingReceive': orders.filter(o => o.status === 3).length,
          'orderStats.pendingComment': orders.filter(o => o.status === 4 && !o.isCommented).length
        });
      }
    } catch (error) {
      console.error('[个人中心] 加载订单统计失败', error);
    }
  },

  /**
   * 微信一键登录（同时获取手机号）
   * 通过 getPhoneNumber 触发，登录+获取手机号一气呵成
   */
  async onLoginWithPhone(e) {
    if (this.data.status !== 'idle') return;

    console.log('[个人中心] 登录并获取手机号:', e);

    const { code, encryptedData, iv, errMsg } = e.detail;

    // 检查用户是否拒绝授权
    if (errMsg && errMsg.includes('deny')) {
      util.showToast('需要授权手机号才能继续', 'none');
      return;
    }

    this.setData({ status: 'loading' });

    try {
      // 步骤1：基础登录（获取 openid 和 token）
      const result = await auth.doLogin();
      console.log('[个人中心] 登录结果:', result);

      if (!result.success) {
        this.setData({ status: 'idle' });
        util.showToast(result.error || '登录失败', 'error');
        return;
      }

      // 步骤2：获取手机号
      let phoneNumber = null;
      if (code || encryptedData) {
        try {
          const requestData = {};
          if (code) {
            requestData.code = code;
          } else if (encryptedData) {
            requestData.encryptedData = encryptedData;
            requestData.iv = iv;
          }

          const { result: phoneResult } = await wx.cloud.callFunction({
            name: 'user',
            data: {
              action: 'getPhoneNumber',
              data: requestData
            }
          });

          const phoneResponse = phoneResult.result || phoneResult;
          if (phoneResponse.code === 0 || phoneResponse.code === 200) {
            phoneNumber = phoneResponse.data.phoneNumber;
            console.log('[个人中心] 获取手机号成功:', phoneNumber);
          }
        } catch (phoneError) {
          console.error('[个人中心] 获取手机号失败:', phoneError);
        }
      }

      // 步骤3：获取微信用户信息（头像和昵称）
      let wxUserInfo = null;
      try {
        const userProfile = await wx.getUserProfile({
          desc: '用于完善用户资料',
          lang: 'zh_CN'
        });
        wxUserInfo = userProfile.userInfo;
        console.log('[个人中心] 获取到微信用户信息:', wxUserInfo);
      } catch (profileError) {
        console.log('[个人中心] 用户拒绝授权获取个人信息，将使用默认信息');
      }

      // 步骤4：更新用户信息到服务器
      let finalUserInfo = result.data.userInfo;
      const updateData = {};
      if (wxUserInfo) {
        updateData.nickName = wxUserInfo.nickName;
        updateData.avatarUrl = wxUserInfo.avatarUrl;
      }
      if (phoneNumber) {
        updateData.phone = phoneNumber;
      }

      if (Object.keys(updateData).length > 0) {
        try {
          const updateResult = await auth.updateUserInfo(updateData);
          if (updateResult.success) {
            finalUserInfo = {
              ...finalUserInfo,
              ...updateData
            };
          }
        } catch (updateError) {
          console.error('[个人中心] 更新用户信息失败:', updateError);
        }
      }

      // 步骤5：如果有临时头像，上传它
      if (this.data.tempAvatarUrl) {
        console.log('[个人中心] 检测到临时头像，开始上传');
        this.setData({
          userInfo: finalUserInfo
        });
        await this.uploadTempAvatar();
      }

      // 步骤6：更新页面和全局状态
      this.setData({
        status: 'success',
        isLogin: true,
        userInfo: finalUserInfo
      });

      // 更新全局 store
      if (app.store && app.store.userStore) {
        app.store.userStore.update({
          isLogin: true,
          userInfo: finalUserInfo,
          openid: result.data.openid,
          role: result.data.role || 'customer'
        });
      }

      // 加载用户数据
      this.loadUserStats();
      this.loadOrderStats();

      // 提示登录成功
      const successMsg = phoneNumber ? '登录成功，已绑定手机号' : '登录成功';
      util.showToast(successMsg, 'success');

      // 延迟恢复按钮状态
      setTimeout(() => {
        this.setData({ status: 'idle' });
      }, 1500);

    } catch (error) {
      console.error('[个人中心] 登录失败:', error);
      this.setData({ status: 'idle' });
      util.showToast('登录失败，请重试', 'error');
    }
  },

  /**
   * 微信一键登录（不获取手机号）
   */
  async onWechatLogin() {
    if (this.data.status !== 'idle') return;

    this.setData({ status: 'loading' });

    try {
      // 步骤1：基础登录（获取 openid 和 token）
      const result = await auth.doLogin();
      console.log('[个人中心] 登录结果:', result);

      if (!result.success) {
        this.setData({ status: 'idle' });
        util.showToast(result.error || '登录失败', 'error');
        return;
      }

      // 步骤2：获取微信用户信息（头像和昵称）
      let wxUserInfo = null;
      try {
        const userProfile = await wx.getUserProfile({
          desc: '用于完善用户资料',
          lang: 'zh_CN'
        });
        wxUserInfo = userProfile.userInfo;
        console.log('[个人中心] 获取到微信用户信息:', wxUserInfo);
      } catch (profileError) {
        console.log('[个人中心] 用户拒绝授权获取个人信息，将使用默认信息');
      }

      // 步骤3：更新用户信息到服务器（如果有微信信息）
      let finalUserInfo = result.data.userInfo;
      if (wxUserInfo) {
        try {
          const updateResult = await auth.updateUserInfo({
            nickName: wxUserInfo.nickName,
            avatarUrl: wxUserInfo.avatarUrl
          });
          if (updateResult.success) {
            finalUserInfo = {
              ...finalUserInfo,
              nickName: wxUserInfo.nickName,
              avatarUrl: wxUserInfo.avatarUrl
            };
          }
        } catch (updateError) {
          console.error('[个人中心] 更新用户信息失败:', updateError);
        }
      }

      // 步骤4：如果有临时头像，上传它
      if (this.data.tempAvatarUrl) {
        console.log('[个人中心] 检测到临时头像，开始上传');
        this.setData({
          userInfo: finalUserInfo
        });
        await this.uploadTempAvatar();
      }

      // 步骤5：更新页面和全局状态
      this.setData({
        status: 'success',
        isLogin: true,
        userInfo: finalUserInfo
      });

      // 更新全局 store
      if (app.store && app.store.userStore) {
        app.store.userStore.update({
          isLogin: true,
          userInfo: finalUserInfo,
          openid: result.data.openid,
          role: result.data.role || 'customer'
        });
      }

      // 加载用户数据
      this.loadUserStats();
      this.loadOrderStats();

      // 延迟恢复按钮状态
      setTimeout(() => {
        this.setData({ status: 'idle' });
      }, 1500);

    } catch (error) {
      console.error('[个人中心] 登录失败:', error);
      this.setData({ status: 'idle' });
      util.showToast('登录失败，请重试', 'error');
    }
  },

  /**
   * 选择头像
   * 支持已登录和未登录两种状态
   */
  async onChooseAvatar(e) {
    console.log('[个人中心] 选择头像:', e);

    // 检查是否有错误（如超时）
    if (e.detail && e.detail.errMsg) {
      if (e.detail.errMsg.includes('timeout')) {
        console.warn('[个人中心] 选择头像超时，可能是开发者工具不支持');
        wx.showModal({
          title: '提示',
          content: '选择头像功能需要在真机上使用，是否继续使用默认头像？',
          showCancel: true,
          cancelText: '取消',
          confirmText: '使用默认头像',
          success: (res) => {
            if (res.confirm) {
              this.useDefaultAvatar();
            }
          }
        });
        return;
      }
    }

    const { avatarUrl } = e.detail;

    if (!avatarUrl) {
      util.showToast('选择头像失败', 'none');
      return;
    }

    // 未登录状态：暂存头像 URL，登录时一起上传
    if (!this.data.isLogin) {
      console.log('[个人中心] 未登录状态，暂存头像');
      this.setData({
        tempAvatarUrl: avatarUrl
      });
      util.showToast('头像已选择，登录后将自动使用', 'success');
      return;
    }

    // 已登录状态：上传到云存储并更新用户信息
    wx.showLoading({ title: '上传中...' });

    try {
      // 上传头像到云存储
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`;
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      });

      // 获取临时链接
      const fileList = await wx.cloud.getTempFileURL({
        fileList: [uploadResult.fileID]
      });

      const finalAvatarUrl = fileList.fileList[0].tempFileURL;

      // 更新用户信息
      const updateResult = await auth.updateUserInfo({
        avatarUrl: finalAvatarUrl
      });

      if (updateResult.success) {
        // 更新本地状态
        const currentUserInfo = this.data.userInfo || {};
        const newUserInfo = { ...currentUserInfo, avatarUrl: finalAvatarUrl };

        this.setData({
          userInfo: newUserInfo
        });

        // 更新全局 store
        if (app.store && app.store.userStore) {
          app.store.userStore.update({
            userInfo: newUserInfo
          });
        }

        // 更新本地存储
        auth.setUserInfo(newUserInfo);

        util.showToast('头像更新成功', 'success');
      }
    } catch (error) {
      console.error('[个人中心] 上传头像失败:', error);
      util.showToast('头像更新失败', 'none');
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 使用默认头像（chooseAvatar 超时的降级方案）
   */
  useDefaultAvatar() {
    const defaultAvatar = 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/product-default.png';

    if (!this.data.isLogin) {
      // 未登录状态：暂存默认头像
      this.setData({
        tempAvatarUrl: defaultAvatar
      });
      util.showToast('已选择默认头像', 'success');
    } else {
      // 已登录状态：直接更新为默认头像
      this.updateAvatarToServer(defaultAvatar);
    }
  },

  /**
   * 从相册选择头像（chooseAvatar 的备选方案）
   */
  async chooseAvatarFromAlbum() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      const tempFilePath = res.tempFilePaths[0];

      if (!this.data.isLogin) {
        // 未登录状态：暂存头像
        this.setData({
          tempAvatarUrl: tempFilePath
        });
        util.showToast('头像已选择，登录后将自动使用', 'success');
      } else {
        // 已登录状态：上传头像
        this.uploadAndUpdateAvatar(tempFilePath);
      }
    } catch (error) {
      console.error('[个人中心] 选择图片失败:', error);
      if (error.errMsg && !error.errMsg.includes('cancel')) {
        util.showToast('选择图片失败', 'none');
      }
    }
  },

  /**
   * 上传并更新头像
   */
  async uploadAndUpdateAvatar(filePath) {
    wx.showLoading({ title: '压缩上传中...' });

    try {
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

      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`;
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: uploadPath
      });

      const fileList = await wx.cloud.getTempFileURL({
        fileList: [uploadResult.fileID]
      });

      const finalAvatarUrl = fileList.fileList[0].tempFileURL;
      await this.updateAvatarToServer(finalAvatarUrl);
    } catch (error) {
      console.error('[个人中心] 上传头像失败:', error);
      util.showToast('头像上传失败', 'none');
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 更新头像到服务器
   */
  async updateAvatarToServer(avatarUrl) {
    try {
      const updateResult = await auth.updateUserInfo({
        avatarUrl: avatarUrl
      });

      if (updateResult.success) {
        const currentUserInfo = this.data.userInfo || {};
        const newUserInfo = { ...currentUserInfo, avatarUrl: avatarUrl };

        this.setData({
          userInfo: newUserInfo
        });

        if (app.store && app.store.userStore) {
          app.store.userStore.update({
            userInfo: newUserInfo
          });
        }

        auth.setUserInfo(newUserInfo);
        util.showToast('头像更新成功', 'success');
      }
    } catch (error) {
      console.error('[个人中心] 更新头像失败:', error);
      util.showToast('头像更新失败', 'none');
    }
  },

  /**
   * 上传临时头像（登录时调用）
   */
  async uploadTempAvatar() {
    const { tempAvatarUrl } = this.data;
    if (!tempAvatarUrl || !this.data.isLogin) return;

    try {
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`;
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempAvatarUrl
      });

      const fileList = await wx.cloud.getTempFileURL({
        fileList: [uploadResult.fileID]
      });

      const finalAvatarUrl = fileList.fileList[0].tempFileURL;

      // 更新用户信息
      await auth.updateUserInfo({
        avatarUrl: finalAvatarUrl
      });

      // 更新本地状态
      const currentUserInfo = this.data.userInfo || {};
      const newUserInfo = { ...currentUserInfo, avatarUrl: finalAvatarUrl };

      this.setData({
        userInfo: newUserInfo,
        tempAvatarUrl: null // 清除临时头像
      });

      // 更新全局 store
      if (app.store && app.store.userStore) {
        app.store.userStore.update({
          userInfo: newUserInfo
        });
      }

      // 更新本地存储
      auth.setUserInfo(newUserInfo);

      console.log('[个人中心] 临时头像上传成功');
    } catch (error) {
      console.error('[个人中心] 临时头像上传失败:', error);
    }
  },

  /**
   * 退出登录
   * 清除所有用户相关数据
   */
  async onLogout() {
    const { confirm } = await util.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？退出后将清除所有本地数据。'
    });

    if (!confirm) return;

    try {
      // 调用退出登录
      await auth.doLogout();

      // 清除全局 store 中的用户数据
      if (app.store && app.store.userStore) {
        app.store.userStore.update({
          userInfo: null,
          openid: '',
          isLogin: false,
          role: 'customer',
          permissions: [],
          addressList: [],
          defaultAddress: null
        });
        console.log('[个人中心] 已清除全局 store 用户数据');
      }

      // 清除全局 app 数据
      app.globalData.isLogin = false;
      app.globalData.userRole = 'customer';

      // 清除页面所有用户相关数据
      this.setData({
        isLogin: false,
        userInfo: null,
        tempAvatarUrl: null,
        // 清除统计数据
        stats: {
          couponCount: 0,
          points: 0,
          balance: 0
        },
        // 清除订单统计
        orderStats: {
          total: 0,
          pendingPayment: 0,
          pendingDelivery: 0,
          pendingReceive: 0,
          pendingComment: 0
        },
        // 重置菜单（移除管理员入口）
        menuItems: [
          { icon: icons.order, label: '我的订单', sub: '查看全部订单', bgColor: '#E8F5E9', path: '/pages/order/order' },
          { icon: icons.scissors, label: '优惠券', sub: '查看我的优惠券', bgColor: '#FFF3E0', path: '/package-user/pages/coupon/coupon' },
          { icon: icons.mapPin, label: '收货地址', sub: '管理配送地址', bgColor: '#E3F2FD', path: '/package-user/pages/address/address' },
          { icon: icons.phone, label: '手机号', sub: '绑定手机号', bgColor: '#FFF8E1', path: '', action: 'bindPhone' },
          { icon: icons.feedback, label: '意见反馈', sub: '帮助我们改进', bgColor: '#FCE4EC', path: '/package-user/pages/feedback/feedback' }
        ]
      });

      // 清除本地存储的其他用户相关数据
      wx.removeStorageSync('cart_data');
      wx.removeStorageSync('address_list');
      wx.removeStorageSync('order_history');

      console.log('[个人中心] 已清除所有用户数据');

      util.showToast('已退出登录', 'success');
    } catch (error) {
      console.error('[个人中心] 退出登录失败:', error);
      util.showToast('退出失败', 'error');
    }
  },

  /**
   * 点击全部订单
   */
  onAllOrdersTap() {
    wx.switchTab({
      url: '/pages/order/order'
    });
  },

  /**
   * 点击积分 - 跳转到会员中心
   */
  onPointsTap() {
    if (!this.data.isLogin) {
      util.showToast('请先登录', 'none');
      return;
    }
    wx.navigateTo({
      url: '/package-user/pages/vip-center/vip-center'
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

    // 如果有优惠券，跳转到优惠券中心-未使用标签页
    const couponCount = this.data.stats.couponCount || 0;
    if (couponCount > 0) {
      wx.navigateTo({
        url: '/package-user/pages/coupon/coupon?tab=unused'
      });
    } else {
      // 没有优惠券时跳转到优惠券中心-可领取标签页
      wx.navigateTo({
        url: '/package-user/pages/coupon/coupon'
      });
    }
  },

  /**
   * 点击菜单项
   */
  onMenuTap(e) {
    const { item } = e.currentTarget.dataset;

    // 处理手机号绑定特殊逻辑
    if (item.action === 'bindPhone') {
      if (!this.data.isLogin) {
        this.onWechatLogin();
        return;
      }
      // 如果已绑定手机号，显示提示
      if (this.data.userInfo && this.data.userInfo.phone) {
        wx.showModal({
          title: '提示',
          content: `您已绑定手机号：${this.data.userInfo.phone}`,
          showCancel: false,
          confirmText: '知道了'
        });
      } else {
        // 未绑定，提示用户点击头像区域的绑定按钮
        wx.showModal({
          title: '绑定手机号',
          content: '请点击上方用户信息区域的"点击绑定手机号"按钮进行绑定',
          showCancel: false,
          confirmText: '知道了'
        });
      }
      return;
    }

    // 需要登录的功能
    const needLogin = ['收货地址', '优惠券', '我的收藏', '浏览记录', '我的订单'];
    if (needLogin.includes(item.label) && !this.data.isLogin) {
      this.onWechatLogin();
      return;
    }

    // 页面跳转
    if (item.path) {
      // 检查是否是 tabBar 页面
      const tabBarPages = ['/pages/index/index', '/pages/reserve/reserve', '/pages/order/order', '/pages/user/user'];
      const isTabBar = tabBarPages.some(page => item.path.startsWith(page));

      if (isTabBar) {
        wx.switchTab({ url: item.path });
      } else {
        wx.navigateTo({ url: item.path });
      }
    }
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '暖心烘焙 - 温暖你的每一天',
      path: '/pages/index/index'
    };
  },

  /**
   * 获取手机号
   * 使用 button open-type="getPhoneNumber" 触发
   */
  async onGetPhoneNumber(e) {
    console.log('[个人中心] 获取手机号:', e);

    const { code, encryptedData, iv, errMsg } = e.detail;

    // 检查用户是否拒绝授权
    if (errMsg && errMsg.includes('deny')) {
      util.showToast('需要授权才能获取手机号', 'none');
      return;
    }

    // 检查是否有获取手机号的凭证
    if (!code && !encryptedData) {
      console.log('[个人中心] 未获取到手机号凭证');
      return;
    }

    wx.showLoading({ title: '获取中...' });

    try {
      // 构建请求参数，优先使用 code（新版推荐方式）
      const requestData = {};
      if (code) {
        requestData.code = code;
      } else if (encryptedData) {
        requestData.encryptedData = encryptedData;
        requestData.iv = iv;
      }

      console.log('[个人中心] 调用云函数获取手机号');

      // 调用云函数获取手机号
      const { result } = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getPhoneNumber',
          data: requestData
        }
      });

      console.log('[个人中心] 获取手机号结果:', result);

      wx.hideLoading();

      const response = result.result || result;

      if (response.code === 0 || response.code === 200) {
        const phoneNumber = response.data.phoneNumber;

        // 更新本地用户信息
        const currentUserInfo = this.data.userInfo || {};
        const newUserInfo = { ...currentUserInfo, phone: phoneNumber };

        this.setData({
          userInfo: newUserInfo
        });

        // 更新全局 store
        if (app.store && app.store.userStore) {
          app.store.userStore.update({
            userInfo: newUserInfo
          });
        }

        // 更新本地存储
        auth.setUserInfo(newUserInfo);

        util.showToast('手机号绑定成功', 'success');
      } else {
        util.showToast(response.message || '绑定失败', 'none');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[个人中心] 获取手机号失败:', error);
      util.showToast('绑定失败，请重试', 'none');
    }
  },

  /**
   * 调试：强制刷新登录状态
   */
  onForceRefresh() {
    console.log('[个人中心] 强制刷新');
    this.checkLoginStatus();
  }
});
