/**
 * 常量定义模块
 * @module utils/constants
 * @description 定义项目中使用的各种常量，包括订单状态、配送方式等
 */

// ==================== 订单状态 ====================

/**
 * 订单状态枚举
 */
const ORDER_STATUS = {
  // 待付款
  PENDING_PAYMENT: {
    code: 10,
    name: 'pending_payment',
    label: '待付款',
    color: '#FF7043',
    bgColor: '#FFF3E0',
    icon: 'clock'
  },
  // 线下支付
  OFFLINE_PAY: {
    code: 5,
    name: 'offline_pay',
    label: '线下支付',
    color: '#D4A96A',
    bgColor: '#FFF8EE',
    icon: 'dollar-sign'
  },
  // 已支付
  PAID: {
    code: 11,
    name: 'paid',
    label: '已支付',
    color: '#4ECDC4',
    bgColor: '#E0F7FA',
    icon: 'check-circle'
  },
  // 待确认
  PENDING_CONFIRM: {
    code: 15,
    name: 'pending_confirm',
    label: '待确认',
    color: '#FFA726',
    bgColor: '#FFF8E1',
    icon: 'help-circle'
  },
  // 待制作
  PENDING_MAKE: {
    code: 20,
    name: 'pending_make',
    label: '待制作',
    color: '#AB47BC',
    bgColor: '#F3E5F5',
    icon: 'cutlery'
  },
  // 制作中
  MAKING: {
    code: 25,
    name: 'making',
    label: '制作中',
    color: '#5C6BC0',
    bgColor: '#E8EAF6',
    icon: 'refresh'
  },
  // 待配送/待自提
  PENDING_DELIVERY: {
    code: 30,
    name: 'pending_delivery',
    label: '待配送',
    color: '#42A5F5',
    bgColor: '#E3F2FD',
    icon: 'package'
  },
  // 配送中
  DELIVERING: {
    code: 35,
    name: 'delivering',
    label: '配送中',
    color: '#29B6F6',
    bgColor: '#E1F5FE',
    icon: 'truck'
  },
  // 待自取
  PENDING_PICKUP: {
    code: 40,
    name: 'pending_pickup',
    label: '待自取',
    color: '#26C6DA',
    bgColor: '#E0F7FA',
    icon: 'map-pin'
  },
  // 已完成
  COMPLETED: {
    code: 50,
    name: 'completed',
    label: '已完成',
    color: '#66BB6A',
    bgColor: '#E8F5E9',
    icon: 'check-circle'
  },
  // 已取消
  CANCELLED: {
    code: 60,
    name: 'cancelled',
    label: '已取消',
    color: '#9E9E9E',
    bgColor: '#F5F5F5',
    icon: 'x-circle'
  },
  // 退款中
  REFUNDING: {
    code: 70,
    name: 'refunding',
    label: '退款中',
    color: '#EF5350',
    bgColor: '#FFEBEE',
    icon: 'rotate-ccw'
  },
  // 已退款
  REFUNDED: {
    code: 80,
    name: 'refunded',
    label: '已退款',
    color: '#BDBDBD',
    bgColor: '#EEEEEE',
    icon: 'corner-up-left'
  }
};

/**
 * 根据状态码获取订单状态
 * @param {number} code - 状态码
 * @returns {Object} 订单状态对象
 */
function getOrderStatusByCode(code, deliveryType) {
  // 处理云函数状态码与 constants 状态码的映射
  const statusMap = {
    0: ORDER_STATUS.PENDING_PAYMENT,   // 待支付
    1: ORDER_STATUS.PAID,              // 已支付
    2: ORDER_STATUS.PENDING_MAKE,      // 备餐中/待制作
    3: ORDER_STATUS.DELIVERING,        // 配送中
    4: ORDER_STATUS.COMPLETED,         // 已完成
    5: ORDER_STATUS.OFFLINE_PAY,       // 线下支付
    '-1': ORDER_STATUS.CANCELLED,      // 已取消
    '-2': ORDER_STATUS.REFUNDING,      // 退款中
    '-3': ORDER_STATUS.REFUNDED        // 已退款
  };

  // status=1(已支付) 时，根据 deliveryType 区分待自取和待配送
  if (code === 1 && deliveryType === 0) {
    return ORDER_STATUS.PENDING_PICKUP;
  }

  return statusMap[code] || ORDER_STATUS.PENDING_PAYMENT;
}

/**
 * 根据状态名获取订单状态
 * @param {string} name - 状态名
 * @returns {Object} 订单状态对象
 */
function getOrderStatusByName(name) {
  return Object.values(ORDER_STATUS).find(status => status.name === name) || ORDER_STATUS.PENDING_PAYMENT;
}

// ==================== 配送方式 ====================

/**
 * 配送方式枚举
 */
const DELIVERY_TYPE = {
  // 门店自提
  SELF_PICKUP: {
    code: 1,
    name: 'self_pickup',
    label: '门店自提',
    icon: 'store',
    desc: '到店自取，免配送费',
    fee: 0
  },
  // 商家配送
  MERCHANT_DELIVERY: {
    code: 2,
    name: 'merchant_delivery',
    label: '商家配送',
    icon: 'truck',
    desc: '配送到家，新鲜直达',
    fee: 5 // 基础配送费
  },
  // 快递配送
  EXPRESS: {
    code: 3,
    name: 'express',
    label: '快递配送',
    icon: 'package',
    desc: '全国配送，冷链运输',
    fee: 15
  }
};

/**
 * 根据配送方式码获取配送方式
 * @param {number} code - 配送方式码
 * @returns {Object} 配送方式对象
 */
function getDeliveryTypeByCode(code) {
  return Object.values(DELIVERY_TYPE).find(type => type.code === code) || DELIVERY_TYPE.SELF_PICKUP;
}

// ==================== 支付方式 ====================

/**
 * 支付方式枚举
 */
const PAYMENT_TYPE = {
  // 微信支付
  WECHAT_PAY: {
    code: 1,
    name: 'wechat_pay',
    label: '微信支付',
    icon: 'wechat'
  },
  // 余额支付
  BALANCE_PAY: {
    code: 2,
    name: 'balance_pay',
    label: '余额支付',
    icon: 'wallet'
  },
  // 到店支付
  OFFLINE_PAY: {
    code: 3,
    name: 'offline_pay',
    label: '到店支付',
    icon: 'dollar-sign'
  }
};

// ==================== 商品分类 ====================

/**
 * 商品分类枚举
 */
const PRODUCT_CATEGORY = {
  // 面包
  BREAD: {
    code: 1,
    name: 'bread',
    label: '现烤面包',
    icon: '🍞',
    sort: 1
  },
  // 蛋糕
  CAKE: {
    code: 2,
    name: 'cake',
    label: '精致蛋糕',
    icon: '🎂',
    sort: 2
  },
  // 甜点
  DESSERT: {
    code: 3,
    name: 'dessert',
    label: '甜点饮品',
    icon: '🍰',
    sort: 3
  },
  // 饼干
  COOKIE: {
    code: 4,
    name: 'cookie',
    label: '手工饼干',
    icon: '🍪',
    sort: 4
  },
  // 礼盒
  GIFT: {
    code: 5,
    name: 'gift',
    label: '礼盒套装',
    icon: '🎁',
    sort: 5
  },
  // 定制
  CUSTOM: {
    code: 6,
    name: 'custom',
    label: '定制服务',
    icon: '✨',
    sort: 6
  }
};

// ==================== 优惠券类型 ====================

/**
 * 优惠券类型枚举
 */
const COUPON_TYPE = {
  // 满减券
  FULL_REDUCTION: {
    code: 1,
    name: 'full_reduction',
    label: '满减券',
    desc: (coupon) => `满${coupon.minAmount}减${coupon.amount}`
  },
  // 折扣券
  DISCOUNT: {
    code: 2,
    name: 'discount',
    label: '折扣券',
    desc: (coupon) => `${coupon.discount}折`
  },
  // 无门槛券
  NO_THRESHOLD: {
    code: 3,
    name: 'no_threshold',
    label: '无门槛券',
    desc: (coupon) => `立减${coupon.amount}元`
  },
  // 兑换券
  EXCHANGE: {
    code: 4,
    name: 'exchange',
    label: '兑换券',
    desc: (coupon) => `兑换${coupon.giftName}`
  }
};

// ==================== 用户角色 ====================

/**
 * 用户角色枚举
 */
const USER_ROLE = {
  // 普通用户
  CUSTOMER: {
    code: 1,
    name: 'customer',
    label: '顾客',
    permissions: ['view', 'order', 'comment']
  },
  // 会员
  MEMBER: {
    code: 2,
    name: 'member',
    label: '会员',
    permissions: ['view', 'order', 'comment', 'discount']
  },
  // 员工
  STAFF: {
    code: 10,
    name: 'staff',
    label: '员工',
    permissions: ['view', 'order', 'manage_order', 'view_statistics']
  },
  // 店长
  MANAGER: {
    code: 20,
    name: 'manager',
    label: '店长',
    permissions: ['view', 'order', 'manage_order', 'manage_product', 'view_statistics', 'manage_staff']
  },
  // 管理员
  ADMIN: {
    code: 99,
    name: 'admin',
    label: '管理员',
    permissions: ['*']
  }
};

/**
 * 检查用户是否有权限
 * @param {string} role - 用户角色
 * @param {string} permission - 权限名称
 * @returns {boolean} 是否有权限
 */
function hasPermission(role, permission) {
  const roleObj = Object.values(USER_ROLE).find(r => r.name === role);
  if (!roleObj) return false;
  if (roleObj.permissions.includes('*')) return true;
  return roleObj.permissions.includes(permission);
}

// ==================== 业务常量 ====================

/**
 * 业务相关常量
 */
const BUSINESS = {
  // 店铺名称
  SHOP_NAME: '暖心烘焙',
  // 客服电话
  SERVICE_PHONE: '400-888-8888',
  // 营业时间
  BUSINESS_HOURS: {
    OPEN: '08:00',
    CLOSE: '21:00'
  },
  // 配送时间选项
  DELIVERY_TIME_SLOTS: [
    { start: '10:00', end: '12:00', label: '10:00-12:00' },
    { start: '12:00', end: '14:00', label: '12:00-14:00' },
    { start: '14:00', end: '16:00', label: '14:00-16:00' },
    { start: '16:00', end: '18:00', label: '16:00-18:00' },
    { start: '18:00', end: '20:00', label: '18:00-20:00' }
  ],
  // 起送金额
  MIN_DELIVERY_AMOUNT: 30,
  // 免配送费金额
  FREE_DELIVERY_AMOUNT: 88,
  // 基础配送费
  BASE_DELIVERY_FEE: 5,
  // 订单自动取消时间（分钟）
  ORDER_AUTO_CANCEL_MINUTES: 30,
  // 评论有效期（天）
  COMMENT_VALID_DAYS: 7
};

// ==================== 分页常量 ====================

/**
 * 分页相关常量
 */
const PAGINATION = {
  // 默认每页数量
  DEFAULT_PAGE_SIZE: 10,
  // 最大每页数量
  MAX_PAGE_SIZE: 50,
  // 首页每页数量
  HOME_PAGE_SIZE: 6,
  // 列表每页数量
  LIST_PAGE_SIZE: 10
};

// ==================== 存储键名 ====================

/**
 * 本地存储键名
 */
const STORAGE_KEYS = {
  // 用户信息
  USER_INFO: 'user_info',
  // 登录凭证
  TOKEN: 'token',
  // 购物车数据
  CART_DATA: 'cart_data',
  // 收货地址
  ADDRESS_LIST: 'address_list',
  // 默认地址ID
  DEFAULT_ADDRESS_ID: 'default_address_id',
  // 搜索历史
  SEARCH_HISTORY: 'search_history',
  // 浏览历史
  BROWSE_HISTORY: 'browse_history',
  // 优惠券
  COUPON_LIST: 'coupon_list',
  // 应用设置
  APP_SETTINGS: 'app_settings',
  // 消息通知设置
  NOTIFICATION_SETTINGS: 'notification_settings'
};

// ==================== 正则表达式 ====================

/**
 * 常用正则表达式
 */
const REGEX = {
  // 手机号
  PHONE: /^1[3-9]\d{9}$/,
  // 邮箱
  EMAIL: /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/,
  // 验证码（6位数字）
  VERIFY_CODE: /^\d{6}$/,
  // 密码（6-20位字母数字组合）
  PASSWORD: /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{6,20}$/,
  // 金额（最多2位小数）
  AMOUNT: /^\d+(\.\d{1,2})?$/,
  // 中文姓名
  CHINESE_NAME: /^[\u4e00-\u9fa5]{2,10}$/,
  // 身份证号
  ID_CARD: /^\d{15}|\d{18}$/
};

// ==================== 错误码 ====================

/**
 * 错误码定义
 */
const ERROR_CODE = {
  // 成功
  SUCCESS: { code: 0, message: '操作成功' },
  // 通用错误
  ERROR: { code: -1, message: '操作失败' },
  // 参数错误
  PARAM_ERROR: { code: 400, message: '参数错误' },
  // 未授权
  UNAUTHORIZED: { code: 401, message: '请先登录' },
  // 禁止访问
  FORBIDDEN: { code: 403, message: '没有权限' },
  // 资源不存在
  NOT_FOUND: { code: 404, message: '资源不存在' },
  // 服务器错误
  SERVER_ERROR: { code: 500, message: '服务器错误' },
  // 网络错误
  NETWORK_ERROR: { code: -100, message: '网络错误' },
  // 请求超时
  TIMEOUT: { code: -101, message: '请求超时' },
  // 取消操作
  CANCELLED: { code: -102, message: '操作已取消' }
};

// 导出常量
module.exports = {
  // 订单状态
  ORDER_STATUS,
  getOrderStatusByCode,
  getOrderStatusByName,
  
  // 配送方式
  DELIVERY_TYPE,
  getDeliveryTypeByCode,
  
  // 支付方式
  PAYMENT_TYPE,
  
  // 商品分类
  PRODUCT_CATEGORY,
  
  // 优惠券类型
  COUPON_TYPE,
  
  // 用户角色
  USER_ROLE,
  hasPermission,
  
  // 业务常量
  BUSINESS,
  
  // 分页常量
  PAGINATION,
  
  // 存储键名
  STORAGE_KEYS,
  
  // 正则表达式
  REGEX,
  
  // 错误码
  ERROR_CODE
};
