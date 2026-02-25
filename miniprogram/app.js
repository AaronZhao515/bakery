/**
 * 小程序入口文件
 * 温馨烘焙坊 - 面包烘焙小程序
 */

App({
  globalData: {
    userInfo: null,
    openid: null,
    cartCount: 0,
    systemInfo: null
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-5gh4dyhpb180b5fb', // 云开发环境ID
        traceUser: true
      });
    }

    // 获取系统信息
    this.getSystemInfo();

    // 获取购物车数量
    this.updateCartCount();

    // 自动登录
    this.autoLogin();
  },

  onShow() {
    // 更新购物车数量
    this.updateCartCount();
  },

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
      }
    });
  },

  /**
   * 自动登录
   */
  async autoLogin() {
    try {
      // 检查本地是否有登录态
      const openid = wx.getStorageSync('openid');
      
      if (openid) {
        this.globalData.openid = openid;
        return;
      }

      // 调用云函数获取openid
      const { result } = await wx.cloud.callFunction({
        name: 'login'
      });

      if (result && result.openid) {
        this.globalData.openid = result.openid;
        wx.setStorageSync('openid', result.openid);
      }
    } catch (error) {
      console.error('自动登录失败:', error);
    }
  },

  /**
   * 更新购物车数量
   */
  updateCartCount() {
    const cartData = wx.getStorageSync('cartData') || [];
    const count = cartData.reduce((total, item) => total + item.quantity, 0);
    this.globalData.cartCount = count;
    
    // 设置tabBar徽章
    if (count > 0) {
      wx.setTabBarBadge({
        index: 1,
        text: String(count > 99 ? '99+' : count)
      });
    } else {
      wx.removeTabBarBadge({
        index: 1
      });
    }
  },

  /**
   * 获取用户信息
   */
  async getUserInfo() {
    if (this.globalData.userInfo) {
      return this.globalData.userInfo;
    }

    try {
      const { userInfo } = await wx.getUserProfile({
        desc: '用于完善用户资料'
      });
      
      this.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
      
      return userInfo;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }
});
