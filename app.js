/**
 * 面包烘焙小程序 - 应用入口
 * 功能：初始化云开发、全局状态管理、用户登录
 * @author Bread Bakery Team
 * @version 1.0.0
 */

import { createStoreBindings } from './utils/store';

App({
  // 全局数据
  globalData: {
    // 系统信息
    systemInfo: null,
    // 导航栏高度
    navBarHeight: 0,
    // 状态栏高度
    statusBarHeight: 0,
    // 安全区域底部高度
    safeAreaBottom: 0,
    // 是否已登录
    isLogin: false,
    // 用户角色：'customer' | 'admin' | 'staff'
    userRole: 'customer',
    // 店铺信息
    shopInfo: null
  },

  /**
   * 小程序初始化
   */
  onLaunch(options) {
    console.log('[App] 小程序启动', options);
    
    // 初始化云开发
    this.initCloud();
    
    // 获取系统信息
    this.initSystemInfo();
    
    // 初始化全局状态
    this.initGlobalStore();
    
    // 检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 小程序显示
   */
  onShow(options) {
    console.log('[App] 小程序显示', options);
  },

  /**
   * 小程序隐藏
   */
  onHide() {
    console.log('[App] 小程序隐藏');
  },

  /**
   * 初始化云开发环境
   */
  initCloud() {
    if (!wx.cloud) {
      console.error('[App] 请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    // 初始化云开发
    wx.cloud.init({
      // 云开发环境ID，请替换为您的实际环境ID
      env: 'cloud1-5gh4dyhpb180b5fb',
      // 跟踪用户调用情况
      traceUser: true
    });

    console.log('[App] 云开发初始化成功');
  },

  /**
   * 获取系统信息
   */
  initSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
      
      // 计算导航栏高度
      const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height;
      
      // 计算安全区域底部高度
      const safeAreaBottom = systemInfo.safeArea ? 
        (systemInfo.screenHeight - systemInfo.safeArea.bottom) : 0;

      this.globalData.systemInfo = systemInfo;
      this.globalData.statusBarHeight = systemInfo.statusBarHeight;
      this.globalData.navBarHeight = navBarHeight;
      this.globalData.safeAreaBottom = safeAreaBottom;

      console.log('[App] 系统信息获取成功', {
        statusBarHeight: systemInfo.statusBarHeight,
        navBarHeight,
        safeAreaBottom
      });
    } catch (error) {
      console.error('[App] 获取系统信息失败', error);
    }
  },

  /**
   * 初始化全局状态管理
   */
  initGlobalStore() {
    // 创建全局状态存储
    this.store = createStoreBindings({
      // 用户信息
      userStore: {
        userInfo: null,
        openid: '',
        unionid: '',
        isLogin: false,
        role: 'customer', // customer | admin | staff
        permissions: [],
        addressList: [],
        defaultAddress: null
      },
      // 购物车数据
      cartStore: {
        items: [],
        totalCount: 0,
        totalPrice: 0,
        selectedCount: 0,
        selectedPrice: 0
      },
      // 应用状态
      appStore: {
        isLoading: false,
        loadingText: '',
        toast: {
          show: false,
          title: '',
          icon: 'none',
          duration: 2000
        },
        modal: {
          show: false,
          title: '',
          content: '',
          showCancel: true,
          cancelText: '取消',
          confirmText: '确定'
        },
        // 店铺配置
        shopConfig: {
          businessHours: {
            open: '08:00',
            close: '21:00'
          },
          deliveryTime: ['10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'],
          notice: '',
          phone: ''
        }
      }
    });

    console.log('[App] 全局状态管理初始化成功');
  },

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    try {
      // 先检查本地登录状态
      const auth = require('./utils/auth');
      const isLocalLogin = auth.isLogin();

      console.log('[App] 本地登录状态:', isLocalLogin);

      // 如果本地未登录，直接返回
      if (!isLocalLogin) {
        this.store.userStore.update({
          userInfo: null,
          isLogin: false,
          role: 'customer'
        });
        this.globalData.isLogin = false;
        this.globalData.userRole = 'customer';
        return;
      }

      // 本地已登录，从本地获取用户信息
      const localUserInfo = auth.getUserInfo();
      const localRole = auth.getUserRole();

      // 先更新全局状态（使用本地数据，确保页面立即显示）
      this.store.userStore.update({
        userInfo: localUserInfo,
        isLogin: true,
        role: localRole
      });
      this.globalData.isLogin = true;
      this.globalData.userRole = localRole;

      // 异步检查服务器端登录状态
      const authInfo = auth.getAuthInfo();
      const { result } = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'checkLogin',
          token: authInfo.token
        }
      });

      if (result.code === 0 && result.data.isLogin) {
        console.log('[App] 服务端登录状态验证成功');

        // 如果 token 无效，重新登录
        if (!result.data.isTokenValid) {
          console.log('[App] Token 已过期，执行静默登录');
          await this.silentLogin();
        } else {
          // 更新服务器端的用户信息
          this.store.userStore.update({
            userInfo: result.data.userInfo,
            isLogin: true,
            role: result.data.userInfo.role || 'customer'
          });
        }
      } else if (result.code === 0 && !result.data.isLogin) {
        // 用户不存在于数据库，清除本地状态
        console.log('[App] 用户不存在于数据库，清除本地状态');
        auth.clearAuthInfo();
        this.store.userStore.update({
          userInfo: null,
          isLogin: false,
          role: 'customer'
        });
        this.globalData.isLogin = false;
        this.globalData.userRole = 'customer';
      } else {
        // 云函数调用出错，保持本地登录状态
        console.log('[App] 服务端检查失败，保持本地登录状态');
      }
    } catch (error) {
      console.error('[App] 检查登录状态失败', error);
      // 出错时保持本地登录状态（如果有）
      const auth = require('./utils/auth');
      if (auth.isLogin()) {
        const localUserInfo = auth.getUserInfo();
        const localRole = auth.getUserRole();
        this.store.userStore.update({
          userInfo: localUserInfo,
          isLogin: true,
          role: localRole
        });
        this.globalData.isLogin = true;
        this.globalData.userRole = localRole;
      }
    }
  },

  /**
   * 静默登录（token 过期时自动刷新）
   */
  async silentLogin() {
    try {
      const auth = require('./utils/auth');
      const result = await auth.doLogin();

      if (result.success) {
        this.store.userStore.update({
          userInfo: result.data.userInfo || result.data,
          isLogin: true,
          openid: result.data.openid,
          role: result.data.role || 'customer'
        });
        this.globalData.isLogin = true;
        this.globalData.userRole = result.data.role || 'customer';
        console.log('[App] 静默登录成功');
      }
    } catch (error) {
      console.error('[App] 静默登录失败', error);
    }
  },

  /**
   * 用户登录
   */
  async login() {
    try {
      const auth = require('./utils/auth');
      const result = await auth.doLogin();

      if (result.success) {
        // 更新全局状态
        this.store.userStore.update({
          userInfo: result.data.userInfo || result.data,
          isLogin: true,
          openid: result.data.openid,
          role: result.data.role || 'customer'
        });
        this.globalData.isLogin = true;
        this.globalData.userRole = result.data.role || 'customer';

        console.log('[App] 登录成功', result.data);
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error || '登录失败');
      }
    } catch (error) {
      console.error('[App] 登录失败', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 获取用户信息
   */
  async getUserProfile() {
    try {
      const { userInfo } = await wx.getUserProfile({
        desc: '用于完善用户资料'
      });

      // 更新用户信息到云数据库
      const { result } = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'updateUserInfo',
          data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl
          }
        }
      });

      if (result.code === 0) {
        // 更新 store
        this.store.userStore.update({
          userInfo: { ...this.store.userStore.userInfo, ...result.data }
        });
        // 同步更新本地存储
        const auth = require('./utils/auth');
        auth.setUserInfo(result.data);
        return { success: true, data: result.data };
      }
    } catch (error) {
      console.error('[App] 获取用户信息失败', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 退出登录
   * 清除所有用户相关数据
   */
  async logout() {
    try {
      const auth = require('./utils/auth');
      await auth.doLogout();

      // 清空全局用户状态
      this.store.userStore.update({
        userInfo: null,
        openid: '',
        unionid: '',
        isLogin: false,
        role: 'customer',
        permissions: [],
        addressList: [],
        defaultAddress: null
      });

      // 清空购物车数据
      this.store.cartStore.update({
        items: [],
        totalCount: 0,
        totalPrice: 0,
        selectedCount: 0,
        selectedPrice: 0
      });

      // 清空全局数据
      this.globalData.isLogin = false;
      this.globalData.userRole = 'customer';
      this.globalData.shopInfo = null;

      // 清除本地存储的其他用户相关数据
      wx.removeStorageSync('cart_data');
      wx.removeStorageSync('address_list');
      wx.removeStorageSync('order_history');
      wx.removeStorageSync('user_coupons');

      console.log('[App] 退出登录成功，已清除所有用户数据');
      return { success: true };
    } catch (error) {
      console.error('[App] 退出登录失败', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 显示加载中
   * @param {string} text - 提示文字
   */
  showLoading(text = '加载中...') {
    this.store.appStore.update({
      isLoading: true,
      loadingText: text
    });
  },

  /**
   * 隐藏加载中
   */
  hideLoading() {
    this.store.appStore.update({
      isLoading: false,
      loadingText: ''
    });
  },

  /**
   * 显示Toast提示
   * @param {Object} options - 配置项
   */
  showToast(options = {}) {
    const defaultOptions = {
      show: true,
      title: '',
      icon: 'none',
      duration: 2000
    };

    this.store.appStore.toast.update({
      ...defaultOptions,
      ...options
    });

    // 自动隐藏
    if (options.duration !== 0) {
      setTimeout(() => {
        this.store.appStore.tost.update({ show: false });
      }, options.duration || 2000);
    }
  },

  /**
   * 隐藏Toast
   */
  hideToast() {
    this.store.appStore.toast.update({ show: false });
  },

  /**
   * 显示Modal弹窗
   * @param {Object} options - 配置项
   * @returns {Promise} - 用户操作结果
   */
  showModal(options = {}) {
    return new Promise((resolve) => {
      const defaultOptions = {
        show: true,
        title: '提示',
        content: '',
        showCancel: true,
        cancelText: '取消',
        confirmText: '确定',
        success: resolve
      };

      this.store.appStore.modal.update({
        ...defaultOptions,
        ...options
      });
    });
  },

  /**
   * 隐藏Modal
   */
  hideModal() {
    this.store.appStore.modal.update({ show: false });
  }
});
