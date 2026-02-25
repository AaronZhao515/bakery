/**
 * 订单相关云函数
 * - create: 创建订单（关键：库存检查+扣减，事务处理）
 * - getList: 获取订单列表
 * - getDetail: 获取订单详情
 * - cancel: 取消订单
 * - confirmReceive: 确认收货
 */
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 订单状态常量
const ORDER_STATUS = {
  PENDING_PAY: 0,      // 待支付
  PAID: 1,             // 已支付
  PREPARING: 2,        // 备餐中
  DELIVERING: 3,       // 配送中
  COMPLETED: 4,        // 已完成
  CANCELLED: -1,       // 已取消
  REFUNDING: -2,       // 退款中
  REFUNDED: -3         // 已退款
}

// 主入口函数
exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()
  
  if (!OPENID) {
    return { code: -1, message: '用户未登录' }
  }

  try {
    switch (action) {
      case 'create':
        return await create(OPENID, data)
      case 'getList':
        return await getList(OPENID, data)
      case 'getDetail':
        return await getDetail(OPENID, data)
      case 'cancel':
        return await cancel(OPENID, data)
      case 'confirmReceive':
        return await confirmReceive(OPENID, data)
      case 'pay':
        return await pay(OPENID, data)
      case 'applyRefund':
        return await applyRefund(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('订单云函数错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 生成订单号
 * 格式：年月日时分秒 + 6位随机数
 */
function generateOrderNo() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
  
  return `${year}${month}${day}${hour}${minute}${second}${random}`
}

/**
 * 创建订单（带事务处理，防超卖）
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {Array} data.products - 商品列表 [{productId, specId, quantity}]
 * @param {String} data.addressId - 地址ID
 * @param {Number} data.deliveryType - 配送类型 0自取 1配送
 * @param {Date} data.pickupTime - 自取时间
 * @param {String} data.remark - 备注
 * @param {String} data.userCouponId - 用户优惠券ID
 */
async function create(openid, data) {
  console.log('[Order Create] 接收数据:', JSON.stringify(data))

  const { products, addressId, deliveryType = 0, pickupTime, remark, userCouponId } = data

  if (!products || products.length === 0) {
    return { code: -1, message: '商品不能为空' }
  }

  // 验证商品数据
  for (const item of products) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return { code: -1, message: '商品数据不完整' }
    }
  }

  // 获取商品信息
  const productIds = products.map(p => p.productId)
  const productResult = await db.collection('products')
    .where({
      _id: _.in(productIds)
    })
    .get()

  const productMap = productResult.data.reduce((map, p) => {
    map[p._id] = p
    return map
  }, {})

  // 检查商品状态并计算价格
  let totalAmount = 0
  const orderProducts = []

  for (const item of products) {
    const product = productMap[item.productId]

    if (!product) {
      return { code: -1, message: `商品不存在: ${item.productId}` }
    }

    if (product.status !== 1) {
      return { code: -1, message: `商品已下架: ${product.name}` }
    }

    let price = product.price
    let stock = product.stock
    let specName = ''

    // 检查规格
    if (item.specId && product.specs) {
      const spec = product.specs.find(s => s._id === item.specId || s.id === item.specId)
      if (!spec) {
        return { code: -1, message: `规格不存在: ${product.name}` }
      }
      price = spec.price
      stock = spec.stock
      specName = spec.name
    }

    // 检查库存
    if (stock < item.quantity) {
      return { code: -1, message: `库存不足: ${product.name}` }
    }

    const itemAmount = price * item.quantity
    totalAmount += itemAmount

    orderProducts.push({
      productId: item.productId,
      specId: item.specId || '',
      name: product.name,
      image: product.images && product.images[0] ? product.images[0] : '',
      specName: specName,
      price: price,
      quantity: item.quantity,
      totalAmount: itemAmount
    })
  }

  // 获取地址信息
  let address = null
  if (deliveryType === 1 && addressId) {
    const addressResult = await db.collection('addresses').doc(addressId).get()
    if (!addressResult.data) {
      return { code: -1, message: '地址不存在' }
    }
    if (addressResult.data.userId !== openid) {
      return { code: -1, message: '无权限使用该地址' }
    }
    address = addressResult.data
  }

  // 计算配送费
  let deliveryFee = deliveryType === 1 ? 5 : 0

  // 计算优惠金额
  let discountAmount = 0
  let couponId = null

  if (userCouponId) {
    console.log('[Order Create] 使用优惠券:', userCouponId)
    const userCouponResult = await db.collection('userCoupons').doc(userCouponId).get()

    if (userCouponResult.data) {
      const userCoupon = userCouponResult.data

      // 验证优惠券归属和状态
      if (userCoupon.userId === openid && userCoupon.status === 0) {
        const couponResult = await db.collection('coupons').doc(userCoupon.couponId).get()

        if (couponResult.data) {
          const coupon = couponResult.data
          const now = new Date()

          // 检查有效期和最低消费
          if (now >= new Date(coupon.startTime) && now <= new Date(coupon.endTime) && totalAmount >= coupon.minAmount) {
            if (coupon.type === 0 || coupon.discountType === 'amount') {
              // 满减券
              discountAmount = coupon.amount
            } else if (coupon.type === 1 || coupon.discountType === 'discount') {
              // 折扣券
              discountAmount = totalAmount * (1 - coupon.amount / 10)
            }
            couponId = userCoupon.couponId
            console.log('[Order Create] 优惠券有效，优惠金额:', discountAmount)
          } else {
            console.log('[Order Create] 优惠券不满足使用条件')
          }
        }
      } else {
        console.log('[Order Create] 优惠券不可用，状态:', userCoupon.status)
      }
    } else {
      console.log('[Order Create] 未找到优惠券记录')
    }
  }

  // 计算实付金额
  let payAmount = totalAmount + deliveryFee - discountAmount
  if (payAmount < 0) payAmount = 0

  // 获取用户积分信息
  const userResult = await db.collection('users').where({ openid }).get()
  const user = userResult.data[0] || {}
  const userPoints = user.points || 0

  // 计算所需积分（1元 = 1积分）
  const requiredPoints = Math.ceil(payAmount)

  // 检查积分是否足够
  const hasEnoughPoints = userPoints >= requiredPoints

  // 生成订单号
  const orderNo = generateOrderNo()

  const now = db.serverDate()

  // 创建订单数据
  const orderData = {
    orderNo: orderNo,
    userId: openid,
    status: ORDER_STATUS.PENDING_PAY,
    products: orderProducts,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    deliveryFee: deliveryFee,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    payAmount: parseFloat(payAmount.toFixed(2)),
    address: address || {},
    deliveryType: deliveryType,
    pickupTime: pickupTime || '',
    remark: remark || '',
    couponId: couponId || '',
    userCouponId: userCouponId || '',
    // 积分相关字段
    requiredPoints: requiredPoints,
    userPoints: userPoints,
    hasEnoughPoints: hasEnoughPoints,
    pointsDeducted: 0,
    payTime: null,
    deliverTime: null,
    completeTime: null,
    createTime: now,
    updateTime: now
  }

  console.log('[Order Create] 订单数据:', JSON.stringify(orderData))

  // ========== 事务处理开始 ==========
  const transaction = await db.startTransaction()

  try {
    // 1. 扣减库存
    for (const item of products) {
      const product = productMap[item.productId]
      
      if (item.specId && product.specs) {
        // 扣减规格库存
        const specIndex = product.specs.findIndex(s => s._id === item.specId || s.id === item.specId)
        if (specIndex >= 0) {
          await transaction.collection('products').doc(item.productId).update({
            data: {
              [`specs.${specIndex}.stock`]: _.inc(-item.quantity),
              sales: _.inc(item.quantity),
              updateTime: now
            }
          })
        }
      } else {
        // 扣减商品库存
        await transaction.collection('products').doc(item.productId).update({
          data: {
            stock: _.inc(-item.quantity),
            sales: _.inc(item.quantity),
            updateTime: now
          }
        })
      }
    }

    // 2. 创建订单
    const orderResult = await transaction.collection('orders').add({
      data: orderData
    })

    // 3. 如果使用优惠券，标记为已使用
    if (userCouponId) {
      await transaction.collection('userCoupons').doc(userCouponId).update({
        data: {
          status: 1,
          useTime: now,
          orderId: orderResult._id
        }
      })
    }

    // 4. 清空购物车中已购买的商品
    for (const item of products) {
      await transaction.collection('cart').where({
        userId: openid,
        productId: item.productId,
        specId: item.specId || ''
      }).remove()
    }

    // 提交事务
    await transaction.commit()

    return {
      code: 0,
      message: '订单创建成功',
      data: {
        orderId: orderResult._id,
        orderNo: orderNo,
        payAmount: payAmount,
        requiredPoints: requiredPoints,
        userPoints: userPoints,
        hasEnoughPoints: hasEnoughPoints
      }
    }

  } catch (err) {
    // 回滚事务
    await transaction.rollback()
    console.error('创建订单事务失败:', err)
    return { code: -1, message: '订单创建失败: ' + err.message }
  }
}

/**
 * 获取订单列表
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {Number} data.status - 订单状态
 * @param {Number} data.page - 页码
 * @param {Number} data.pageSize - 每页数量
 */
async function getList(openid, data) {
  const { status, page = 1, pageSize = 10 } = data

  const where = {
    userId: openid
  }

  if (status !== undefined) {
    where.status = status
  }

  // 查询总数
  const countResult = await db.collection('orders').where(where).count()
  const total = countResult.total

  // 查询列表
  const listResult = await db.collection('orders')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    code: 0,
    message: 'success',
    data: {
      list: listResult.data,
      total,
      page,
      pageSize,
      totalPage: Math.ceil(total / pageSize)
    }
  }
}

/**
 * 获取订单详情
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.orderId - 订单ID
 */
async function getDetail(openid, data) {
  const { orderId } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  const orderResult = await db.collection('orders').doc(orderId).get()

  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const order = orderResult.data

  // 验证用户权限
  if (order.userId !== openid) {
    return { code: -1, message: '无权限查看' }
  }

  return {
    code: 0,
    message: 'success',
    data: order
  }
}

/**
 * 取消订单
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.orderId - 订单ID
 */
async function cancel(openid, data) {
  const { orderId } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  const orderResult = await db.collection('orders').doc(orderId).get()

  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const order = orderResult.data

  // 验证用户权限
  if (order.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  // 只能取消待支付订单
  if (order.status !== ORDER_STATUS.PENDING_PAY) {
    return { code: -1, message: '订单状态不允许取消' }
  }

  const now = db.serverDate()

  // 事务处理：恢复库存
  const transaction = await db.startTransaction()

  try {
    // 1. 恢复库存
    for (const item of order.products) {
      const productResult = await transaction.collection('products').doc(item.productId).get()
      const product = productResult.data

      if (item.specId && product.specs) {
        // 恢复规格库存
        const specIndex = product.specs.findIndex(s => s._id === item.specId || s.id === item.specId)
        if (specIndex >= 0) {
          await transaction.collection('products').doc(item.productId).update({
            data: {
              [`specs.${specIndex}.stock`]: _.inc(item.quantity),
              sales: _.inc(-item.quantity),
              updateTime: now
            }
          })
        }
      } else {
        // 恢复商品库存
        await transaction.collection('products').doc(item.productId).update({
          data: {
            stock: _.inc(item.quantity),
            sales: _.inc(-item.quantity),
            updateTime: now
          }
        })
      }
    }

    // 2. 如果使用优惠券，恢复优惠券
    if (order.userCouponId) {
      await transaction.collection('userCoupons').doc(order.userCouponId).update({
        data: {
          status: 0,
          useTime: null,
          orderId: null
        }
      })
    }

    // 3. 更新订单状态
    await transaction.collection('orders').doc(orderId).update({
      data: {
        status: ORDER_STATUS.CANCELLED,
        updateTime: now
      }
    })

    await transaction.commit()

    return {
      code: 0,
      message: '订单取消成功'
    }

  } catch (err) {
    await transaction.rollback()
    console.error('取消订单事务失败:', err)
    return { code: -1, message: '取消订单失败: ' + err.message }
  }
}

/**
 * 确认收货
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.orderId - 订单ID
 */
async function confirmReceive(openid, data) {
  const { orderId } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  const orderResult = await db.collection('orders').doc(orderId).get()

  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const order = orderResult.data

  // 验证用户权限
  if (order.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  // 只能确认配送中的订单
  if (order.status !== ORDER_STATUS.DELIVERING) {
    return { code: -1, message: '订单状态不允许确认收货' }
  }

  const now = db.serverDate()

  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    data: {
      status: ORDER_STATUS.COMPLETED,
      completeTime: now,
      updateTime: now
    }
  })

  return {
    code: 0,
    message: '确认收货成功'
  }
}

/**
 * 支付订单
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.orderId - 订单ID
 */
async function pay(openid, data) {
  const { orderId } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  const orderResult = await db.collection('orders').doc(orderId).get()

  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const order = orderResult.data

  // 验证用户权限
  if (order.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  // 只能支付待支付订单
  if (order.status !== ORDER_STATUS.PENDING_PAY) {
    return { code: -1, message: '订单状态不允许支付' }
  }

  // 检查积分是否足够
  if (!order.hasEnoughPoints) {
    return { code: -1, message: '积分不足，无法支付' }
  }

  const now = db.serverDate()
  const requiredPoints = order.requiredPoints || 0

  // 使用事务处理积分扣减和订单状态更新
  const transaction = await db.startTransaction()

  try {
    // 1. 扣减用户积分
    await transaction.collection('users').where({ openid }).update({
      data: {
        points: _.inc(-requiredPoints),
        updateTime: now
      }
    })

    // 2. 更新订单状态为已支付
    await transaction.collection('orders').doc(orderId).update({
      data: {
        status: ORDER_STATUS.PAID,
        payTime: now,
        pointsDeducted: requiredPoints,
        updateTime: now
      }
    })

    // 提交事务
    await transaction.commit()

    return {
      code: 0,
      message: '支付成功',
      data: {
        orderId,
        payTime: new Date(),
        pointsDeducted: requiredPoints
      }
    }
  } catch (err) {
    await transaction.rollback()
    console.error('[Order Pay] 支付事务失败:', err)
    return { code: -1, message: '支付失败: ' + err.message }
  }
}

/**
 * 申请退款
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.orderId - 订单ID
 * @param {String} data.reason - 退款原因
 */
async function applyRefund(openid, data) {
  const { orderId, reason } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  if (!reason) {
    return { code: -1, message: '退款原因不能为空' }
  }

  const orderResult = await db.collection('orders').doc(orderId).get()

  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const order = orderResult.data

  // 验证用户权限
  if (order.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  // 只能退款已支付或备餐中的订单
  if (order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.PREPARING) {
    return { code: -1, message: '订单状态不允许退款' }
  }

  const now = db.serverDate()

  // 更新订单状态为退款中
  await db.collection('orders').doc(orderId).update({
    data: {
      status: ORDER_STATUS.REFUNDING,
      refundReason: reason,
      refundApplyTime: now,
      updateTime: now
    }
  })

  return {
    code: 0,
    message: '退款申请已提交',
    data: {
      orderId,
      refundApplyTime: new Date()
    }
  }
}
