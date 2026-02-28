/**
 * 优惠券相关云函数
 * - getList: 获取优惠券列表
 * - receive: 领取优惠券
 * - getUserCoupons: 获取用户优惠券
 * - check: 检查订单可用优惠券
 */
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 主入口函数
exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'getList':
        return await getList(data)
      case 'receive':
        return await receive(OPENID, data)
      case 'getUserCoupons':
        return await getUserCoupons(OPENID, data)
      case 'check':
        return await check(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('优惠券云函数错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 获取可领取优惠券列表
 * @param {Object} data - 请求参数
 * @param {Number} data.page - 页码
 * @param {Number} data.pageSize - 每页数量
 * @param {String} data.type - 优惠券类型：newcomer(新人优惠)、limited(限时优惠)、all(全部)
 */
async function getList(data) {
  const { page = 1, pageSize = 10, type = 'all' } = data

  const now = new Date()

  // 查询可用的优惠券（基本条件：状态）
  const where = {
    status: 1
  }

  // 根据类型筛选
  // newcomer: 专属礼包优惠券 (scope: 'gift')
  // limited: 普通优惠券 (scope: 'all' 或 'product'，或没有scope字段)
  if (type === 'newcomer') {
    where.scope = 'gift'
  } else if (type === 'limited') {
    // 普通优惠券：scope为'all'或'product'，或没有scope字段（默认为all）
    where.scope = _.or([
      _.in(['all', 'product']),
      _.exists(false)
    ])
  }

  console.log('[coupon/getList] 查询条件:', where)

  // 查询列表
  const listResult = await db.collection('coupons')
    .where(where)
    .orderBy('sort', 'asc')
    .orderBy('createTime', 'desc')
    .get()

  console.log('[coupon/getList] 查询结果:', listResult.data.length, '条')

  // 过滤：时间范围和库存（数据库中时间是字符串格式，需要在代码中比较）
  const availableCoupons = listResult.data.filter(item => {
    // 检查库存
    if (item.receivedCount >= item.totalCount) return false

    // 检查时间范围（处理字符串格式的时间）
    if (item.startTime && item.endTime) {
      const startTime = new Date(item.startTime)
      const endTime = new Date(item.endTime)
      if (now < startTime || now > endTime) return false
    }

    return true
  })

  console.log('[coupon/getList] 可用优惠券:', availableCoupons.length, '条')

  // 分页处理
  const total = availableCoupons.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const list = availableCoupons.slice(start, end)

  return {
    code: 0,
    message: 'success',
    data: {
      list,
      total,
      page,
      pageSize,
      totalPage: Math.ceil(total / pageSize)
    }
  }
}

/**
 * 领取优惠券
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.couponId - 优惠券ID
 */
async function receive(openid, data) {
  if (!openid) {
    return { code: -1, message: '用户未登录' }
  }

  const { couponId } = data

  if (!couponId) {
    return { code: -1, message: '优惠券ID不能为空' }
  }

  // 查询优惠券
  const couponResult = await db.collection('coupons').doc(couponId).get()
  
  if (!couponResult.data) {
    return { code: -1, message: '优惠券不存在' }
  }

  const coupon = couponResult.data

  // 检查优惠券状态
  if (coupon.status !== 1) {
    return { code: -1, message: '优惠券已下架' }
  }

  const now = new Date()
  const startTime = new Date(coupon.startTime)
  const endTime = new Date(coupon.endTime)

  // 检查时间
  if (now < startTime) {
    return { code: -1, message: '优惠券领取未开始' }
  }

  if (now > endTime) {
    return { code: -1, message: '优惠券已过期' }
  }

  // 检查库存
  if (coupon.receivedCount >= coupon.totalCount) {
    return { code: -1, message: '优惠券已领完' }
  }

  // 检查用户是否已领取
  const existResult = await db.collection('userCoupons')
    .where({
      userId: openid,
      couponId: couponId
    })
    .get()

  if (existResult.data.length > 0) {
    return { code: -1, message: '您已领取过该优惠券' }
  }

  const serverNow = db.serverDate()

  // 事务处理
  const transaction = await db.startTransaction()

  try {
    // 1. 增加优惠券领取数量
    await transaction.collection('coupons').doc(couponId).update({
      data: {
        receivedCount: _.inc(1),
        updateTime: serverNow
      }
    })

    // 2. 创建用户优惠券记录
    const userCouponResult = await transaction.collection('userCoupons').add({
      data: {
        userId: openid,
        couponId: couponId,
        status: 0, // 0未使用
        useTime: null,
        orderId: '',
        createTime: serverNow
      }
    })

    await transaction.commit()

    return {
      code: 0,
      message: '领取成功',
      data: {
        userCouponId: userCouponResult._id,
        couponId: couponId
      }
    }

  } catch (err) {
    await transaction.rollback()
    console.error('领取优惠券事务失败:', err)
    return { code: -1, message: '领取失败: ' + err.message }
  }
}

/**
 * 获取用户优惠券列表
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {Number} data.status - 状态 0未使用 1已使用 2已过期
 */
async function getUserCoupons(openid, data) {
  if (!openid) {
    return { code: -1, message: '用户未登录' }
  }

  const { status } = data

  const where = {
    userId: openid
  }

  if (status !== undefined) {
    where.status = status
  }

  // 查询用户优惠券
  const userCouponResult = await db.collection('userCoupons')
    .where(where)
    .orderBy('createTime', 'desc')
    .get()

  const userCoupons = userCouponResult.data

  if (userCoupons.length === 0) {
    return {
      code: 0,
      message: 'success',
      data: {
        list: [],
        total: 0
      }
    }
  }

  // 获取优惠券详情
  const couponIds = userCoupons.map(uc => uc.couponId)
  const couponResult = await db.collection('coupons')
    .where({
      _id: _.in(couponIds)
    })
    .get()

  const couponMap = couponResult.data.reduce((map, c) => {
    map[c._id] = c
    return map
  }, {})

  const now = new Date()

  // 组装数据
  const list = userCoupons.map(uc => {
    const coupon = couponMap[uc.couponId]
    
    // 检查是否过期
    let actualStatus = uc.status
    if (uc.status === 0 && coupon && now > coupon.endTime) {
      actualStatus = 2 // 已过期
    }

    return {
      ...uc,
      status: actualStatus,
      coupon: coupon || null
    }
  })

  return {
    code: 0,
    message: 'success',
    data: {
      list,
      total: list.length
    }
  }
}

/**
 * 检查订单可用优惠券
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {Number} data.totalAmount - 订单总金额
 */
async function check(openid, data) {
  if (!openid) {
    return { code: -1, message: '用户未登录' }
  }

  const { totalAmount } = data

  if (totalAmount === undefined || totalAmount < 0) {
    return { code: -1, message: '订单金额不合法' }
  }

  const now = new Date()

  // 查询用户未使用的优惠券
  const userCouponResult = await db.collection('userCoupons')
    .where({
      userId: openid,
      status: 0
    })
    .get()

  const userCoupons = userCouponResult.data

  if (userCoupons.length === 0) {
    return {
      code: 0,
      message: 'success',
      data: {
        availableList: [],
        unavailableList: []
      }
    }
  }

  // 获取优惠券详情
  const couponIds = userCoupons.map(uc => uc.couponId)
  const couponResult = await db.collection('coupons')
    .where({
      _id: _.in(couponIds)
    })
    .get()

  const couponMap = couponResult.data.reduce((map, c) => {
    map[c._id] = c
    return map
  }, {})

  const availableList = []
  const unavailableList = []

  userCoupons.forEach(uc => {
    const coupon = couponMap[uc.couponId]
    
    if (!coupon) return

    // 检查是否过期
    if (now > coupon.endTime) {
      unavailableList.push({
        ...uc,
        coupon: coupon,
        reason: '已过期'
      })
      return
    }

    // 检查最低消费（兼容 minSpend 和 minAmount 两种字段名）
    const minAmount = coupon.minSpend || coupon.minAmount || 0
    if (totalAmount < minAmount) {
      unavailableList.push({
        ...uc,
        coupon: coupon,
        reason: `满${minAmount}元可用`
      })
      return
    }

    // 计算优惠金额
    let discountAmount = 0
    if (coupon.type === 0) {
      discountAmount = coupon.amount
    } else if (coupon.type === 1) {
      discountAmount = totalAmount * (1 - coupon.amount / 10)
    }

    availableList.push({
      ...uc,
      coupon: coupon,
      discountAmount: parseFloat(discountAmount.toFixed(2))
    })
  })

  // 按优惠金额排序
  availableList.sort((a, b) => b.discountAmount - a.discountAmount)

  return {
    code: 0,
    message: 'success',
    data: {
      availableList,
      unavailableList
    }
  }
}
