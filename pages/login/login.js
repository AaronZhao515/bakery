/**
 * 登录页面
 * 面包烘焙小程序 - 用户登录
 */

const app = getApp();
const auth = require('../../utils/auth');
const util = require('../../utils/util');
const icons = require('../../utils/icons');

Page({
  data: {
    // 登录状态
    isLogin: false,
    isLoading: false,

    // 用户信息
    userInfo: {
      nickName: '',
      avatarUrl: '',
      phoneNumber: ''
    },

    // 协议同意状态
    agreed: false,

    // 页面来源，登录成功后返回
    from: '',

    // 是否显示传统登录方式
    canUseOldLogin: false,

    // 图标
    icons: icons
  },

  onLoad(options) {
    console.log('[登录] 页面加载', options);

    // 保存来源页面
    if (options.from) {
      this.setData({ from: options.from });
    }

    // 检查当前登录状态
    this.checkLoginStatus();
  },

  onShow() {
    console.log('[登录] 页面显示');
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const isLogin = auth.isLogin();
    const userInfo = auth.getUserInfo() || {};

    console.log('[登录] 当前登录状态:', isLogin, userInfo);

    this.setData({
      isLogin: isLogin,
      userInfo: {
        nickName: userInfo.nickName || '',
        avatarUrl: userInfo.avatarUrl || '',
        phoneNumber: userInfo.phoneNumber || ''
      }
    });

    // 如果已登录且指定了来源页面，自动返回
    if (isLogin && this.data.from) {
      console.log('[登录] 已登录，自动返回来源页面');
      // 延迟执行，让用户看到已登录状态
      setTimeout(() => {
        this.goBack();
      }, 500);
    }
  },

  /**
   * 手机号一键登录
   * 通过微信 getPhoneNumber 能力获取手机号，并作为用户唯一标识
   */
  async onPhoneLogin(e) {
    console.log('[登录] 手机号登录事件:', e);

    if (this.data.isLoading) return;

    // 检查是否同意协议
    if (!this.data.agreed) {
      util.showToast('请先同意用户协议', 'none');
      return;
    }

    const { code, errMsg } = e.detail;

    // 检查用户是否拒绝授权
    if (!code || (errMsg && errMsg.includes('deny'))) {
      util.showToast('需要授权手机号才能登录', 'none');
      return;
    }

    this.setData({ isLoading: true });
    wx.showLoading({ title: '登录中...' });

    try {
      // 调用手机号一键登录
      const result = await auth.doLoginWithPhone({
        phoneCode: code,
        userInfo: {
          nickName: this.data.userInfo.nickName || '',
          avatarUrl: this.data.userInfo.avatarUrl || ''
        }
      });

      console.log('[登录] 手机号登录结果:', result);
      wx.hideLoading();

      if (result.success) {
        const isNewUser = result.isNewUser;
        util.showToast(isNewUser ? '注册成功' : '登录成功', 'success');

        // 更新页面状态
        this.setData({
          isLogin: true,
          userInfo: result.data.userInfo || {},
          'userInfo.phoneNumber': result.data.phone || ''
        });

        // 同步更新全局 store
        const app = getApp();
        if (app.store && app.store.userStore) {
          app.store.userStore.update({
            isLogin: true,
            userInfo: result.data.userInfo || result.data,
            phone: result.data.phone,
            openid: result.data.openid,
            role: result.data.role || 'customer'
          });
          console.log('[登录] 已同步更新全局 store');
        }

        // 延迟返回
        setTimeout(() => {
          this.goBack();
        }, 1500);
      } else {
        util.showToast(result.error || '登录失败', 'none');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[登录] 手机号登录失败:', error);
      util.showToast('登录失败，请重试', 'none');
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 获取微信用户信息（昵称、头像）
   */
  async onGetUserProfile() {
    try {
      const result = await auth.getWxUserProfile();
      console.log('[登录] 获取用户信息结果:', result);

      if (result.success) {
        this.setData({
          'userInfo.nickName': result.data.nickName,
          'userInfo.avatarUrl': result.data.avatarUrl
        });
        util.showToast('获取成功', 'success');
      } else {
        util.showToast(result.error || '获取失败', 'none');
      }
    } catch (error) {
      console.error('[登录] 获取用户信息失败:', error);
      util.showToast('获取失败', 'none');
    }
  },

  /**
   * 微信传统登录（备用方式）
   */
  async onWechatLogin() {
    if (this.data.isLoading) return;

    // 检查是否同意协议
    if (!this.data.agreed) {
      util.showToast('请先同意用户协议', 'none');
      return;
    }

    this.setData({ isLoading: true });

    try {
      const result = await auth.doLogin();
      console.log('[登录] 登录结果:', result);

      if (result.success) {
        util.showToast('登录成功', 'success');

        // 更新页面状态
        this.setData({
          isLogin: true,
          userInfo: result.data.userInfo || {}
        });

        // 同步更新全局 store
        const app = getApp();
        if (app.store && app.store.userStore) {
          app.store.userStore.update({
            isLogin: true,
            userInfo: result.data.userInfo || result.data,
            openid: result.data.openid,
            role: result.data.role || 'customer'
          });
          console.log('[登录] 已同步更新全局 store');
        }

        // 延迟返回
        setTimeout(() => {
          this.goBack();
        }, 1500);
      } else {
        util.showToast(result.message || '登录失败', 'none');
      }
    } catch (error) {
      console.error('[登录] 登录失败:', error);
      util.showToast('登录失败，请重试', 'none');
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 选择头像 - 使用微信2022新版 chooseAvatar
   */
  onChooseAvatar(e) {
    console.log('[登录] 选择头像:', e);
    const { avatarUrl } = e.detail;

    if (!avatarUrl) {
      console.log('[登录] 未选择头像');
      return;
    }

    this.setData({
      'userInfo.avatarUrl': avatarUrl
    });

    // 可选：上传到云存储
    // this.uploadAvatar(avatarUrl);

    wx.showToast({
      title: '头像已选择',
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * 昵称输入变化 - 使用微信2022新版 nickname input
   */
  onNickNameChange(e) {
    console.log('[登录] 昵称输入:', e);
    const { value } = e.detail;

    this.setData({
      'userInfo.nickName': value
    });
  },

  /**
   * 昵称审核回调 - 微信自动审核昵称合规性
   */
  onNickNameReview(e) {
    console.log('[登录] 昵称审核:', e);
    const { pass, timeout } = e.detail;

    if (!pass && !timeout) {
      wx.showToast({
        title: '昵称可能不合规，请修改',
        icon: 'none'
      });
    }
  },

  /**
   * 上传头像到云存储
   */
  async uploadAvatar(filePath) {
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

      console.log('[登录] 头像上传成功:', uploadResult);

      // 获取临时链接
      const fileList = await wx.cloud.getTempFileURL({
        fileList: [uploadResult.fileID]
      });

      const avatarUrl = fileList.fileList[0].tempFileURL;

      // 更新用户信息
      await this.updateUserInfo({ avatarUrl });

      this.setData({
        'userInfo.avatarUrl': avatarUrl
      });

      return avatarUrl;
    } catch (error) {
      console.error('[登录] 头像上传失败:', error);
      return null;
    }
  },

  /**
   * 更新用户信息
   */
  async updateUserInfo(userInfo) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'updateUserInfo',
          data: userInfo
        }
      });

      console.log('[登录] 更新用户信息结果:', result);

      // 处理返回结果
      const response = result.result || result;

      if (response.code === 0 || response.code === 200) {
        // 更新本地存储
        const currentUserInfo = auth.getUserInfo() || {};
        auth.setUserInfo({ ...currentUserInfo, ...userInfo });

        // 同步更新全局 store
        const appInstance = getApp();
        if (appInstance.store && appInstance.store.userStore) {
          appInstance.store.userStore.update({
            userInfo: { ...currentUserInfo, ...userInfo }
          });
        }

        return response;
      } else {
        throw new Error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('[登录] 更新用户信息失败:', error);
      wx.showToast({
        title: error.message || '更新失败',
        icon: 'none'
      });
      return null;
    }
  },

  /**
   * 绑定手机号（已登录用户）
   * 支持新版 code 方式（推荐）和旧版 encryptedData 方式
   */
  async onGetPhoneNumber(e) {
    console.log('[登录] 获取手机号:', e);

    const { code, encryptedData, iv, cloudID } = e.detail;

    // 检查是否有获取手机号的凭证
    if (!code && !encryptedData && !cloudID) {
      // 用户拒绝授权
      if (e.detail.errMsg && e.detail.errMsg.includes('deny')) {
        util.showToast('需要授权手机号才能继续', 'none');
      } else {
        util.showToast('请授权获取手机号', 'none');
      }
      return;
    }

    wx.showLoading({ title: '绑定中...' });

    try {
      // 构建请求参数，优先使用 code（新版推荐方式）
      const requestData = {};
      if (code) {
        requestData.code = code;
      } else if (cloudID) {
        requestData.cloudID = cloudID;
      } else if (encryptedData) {
        requestData.encryptedData = encryptedData;
        requestData.iv = iv;
      }

      // 调用云函数获取手机号
      const result = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getPhoneNumber',
          data: requestData
        }
      });

      console.log('[登录] 获取手机号结果:', result);

      wx.hideLoading();

      const response = result.result || result;

      if (response.code === 0 || response.code === 200) {
        const phoneNumber = response.data.phoneNumber;

        // 更新用户信息
        await this.updateUserInfo({ phoneNumber });

        this.setData({
          'userInfo.phoneNumber': phoneNumber
        });

        util.showToast('手机号绑定成功', 'success');
      } else {
        util.showToast(response.message || '绑定失败', 'none');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[登录] 获取手机号失败:', error);
      util.showToast('绑定失败，请重试', 'none');
    }
  },

  /**
   * 协议同意切换
   */
  onAgreementToggle() {
    this.setData({
      agreed: !this.data.agreed
    });
  },

  /**
   * 查看用户协议
   */
  onUserAgreementTap() {
    wx.navigateTo({
      url: '/pages/webview/webview?url=' + encodeURIComponent('https://example.com/user-agreement')
    });
  },

  /**
   * 查看隐私政策
   */
  onPrivacyPolicyTap() {
    wx.navigateTo({
      url: '/package-user/pages/privacy/privacy'
    });
  },

  /**
   * 返回上一页或首页
   */
  goBack() {
    // 首先尝试 navigateBack 返回上一页（最简单可靠）
    const pages = getCurrentPages();
    if (pages.length > 1) {
      console.log('[登录] 使用 navigateBack 返回');
      wx.navigateBack({
        success: () => {
          console.log('[登录] navigateBack 成功');
        },
        fail: (err) => {
          console.error('[登录] navigateBack 失败:', err);
          this.redirectToTarget();
        }
      });
    } else {
      this.redirectToTarget();
    }
  },

  /**
   * 根据来源跳转到指定页面
   */
  redirectToTarget() {
    if (this.data.from) {
      const targetUrl = decodeURIComponent(this.data.from);
      console.log('[登录] 跳转到目标页面:', targetUrl);

      // 检查是否是 tabBar 页面
      const tabBarPages = [
        '/pages/index/index',
        '/pages/reserve/reserve',
        '/pages/order/order',
        '/pages/user/user'
      ];

      const isTabBar = tabBarPages.some(page => targetUrl.startsWith(page));

      if (isTabBar) {
        wx.switchTab({
          url: targetUrl,
          fail: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      } else {
        wx.redirectTo({
          url: targetUrl,
          fail: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      }
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  /**
   * 暂不登录，返回首页
   */
  onBackTap() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '暖心烘焙 - 会员登录',
      path: '/pages/login/login'
    };
  }
});
