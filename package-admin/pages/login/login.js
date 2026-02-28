/**
 * 管理端登录页
 * 功能：管理员身份验证、微信授权登录
 */
const app = getApp();

Page({
  data: {
    isLoading: false,
    isAuthorized: false,
    userInfo: null
  },

  onLoad(options) {
    // 页面加载时检查登录状态
    this.checkLoginStatus();
  },

  onShow() {
    // 页面显示时检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const adminInfo = wx.getStorageSync('admin_info');
    if (adminInfo && adminInfo.isAdmin) {
      this.setData({
        isAuthorized: true,
        userInfo: adminInfo
      });
    }
  },

  // 管理员登录验证（通过openid）
  async handleLogin() {
    this.setData({ isLoading: true });

    try {
      // 调用云函数进行登录验证（通过openid自动验证）
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'login'
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

        // 延迟跳转到首页
        setTimeout(() => {
          wx.redirectTo({
            url: '/package-admin/pages/dashboard/dashboard'
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

  // 进入管理后台
  enterDashboard() {
    wx.redirectTo({
      url: '/package-admin/pages/dashboard/dashboard'
    });
  },

  // 切换账号（退出登录）
  async switchAccount() {
    const { confirm } = await wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmColor: '#f44336'
    });

    if (!confirm) return;

    // 使用 auth 模块的 clearAllUserData 清除所有用户相关数据
    const auth = require('../../../utils/auth');
    auth.clearAllUserData();

    this.setData({
      isAuthorized: false,
      userInfo: null
    });

    wx.showToast({
      title: '已退出登录',
      icon: 'none'
    });

    // 关闭所有其他页面，只保留登录页
    // 使用 reLaunch 重新启动到登录页
    setTimeout(() => {
      wx.reLaunch({
        url: '/package-admin/pages/login/login'
      });
    }, 500);
  }
});
