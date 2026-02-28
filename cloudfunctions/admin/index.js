/**
 * 管理端云函数
 * - login: 管理员登录
 * - productCRUD: 商品增删改查
 * - orderManage: 订单管理
 * - getStatistics: 获取统计数据
 * - updateStock: 更新库存
 */
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

// 订单状态常量
const ORDER_STATUS = {
  PENDING_PAY: 0,  // 待支付
  PAID: 1,         // 已支付，待制作
  PREPARING: 2,    // 制作中
  DELIVERING: 3,   // 配送中
  COMPLETED: 4,    // 已完成
  CANCELLED: -1,   // 已取消
  REFUNDING: -2,   // 退款中
  REFUNDED: -3     // 已退款
}

// 管理员openid列表（实际项目中应从数据库或配置文件读取）
const ADMIN_OPENIDS = ['ADMIN_OPENID_1', 'ADMIN_OPENID_2']

// 主入口函数
exports.main = async (event, context) => {
  const { action } = event
  // 支持两种参数格式：
  // 1. { action, data: { operation, ... } }
  // 2. { action, operation, ... }
  let data = event.data
  if (!data) {
    // 格式2：提取除了 action 之外的其他参数
    data = {}
    const keys = ['operation', 'productId', 'productData', 'page', 'pageSize', 'status',
                  'categoryId', 'keyword', 'orderId', 'orderData', 'stock', 'specId',
                  'startDate', 'endDate', 'userId', 'points', 'reason', 'operator',
                  'couponId', 'name', 'type', 'value', 'minSpend', 'totalCount',
                  'limitPerUser', 'startTime', 'endTime', 'scope', 'description',
                  'statusList', 'deliverymanId', 'settings', 'initType', 'sortDesc',
                  'remark', 'isDailyLimit', 'dailyLimit', 'sort', 'images', 'specs',
                  'originalPrice', 'categoryName', 'recordType', 'recordRemark', 'period', 'limit',
                  'role', 'userData']
    keys.forEach(key => {
      if (event[key] !== undefined) data[key] = event[key]
    })
  }
  const { OPENID } = cloud.getWXContext()

  // 添加调试日志
  console.log('[Admin] 收到请求:', { action, data, OPENID })

  try {
    switch (action) {
      case 'login':
        return await login(OPENID, data)
      case 'productCRUD':
        return await checkAdmin(OPENID) && await productCRUD(data)
      case 'orderManage':
        return await checkAdmin(OPENID) && await orderManage(data)
      case 'getStatistics':
        return await checkAdmin(OPENID) && await getStatistics(data)
      case 'updateStock':
        return await checkAdmin(OPENID) && await updateStock(data)
      case 'getUserList':
        return await checkAdmin(OPENID) && await getUserList(data)
      case 'userManage':
        return await checkAdmin(OPENID) && await userManage(data)
      case 'updateOrderStatus':
        return await checkAdmin(OPENID) && await updateOrderStatus(data)
      case 'cancelOrder':
        return await checkAdmin(OPENID) && await cancelOrder(data, OPENID)
      case 'couponManage':
        return await checkAdmin(OPENID) && await couponManage(data)
      case 'pointsManage':
        return await checkAdmin(OPENID) && await pointsManage(data)
      case 'deliveryManage':
        return await checkAdmin(OPENID) && await deliveryManage(data)
      case 'shopSettings':
        return await checkAdmin(OPENID) && await shopSettings(data)
      case 'initDatabase':
        return await checkAdmin(OPENID) && await initDatabase(data)
      case 'stockRecordManage':
        return await checkAdmin(OPENID) && await stockRecordManage(data)
      case 'getSalesTrend':
        return await checkAdmin(OPENID) && await getSalesTrend(data)
      case 'getTimeAnalysis':
        return await checkAdmin(OPENID) && await getTimeAnalysis(data)
      case 'getProductRanking':
        return await checkAdmin(OPENID) && await getProductRanking(data)
      case 'getDataInsights':
        return await checkAdmin(OPENID) && await getDataInsights(data)
      case 'categoryManage':
        return await checkAdmin(OPENID) && await categoryManage(data)
      case 'deleteCloudFile':
        return await checkAdmin(OPENID) && await deleteCloudFile(data)
      default:
        return { code: -1, message: `未知操作: ${action}` }
    }
  } catch (err) {
    console.error('管理端云函数错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 检查管理员权限
 * @param {String} openid - 用户openid
 */
async function checkAdmin(openid) {
  // 查询用户是否为管理员
  const userResult = await db.collection('users')
    .where({
      openid: openid,
      isAdmin: true
    })
    .get()

  if (userResult.data.length === 0) {
    throw new Error('无管理员权限')
  }
  
  return true
}

/**
 * 管理员登录
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 */
async function login(openid, data) {
  if (!openid) {
    return { code: -1, message: '请先登录小程序' }
  }

  // 查询用户
  const userResult = await db.collection('users')
    .where({
      openid: openid
    })
    .get()

  if (userResult.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }

  const user = userResult.data[0]

  // 检查是否为管理员
  if (!user.isAdmin) {
    return { code: -1, message: '无管理员权限' }
  }

  return {
    code: 0,
    message: '登录成功',
    data: {
      userId: user._id,
      nickName: user.nickName,
      isAdmin: user.isAdmin
    }
  }
}

/**
 * 商品增删改查
 * @param {Object} data - 请求参数
 */
async function productCRUD(data) {
  const { operation, productId, productData } = data

  const now = db.serverDate()

  switch (operation) {
    case 'create':
      // 创建商品
      if (!productData.name || productData.price === undefined) {
        return { code: -1, message: '商品名称和价格不能为空' }
      }

      const newProduct = {
        name: productData.name,
        categoryId: productData.categoryId || '',
        description: productData.description || '',
        images: productData.images || [],
        image: productData.images && productData.images.length > 0 ? productData.images[0] : '', // 主图，兼容旧代码
        price: productData.price,
        originalPrice: productData.originalPrice || productData.price,
        stock: productData.stock || 0,
        stockWarning: productData.stockWarning || 10,
        specs: productData.specs || [],
        sales: 0,
        status: productData.status !== undefined ? productData.status : 1,
        isDailyLimit: productData.isDailyLimit || false,
        dailyLimit: productData.dailyLimit || 0,
        sort: productData.sort || 0,
        createTime: now,
        updateTime: now
      }

      const createResult = await db.collection('products').add({
        data: newProduct
      })

      return {
        code: 0,
        message: '创建成功',
        data: { productId: createResult._id }
      }

    case 'update':
      // 更新商品
      if (!productId) {
        return { code: -1, message: '商品ID不能为空' }
      }

      const updateData = { updateTime: now }

      if (productData.name !== undefined) updateData.name = productData.name
      if (productData.categoryId !== undefined) updateData.categoryId = productData.categoryId
      if (productData.description !== undefined) updateData.description = productData.description
      if (productData.images !== undefined) {
        updateData.images = productData.images
        // 同时更新单数形式的 image 字段，保持与旧代码兼容
        updateData.image = productData.images.length > 0 ? productData.images[0] : ''
      }
      if (productData.price !== undefined) updateData.price = productData.price
      if (productData.originalPrice !== undefined) updateData.originalPrice = productData.originalPrice
      if (productData.stock !== undefined) updateData.stock = productData.stock
      if (productData.stockWarning !== undefined) updateData.stockWarning = productData.stockWarning
      if (productData.specs !== undefined) updateData.specs = productData.specs
      if (productData.status !== undefined) updateData.status = productData.status
      if (productData.isDailyLimit !== undefined) updateData.isDailyLimit = productData.isDailyLimit
      if (productData.dailyLimit !== undefined) updateData.dailyLimit = productData.dailyLimit
      if (productData.sort !== undefined) updateData.sort = productData.sort

      await db.collection('products').doc(productId).update({
        data: updateData
      })

      return {
        code: 0,
        message: '更新成功',
        data: { productId }
      }

    case 'delete':
      // 删除商品
      if (!productId) {
        return { code: -1, message: '商品ID不能为空' }
      }

      await db.collection('products').doc(productId).remove()

      return {
        code: 0,
        message: '删除成功'
      }

    case 'get':
      // 获取商品详情
      if (!productId) {
        return { code: -1, message: '商品ID不能为空' }
      }

      const productResult = await db.collection('products').doc(productId).get()

      if (!productResult.data) {
        return { code: -1, message: '商品不存在' }
      }

      return {
        code: 0,
        message: 'success',
        data: productResult.data
      }

    case 'list':
      // 获取商品列表
      const { page = 1, pageSize = 20, status, categoryId, keyword, sortBy = 'updateTime' } = data

      const where = {}
      if (status !== undefined) where.status = status
      if (categoryId) where.categoryId = categoryId
      if (keyword) {
        where.name = db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      }

      // 构建排序条件
      let orderByField = 'updateTime'
      let orderByDirection = 'desc'

      if (sortBy === 'createTime') {
        orderByField = 'createTime'
        orderByDirection = 'desc'
      } else if (sortBy === 'sort') {
        orderByField = 'sort'
        orderByDirection = 'asc'
      }

      const countResult = await db.collection('products').where(where).count()
      const listResult = await db.collection('products')
        .where(where)
        .orderBy(orderByField, orderByDirection)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      return {
        code: 0,
        message: 'success',
        data: {
          list: listResult.data,
          total: countResult.total,
          page,
          pageSize
        }
      }

    default:
      return { code: -1, message: '未知操作' }
  }
}

/**
 * 订单管理
 * @param {Object} data - 请求参数
 */
async function orderManage(data) {
  const { operation, orderId, orderData } = data

  switch (operation) {
    case 'list':
      // 获取订单列表
      const { 
        page = 1, 
        pageSize = 20, 
        status, 
        orderNo, 
        userId,
        startDate,
        endDate
      } = data

      const where = {}
      if (status !== undefined) where.status = status
      if (orderNo) where.orderNo = orderNo
      if (userId) where.userId = userId
      if (startDate && endDate) {
        // 将日期字符串转换为 Date 对象
        // startDate 格式: YYYY-MM-DD
        const startDateObj = new Date(startDate + 'T00:00:00.000+08:00')
        const endDateObj = new Date(endDate + 'T23:59:59.999+08:00')
        where.createTime = _.gte(startDateObj).lte(endDateObj)
        console.log('[订单查询] 日期范围:', { startDate, endDate, startDateObj: startDateObj.toISOString(), endDateObj: endDateObj.toISOString() })
      }

      const countResult = await db.collection('orders').where(where).count()
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
          total: countResult.total,
          page,
          pageSize
        }
      }

    case 'get':
      // 获取订单详情
      if (!orderId) {
        return { code: -1, message: '订单ID不能为空' }
      }

      const orderResult = await db.collection('orders').doc(orderId).get()

      if (!orderResult.data) {
        return { code: -1, message: '订单不存在' }
      }

      return {
        code: 0,
        message: 'success',
        data: orderResult.data
      }

    default:
      return { code: -1, message: '未知操作' }
  }
}

/**
 * 更新订单状态
 * @param {Object} data - 请求参数
 */
async function updateOrderStatus(data) {
  const { orderId, status, remark } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  if (status === undefined) {
    return { code: -1, message: '状态不能为空' }
  }

  const orderResult = await db.collection('orders').doc(orderId).get()

  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const now = db.serverDate()
  const updateData = {
    status: status,
    updateTime: now
  }

  // 根据状态设置对应的时间字段
  if (status === ORDER_STATUS.PREPARING) {
    updateData.prepareTime = now
  } else if (status === ORDER_STATUS.DELIVERING) {
    updateData.deliverTime = now
  } else if (status === ORDER_STATUS.COMPLETED) {
    updateData.completeTime = now
  }

  // 记录操作日志
  await db.collection('adminLogs').add({
    data: {
      type: 'order',
      action: 'updateStatus',
      orderId: orderId,
      oldStatus: orderResult.data.status,
      newStatus: status,
      remark: remark || '',
      createTime: now,
      operator: cloud.getWXContext().OPENID
    }
  })

  if (remark) {
    updateData.adminRemark = remark
  }

  await db.collection('orders').doc(orderId).update({
    data: updateData
  })

  return {
    code: 0,
    message: '状态更新成功',
    data: { orderId, status }
  }
}

/**
 * 取消订单（管理员）
 * 包含完整的库存恢复、优惠券返还、积分退还逻辑
 * @param {Object} data - 请求参数
 * @param {String} operatorOpenid - 操作人openid
 */
async function cancelOrder(data, operatorOpenid) {
  const { orderId, remark } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  const orderResult = await db.collection('orders').doc(orderId).get()

  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const order = orderResult.data

  // 已完成、已取消、退款中、已退款的订单不能取消
  const cannotCancelStatuses = [
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.REFUNDING,
    ORDER_STATUS.REFUNDED
  ]
  if (cannotCancelStatuses.includes(order.status)) {
    return { code: -1, message: '订单状态不允许取消' }
  }

  const now = db.serverDate()

  // 判断是否已支付（需要退款/返还积分）
  const isPaid = order.status === ORDER_STATUS.PAID ||
                 order.status === ORDER_STATUS.PREPARING ||
                 order.status === ORDER_STATUS.DELIVERING ||
                 order.payType === 'points' ||
                 order.payType === 'offline'

  // 事务处理：恢复库存、退还积分、退还优惠券
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

    // 3. 如果已支付（积分支付），退还积分
    let refundedPoints = 0
    if (isPaid && order.pointsDeducted > 0) {
      refundedPoints = order.pointsDeducted

      // 查询用户当前积分
      const userResult = await transaction.collection('users').where({ openid: order.userId }).get()
      const user = userResult.data[0]
      const currentPoints = user ? (user.points || 0) : 0
      const newBalance = currentPoints + refundedPoints

      // 退还积分到用户账户
      if (user) {
        await transaction.collection('users').doc(user._id).update({
          data: {
            points: newBalance,
            updateTime: now
          }
        })
      }

      // 创建积分返还记录
      await transaction.collection('pointsHistory').add({
        data: {
          userId: order.userId,
          label: '订单取消返还（管理员）',
          desc: `订单 ${order.orderNo} 被管理员取消，积分返还`,
          points: refundedPoints,
          type: 'earn',
          category: 'refund',
          balance: newBalance,
          orderId: orderId,
          orderNo: order.orderNo,
          createTime: now
        }
      })
    }

    // 4. 更新订单状态
    await transaction.collection('orders').doc(orderId).update({
      data: {
        status: ORDER_STATUS.CANCELLED,
        cancelTime: now,
        cancelReason: remark || '管理员取消',
        refundedPoints: refundedPoints,
        updateTime: now,
        adminRemark: remark || ''
      }
    })

    // 5. 记录管理员操作日志
    await transaction.collection('adminLogs').add({
      data: {
        type: 'order',
        action: 'cancelOrder',
        orderId: orderId,
        oldStatus: order.status,
        newStatus: ORDER_STATUS.CANCELLED,
        remark: remark || '',
        refundedPoints: refundedPoints,
        createTime: now,
        operator: operatorOpenid
      }
    })

    await transaction.commit()

    return {
      code: 0,
      message: '订单取消成功',
      data: {
        orderId,
        status: ORDER_STATUS.CANCELLED,
        refundedPoints: refundedPoints,
        refundedCoupon: !!order.userCouponId
      }
    }

  } catch (err) {
    await transaction.rollback()
    console.error('[Admin CancelOrder] 取消订单事务失败:', err)
    return { code: -1, message: '取消订单失败: ' + err.message }
  }
}

/**
 * 获取统计数据
 * @param {Object} data - 请求参数
 */
async function getStatistics(data) {
  const { startDate, endDate } = data

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  // 今日订单统计
  const todayOrderResult = await db.collection('orders')
    .where({
      createTime: _.gte(today),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .count()

  // 今日销售额
  const todaySalesResult = await db.collection('orders')
    .where({
      createTime: _.gte(today),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  const todaySales = todaySalesResult.data.reduce((sum, order) => sum + order.payAmount, 0)

  // 昨日销售额
  const yesterdaySalesResult = await db.collection('orders')
    .where({
      createTime: _.gte(yesterday).and(_.lt(today)),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  const yesterdaySales = yesterdaySalesResult.data.reduce((sum, order) => sum + order.payAmount, 0)

  // 本周销售额
  const weekSalesResult = await db.collection('orders')
    .where({
      createTime: _.gte(weekAgo),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  const weekSales = weekSalesResult.data.reduce((sum, order) => sum + order.payAmount, 0)

  // 本月销售额
  const monthSalesResult = await db.collection('orders')
    .where({
      createTime: _.gte(monthAgo),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  const monthSales = monthSalesResult.data.reduce((sum, order) => sum + order.payAmount, 0)
  const monthOrders = monthSalesResult.data.length

  // 年度销售额
  const yearStart = new Date(today.getFullYear(), 0, 1)
  const yearSalesResult = await db.collection('orders')
    .where({
      createTime: _.gte(yearStart),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  const yearSales = yearSalesResult.data.reduce((sum, order) => sum + order.payAmount, 0)
  const yearOrders = yearSalesResult.data.length

  // 待处理订单数
  const pendingOrderResult = await db.collection('orders')
    .where({
      status: ORDER_STATUS.PAID
    })
    .count()

  // 商品总数
  const productResult = await db.collection('products').count()

  // 库存预警商品 - 使用聚合查询比较 stock 和 stockWarning
  const stockWarningAggResult = await db.collection('products')
    .aggregate()
    .match({
      $expr: { $lte: ['$stock', '$stockWarning'] }
    })
    .count('count')
    .end()

  const stockWarningCount = stockWarningAggResult.list[0]?.count || 0

  // 已售罄商品 - stock <= 0
  const outOfStockResult = await db.collection('products')
    .where({
      stock: _.lte(0)
    })
    .count()

  // 用户总数
  const userResult = await db.collection('users').count()

  return {
    code: 0,
    message: 'success',
    data: {
      today: {
        orderCount: todayOrderResult.total,
        salesAmount: parseFloat(todaySales.toFixed(2))
      },
      yesterday: {
        salesAmount: parseFloat(yesterdaySales.toFixed(2))
      },
      week: {
        salesAmount: parseFloat(weekSales.toFixed(2)),
        orderCount: weekSalesResult.data.length
      },
      month: {
        salesAmount: parseFloat(monthSales.toFixed(2)),
        orderCount: monthOrders
      },
      year: {
        salesAmount: parseFloat(yearSales.toFixed(2)),
        orderCount: yearOrders
      },
      pendingOrderCount: pendingOrderResult.total,
      productCount: productResult.total,
      stockWarningCount: stockWarningCount,
      outOfStockCount: outOfStockResult.total,
      userCount: userResult.total
    }
  }
}

/**
 * 更新库存
 * @param {Object} data - 请求参数
 */
async function updateStock(data) {
  const { productId, stock, specId, recordType, recordRemark, operator } = data

  if (!productId) {
    return { code: -1, message: '商品ID不能为空' }
  }

  if (stock === undefined || stock < 0) {
    return { code: -1, message: '库存数量不合法' }
  }

  const now = db.serverDate()
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 获取商品信息（用于记录）
  const productResult = await db.collection('products').doc(productId).get()
  const product = productResult.data

  if (!product) {
    return { code: -1, message: '商品不存在' }
  }

  const oldStock = product.stock || 0
  const changeQuantity = stock - oldStock

  // 判断是入库还是出库
  const type = changeQuantity > 0 ? 'in' : 'out'
  const absQuantity = Math.abs(changeQuantity)

  if (specId) {
    // 更新规格库存
    const specIndex = product.specs.findIndex(s => s._id === specId || s.id === specId)
    if (specIndex < 0) {
      return { code: -1, message: '规格不存在' }
    }

    await db.collection('products').doc(productId).update({
      data: {
        [`specs.${specIndex}.stock`]: stock,
        updateTime: now
      }
    })
  } else {
    // 更新商品库存
    await db.collection('products').doc(productId).update({
      data: {
        stock: stock,
        updateTime: now
      }
    })
  }

  // 记录库存操作
  if (changeQuantity !== 0) {
    try {
      await db.collection('stockRecords').add({
        data: {
          productId: productId,
          productName: product.name,
          type: type,
          operationType: recordType || (type === 'in' ? 'adjust' : 'sale'),
          quantity: absQuantity,
          beforeStock: oldStock,
          afterStock: stock,
          remark: recordRemark || '',
          operator: operator || '管理员',
          operatorId: openid,
          createTime: now
        }
      })
    } catch (err) {
      console.error('记录库存操作失败:', err)
      // 不影响主流程，继续返回成功
    }
  }

  return {
    code: 0,
    message: '库存更新成功',
    data: { productId, stock, changeQuantity }
  }
}

/**
 * 库存记录管理
 * @param {Object} data - 请求参数
 */
async function stockRecordManage(data) {
  const { operation } = data
  const now = db.serverDate()

  switch (operation) {
    case 'list':
      // 获取库存记录列表
      const { page = 1, pageSize = 20, productId, type, startDate, endDate } = data

      const where = {}
      if (productId) where.productId = productId
      if (type) where.type = type
      if (startDate && endDate) {
        where.createTime = _.gte(new Date(startDate)).and(_.lt(new Date(endDate + 'T23:59:59')))
      }

      const countResult = await db.collection('stockRecords').where(where).count()
      const listResult = await db.collection('stockRecords')
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
          total: countResult.total,
          page,
          pageSize
        }
      }

    default:
      return { code: -1, message: '未知操作' }
  }
}

/**
 * 获取用户列表
 * @param {Object} data - 请求参数
 */
async function getUserList(data) {
  const { page = 1, pageSize = 20, keyword } = data

  const where = {}
  if (keyword) {
    where.$or = [
      { nickName: db.RegExp({ regexp: keyword, options: 'i' }) },
      { phone: db.RegExp({ regexp: keyword, options: 'i' }) }
    ]
  }

  const countResult = await db.collection('users').where(where).count()
  const listResult = await db.collection('users')
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
      total: countResult.total,
      page,
      pageSize
    }
  }
}

/**
 * 优惠券管理
 * @param {Object} data - 请求参数
 */
async function couponManage(data) {
  const { operation } = data
  const now = db.serverDate()

  switch (operation) {
    case 'getStats':
      // 获取优惠券统计
      const totalResult = await db.collection('coupons').count()
      const nowStats = new Date()
      const nowStatsStr = nowStats.toISOString()

      const activeResult = await db.collection('coupons')
        .where({
          startTime: _.lte(nowStatsStr),
          endTime: _.gte(nowStatsStr)
        })
        .count()

      const expiredResult = await db.collection('coupons')
        .where({
          endTime: _.lt(nowStatsStr)
        })
        .count()

      // 统计总领取数量
      const userCouponResult = await db.collection('userCoupons').count()

      return {
        code: 0,
        data: {
          total: totalResult.total,
          active: activeResult.total,
          expired: expiredResult.total,
          totalReceived: userCouponResult.total
        }
      }

    case 'list':
      // 获取优惠券列表
      const { page = 1, pageSize = 20, keyword, status } = data
      const where = {}

      if (keyword) {
        where.name = db.RegExp({ regexp: keyword, options: 'i' })
      }

      if (status) {
        // 使用字符串格式的当前日期（ISO 8601）
        const now = new Date()
        const nowStr = now.toISOString()

        if (status === 'active') {
          // 进行中：已开始且未结束
          where.startTime = _.lte(nowStr)
          where.endTime = _.gte(nowStr)
        } else if (status === 'pending') {
          // 未开始：开始时间在当前时间之后
          where.startTime = _.gt(nowStr)
        } else if (status === 'expired') {
          // 已结束：结束时间早于当前时间
          where.endTime = _.lt(nowStr)
        }
      }

      const countResult = await db.collection('coupons').where(where).count()
      const listResult = await db.collection('coupons')
        .where(where)
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      return {
        code: 0,
        data: {
          list: listResult.data,
          total: countResult.total,
          page,
          pageSize
        }
      }

    case 'create':
      // 创建优惠券
      const newCoupon = {
        name: data.name,
        type: data.type,
        value: data.value,
        minSpend: data.minSpend || 0,
        totalCount: data.totalCount || 0,
        limitPerUser: data.limitPerUser || 1,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime + 'T23:59:59'),
        scope: data.scope || 'all',
        description: data.description || '',
        selectedProducts: data.selectedProducts || [],
        receivedCount: 0,
        usedCount: 0,
        createTime: now,
        updateTime: now
      }

      const createResult = await db.collection('coupons').add({
        data: newCoupon
      })

      return {
        code: 0,
        message: '创建成功',
        data: { couponId: createResult._id }
      }

    case 'update':
      // 更新优惠券
      if (!data.couponId) {
        return { code: -1, message: '优惠券ID不能为空' }
      }

      const updateData = {
        name: data.name,
        type: data.type,
        value: data.value,
        minSpend: data.minSpend || 0,
        totalCount: data.totalCount || 0,
        limitPerUser: data.limitPerUser || 1,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime + 'T23:59:59'),
        scope: data.scope || 'all',
        description: data.description || '',
        selectedProducts: data.selectedProducts || [],
        updateTime: now
      }

      await db.collection('coupons').doc(data.couponId).update({
        data: updateData
      })

      return {
        code: 0,
        message: '更新成功'
      }

    case 'delete':
      // 删除优惠券
      if (!data.couponId) {
        return { code: -1, message: '优惠券ID不能为空' }
      }

      await db.collection('coupons').doc(data.couponId).remove()

      return {
        code: 0,
        message: '删除成功'
      }

    case 'distribute':
      // 发放优惠券给指定用户
      const { couponId, userId, count = 1 } = data

      if (!couponId) {
        return { code: -1, message: '优惠券ID不能为空' }
      }

      if (!userId) {
        return { code: -1, message: '用户ID不能为空' }
      }

      // 检查用户是否存在
      let userResult
      try {
        userResult = await db.collection('users').doc(userId).get()
      } catch (err) {
        return { code: -1, message: '用户不存在' }
      }

      if (!userResult.data) {
        return { code: -1, message: '用户不存在' }
      }

      // 获取优惠券信息
      let couponResult
      try {
        couponResult = await db.collection('coupons').doc(couponId).get()
      } catch (err) {
        return { code: -1, message: '优惠券不存在' }
      }

      if (!couponResult.data) {
        return { code: -1, message: '优惠券不存在' }
      }

      const coupon = couponResult.data

      // 检查优惠券是否有效
      const currentTime = new Date()
      if (currentTime > coupon.endTime) {
        return { code: -1, message: '优惠券已过期' }
      }

      // 检查是否超过发放总量
      if (coupon.totalCount > 0) {
        const currentReceived = coupon.receivedCount || 0
        if (currentReceived + count > coupon.totalCount) {
          return { code: -1, message: '优惠券库存不足' }
        }
      }

      // 检查用户是否超过限领数量
      const userCouponCount = await db.collection('userCoupons')
        .where({
          couponId: couponId,
          userId: userId
        })
        .count()

      if (coupon.limitPerUser > 0 && userCouponCount.total + count > coupon.limitPerUser) {
        return { code: -1, message: `该用户已达到限领数量(${coupon.limitPerUser}张)` }
      }

      // 创建用户优惠券记录
      const userCouponRecords = []
      for (let i = 0; i < count; i++) {
        userCouponRecords.push({
          couponId: couponId,
          userId: userId,
          name: coupon.name,
          type: coupon.type,
          value: coupon.value,
          minSpend: coupon.minSpend || 0,
          scope: coupon.scope || 'all',
          description: coupon.description || '',
          startTime: coupon.startTime,
          endTime: coupon.endTime,
          status: 0, // 0=未使用, 1=已使用, -1=已过期
          useTime: null,
          orderId: null,
          source: 'admin', // 管理员发放
          createTime: now,
          updateTime: now
        })
      }

      // 事务：添加用户优惠券 + 更新优惠券领取数量
      const transaction = await db.startTransaction()

      try {
        for (const record of userCouponRecords) {
          await transaction.collection('userCoupons').add({ data: record })
        }

        await transaction.collection('coupons').doc(couponId).update({
          data: {
            receivedCount: _.inc(count),
            updateTime: now
          }
        })

        await transaction.commit()

        return {
          code: 0,
          message: '发放成功',
          data: {
            distributedCount: count,
            userName: userResult.data.nickName || userResult.data.phone || '未知用户'
          }
        }
      } catch (err) {
        await transaction.rollback()
        console.error('发放优惠券事务失败:', err)
        return { code: -1, message: '发放失败，请重试' }
      }

    case 'searchUsers':
      // 搜索用户（用于发放优惠券）
      const { keyword: userKeyword, limit: userLimit = 10 } = data

      if (!userKeyword || userKeyword.trim().length === 0) {
        return { code: -1, message: '请输入搜索关键词' }
      }

      const userSearchWhere = {
        $or: [
          { nickName: db.RegExp({ regexp: userKeyword, options: 'i' }) },
          { phone: db.RegExp({ regexp: userKeyword, options: 'i' }) }
        ]
      }

      const userSearchResult = await db.collection('users')
        .where(userSearchWhere)
        .limit(userLimit)
        .get()

      return {
        code: 0,
        data: {
          list: userSearchResult.data.map(user => ({
            _id: user._id,
            nickName: user.nickName || '未知用户',
            avatarUrl: user.avatarUrl || '',
            phone: user.phone || ''
          }))
        }
      }

    case 'getDistributionRecords':
      // 获取发放记录
      const { page: distPage = 1, pageSize: distPageSize = 20, couponId: distCouponId } = data

      let distWhere = { source: 'admin' }
      if (distCouponId) {
        distWhere.couponId = distCouponId
      }

      const distCountResult = await db.collection('userCoupons').where(distWhere).count()
      const distListResult = await db.collection('userCoupons')
        .where(distWhere)
        .orderBy('createTime', 'desc')
        .skip((distPage - 1) * distPageSize)
        .limit(distPageSize)
        .get()

      // 获取用户信息
      const distUserIds = [...new Set(distListResult.data.map(item => item.userId))]
      const distUsersResult = await db.collection('users')
        .where({ _id: _.in(distUserIds) })
        .get()

      const distUserMap = {}
      distUsersResult.data.forEach(user => {
        distUserMap[user._id] = user
      })

      return {
        code: 0,
        data: {
          list: distListResult.data.map(item => ({
            ...item,
            userName: distUserMap[item.userId]?.nickName || distUserMap[item.userId]?.phone || '未知用户',
            userPhone: distUserMap[item.userId]?.phone || ''
          })),
          total: distCountResult.total,
          page: distPage,
          pageSize: distPageSize
        }
      }

    case 'getRecallableRecords':
      // 获取可回收的优惠券记录（未使用的）
      const { couponId: recallCouponId, page: recallPage = 1, pageSize: recallPageSize = 50 } = data

      if (!recallCouponId) {
        return { code: -1, message: '优惠券ID不能为空' }
      }

      const recallWhere = {
        couponId: recallCouponId,
        status: 0, // 未使用
        source: 'admin'
      }

      const recallCountResult = await db.collection('userCoupons').where(recallWhere).count()
      const recallListResult = await db.collection('userCoupons')
        .where(recallWhere)
        .orderBy('createTime', 'desc')
        .skip((recallPage - 1) * recallPageSize)
        .limit(recallPageSize)
        .get()

      // 获取用户信息
      const recallUserIds = [...new Set(recallListResult.data.map(item => item.userId))]
      const recallUsersResult = await db.collection('users')
        .where({ _id: _.in(recallUserIds) })
        .get()

      const recallUserMap = {}
      recallUsersResult.data.forEach(user => {
        recallUserMap[user._id] = user
      })

      return {
        code: 0,
        data: {
          list: recallListResult.data.map(item => ({
            ...item,
            userName: recallUserMap[item.userId]?.nickName || '未知用户',
            userPhone: recallUserMap[item.userId]?.phone || '',
            userAvatar: recallUserMap[item.userId]?.avatarUrl || ''
          })),
          total: recallCountResult.total,
          page: recallPage,
          pageSize: recallPageSize
        }
      }

    case 'recall':
      // 回收优惠券（删除用户的优惠券记录）
      const { userCouponId, couponId: recallCouponId2 } = data

      if (!userCouponId) {
        return { code: -1, message: '用户优惠券ID不能为空' }
      }

      if (!recallCouponId2) {
        return { code: -1, message: '优惠券ID不能为空' }
      }

      // 使用事务进行回收
      const recallTransaction = await db.startTransaction()

      try {
        // 获取用户优惠券记录
        const userCouponResult = await recallTransaction.collection('userCoupons').doc(userCouponId).get()
        const userCoupon = userCouponResult.data

        if (!userCoupon) {
          await recallTransaction.rollback()
          return { code: -1, message: '优惠券记录不存在' }
        }

        if (userCoupon.status !== 0) {
          await recallTransaction.rollback()
          return { code: -1, message: '该优惠券已使用或已过期，无法回收' }
        }

        // 删除用户优惠券记录
        await recallTransaction.collection('userCoupons').doc(userCouponId).remove()

        // 更新优惠券领取数量
        await recallTransaction.collection('coupons').doc(recallCouponId2).update({
          data: {
            receivedCount: _.inc(-1),
            updateTime: now
          }
        })

        await recallTransaction.commit()

        return {
          code: 0,
          message: '回收成功'
        }
      } catch (err) {
        await recallTransaction.rollback()
        console.error('回收优惠券失败:', err)
        return { code: -1, message: '回收失败' }
      }

    case 'recallAll':
      // 全部回收（回收所有未使用的优惠券）
      const { couponId: recallAllCouponId } = data

      if (!recallAllCouponId) {
        return { code: -1, message: '优惠券ID不能为空' }
      }

      // 获取所有未使用的记录
      const recallAllWhere = {
        couponId: recallAllCouponId,
        status: 0,
        source: 'admin'
      }

      const recallAllResult = await db.collection('userCoupons')
        .where(recallAllWhere)
        .get()

      const recallCount = recallAllResult.data.length

      if (recallCount === 0) {
        return { code: -1, message: '没有可回收的优惠券' }
      }

      // 使用事务批量回收
      const recallAllTransaction = await db.startTransaction()

      try {
        // 批量删除用户优惠券记录
        for (const record of recallAllResult.data) {
          await recallAllTransaction.collection('userCoupons').doc(record._id).remove()
        }

        // 更新优惠券领取数量
        await recallAllTransaction.collection('coupons').doc(recallAllCouponId).update({
          data: {
            receivedCount: _.inc(-recallCount),
            updateTime: now
          }
        })

        await recallAllTransaction.commit()

        return {
          code: 0,
          message: `成功回收${recallCount}张优惠券`,
          data: { recallCount }
        }
      } catch (err) {
        await recallAllTransaction.rollback()
        console.error('批量回收优惠券失败:', err)
        return { code: -1, message: '回收失败' }
      }

    case 'batchDistribute':
      // 批量发放给所有用户
      const { couponId: batchCouponId } = data

      if (!batchCouponId) {
        return { code: -1, message: '优惠券ID不能为空' }
      }

      // 获取优惠券信息
      let batchCouponResult
      try {
        batchCouponResult = await db.collection('coupons').doc(batchCouponId).get()
      } catch (err) {
        return { code: -1, message: '优惠券不存在' }
      }

      const batchCoupon = batchCouponResult.data

      if (!batchCoupon) {
        return { code: -1, message: '优惠券不存在' }
      }

      // 检查优惠券是否有效
      const batchCurrentTime = new Date()
      if (batchCurrentTime > batchCoupon.endTime) {
        return { code: -1, message: '优惠券已过期' }
      }

      // 获取所有用户
      const allUsersResult = await db.collection('users').get()
      const allUsers = allUsersResult.data

      if (allUsers.length === 0) {
        return { code: -1, message: '没有用户可发放' }
      }

      let successCount = 0
      let failCount = 0
      let skipCount = 0

      // 逐个用户发放
      for (const user of allUsers) {
        const userId = user._id

        // 检查用户是否超过限领数量
        const userCouponCount = await db.collection('userCoupons')
          .where({
            couponId: batchCouponId,
            userId: userId
          })
          .count()

        if (batchCoupon.limitPerUser > 0 && userCouponCount.total >= batchCoupon.limitPerUser) {
          skipCount++
          continue
        }

        // 检查是否超过发放总量
        if (batchCoupon.totalCount > 0) {
          const currentReceived = batchCoupon.receivedCount || 0
          if (currentReceived + successCount >= batchCoupon.totalCount) {
            failCount++
            continue
          }
        }

        // 创建用户优惠券记录
        try {
          await db.collection('userCoupons').add({
            data: {
              couponId: batchCouponId,
              userId: userId,
              name: batchCoupon.name,
              type: batchCoupon.type,
              value: batchCoupon.value,
              minSpend: batchCoupon.minSpend || 0,
              scope: batchCoupon.scope || 'all',
              description: batchCoupon.description || '',
              startTime: batchCoupon.startTime,
              endTime: batchCoupon.endTime,
              status: 0,
              useTime: null,
              orderId: null,
              source: 'admin',
              createTime: now,
              updateTime: now
            }
          })
          successCount++
        } catch (err) {
          console.error(`发放给用户 ${userId} 失败:`, err)
          failCount++
        }
      }

      // 更新优惠券领取数量
      if (successCount > 0) {
        await db.collection('coupons').doc(batchCouponId).update({
          data: {
            receivedCount: _.inc(successCount),
            updateTime: now
          }
        })
      }

      return {
        code: 0,
        message: `成功发放给${successCount}位用户，跳过${skipCount}位，失败${failCount}位`,
        data: { successCount, skipCount, failCount }
      }

    default:
      return { code: -1, message: '未知操作' }
  }
}

/**
 * 积分管理
 * @param {Object} data - 请求参数
 */
async function pointsManage(data) {
  const { operation } = data
  const now = db.serverDate()

  switch (operation) {
    case 'getStats':
      // 获取积分统计
      const usersWithPoints = await db.collection('users')
        .where({
          points: _.gt(0)
        })
        .count()

      // 计算总积分
      const pointsResult = await db.collection('users')
        .aggregate()
        .group({
          _id: null,
          totalPoints: $.sum('$points')
        })
        .end()

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let todayCharged = 0
      try {
        const todayChargedResult = await db.collection('pointsRecords')
          .where({
            type: 'charge',
            createTime: _.gte(today)
          })
          .count()
        todayCharged = todayChargedResult.total
      } catch (err) {
        console.log('[getStats] pointsRecords 查询失败（集合可能不存在）:', err.message)
        todayCharged = 0
      }

      return {
        code: 0,
        data: {
          totalUsers: usersWithPoints.total,
          totalPoints: pointsResult.list[0]?.totalPoints || 0,
          todayCharged: todayCharged
        }
      }

    case 'searchUsers':
      // 搜索用户
      const { keyword } = data
      const searchWhere = {}

      if (keyword) {
        searchWhere.$or = [
          { nickName: db.RegExp({ regexp: keyword, options: 'i' }) },
          { phone: db.RegExp({ regexp: keyword, options: 'i' }) }
        ]
      }

      const searchResult = await db.collection('users')
        .where(searchWhere)
        .limit(10)
        .get()

      return {
        code: 0,
        data: {
          list: searchResult.data
        }
      }

    case 'charge':
      // 充值积分
      const { userId, points, reason, operator } = data

      if (!userId || !points || points <= 0) {
        return { code: -1, message: '参数错误' }
      }

      const transaction = await db.startTransaction()

      try {
        // 获取用户当前积分
        const userResult = await transaction.collection('users').doc(userId).get()
        const user = userResult.data

        if (!user) {
          await transaction.rollback()
          return { code: -1, message: '用户不存在' }
        }

        const currentPoints = user.points || 0
        const newPoints = currentPoints + points

        // 更新用户积分
        await transaction.collection('users').doc(userId).update({
          data: {
            points: newPoints,
            updateTime: now
          }
        })

        // 添加积分记录到 pointsRecords
        // 同时存储 userId(_id) 和 openid，方便不同场景查询
        await transaction.collection('pointsRecords').add({
          data: {
            userId: user._id,           // 用户文档ID
            openid: user._openid,       // 微信openid
            type: 'charge',
            points: points,
            balance: newPoints,
            reason: reason || '管理员充值',
            operator: operator || '管理员',
            createTime: now
          }
        })

        // 同时写入 pointHistory 集合（兼容性）
        try {
          await transaction.collection('pointHistory').add({
            data: {
              userId: user._id,         // 用户文档ID
              openid: user._openid,     // 微信openid
              type: 'charge',
              points: points,
              balance: newPoints,
              reason: reason || '管理员充值',
              operator: operator || '管理员',
              createTime: now
            }
          })
        } catch (historyErr) {
          console.log('pointHistory 写入失败（可能集合不存在）:', historyErr.message)
          // 不影响主流程，继续执行
        }

        await transaction.commit()

        return {
          code: 0,
          message: '充值成功',
          data: { newPoints }
        }
      } catch (err) {
        await transaction.rollback()
        console.error('积分充值失败:', err)
        throw err
      }

    case 'getRecords':
      // 获取充值记录
      const { page = 1, pageSize = 20, date } = data
      const recordWhere = { type: 'charge' }

      if (date) {
        const startDate = new Date(date)
        const endDate = new Date(date)
        endDate.setDate(endDate.getDate() + 1)
        recordWhere.createTime = _.gte(startDate).and(_.lt(endDate))
      }

      try {
        const recordCountResult = await db.collection('pointsRecords').where(recordWhere).count()
        const recordListResult = await db.collection('pointsRecords')
          .where(recordWhere)
          .orderBy('createTime', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        // 获取用户信息
        const userIds = recordListResult.data.map(r => r.userId)
        const usersResult = await db.collection('users')
          .where({
            _id: _.in(userIds)
          })
          .get()

        const userMap = {}
        usersResult.data.forEach(u => {
          userMap[u._id] = u
        })

        const records = recordListResult.data.map(r => ({
          ...r,
          userName: userMap[r.userId]?.nickName || '未知用户',
          userAvatar: userMap[r.userId]?.avatarUrl
        }))

        return {
          code: 0,
          data: {
            list: records,
            total: recordCountResult.total,
            page,
            pageSize
          }
        }
      } catch (err) {
        console.log('[getRecords] 查询失败（集合可能不存在）:', err.message)
        // 集合不存在时返回空数据
        return {
          code: 0,
          data: {
            list: [],
            total: 0,
            page,
            pageSize
          }
        }
      }

    case 'getUserPoints':
      // 获取用户积分列表
      const { page: userPage = 1, pageSize: userPageSize = 20, sortDesc = true } = data

      const userCountResult = await db.collection('users').count()
      const userListResult = await db.collection('users')
        .orderBy('points', sortDesc ? 'desc' : 'asc')
        .skip((userPage - 1) * userPageSize)
        .limit(userPageSize)
        .get()

      return {
        code: 0,
        data: {
          list: userListResult.data,
          total: userCountResult.total,
          page: userPage,
          pageSize: userPageSize
        }
      }

    default:
      return { code: -1, message: '未知操作' }
  }
}

/**
 * 配送管理
 * @param {Object} data - 请求参数
 */
async function deliveryManage(data) {
  const { operation } = data
  const now = db.serverDate()

  // 配送管理专用状态常量（内部使用）
  const DELIVERY_STATUS = {
    PAID: 1,          // 已支付，待打包
    PACKING: 2,       // 打包中
    PACKED: 3,        // 已打包，待配送
    DELIVERING: 4,    // 配送中
    COMPLETED: 5      // 已完成
  }

  // 配送状态到订单状态的映射（查询和存入数据库时使用）
  const DELIVERY_TO_ORDER_STATUS = {
    1: 1,  // PAID -> 已支付
    2: 2,  // PACKING -> 制作中
    3: 2,  // PACKED -> 制作中（还是制作中，只是打包完成）
    4: 3,  // DELIVERING -> 配送中
    5: 4   // COMPLETED -> 已完成
  }

  // 订单状态到配送状态的映射（返回数据时使用）
  // 注意：PACKING(2) 和 PACKED(3) 都映射自订单状态 2，需要根据 packEndTime 区分
  const ORDER_TO_DELIVERY_STATUS = {
    1: 1,  // 已支付 -> PAID
    2: 2,  // 制作中 -> 默认为 PACKING，有 packEndTime 则为 PACKED
    3: 4,  // 配送中 -> DELIVERING
    4: 5   // 已完成 -> COMPLETED
  }

  switch (operation) {
    case 'getStats':
      // 获取配送统计 - 只统计 deliveryType=1 的配送订单
      const pendingPackResult = await db.collection('orders')
        .where({
          deliveryType: 1,
          status: DELIVERY_TO_ORDER_STATUS[DELIVERY_STATUS.PAID]
        })
        .count()

      const pendingDeliveryResult = await db.collection('orders')
        .where({
          deliveryType: 1,
          status: DELIVERY_TO_ORDER_STATUS[DELIVERY_STATUS.PACKED]
        })
        .count()

      const deliveringResult = await db.collection('orders')
        .where({
          deliveryType: 1,
          status: DELIVERY_TO_ORDER_STATUS[DELIVERY_STATUS.DELIVERING]
        })
        .count()

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const completedTodayResult = await db.collection('orders')
        .where({
          deliveryType: 1,
          status: DELIVERY_TO_ORDER_STATUS[DELIVERY_STATUS.COMPLETED], // 映射为订单状态 4
          completeTime: _.gte(today)
        })
        .count()

      return {
        code: 0,
        data: {
          pendingPack: pendingPackResult.total,
          pendingDelivery: pendingDeliveryResult.total,
          delivering: deliveringResult.total,
          completedToday: completedTodayResult.total
        }
      }

    case 'getOrders':
      // 获取订单列表 - 只查询 deliveryType=1 的配送订单
      const { page = 1, pageSize = 10, statusList = [] } = data

      const where = {
        deliveryType: 1  // 只查询配送订单
      }
      if (statusList.length > 0) {
        // 将配送状态映射为订单状态进行查询
        const orderStatusList = statusList.map(s => DELIVERY_TO_ORDER_STATUS[s] || s)
        where.status = _.in(orderStatusList)
      }

      const countResult = await db.collection('orders').where(where).count()
      const listResult = await db.collection('orders')
        .where(where)
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      // 获取用户信息 - 使用 openid 查询（订单的 userId 是 openid）
      const userIds = listResult.data.map(o => o.userId)
      const usersResult = await db.collection('users')
        .where({
          openid: _.in(userIds)
        })
        .get()

      const userMap = {}
      usersResult.data.forEach(u => {
        userMap[u.openid] = u
      })

      const orders = listResult.data.map(o => {
        // 将订单状态映射为配送状态
        let deliveryStatus = ORDER_TO_DELIVERY_STATUS[o.status]

        // 特殊处理：订单状态2（制作中）需要区分是打包中还是已打包
        if (o.status === 2) {
          if (o.packEndTime) {
            deliveryStatus = 3  // PACKED: 已打包
          } else if (o.packStartTime) {
            deliveryStatus = 2  // PACKING: 打包中
          } else {
            deliveryStatus = 2  // 默认为打包中
          }
        }

        return {
          ...o,
          status: deliveryStatus,  // 使用配送状态覆盖订单状态
          userName: userMap[o.userId]?.nickName || '未知用户',
          userPhone: userMap[o.userId]?.phone || o.address?.phone || ''
        }
      })

      return {
        code: 0,
        data: {
          list: orders,
          total: countResult.total,
          page,
          pageSize
        }
      }

    case 'updateStatus':
      // 更新订单状态
      const { orderId, status } = data

      if (!orderId || status === undefined) {
        return { code: -1, message: '参数错误' }
      }

      // 将配送状态映射为订单状态
      const orderStatus = DELIVERY_TO_ORDER_STATUS[status] || status

      const updateData = {
        status: orderStatus,
        updateTime: now
      }

      // 根据状态记录相应的时间
      if (status === DELIVERY_STATUS.PACKING) {
        updateData.packStartTime = now
      } else if (status === DELIVERY_STATUS.PACKED) {
        updateData.packEndTime = now
      } else if (status === DELIVERY_STATUS.DELIVERING) {
        updateData.deliverTime = now
      } else if (status === DELIVERY_STATUS.COMPLETED) {
        updateData.completeTime = now
      }

      await db.collection('orders').doc(orderId).update({
        data: updateData
      })

      return {
        code: 0,
        message: '状态更新成功'
      }

    case 'getDeliverymen':
      // 获取配送员列表 - status: 1表示在职
      const deliverymenResult = await db.collection('deliverymen')
        .where({
          status: 1
        })
        .get()

      // 格式化配送员数据以匹配小程序端期望的格式
      const formattedDeliverymen = deliverymenResult.data.map(d => ({
        _id: d._id,
        name: d.name,
        phone: d.phone,
        avatarUrl: d.avatarUrl || '',
        status: 'online',  // 默认为在线状态
        ordersCompleted: d.ordersCompleted || 0,
        rating: d.rating || 5
      }))

      return {
        code: 0,
        data: {
          list: formattedDeliverymen
        }
      }

    case 'assignDelivery':
      // 分配配送员
      const { orderId: assignOrderId, deliverymanId } = data

      if (!assignOrderId || !deliverymanId) {
        return { code: -1, message: '参数错误' }
      }

      await db.collection('orders').doc(assignOrderId).update({
        data: {
          status: DELIVERY_STATUS.DELIVERING,
          deliverymanId: deliverymanId,
          deliverTime: now,
          updateTime: now
        }
      })

      return {
        code: 0,
        message: '分配成功'
      }

    default:
      return { code: -1, message: '未知操作' }
  }
}

/**
 * 店铺设置管理
 * @param {Object} data - 请求参数
 */
async function shopSettings(data) {
  const { operation } = data
  const now = db.serverDate()

  switch (operation) {
    case 'get': {
      // 获取店铺设置
      const settingsResult = await db.collection('shopSettings').limit(1).get()

      if (settingsResult.data.length === 0) {
        // 返回默认设置
        return {
          code: 0,
          data: {
            shopName: '暖心烘焙',
            shopPhone: '',
            shopAddress: '',
            businessHours: {
              start: '08:00',
              end: '22:00'
            },
            deliveryTime: {
              start: '09:00',
              end: '21:00'
            },
            deliveryFee: 0,
            minOrderAmount: 0,
            notice: '',
            isOpen: true
          }
        }
      }

      return {
        code: 0,
        data: settingsResult.data[0]
      }
    }

    case 'update': {
      // 更新店铺设置
      const { settings } = data

      const updateResult = await db.collection('shopSettings').limit(1).get()

      if (updateResult.data.length === 0) {
        // 创建设置
        await db.collection('shopSettings').add({
          data: {
            ...settings,
            createTime: now,
            updateTime: now
          }
        })
      } else {
        // 更新设置
        await db.collection('shopSettings').doc(updateResult.data[0]._id).update({
          data: {
            ...settings,
            updateTime: now
          }
        })
      }

      return {
        code: 0,
        message: '设置更新成功'
      }
    }

    default:
      return { code: -1, message: '未知操作' }
  }
}

/**
 * 初始化数据库
 * 创建必要的集合和初始数据
 * @param {Object} data - 请求参数
 */
async function initDatabase(data) {
  const { initType } = data
  const now = db.serverDate()

  try {
    switch (initType) {
      case 'categories':
        // 初始化商品分类
        const categories = [
          { name: '面包', sort: 1, icon: '', createTime: now },
          { name: '蛋糕', sort: 2, icon: '', createTime: now },
          { name: '点心', sort: 3, icon: '', createTime: now },
          { name: '饮品', sort: 4, icon: '', createTime: now }
        ]

        for (const cat of categories) {
          await db.collection('categories').add({ data: cat })
        }

        return { code: 0, message: '分类初始化成功' }

      case 'shopSettings':
        // 初始化店铺设置
        await db.collection('shopSettings').add({
          data: {
            shopName: '暖心烘焙',
            shopPhone: '',
            shopAddress: '',
            businessHours: { start: '08:00', end: '22:00' },
            deliveryTime: { start: '09:00', end: '21:00' },
            deliveryFee: 0,
            minOrderAmount: 0,
            notice: '欢迎光临暖心烘焙！',
            isOpen: true,
            createTime: now,
            updateTime: now
          }
        })

        return { code: 0, message: '店铺设置初始化成功' }

      case 'banners':
        // 初始化轮播图
        const banners = [
          { image: '', link: '', sort: 1, isShow: true, createTime: now },
          { image: '', link: '', sort: 2, isShow: true, createTime: now },
          { image: '', link: '', sort: 3, isShow: true, createTime: now }
        ]

        for (const banner of banners) {
          await db.collection('banners').add({ data: banner })
        }

        return { code: 0, message: '轮播图初始化成功' }

      case 'all':
        // 初始化所有
        await initDatabase({ initType: 'categories' })
        await initDatabase({ initType: 'shopSettings' })
        await initDatabase({ initType: 'banners' })

        return { code: 0, message: '全部初始化成功' }

      default:
        return { code: -1, message: '未知的初始化类型' }
    }
  } catch (err) {
    console.error('初始化失败:', err)
    return { code: -1, message: '初始化失败: ' + err.message }
  }
}

/**
 * 获取销售趋势数据
 * @param {Object} data - 请求参数
 */
async function getSalesTrend(data) {
  const { period = 'week' } = data
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let startDate, endDate

  if (period === 'week') {
    const dayOfWeek = today.getDay() || 7
    startDate = new Date(today.getTime() - (dayOfWeek - 1) * 24 * 60 * 60 * 1000)
    endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
  } else if (period === 'month') {
    startDate = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
    endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
  } else if (period === 'year') {
    startDate = new Date(today.getFullYear(), 0, 1)
    endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59)
  }

  // 查询订单数据
  const ordersResult = await db.collection('orders')
    .where({
      createTime: _.gte(startDate).lte(endDate),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .orderBy('createTime', 'asc')
    .get()

  // 按日期分组统计
  const dailyStats = {}

  ordersResult.data.forEach(order => {
    const date = new Date(order.createTime)
    let key

    if (period === 'year') {
      key = `${date.getMonth() + 1}月`
    } else {
      key = `${date.getMonth() + 1}/${date.getDate()}`
    }

    if (!dailyStats[key]) {
      dailyStats[key] = { amount: 0, orders: 0, label: key }
    }

    dailyStats[key].amount += order.payAmount || 0
    dailyStats[key].orders += 1
  })

  // 生成完整的数据列表
  let list = []

  if (period === 'week') {
    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    weekDays.forEach((day, index) => {
      const date = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000)
      const key = `${date.getMonth() + 1}/${date.getDate()}`
      const stat = dailyStats[key] || { amount: 0, orders: 0 }
      list.push({
        label: day,
        amount: Math.round(stat.amount * 100) / 100,
        orders: stat.orders
      })
    })
  } else if (period === 'month') {
    for (let i = 0; i < 30; i += 3) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const key = `${date.getMonth() + 1}/${date.getDate()}`
      const stat = dailyStats[key] || { amount: 0, orders: 0 }
      list.push({
        label: `${date.getDate()}日`,
        amount: Math.round(stat.amount * 100) / 100,
        orders: stat.orders
      })
    }
  } else if (period === 'year') {
    for (let i = 1; i <= 12; i++) {
      const key = `${i}月`
      const stat = dailyStats[key] || { amount: 0, orders: 0 }
      list.push({
        label: key,
        amount: Math.round(stat.amount * 100) / 100,
        orders: stat.orders
      })
    }
  }

  // 检查是否有实际数据
  const hasData = list.some(item => item.amount > 0 || item.orders > 0)

  if (!hasData) {
    return {
      code: 0,
      message: 'success',
      data: { list: [], stats: { maxAmount: 0, avgAmount: 0, totalOrders: 0 } }
    }
  }

  // 计算统计数据
  const amounts = list.map(item => item.amount).filter(a => a > 0)
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0
  const totalAmount = list.reduce((sum, item) => sum + item.amount, 0)
  const totalOrders = list.reduce((sum, item) => sum + item.orders, 0)

  const stats = {
    maxAmount: maxAmount.toFixed(2),
    avgAmount: list.length > 0 ? Math.round(totalAmount / list.length).toFixed(2) : '0.00',
    totalOrders
  }

  return {
    code: 0,
    message: 'success',
    data: { list, stats }
  }
}

/**
 * 获取时段分析数据
 * @param {Object} data - 请求参数
 */
async function getTimeAnalysis(data) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  // 查询今日订单
  const ordersResult = await db.collection('orders')
    .where({
      createTime: _.gte(today).lt(tomorrow),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  // 定义时段
  const timeSlots = [
    { time: '06:00-08:00', start: 6, end: 8, amount: 0, orders: 0 },
    { time: '08:00-10:00', start: 8, end: 10, amount: 0, orders: 0 },
    { time: '10:00-12:00', start: 10, end: 12, amount: 0, orders: 0 },
    { time: '12:00-14:00', start: 12, end: 14, amount: 0, orders: 0 },
    { time: '14:00-16:00', start: 14, end: 16, amount: 0, orders: 0 },
    { time: '16:00-18:00', start: 16, end: 18, amount: 0, orders: 0 },
    { time: '18:00-20:00', start: 18, end: 20, amount: 0, orders: 0 },
    { time: '20:00-22:00', start: 20, end: 22, amount: 0, orders: 0 }
  ]

  // 统计各时段数据
  ordersResult.data.forEach(order => {
    const hour = new Date(order.createTime).getHours()
    const slot = timeSlots.find(s => hour >= s.start && hour < s.end)
    if (slot) {
      slot.amount += order.payAmount || 0
      slot.orders += 1
    }
  })

  // 格式化输出
  const result = timeSlots.map(slot => ({
    time: slot.time,
    amount: Math.round(slot.amount * 100) / 100,
    orders: slot.orders
  }))

  return {
    code: 0,
    message: 'success',
    data: result
  }
}

/**
 * 获取商品销售排行
 * @param {Object} data - 请求参数
 */
async function getProductRanking(data) {
  const { period = 'today', limit = 10 } = data
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let startDate

  if (period === 'today') {
    startDate = today
  } else if (period === 'week') {
    const dayOfWeek = today.getDay() || 7
    startDate = new Date(today.getTime() - (dayOfWeek - 1) * 24 * 60 * 60 * 1000)
  } else if (period === 'month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1)
  }

  const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  // 查询订单数据 - 排除已取消和待支付的订单
  const ordersResult = await db.collection('orders')
    .where({
      createTime: _.gte(startDate).lt(endDate),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  // 如果没有订单，返回空数组
  if (ordersResult.data.length === 0) {
    return {
      code: 0,
      message: 'success',
      data: []
    }
  }

  // 统计商品销量
  const productStats = {}

  ordersResult.data.forEach(order => {
    if (order.products && Array.isArray(order.products)) {
      order.products.forEach(product => {
        const id = product.productId || product._id
        if (!id) return

        if (!productStats[id]) {
          productStats[id] = {
            productId: id,
            name: product.name || '未知商品',
            image: product.image || '',
            salesCount: 0,
            salesAmount: 0
          }
        }
        productStats[id].salesCount += product.quantity || 1
        productStats[id].salesAmount += (product.price || 0) * (product.quantity || 1)
      })
    }
  })

  // 排序并取前N
  const ranking = Object.values(productStats)
    .filter(item => item.salesCount > 0)
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, limit)
    .map(item => ({
      ...item,
      salesAmount: Math.round(item.salesAmount * 100) / 100
    }))

  return {
    code: 0,
    message: 'success',
    data: ranking
  }
}

/**
 * 获取数据洞察
 * @param {Object} data - 请求参数
 */
async function getDataInsights(data) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())

  // 查询今日有效订单（排除已取消和待支付）
  const todayOrders = await db.collection('orders')
    .where({
      createTime: _.gte(today),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  // 查询历史订单（用于计算复购率）
  const lastMonthOrders = await db.collection('orders')
    .where({
      createTime: _.gte(lastMonth).lt(today),
      status: _.nin([ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING_PAY])
    })
    .get()

  // 计算客单价
  const totalAmount = todayOrders.data.reduce((sum, order) => sum + (order.payAmount || 0), 0)
  const orderCount = todayOrders.data.length
  const avgOrderAmount = orderCount > 0 ? (totalAmount / orderCount).toFixed(2) : '0.00'

  // 计算高峰时段
  const hourStats = {}
  todayOrders.data.forEach(order => {
    const hour = new Date(order.createTime).getHours()
    hourStats[hour] = (hourStats[hour] || 0) + 1
  })

  let peakHour = '--:--'
  let maxOrders = 0
  Object.entries(hourStats).forEach(([hour, count]) => {
    if (count > maxOrders) {
      maxOrders = count
      peakHour = `${hour.toString().padStart(2, '0')}:00`
    }
  })

  // 计算复购率（过去30天有多次购买的用户占比）
  const userOrders = {}
  lastMonthOrders.data.forEach(order => {
    const userId = order.userId || order._openid
    if (userId) {
      userOrders[userId] = (userOrders[userId] || 0) + 1
    }
  })

  const totalUsers = Object.keys(userOrders).length
  const repeatUsers = Object.values(userOrders).filter(count => count > 1).length
  const repurchaseRate = totalUsers > 0 ? ((repeatUsers / totalUsers) * 100).toFixed(1) : '0.0'

  // 转化率 - 基于实际数据计算（这里用订单数/访客数，访客数从用户表估算）
  const userCount = await db.collection('users').count()
  const activeUsers = userCount.total || 1
  const conversionRate = activeUsers > 0 ? ((orderCount / activeUsers) * 100).toFixed(1) : '0.0'

  return {
    code: 0,
    message: 'success',
    data: {
      avgOrderAmount,
      conversionRate,
      peakHour,
      repurchaseRate
    }
  }
}

/**
 * 分类管理
 * @param {Object} data - 请求参数
 */
async function categoryManage(data) {
  const { operation, categoryId, categoryData } = data
  const now = db.serverDate()

  switch (operation) {
    case 'create':
      // 创建分类
      if (!categoryData.name) {
        return { code: -1, message: '分类名称不能为空' }
      }

      // 获取当前最大排序值
      const maxSortResult = await db.collection('categories')
        .orderBy('sort', 'desc')
        .limit(1)
        .get()
      const maxSort = maxSortResult.data[0]?.sort || 0

      const newCategory = {
        name: categoryData.name,
        icon: categoryData.icon || '',
        sort: categoryData.sort !== undefined ? categoryData.sort : maxSort + 1,
        status: categoryData.status !== undefined ? categoryData.status : 1,
        createTime: now,
        updateTime: now
      }

      const createResult = await db.collection('categories').add({
        data: newCategory
      })

      return {
        code: 0,
        message: '创建成功',
        data: { categoryId: createResult._id }
      }

    case 'update':
      // 更新分类
      if (!categoryId) {
        return { code: -1, message: '分类ID不能为空' }
      }

      const updateData = { updateTime: now }
      if (categoryData.name !== undefined) updateData.name = categoryData.name
      if (categoryData.icon !== undefined) updateData.icon = categoryData.icon
      if (categoryData.sort !== undefined) updateData.sort = categoryData.sort
      if (categoryData.status !== undefined) updateData.status = categoryData.status

      await db.collection('categories').doc(categoryId).update({
        data: updateData
      })

      return {
        code: 0,
        message: '更新成功',
        data: { categoryId }
      }

    case 'delete':
      // 删除分类
      if (!categoryId) {
        return { code: -1, message: '分类ID不能为空' }
      }

      // 检查分类下是否有商品
      const productCount = await db.collection('products')
        .where({ categoryId })
        .count()

      if (productCount.total > 0) {
        return { code: -1, message: '该分类下还有商品，不能删除' }
      }

      await db.collection('categories').doc(categoryId).remove()

      return {
        code: 0,
        message: '删除成功'
      }

    case 'get':
      // 获取分类详情
      if (!categoryId) {
        return { code: -1, message: '分类ID不能为空' }
      }

      const categoryResult = await db.collection('categories').doc(categoryId).get()

      if (!categoryResult.data) {
        return { code: -1, message: '分类不存在' }
      }

      return {
        code: 0,
        message: 'success',
        data: categoryResult.data
      }

    case 'list':
      // 获取分类列表
      const { page = 1, pageSize = 100, status } = data

      const where = {}
      if (status !== undefined) where.status = status

      const countResult = await db.collection('categories').where(where).count()
      const listResult = await db.collection('categories')
        .where(where)
        .orderBy('sort', 'asc')
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      return {
        code: 0,
        message: 'success',
        data: {
          list: listResult.data,
          total: countResult.total,
          page,
          pageSize
        }
      }

    default:
      return { code: -1, message: '未知操作' }
  }
}

/**
 * 用户管理
 * @param {Object} data - 请求参数
 */
async function userManage(data) {
  const { operation } = data
  const now = db.serverDate()

  switch (operation) {
    case 'getUsers': {
      // 获取用户列表（简化版 - 仅支持管理员/普通用户两种角色）
      const { page = 1, pageSize = 20, keyword, role, status } = data

      console.log('[userManage] getUsers called with role:', role, 'status:', status)

      // 使用数组来构建查询条件，避免 $or 冲突
      const conditions = []

      // 关键词搜索条件
      if (keyword) {
        conditions.push(_.or([
          { nickName: db.RegExp({ regexp: keyword, options: 'i' }) },
          { phone: db.RegExp({ regexp: keyword, options: 'i' }) }
        ]))
      }

      // 角色筛选：admin-管理员, user-普通用户, all-全部
      if (role && role !== 'all') {
        if (role === 'admin') {
          conditions.push({ isAdmin: true })
        } else if (role === 'user') {
          // 普通用户：isAdmin 不等于 true（包括 false、null 或不存在）
          conditions.push({
            isAdmin: _.neq(true)
          })
        }
      }

      // 状态筛选：active-正常, disabled-已禁用, all-全部
      if (status && status !== 'all') {
        if (status === 'active') {
          conditions.push({
            status: _.in(['active', null, undefined])  // 默认active
          })
        } else if (status === 'disabled') {
          conditions.push({ status: 'disabled' })
        }
      }

      // 构建最终查询条件
      const where = conditions.length > 0 ? _.and(conditions) : {}

      console.log('[userManage] query conditions:', conditions.length)
      console.log('[userManage] query where:', JSON.stringify(where))

      const countResult = await db.collection('users').where(where).count()
      console.log('[userManage] total count:', countResult.total)

      const listResult = await db.collection('users')
        .where(where)
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      console.log('[userManage] found users:', listResult.data.length)
      console.log('[userManage] first user sample:', listResult.data[0] ? JSON.stringify({ _id: listResult.data[0]._id, nickName: listResult.data[0].nickName, isAdmin: listResult.data[0].isAdmin }) : 'no users')

      // 格式化用户数据
      const formattedList = listResult.data.map(user => {
        // 格式化日期
        let createTimeStr = ''
        if (user.createTime) {
          const date = new Date(user.createTime)
          createTimeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        }

        // 状态规范化：默认为 active
        const userStatus = user.status || 'active'

        return {
          ...user,
          status: userStatus,
          role: user.isAdmin ? 'admin' : 'user',
          createTime: createTimeStr || user.createTime
        }
      })

      return {
        code: 0,
        message: 'success',
        data: {
          list: formattedList,
          total: countResult.total,
          page,
          pageSize
        }
      }
    }

    case 'createUser': {
      // 创建新用户
      const { userData, enableIfDisabled } = data

      if (!userData || !userData.nickName || !userData.phone) {
        return { code: -1, message: '昵称和手机号不能为空' }
      }

      // 检查手机号是否已存在
      const existUser = await db.collection('users')
        .where({ phone: userData.phone })
        .limit(1)
        .get()

      if (existUser.data.length > 0) {
        const existingUser = existUser.data[0]

        // 如果用户被禁用，询问是否要启用
        if (existingUser.status === 'disabled') {
          if (enableIfDisabled) {
            // 启用用户并更新信息
            await db.collection('users').doc(existingUser._id).update({
              data: {
                status: 'active',
                nickName: userData.nickName.trim(),
                isAdmin: userData.isAdmin || false,
                avatarUrl: userData.avatarUrl || existingUser.avatarUrl,
                points: userData.points || existingUser.points || 0,
                balance: userData.balance || existingUser.balance || 0,
                memberLevel: userData.memberLevel !== undefined ? userData.memberLevel : (existingUser.memberLevel || 0),
                updateTime: now
              }
            })
            return {
              code: 0,
              message: '用户已启用并更新',
              data: { _id: existingUser._id, enabled: true }
            }
          } else {
            // 返回特定错误码，提示用户被禁用
            return {
              code: -2,
              message: '该手机号已被注册但处于禁用状态',
              data: {
                userId: existingUser._id,
                nickName: existingUser.nickName,
                status: 'disabled'
              }
            }
          }
        }

        // 用户已存在且处于启用状态
        return { code: -1, message: '该手机号已被注册' }
      }

      // 创建用户
      const newUser = {
        nickName: userData.nickName.trim(),
        phone: userData.phone.trim(),
        isAdmin: userData.isAdmin || false,
        avatarUrl: userData.avatarUrl || '/images/default-avatar.png',
        points: userData.points || 0,
        balance: userData.balance || 0,
        memberLevel: userData.memberLevel || 0,
        status: 'active',
        createTime: now,
        updateTime: now
      }

      const addResult = await db.collection('users').add({ data: newUser })

      return {
        code: 0,
        message: '用户创建成功',
        data: {
          _id: addResult._id,
          ...newUser
        }
      }
    }

    case 'updateUser': {
      // 更新用户信息
      const { userId, userData } = data

      if (!userId) {
        return { code: -1, message: '用户ID不能为空' }
      }

      if (!userData) {
        return { code: -1, message: '没有要更新的数据' }
      }

      // 如果更换手机号，检查是否已被其他用户使用
      if (userData.phone) {
        const existUser = await db.collection('users')
          .where({
            phone: userData.phone,
            _id: _.neq(userId)
          })
          .limit(1)
          .get()

        if (existUser.data.length > 0) {
          return { code: -1, message: '该手机号已被其他用户使用' }
        }
      }

      // 构建更新数据
      const updateData = {
        updateTime: now
      }
      if (userData.nickName !== undefined) {
        updateData.nickName = userData.nickName.trim()
      }
      if (userData.phone !== undefined) {
        updateData.phone = userData.phone.trim()
      }
      if (userData.isAdmin !== undefined) {
        updateData.isAdmin = userData.isAdmin
      }
      if (userData.points !== undefined) {
        updateData.points = userData.points
      }
      if (userData.balance !== undefined) {
        updateData.balance = userData.balance
      }
      if (userData.memberLevel !== undefined) {
        updateData.memberLevel = userData.memberLevel
      }
      if (userData.avatarUrl !== undefined) {
        updateData.avatarUrl = userData.avatarUrl
      }

      await db.collection('users').doc(userId).update({ data: updateData })

      return {
        code: 0,
        message: '用户信息更新成功'
      }
    }

    case 'toggleUserStatus': {
      // 启用/禁用用户
      const { userId, status } = data

      if (!userId) {
        return { code: -1, message: '用户ID不能为空' }
      }

      if (!status || (status !== 'active' && status !== 'disabled')) {
        return { code: -1, message: '状态必须是 active 或 disabled' }
      }

      await db.collection('users').doc(userId).update({
        data: {
          status: status,
          updateTime: now
        }
      })

      return {
        code: 0,
        message: status === 'active' ? '用户已启用' : '用户已禁用'
      }
    }

    case 'getUserDetail': {
      // 获取用户详情（包含订单和统计）
      const { userId } = data
      if (!userId) {
        return { code: -1, message: '用户ID不能为空' }
      }

      // 获取用户信息
      const userResult = await db.collection('users').doc(userId).get()
      if (!userResult.data) {
        return { code: -1, message: '用户不存在' }
      }

      // 获取用户订单
      const ordersResult = await db.collection('orders')
        .where({ userId })
        .orderBy('createTime', 'desc')
        .limit(10)
        .get()

      // 处理订单状态文本和颜色
      const processedOrders = ordersResult.data.map(order => {
        let statusText = '未知'
        let statusClass = ''

        switch (order.status) {
          case ORDER_STATUS.PENDING_PAY:
            statusText = '待付款'
            statusClass = 'pending'
            break
          case ORDER_STATUS.PAID:
            statusText = order.deliveryType === 0 ? '待自取' : '待配送'
            statusClass = 'paid'
            break
          case ORDER_STATUS.PREPARING:
            statusText = '制作中'
            statusClass = 'preparing'
            break
          case ORDER_STATUS.DELIVERING:
            statusText = '配送中'
            statusClass = 'delivering'
            break
          case ORDER_STATUS.COMPLETED:
            statusText = '已完成'
            statusClass = 'completed'
            break
          case ORDER_STATUS.CANCELLED:
            statusText = '已取消'
            statusClass = 'cancelled'
            break
          case ORDER_STATUS.REFUNDING:
            statusText = '退款中'
            statusClass = 'refunding'
            break
          case ORDER_STATUS.REFUNDED:
            statusText = '已退款'
            statusClass = 'refunded'
            break
          case 5:
            statusText = '线下支付'
            statusClass = 'offline'
            break
        }

        return {
          ...order,
          statusText,
          statusClass
        }
      })

      // 统计用户订单数据
      const stats = {
        totalOrders: 0,
        totalAmount: 0,
        completedOrders: 0
      }

      const allOrdersResult = await db.collection('orders')
        .where({ userId })
        .get()

      allOrdersResult.data.forEach(order => {
        stats.totalOrders++
        stats.totalAmount += order.payAmount || 0
        if (order.status === ORDER_STATUS.COMPLETED) {
          stats.completedOrders++
        }
      })

      // 规范化用户状态
      const userData = userResult.data
      if (!userData.status) {
        userData.status = 'active'
      }

      return {
        code: 0,
        message: 'success',
        data: {
          user: userData,
          orders: processedOrders,
          stats
        }
      }
    }

    default:
      return { code: -1, message: `未知操作: ${operation}` }
  }
}

/**
 * 删除云存储文件
 * @param {Object} data - 请求参数
 * @param {String} data.fileID - 云存储 fileID
 */
async function deleteCloudFile(data) {
  const { fileID } = data

  if (!fileID) {
    return { code: -1, message: 'fileID 不能为空' }
  }

  // 验证 fileID 格式
  if (!fileID.startsWith('cloud://')) {
    return { code: -1, message: '无效的 fileID 格式' }
  }

  try {
    // 从 fileID 提取文件路径
    // cloud://env-id.bucket/path/to/file.jpg -> path/to/file.jpg
    const match = fileID.match(/cloud:\/\/[^/]+\.[^/]+\/(.*)/)
    if (!match) {
      return { code: -1, message: '无法解析 fileID' }
    }

    const filePath = match[1]
    console.log('[DeleteCloudFile] 删除文件:', filePath)

    // 删除云存储文件
    const result = await cloud.deleteFile({
      fileList: [fileID]
    })

    console.log('[DeleteCloudFile] 删除结果:', result)

    // 检查结果
    if (result.fileList && result.fileList.length > 0) {
      const fileResult = result.fileList[0]
      if (fileResult.code === 'SUCCESS' || fileResult.code === 'OK') {
        return {
          code: 0,
          message: '删除成功',
          data: { fileID, filePath }
        }
      } else {
        // 文件可能不存在，也算成功
        if (fileResult.code === 'FILE_NOT_EXIST') {
          return {
            code: 0,
            message: '文件不存在',
            data: { fileID, filePath }
          }
        }
        return { code: -1, message: `删除失败: ${fileResult.code}` }
      }
    }

    return { code: 0, message: '删除成功' }
  } catch (err) {
    console.error('[DeleteCloudFile] 删除失败:', err)
    // 如果是文件不存在的错误，视为成功
    if (err.message && err.message.includes('not exist')) {
      return { code: 0, message: '文件不存在' }
    }
    return { code: -1, message: err.message }
  }
}
