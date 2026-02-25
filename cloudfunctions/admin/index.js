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
  PENDING_PAY: 0,
  PAID: 1,
  PREPARING: 2,
  DELIVERING: 3,
  COMPLETED: 4,
  CANCELLED: -1,
  REFUNDING: -2,
  REFUNDED: -3
}

// 管理员openid列表（实际项目中应从数据库或配置文件读取）
const ADMIN_OPENIDS = ['ADMIN_OPENID_1', 'ADMIN_OPENID_2']

// 主入口函数
exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()
  
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
      case 'updateOrderStatus':
        return await checkAdmin(OPENID) && await updateOrderStatus(data)
      default:
        return { code: -1, message: '未知操作' }
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
      if (productData.images !== undefined) updateData.images = productData.images
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
      const { page = 1, pageSize = 20, status, categoryId, keyword } = data

      const where = {}
      if (status !== undefined) where.status = status
      if (categoryId) where.categoryId = categoryId
      if (keyword) {
        where.name = db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      }

      const countResult = await db.collection('products').where(where).count()
      const listResult = await db.collection('products')
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
        where.createTime = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
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

  // 待处理订单数
  const pendingOrderResult = await db.collection('orders')
    .where({
      status: ORDER_STATUS.PAID
    })
    .count()

  // 商品总数
  const productResult = await db.collection('products').count()

  // 库存预警商品
  const stockWarningResult = await db.collection('products')
    .where({
      stock: _.lte(_.multiply('$stockWarning', 1))
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
        salesAmount: parseFloat(weekSales.toFixed(2))
      },
      month: {
        salesAmount: parseFloat(monthSales.toFixed(2))
      },
      pendingOrderCount: pendingOrderResult.total,
      productCount: productResult.total,
      stockWarningCount: stockWarningResult.total,
      userCount: userResult.total
    }
  }
}

/**
 * 更新库存
 * @param {Object} data - 请求参数
 */
async function updateStock(data) {
  const { productId, stock, specId } = data

  if (!productId) {
    return { code: -1, message: '商品ID不能为空' }
  }

  if (stock === undefined || stock < 0) {
    return { code: -1, message: '库存数量不合法' }
  }

  const now = db.serverDate()

  if (specId) {
    // 更新规格库存
    const productResult = await db.collection('products').doc(productId).get()
    const product = productResult.data

    if (!product) {
      return { code: -1, message: '商品不存在' }
    }

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

  return {
    code: 0,
    message: '库存更新成功',
    data: { productId, stock }
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
