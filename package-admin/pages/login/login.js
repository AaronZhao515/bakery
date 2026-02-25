/**
 * 管理端登录页
 * 功能：管理员身份验证、微信授权登录
 */
const app = getApp();

Page({
  data: {
    account: '',
    password: '',
    rememberMe: false,
    isLoading: false,
    isAuthorized: false,
    userInfo: null
  },

  onLoad(options) {
    // 检查本地存储的登录信息
    this.checkLocalLogin();
  },

  onShow() {
    // 页面显示时检查登录状态
    this.checkLoginStatus();
  },

  // 检查本地存储的登录信息
  checkLocalLogin() {
    const savedAccount = wx.getStorageSync('admin_account');
    const savedRemember = wx.getStorageSync('admin_remember');
    
    if (savedRemember && savedAccount) {
      this.setData({
        account: savedAccount,
        rememberMe: true
      });
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const adminInfo = wx.getStorageSync('admin_info');
    if (adminInfo && adminInfo.token) {
      this.setData({
        isAuthorized: true,
        userInfo: adminInfo
      });
    }
  },

  // 账号输入
  onAccountInput(e) {
    this.setData({
      account: e.detail.value
    });
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  // 切换记住账号
  toggleRemember() {
    this.setData({
      rememberMe: !this.data.rememberMe
    });
  },

  // 忘记密码
  forgotPassword() {
    wx.showModal({
      title: '找回密码',
      content: '请联系超级管理员重置密码',
      showCancel: false
    });
  },

  // 账号密码登录
  async handleLogin() {
    const { account, password, rememberMe } = this.data;

    // 表单验证
    if (!account.trim()) {
      wx.showToast({
        title: '请输入账号',
        icon: 'none'
      });
      return;
    }

    if (!password.trim()) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });

    try {
      // 调用云函数进行登录验证
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'login',
          account: account.trim(),
          password: password.trim()
        }
      });

      if (result.result.code === 0) {
        const adminInfo = result.result.data;
        
        // 保存登录信息
        wx.setStorageSync('admin_info', adminInfo);
        
        // 记住账号
        if (rememberMe) {
          wx.setStorageSync('admin_account', account.trim());
          wx.setStorageSync('admin_remember', true);
        } else {
          wx.removeStorageSync('admin_account');
          wx.removeStorageSync('admin_remember');
        }

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });

        // 延迟跳转到首页
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/admin/dashboard/dashboard'
          });
        }, 1000);
      } else {
        wx.showToast({
          title: result.result.message || '登录失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('登录失败:', error);
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 微信一键登录
  async handleWxLogin(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '需要授权手机号才能登录',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });

    try {
      // 获取登录凭证
      const loginRes = await wx.login();
      
      // 调用云函数进行微信登录
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'wxLogin',
          code: loginRes.code,
          encryptedData: e.detail.encryptedData,
          iv: e.detail.iv
        }
      });

      if (result.result.code === 0) {
        const adminInfo = result.result.data;
        
        // 保存登录信息
        wx.setStorageSync('admin_info', adminInfo);

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });

        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/admin/dashboard/dashboard'
          });
        }, 1000);
      } else {
        wx.showToast({
          title: result.result.message || '登录失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('微信登录失败:', error);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 进入管理后台
  enterDashboard() {
    wx.redirectTo({
      url: '/pages/admin/dashboard/dashboard'
    });
  },

  // 切换账号
  switchAccount() {
    wx.removeStorageSync('admin_info');
    this.setData({
      isAuthorized: false,
      userInfo: null,
      account: '',
      password: ''
    });
  }
});
