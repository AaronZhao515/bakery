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
   * 微信一键登录
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
   * 选择头像
   */
  onChooseAvatar(e) {
    console.log('[登录] 选择头像:', e);
    const { avatarUrl } = e.detail;

    this.setData({
      'userInfo.avatarUrl': avatarUrl
    });

    // 上传到云存储并更新用户信息
    this.uploadAvatar(avatarUrl);
  },

  /**
   * 上传头像到云存储
   */
  async uploadAvatar(filePath) {
    try {
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`;

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
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
   * 获取手机号
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
      url: '/pages/webview/webview?url=' + encodeURIComponent('https://example.com/privacy-policy')
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
