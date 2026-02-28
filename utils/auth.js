/**
 * 权限验证工具模块
 * @module utils/auth
 * @description 提供用户认证、权限检查、登录状态管理等功能
 */

const { USER_ROLE, hasPermission } = require('./constants');
const { getStorage, setStorage, removeStorage } = require('./util');

// 存储键名
const AUTH_STORAGE_KEY = 'auth_info';

/**
 * 获取认证信息
 * @returns {Object} 认证信息
 */
function getAuthInfo() {
  return getStorage(AUTH_STORAGE_KEY, {
    isLogin: false,
    token: '',
    openid: '',
    userInfo: null,
    role: 'customer',
    expireTime: 0
  });
}

/**
 * 设置认证信息
 * @param {Object} authInfo - 认证信息
 */
function setAuthInfo(authInfo) {
  console.log('[Auth] setAuthInfo:', authInfo);
  setStorage(AUTH_STORAGE_KEY, authInfo);
}

/**
 * 更新本地存储的用户信息（不调用服务器）
 * @param {Object} userInfo - 用户信息
 */
function setUserInfo(userInfo) {
  console.log('[Auth] setUserInfo:', userInfo);
  const authInfo = getAuthInfo();
  authInfo.userInfo = { ...authInfo.userInfo, ...userInfo };
  setStorage(AUTH_STORAGE_KEY, authInfo);
}

/**
 * 清除认证信息
 */
function clearAuthInfo() {
  removeStorage(AUTH_STORAGE_KEY);
}

/**
 * 检查是否已登录
 * @returns {boolean} 是否已登录
 */
function isLogin() {
  const authInfo = getAuthInfo();
  console.log('[Auth] isLogin check:', authInfo);

  // 检查登录状态
  if (!authInfo.isLogin || !authInfo.token) {
    console.log('[Auth] isLogin: false (no isLogin or token)');
    return false;
  }

  // 检查token是否过期
  if (authInfo.expireTime && Date.now() > authInfo.expireTime) {
    console.log('[Auth] isLogin: false (token expired)');
    clearAuthInfo();
    return false;
  }

  console.log('[Auth] isLogin: true');
  return true;
}

/**
 * 检查登录状态，未登录则跳转到登录页
 * @param {boolean} redirect - 是否记录当前页面用于登录后跳转
 * @returns {boolean} 是否已登录
 */
function checkLogin(redirect = true) {
  if (isLogin()) {
    return true;
  }
  
  if (redirect) {
    // 获取当前页面路径
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const url = currentPage ? `/${currentPage.route}` : '/pages/index/index';
    
    // 保存当前页面路径
    setStorage('redirect_url', url);
    
    // 跳转到登录页
    wx.navigateTo({
      url: '/pages/login/login'
    });
  }
  
  return false;
}

/**
 * 获取用户信息
 * @returns {Object|null} 用户信息
 */
function getUserInfo() {
  const authInfo = getAuthInfo();
  console.log('[Auth] getUserInfo:', authInfo);
  return authInfo.userInfo;
}

/**
 * 获取用户角色
 * @returns {string} 用户角色
 */
function getUserRole() {
  const authInfo = getAuthInfo();
  return authInfo.role || 'customer';
}

/**
 * 检查用户是否有指定权限
 * @param {string} permission - 权限名称
 * @returns {boolean} 是否有权限
 */
function checkPermission(permission) {
  const role = getUserRole();
  return hasPermission(role, permission);
}

/**
 * 检查用户是否为管理员
 * @returns {boolean} 是否为管理员
 */
function isAdmin() {
  const role = getUserRole();
  return role === 'admin' || role === 'manager';
}

/**
 * 检查用户是否为员工
 * @returns {boolean} 是否为员工
 */
function isStaff() {
  const role = getUserRole();
  return role === 'staff' || role === 'admin' || role === 'manager';
}

/**
 * 微信登录
 * @returns {Promise} 登录结果
 */
function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 获取微信用户信息
 * @param {boolean} withCredentials - 是否带上登录态信息
 * @returns {Promise} 用户信息
 */
function getWxUserInfo(withCredentials = true) {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 执行登录流程（传统方式 - 仅获取 OpenID）
 * @returns {Promise} 登录结果
 */
async function doLogin() {
  try {
    // 调用云函数登录 - 云函数从 cloud.getWXContext() 获取 OPENID
    const { result } = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'login',
        data: {}
      }
    });

    console.log('[Auth] 登录返回:', result);

    // 处理 API 返回格式 { success, code, message, data }
    const response = result.result || result;

    if ((response.code === 0 || response.code === 200) && response.data) {
      // 构建用户信息对象（确保包含所有必要字段）
      const userInfoFromServer = response.data.userInfo || {};
      const userInfo = {
        userId: response.data.userId || userInfoFromServer.userId || '',
        nickName: userInfoFromServer.nickName || '',
        avatarUrl: userInfoFromServer.avatarUrl || '',
        phone: userInfoFromServer.phone || '',
        memberLevel: userInfoFromServer.memberLevel || 0,
        points: userInfoFromServer.points || 0
      };

      // 保存认证信息
      const authInfo = {
        isLogin: true,
        token: response.data.token,
        openid: response.data.openid,
        userInfo: userInfo,
        role: response.data.role || 'customer',
        expireTime: response.data.expireTime || Date.now() + 7 * 24 * 60 * 60 * 1000 // 默认7天
      };

      setAuthInfo(authInfo);

      // 返回统一格式的数据
      return {
        success: true,
        data: {
          ...response.data,
          userInfo: userInfo
        }
      };
    } else {
      throw new Error(response.message || '登录失败');
    }
  } catch (error) {
    console.error('[Auth] 登录失败:', error);
    return {
      success: false,
      error: error.message || '登录失败'
    };
  }
}

/**
 * 手机号一键登录
 * @param {Object} options - 登录选项
 * @param {String} options.phoneCode - 手机号授权凭证
 * @param {Object} options.userInfo - 用户信息（昵称、头像）
 * @returns {Promise} 登录结果
 */
async function doLoginWithPhone(options = {}) {
  const { phoneCode, userInfo = {} } = options;

  if (!phoneCode) {
    return {
      success: false,
      error: '手机号授权凭证不能为空'
    };
  }

  try {
    console.log('[Auth] 开始手机号一键登录');

    // 调用云函数进行手机号登录
    const { result } = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'loginWithPhone',
        data: {
          phoneCode: phoneCode,
          userInfo: userInfo
        }
      }
    });

    console.log('[Auth] 手机号登录返回:', result);

    // 处理 API 返回格式
    const response = result.result || result;

    if ((response.code === 0 || response.code === 200) && response.data) {
      const userInfoData = response.data.userInfo || {};

      // 构建完整的用户信息
      const userInfo = {
        userId: response.data.userId,
        nickName: userInfoData.nickName || userInfo.nickName || '',
        avatarUrl: userInfoData.avatarUrl || userInfo.avatarUrl || '',
        phone: response.data.phone || userInfoData.phone || '',
        memberLevel: userInfoData.memberLevel || 0,
        points: userInfoData.points || 0
      };

      // 保存认证信息
      const authInfo = {
        isLogin: true,
        token: response.data.token,
        openid: response.data.openid,
        phone: response.data.phone,
        userInfo: userInfo,
        role: response.data.role || 'customer',
        expireTime: response.data.expireTime || Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      setAuthInfo(authInfo);

      return {
        success: true,
        data: {
          ...response.data,
          userInfo: userInfo
        },
        isNewUser: response.data.isNewUser
      };
    } else {
      throw new Error(response.message || '登录失败');
    }
  } catch (error) {
    console.error('[Auth] 手机号登录失败:', error);
    return {
      success: false,
      error: error.message || '登录失败'
    };
  }
}

/**
 * 获取微信用户信息（昵称、头像）
 * 需要用户点击触发
 * @returns {Promise} 用户信息
 */
function getWxUserProfile() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        resolve({
          success: true,
          data: {
            nickName: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl,
            gender: res.userInfo.gender,
            city: res.userInfo.city,
            province: res.userInfo.province,
            country: res.userInfo.country
          }
        });
      },
      fail: (err) => {
        console.error('[Auth] 获取用户信息失败:', err);
        resolve({
          success: false,
          error: err.errMsg || '获取用户信息失败'
        });
      }
    });
  });
}

/**
 * 执行退出登录
 * @returns {Promise} 退出结果
 */
async function doLogout() {
  try {
    // 调用云函数退出登录
    await wx.cloud.callFunction({
      name: 'user',
      data: { action: 'logout' }
    });
  } catch (error) {
    console.error('[Auth] 服务器退出失败:', error);
  } finally {
    // 清除所有用户相关的本地存储数据
    clearAllUserData();

    return {
      success: true
    };
  }
}

/**
 * 清除所有用户相关的本地存储数据
 */
function clearAllUserData() {
  // 用户认证信息
  clearAuthInfo();

  // 购物车相关数据
  wx.removeStorageSync('cartData');
  wx.removeStorageSync('cart');
  wx.removeStorageSync('cart_data');

  // 管理员信息
  wx.removeStorageSync('admin_info');

  // 用户信息
  wx.removeStorageSync('user_info');
  wx.removeStorageSync('userInfo');

  // 优惠券相关
  wx.removeStorageSync('claimed_coupons');
  wx.removeStorageSync('selectedCouponForOrder');

  // 地址信息
  wx.removeStorageSync('selectedAddressForOrder');

  // 订单相关
  wx.removeStorageSync('currentOrder');
  wx.removeStorageSync('checkoutData');
  wx.removeStorageSync('orderType');

  // 其他用户相关数据
  wx.removeStorageSync('openid');
  wx.removeStorageSync('redirect_url');
  wx.removeStorageSync('couponSelectionMade');

  // 地址列表和订单历史
  wx.removeStorageSync('address_list');
  wx.removeStorageSync('order_history');
  wx.removeStorageSync('user_coupons');

  // 收藏和搜索历史
  wx.removeStorageSync('collects');
  wx.removeStorageSync('searchHistory');

  console.log('[Auth] 所有用户相关数据已清除');
}

/**
 * 更新用户信息
 * @param {Object} userInfo - 用户信息
 * @returns {Promise} 更新结果
 */
async function updateUserInfo(userInfo) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'updateUserInfo',
        data: userInfo
      }
    });

    // 处理 API 返回格式
    const response = result.result || result;

    if (response.code === 0 || response.code === 200) {
      // 更新本地存储
      const authInfo = getAuthInfo();
      authInfo.userInfo = { ...authInfo.userInfo, ...userInfo };
      setAuthInfo(authInfo);

      return {
        success: true,
        data: response.data
      };
    } else {
      throw new Error(response.message || '更新失败');
    }
  } catch (error) {
    console.error('[Auth] 更新用户信息失败:', error);
    return {
      success: false,
      error: error.message || '更新失败'
    };
  }
}

/**
 * 获取手机号
 * @param {Object} encryptedData - 加密数据
 * @returns {Promise} 手机号
 */
async function getPhoneNumber(encryptedData) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'getPhoneNumber',
        data: encryptedData
      }
    });

    // 处理 API 返回格式
    const response = result.result || result;

    if (response.code === 0 || response.code === 200) {
      return {
        success: true,
        data: response.data
      };
    } else {
      throw new Error(response.message || '获取失败');
    }
  } catch (error) {
    console.error('[Auth] 获取手机号失败:', error);
    return {
      success: false,
      error: error.message || '获取失败'
    };
  }
}

/**
 * 静默登录（检查登录状态，如过期则自动刷新）
 * @returns {Promise} 登录结果
 */
async function silentLogin() {
  if (isLogin()) {
    return {
      success: true,
      data: getAuthInfo()
    };
  }
  
  return doLogin();
}

/**
 * 需要登录的装饰器
 * @param {Function} fn - 需要登录的函数
 * @returns {Function} 包装后的函数
 */
function requireLogin(fn) {
  return function (...args) {
    if (!isLogin()) {
      checkLogin(true);
      return;
    }
    return fn.apply(this, args);
  };
}

/**
 * 需要权限的装饰器
 * @param {string} permission - 需要的权限
 * @returns {Function} 装饰器函数
 */
function requirePermission(permission) {
  return function (fn) {
    return function (...args) {
      if (!isLogin()) {
        checkLogin(true);
        return;
      }
      
      if (!checkPermission(permission)) {
        wx.showToast({
          title: '没有权限执行此操作',
          icon: 'none'
        });
        return;
      }
      
      return fn.apply(this, args);
    };
  };
}

/**
 * 订阅消息授权
 * @param {Array} tmplIds - 模板ID列表
 * @returns {Promise} 授权结果
 */
function requestSubscribeMessage(tmplIds) {
  return new Promise((resolve, reject) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 获取用户位置授权
 * @returns {Promise} 授权结果
 */
function requestLocationAuth() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success: resolve,
            fail: reject
          });
        } else {
          resolve({ authSetting: { 'scope.userLocation': true } });
        }
      },
      fail: reject
    });
  });
}

/**
 * 打开授权设置页
 * @returns {Promise} 设置结果
 */
function openSetting() {
  return new Promise((resolve, reject) => {
    wx.openSetting({
      success: resolve,
      fail: reject
    });
  });
}

// 导出模块
module.exports = {
  // 认证信息操作
  getAuthInfo,
  setAuthInfo,
  setUserInfo,
  clearAuthInfo,
  clearAllUserData,

  // 登录状态检查
  isLogin,
  checkLogin,

  // 用户信息获取
  getUserInfo,
  getUserRole,

  // 权限检查
  checkPermission,
  isAdmin,
  isStaff,

  // 登录操作
  wxLogin,
  getWxUserInfo,
  getWxUserProfile,  // 获取微信用户信息（昵称、头像）
  doLogin,           // 传统登录
  doLoginWithPhone,  // 手机号一键登录
  doLogout,
  updateUserInfo,
  getPhoneNumber,
  silentLogin,

  // 装饰器
  requireLogin,
  requirePermission,

  // 授权相关
  requestSubscribeMessage,
  requestLocationAuth,
  openSetting
};
