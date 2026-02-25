/**
 * 通用工具函数库
 * @module utils/util
 * @description 提供日期格式化、金额格式化、防抖节流等常用工具函数
 */

/**
 * 格式化日期
 * @param {Date|number|string} date - 日期对象、时间戳或日期字符串
 * @param {string} format - 格式化模板，默认 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的日期字符串
 * 
 * @example
 * formatDate(new Date(), 'YYYY-MM-DD') // '2024-01-15'
 * formatDate(1705315200000, 'HH:mm') // '08:00'
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 格式化金额
 * @param {number} amount - 金额数值
 * @param {number} decimals - 小数位数，默认 2
 * @param {boolean} showSymbol - 是否显示货币符号，默认 true
 * @returns {string} 格式化后的金额字符串
 * 
 * @example
 * formatPrice(19.9) // '¥19.90'
 * formatPrice(19.9, 0, false) // '20'
 */
function formatPrice(amount, decimals = 2, showSymbol = true) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? '¥0.00' : '0.00';
  }
  
  const num = parseFloat(amount);
  const fixed = num.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  const result = parts.join('.');
  return showSymbol ? `¥${result}` : result;
}

/**
 * 防抖函数
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒），默认 300
 * @param {boolean} immediate - 是否立即执行，默认 false
 * @returns {Function} 防抖后的函数
 * 
 * @example
 * const debouncedSearch = debounce(search, 500);
 * debouncedSearch('keyword');
 */
function debounce(fn, delay = 300, immediate = false) {
  let timer = null;
  
  return function (...args) {
    const context = this;
    
    if (timer) clearTimeout(timer);
    
    if (immediate) {
      const callNow = !timer;
      timer = setTimeout(() => {
        timer = null;
      }, delay);
      if (callNow) fn.apply(context, args);
    } else {
      timer = setTimeout(() => {
        fn.apply(context, args);
      }, delay);
    }
  };
}

/**
 * 节流函数
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 间隔时间（毫秒），默认 300
 * @returns {Function} 节流后的函数
 * 
 * @example
 * const throttledScroll = throttle(onScroll, 100);
 */
function throttle(fn, interval = 300) {
  let lastTime = 0;
  let timer = null;
  
  return function (...args) {
    const context = this;
    const now = Date.now();
    
    if (now - lastTime >= interval) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      fn.apply(context, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(context, args);
      }, interval - (now - lastTime));
    }
  };
}

/**
 * 深拷贝
 * @param {*} obj - 要拷贝的对象
 * @returns {*} 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
  return obj;
}

/**
 * 对象合并（深度）
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
  const result = deepClone(target);
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

/**
 * 生成唯一ID
 * @param {string} prefix - ID前缀
 * @returns {string} 唯一ID
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}${timestamp}${random}`;
}

/**
 * 数据存储（本地缓存）
 * @param {string} key - 键名
 * @param {*} value - 值
 * @param {number} expire - 过期时间（毫秒），默认永不过期
 */
function setStorage(key, value, expire = null) {
  const data = {
    value,
    expire: expire ? Date.now() + expire : null,
    timestamp: Date.now()
  };
  wx.setStorageSync(key, data);
}

/**
 * 获取数据（本地缓存）
 * @param {string} key - 键名
 * @param {*} defaultValue - 默认值
 * @returns {*} 存储的值
 */
function getStorage(key, defaultValue = null) {
  try {
    const data = wx.getStorageSync(key);
    if (!data) return defaultValue;
    
    // 检查是否过期
    if (data.expire && Date.now() > data.expire) {
      wx.removeStorageSync(key);
      return defaultValue;
    }
    
    return data.value;
  } catch (error) {
    console.error('获取缓存失败', error);
    return defaultValue;
  }
}

/**
 * 移除数据（本地缓存）
 * @param {string} key - 键名
 */
function removeStorage(key) {
  wx.removeStorageSync(key);
}

/**
 * 清空数据（本地缓存）
 */
function clearStorage() {
  wx.clearStorageSync();
}

/**
 * 显示加载提示
 * @param {string} title - 提示文字
 * @param {boolean} mask - 是否显示遮罩
 */
function showLoading(title = '加载中...', mask = true) {
  wx.showLoading({ title, mask });
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示Toast提示
 * @param {string} title - 提示文字
 * @param {string} icon - 图标类型：success/error/loading/none
 * @param {number} duration - 显示时长
 */
function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({ title, icon, duration });
}

/**
 * 显示模态框
 * @param {Object} options - 配置项
 * @returns {Promise} 用户操作结果
 */
function showModal(options = {}) {
  return new Promise((resolve) => {
    const defaultOptions = {
      title: '提示',
      content: '',
      showCancel: true,
      cancelText: '取消',
      confirmText: '确定',
      success: resolve
    };
    wx.showModal({ ...defaultOptions, ...options });
  });
}

/**
 * 显示操作菜单
 * @param {Array} itemList - 选项列表
 * @returns {Promise} 用户选择结果
 */
function showActionSheet(itemList) {
  return new Promise((resolve, reject) => {
    wx.showActionSheet({
      itemList,
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 页面跳转
 * @param {string} url - 页面路径
 * @param {Object} params - 跳转参数
 * @param {string} type - 跳转类型：navigate/redirect/switchTab/reLaunch/navigateBack
 */
function navigateTo(url, params = {}, type = 'navigate') {
  // 构建带参数的URL
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  switch (type) {
    case 'redirect':
      wx.redirectTo({ url: fullUrl });
      break;
    case 'switchTab':
      wx.switchTab({ url: fullUrl });
      break;
    case 'reLaunch':
      wx.reLaunch({ url: fullUrl });
      break;
    case 'navigateBack':
      wx.navigateBack({ delta: params.delta || 1 });
      break;
    default:
      wx.navigateTo({ url: fullUrl });
  }
}

/**
 * 获取页面参数
 * @returns {Object} 页面参数对象
 */
function getPageParams() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  return currentPage ? currentPage.options : {};
}

/**
 * 预览图片
 * @param {string} current - 当前图片URL
 * @param {Array} urls - 图片列表
 */
function previewImage(current, urls) {
  wx.previewImage({ current, urls });
}

/**
 * 选择图片
 * @param {Object} options - 配置项
 * @returns {Promise} 选择结果
 */
function chooseImage(options = {}) {
  const defaultOptions = {
    count: 1,
    sizeType: ['original', 'compressed'],
    sourceType: ['album', 'camera']
  };
  
  return new Promise((resolve, reject) => {
    wx.chooseImage({
      ...defaultOptions,
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 上传文件到云存储
 * @param {string} filePath - 本地文件路径
 * @param {string} cloudPath - 云存储路径
 * @returns {Promise} 上传结果
 */
function uploadToCloud(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 获取地理位置
 * @returns {Promise} 位置信息
 */
function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 选择地址
 * @returns {Promise} 地址信息
 */
function chooseAddress() {
  return new Promise((resolve, reject) => {
    wx.chooseAddress({
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 打电话
 * @param {string} phoneNumber - 电话号码
 */
function makePhoneCall(phoneNumber) {
  wx.makePhoneCall({ phoneNumber });
}

/**
 * 复制到剪贴板
 * @param {string} data - 要复制的数据
 */
function setClipboardData(data) {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data,
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 检查网络状态
 * @returns {Promise} 网络状态
 */
function getNetworkType() {
  return new Promise((resolve, reject) => {
    wx.getNetworkType({
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 监听网络状态变化
 * @param {Function} callback - 回调函数
 */
function onNetworkStatusChange(callback) {
  wx.onNetworkStatusChange(callback);
}

/**
 * 安全地解析JSON
 * @param {string} str - JSON字符串
 * @param {*} defaultValue - 解析失败时的默认值
 * @returns {*} 解析结果
 */
function safeJSONParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 数组去重
 * @param {Array} arr - 数组
 * @param {string} key - 对象数组去重时使用的键
 * @returns {Array} 去重后的数组
 */
function uniqueArray(arr, key = null) {
  if (!key) {
    return [...new Set(arr)];
  }
  const seen = new Set();
  return arr.filter(item => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

/**
 * 数组分组
 * @param {Array} arr - 数组
 * @param {Function|string} key - 分组键或函数
 * @returns {Object} 分组后的对象
 */
function groupBy(arr, key) {
  return arr.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
}

/**
 * 计算距离现在的时间
 * @param {Date|number|string} date - 日期
 * @returns {string} 相对时间字符串
 */
function timeAgo(date) {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now - d;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < week) return `${Math.floor(diff / day)}天前`;
  if (diff < month) return `${Math.floor(diff / week)}周前`;
  
  return formatDate(d, 'YYYY-MM-DD');
}

module.exports = {
  formatDate,
  formatPrice,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  generateId,
  setStorage,
  getStorage,
  removeStorage,
  clearStorage,
  showLoading,
  hideLoading,
  showToast,
  showModal,
  showActionSheet,
  navigateTo,
  getPageParams,
  previewImage,
  chooseImage,
  uploadToCloud,
  getLocation,
  chooseAddress,
  makePhoneCall,
  setClipboardData,
  getNetworkType,
  onNetworkStatusChange,
  safeJSONParse,
  uniqueArray,
  groupBy,
  timeAgo
};
