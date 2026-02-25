/**
 * API 封装模块
 * @module utils/api
 * @description 统一封装云函数调用，提供错误处理和请求拦截
 */

// API 基础配置
const API_CONFIG = {
  // 超时时间（毫秒）
  timeout: 30000,
  // 重试次数
  retryCount: 1,
  // 是否显示加载提示
  showLoading: true,
  // 加载提示文字
  loadingText: '加载中...'
};

// 请求队列（用于管理并发请求）
let requestQueue = [];
let loadingCount = 0;

/**
 * 显示加载提示
 * @param {string} text - 提示文字
 */
function showLoading(text) {
  if (loadingCount === 0) {
    wx.showLoading({ title: text, mask: true });
  }
  loadingCount++;
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) {
    wx.hideLoading();
  }
}

/**
 * 统一的错误处理
 * @param {Error} error - 错误对象
 * @param {string} action - 操作名称
 */
function handleError(error, action = '') {
  console.error(`[API] ${action} 失败:`, error);
  
  let message = '操作失败，请稍后重试';
  
  if (error.errMsg) {
    if (error.errMsg.includes('timeout')) {
      message = '请求超时，请检查网络';
    } else if (error.errMsg.includes('fail')) {
      message = '网络错误，请检查网络连接';
    } else {
      message = error.errMsg;
    }
  } else if (error.message) {
    message = error.message;
  }
  
  // 显示错误提示
  wx.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  });
  
  return {
    code: -1,
    message,
    error
  };
}

/**
 * 调用云函数
 * @param {Object} options - 请求配置
 * @param {string} options.name - 云函数名称
 * @param {Object} options.data - 请求数据
 * @param {number} options.timeout - 超时时间
 * @param {boolean} options.showLoading - 是否显示加载提示
 * @param {string} options.loadingText - 加载提示文字
 * @param {number} options.retry - 重试次数
 * @returns {Promise} 请求结果
 */
async function callCloudFunction(options = {}) {
  const {
    name,
    data = {},
    timeout = API_CONFIG.timeout,
    showLoading: showLoadingFlag = API_CONFIG.showLoading,
    loadingText = API_CONFIG.loadingText,
    retry = API_CONFIG.retryCount
  } = options;

  if (!name) {
    throw new Error('云函数名称不能为空');
  }

  // 显示加载提示
  if (showLoadingFlag) {
    showLoading(loadingText);
  }

  let lastError = null;
  
  // 重试机制
  for (let i = 0; i <= retry; i++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const requestTask = wx.cloud.callFunction({
          name,
          data,
          success: resolve,
          fail: reject
        });

        // 设置超时
        if (timeout > 0) {
          setTimeout(() => {
            reject({ errMsg: 'timeout' });
          }, timeout);
        }
      });

      // 隐藏加载提示
      if (showLoadingFlag) {
        hideLoading();
      }

      // 检查云函数返回结果
      if (result.result) {
        const { code, message, data: responseData } = result.result;
        
        // 业务错误处理
        if (code !== 0 && code !== 200) {
          console.warn(`[API] 业务错误:`, result.result);
          
          // 特殊错误码处理
          if (code === 401) {
            // 未登录，跳转到登录页
            wx.navigateTo({ url: '/pages/login/login' });
          }
          
          throw new Error(message || '请求失败');
        }
        
        return {
          success: true,
          code: code || 0,
          message: message || 'success',
          data: responseData,
          raw: result.result
        };
      }

      return {
        success: true,
        code: 0,
        message: 'success',
        data: result.result,
        raw: result
      };

    } catch (error) {
      lastError = error;
      
      // 如果不是最后一次重试，等待后重试
      if (i < retry) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        console.log(`[API] 第 ${i + 1} 次重试...`);
      }
    }
  }

  // 隐藏加载提示
  if (showLoadingFlag) {
    hideLoading();
  }

  // 所有重试都失败了
  return handleError(lastError, name);
}

/**
 * 批量调用云函数
 * @param {Array} requests - 请求配置数组
 * @returns {Promise} 批量请求结果
 */
async function batchCall(requests = []) {
  if (!Array.isArray(requests) || requests.length === 0) {
    return { success: true, data: [] };
  }

  try {
    const promises = requests.map(req => callCloudFunction({
      ...req,
      showLoading: false // 批量请求不显示单独加载提示
    }));

    const results = await Promise.allSettled(promises);
    
    return {
      success: true,
      data: results.map((result, index) => ({
        name: requests[index].name,
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : result.reason
      }))
    };
  } catch (error) {
    return handleError(error, '批量请求');
  }
}

// ==================== 用户相关 API ====================

const userApi = {
  /**
   * 用户登录
   */
  login() {
    return callCloudFunction({
      name: 'user',
      data: { action: 'login' },
      loadingText: '登录中...'
    });
  },

  /**
   * 获取用户信息
   */
  getUserInfo() {
    return callCloudFunction({
      name: 'user',
      data: { action: 'getUserInfo' }
    });
  },

  /**
   * 更新用户信息
   * @param {Object} userInfo - 用户信息
   */
  updateUserInfo(userInfo) {
    return callCloudFunction({
      name: 'user',
      data: { action: 'updateUserInfo', data: userInfo },
      loadingText: '保存中...'
    });
  },

  /**
   * 退出登录
   */
  logout() {
    return callCloudFunction({
      name: 'user',
      data: { action: 'logout' }
    });
  }
};

// ==================== 商品相关 API ====================

const productApi = {
  /**
   * 获取商品列表
   * @param {Object} params - 查询参数
   */
  getList(params = {}) {
    return callCloudFunction({
      name: 'product',
      data: { action: 'getList', data: params }
    });
  },

  /**
   * 获取商品详情
   * @param {string} productId - 商品ID
   */
  getDetail(productId) {
    return callCloudFunction({
      name: 'product',
      data: { action: 'getDetail', data: { productId } }
    });
  },

  /**
   * 获取商品分类
   */
  getCategories() {
    return callCloudFunction({
      name: 'product',
      data: { action: 'getCategories' }
    });
  },

  /**
   * 搜索商品
   * @param {string} keyword - 搜索关键词
   * @param {Object} params - 其他参数
   */
  search(keyword, params = {}) {
    return callCloudFunction({
      name: 'product',
      data: { action: 'search', data: { keyword, ...params } }
    });
  },

  /**
   * 获取推荐商品
   * @param {number} limit - 数量限制
   */
  getRecommend(limit = 6) {
    return callCloudFunction({
      name: 'product',
      data: { action: 'getRecommend', data: { limit } }
    });
  }
};

// ==================== 订单相关 API ====================

const orderApi = {
  /**
   * 创建订单
   * @param {Object} orderData - 订单数据
   */
  create(orderData) {
    return callCloudFunction({
      name: 'order',
      data: { action: 'create', data: orderData },
      loadingText: '创建订单中...'
    });
  },

  /**
   * 获取订单列表
   * @param {Object} params - 查询参数
   */
  getList(params = {}) {
    return callCloudFunction({
      name: 'order',
      data: { action: 'getList', data: params }
    });
  },

  /**
   * 获取订单详情
   * @param {string} orderId - 订单ID
   */
  getDetail(orderId) {
    return callCloudFunction({
      name: 'order',
      data: { action: 'getDetail', data: { orderId } }
    });
  },

  /**
   * 取消订单
   * @param {string} orderId - 订单ID
   * @param {string} reason - 取消原因
   */
  cancel(orderId, reason = '') {
    return callCloudFunction({
      name: 'order',
      data: { action: 'cancel', data: { orderId, reason } },
      loadingText: '取消中...'
    });
  },

  /**
   * 支付订单
   * @param {string} orderId - 订单ID
   */
  pay(orderId) {
    return callCloudFunction({
      name: 'order',
      data: { action: 'pay', data: { orderId } },
      loadingText: '支付中...'
    });
  },

  /**
   * 确认收货
   * @param {string} orderId - 订单ID
   */
  confirmReceive(orderId) {
    return callCloudFunction({
      name: 'order',
      data: { action: 'confirmReceive', data: { orderId } },
      loadingText: '确认中...'
    });
  },

  /**
   * 申请退款
   * @param {string} orderId - 订单ID
   * @param {Object} refundData - 退款数据
   */
  applyRefund(orderId, refundData) {
    return callCloudFunction({
      name: 'order',
      data: { action: 'applyRefund', data: { orderId, ...refundData } },
      loadingText: '申请中...'
    });
  }
};

// ==================== 购物车相关 API ====================

const cartApi = {
  /**
   * 获取购物车列表
   */
  getList() {
    return callCloudFunction({
      name: 'cart',
      data: { action: 'getList' }
    });
  },

  /**
   * 添加商品到购物车
   * @param {Object} item - 商品信息
   */
  add(item) {
    return callCloudFunction({
      name: 'cart',
      data: { action: 'add', data: item },
      loadingText: '添加中...'
    });
  },

  /**
   * 更新购物车商品
   * @param {string} cartId - 购物车项ID
   * @param {Object} updateData - 更新数据
   */
  update(cartId, updateData) {
    return callCloudFunction({
      name: 'cart',
      data: { action: 'update', data: { cartId, ...updateData } }
    });
  },

  /**
   * 删除购物车商品
   * @param {Array} cartIds - 购物车项ID数组
   */
  remove(cartIds) {
    return callCloudFunction({
      name: 'cart',
      data: { action: 'remove', data: { cartIds } },
      loadingText: '删除中...'
    });
  },

  /**
   * 清空购物车
   */
  clear() {
    return callCloudFunction({
      name: 'cart',
      data: { action: 'clear' },
      loadingText: '清空中...'
    });
  },

  /**
   * 更新购物车选中状态
   * @param {Array} cartIds - 购物车项ID数组
   * @param {boolean} selected - 选中状态
   */
  updateSelected(cartIds, selected) {
    return callCloudFunction({
      name: 'cart',
      data: { action: 'updateSelected', data: { cartIds, selected } }
    });
  }
};

// ==================== 地址相关 API ====================

const addressApi = {
  /**
   * 获取地址列表
   */
  getList() {
    return callCloudFunction({
      name: 'user',
      data: { action: 'getAddressList' }
    });
  },

  /**
   * 添加地址
   * @param {Object} addressData - 地址数据
   */
  add(addressData) {
    return callCloudFunction({
      name: 'user',
      data: { action: 'addAddress', data: addressData },
      loadingText: '保存中...'
    });
  },

  /**
   * 更新地址
   * @param {string} addressId - 地址ID
   * @param {Object} addressData - 地址数据
   */
  update(addressId, addressData) {
    return callCloudFunction({
      name: 'user',
      data: { action: 'updateAddress', data: { addressId, ...addressData } },
      loadingText: '保存中...'
    });
  },

  /**
   * 删除地址
   * @param {string} addressId - 地址ID
   */
  remove(addressId) {
    return callCloudFunction({
      name: 'user',
      data: { action: 'deleteAddress', data: { addressId } },
      loadingText: '删除中...'
    });
  },

  /**
   * 设置默认地址
   * @param {string} addressId - 地址ID
   */
  setDefault(addressId) {
    return callCloudFunction({
      name: 'user',
      data: { action: 'setDefaultAddress', data: { addressId } }
    });
  }
};

// ==================== 优惠券相关 API ====================

const couponApi = {
  /**
   * 获取优惠券列表
   * @param {Object} params - 查询参数
   * @param {String} params.type - 优惠券类型：newcomer(新人优惠)、limited(限时优惠)、all(全部)
   */
  getList(params = {}) {
    return callCloudFunction({
      name: 'coupon',
      data: { action: 'getList', data: params }
    });
  },

  /**
   * 领取优惠券
   * @param {string} couponId - 优惠券ID
   */
  receive(couponId) {
    return callCloudFunction({
      name: 'coupon',
      data: { action: 'receive', data: { couponId } },
      loadingText: '领取中...'
    });
  },

  /**
   * 获取可用优惠券
   * @param {number} amount - 订单金额
   */
  getAvailable(amount) {
    return callCloudFunction({
      name: 'coupon',
      data: { action: 'check', data: { totalAmount: amount } }
    });
  },

  /**
   * 获取用户优惠券列表
   * @param {number} status - 状态 0未使用 1已使用 2已过期
   */
  getUserCoupons(status) {
    return callCloudFunction({
      name: 'coupon',
      data: { action: 'getUserCoupons', data: { status } }
    });
  }
};

// ==================== 店铺相关 API ====================

const shopApi = {
  /**
   * 获取店铺信息
   */
  getInfo() {
    return callCloudFunction({
      name: 'shop',
      data: { action: 'getInfo' }
    });
  },

  /**
   * 获取营业时间
   */
  getBusinessHours() {
    return callCloudFunction({
      name: 'shop',
      data: { action: 'getBusinessHours' }
    });
  },

  /**
   * 获取配送时间
   */
  getDeliveryTime() {
    return callCloudFunction({
      name: 'shop',
      data: { action: 'getDeliveryTime' }
    });
  },

  /**
   * 获取店铺公告
   */
  getNotice() {
    return callCloudFunction({
      name: 'shop',
      data: { action: 'getNotice' }
    });
  }
};

// ==================== 管理员相关 API ====================

const adminApi = {
  /**
   * 获取仪表盘数据
   */
  getDashboard() {
    return callCloudFunction({
      name: 'admin',
      data: { action: 'getDashboard' }
    });
  },

  /**
   * 获取统计数据
   * @param {Object} params - 查询参数
   */
  getStatistics(params = {}) {
    return callCloudFunction({
      name: 'admin',
      data: { action: 'getStatistics', data: params }
    });
  },

  /**
   * 获取订单列表（管理员）
   * @param {Object} params - 查询参数
   */
  getOrderList(params = {}) {
    return callCloudFunction({
      name: 'admin',
      data: { action: 'getOrderList', data: params }
    });
  },

  /**
   * 更新订单状态
   * @param {string} orderId - 订单ID
   * @param {string} status - 订单状态
   * @param {Object} extra - 额外数据
   */
  updateOrderStatus(orderId, status, extra = {}) {
    return callCloudFunction({
      name: 'admin',
      data: { action: 'updateOrderStatus', data: { orderId, status, ...extra } },
      loadingText: '更新中...'
    });
  },

  /**
   * 商品管理
   * @param {string} action - 操作类型
   * @param {Object} data - 商品数据
   */
  manageProduct(action, data = {}) {
    return callCloudFunction({
      name: 'admin',
      data: { action: `product_${action}`, data: data },
      loadingText: '处理中...'
    });
  }
};

// 导出 API 模块
module.exports = {
  // 基础方法
  callCloudFunction,
  batchCall,
  
  // 业务 API
  user: userApi,
  product: productApi,
  order: orderApi,
  cart: cartApi,
  address: addressApi,
  coupon: couponApi,
  shop: shopApi,
  admin: adminApi
};
