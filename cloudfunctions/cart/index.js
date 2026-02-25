/**
 * 购物车相关云函数
 * - getList: 获取购物车列表
 * - add: 添加商品到购物车
 * - update: 更新购物车商品
 * - delete: 删除购物车商品
 * - clear: 清空购物车
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
  const wxContext = cloud.getWXContext()
  const OPENID = wxContext.OPENID

  console.log('[Cart] 调用上下文:', { OPENID, action, data })
  console.log('[Cart] 完整上下文:', wxContext)

  if (!OPENID) {
    console.error('[Cart] 未获取到 OPENID')
    return { code: -1, message: '用户未登录' }
  }

  try {
    switch (action) {
      case 'getList':
        return await getList(OPENID)
      case 'add':
        return await add(OPENID, data)
      case 'update':
        return await update(OPENID, data)
      case 'delete':
      case 'remove':
        return await deleteCart(OPENID, data)
      case 'clear':
        return await clear(OPENID)
      case 'updateSelected':
        return await updateSelected(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('购物车云函数错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 获取购物车列表
 * @param {String} openid - 用户openid
 */
async function getList(openid) {
  // 查询购物车列表
  const cartResult = await db.collection('cart')
    .where({
      userId: openid
    })
    .orderBy('createTime', 'desc')
    .get()

  const cartList = cartResult.data

  if (cartList.length === 0) {
    return {
      code: 0,
      message: 'success',
      data: {
        list: [],
        total: 0,
        totalAmount: 0
      }
    }
  }

  // 获取商品信息
  const productIds = cartList.map(item => item.productId)
  const productResult = await db.collection('products')
    .where({
      _id: _.in(productIds)
    })
    .get()

  const productMap = productResult.data.reduce((map, product) => {
    map[product._id] = product
    return map
  }, {})

  // 组装购物车数据
  let totalAmount = 0
  const list = cartList.map(item => {
    const product = productMap[item.productId]
    let price = product ? product.price : 0
    let stock = product ? product.stock : 0
    let productName = product ? product.name : '商品已下架'
    let productImage = product && product.images ? product.images[0] : ''

    // 如果有规格，获取规格价格
    if (item.specId && product && product.specs) {
      const spec = product.specs.find(s => s._id === item.specId || s.id === item.specId)
      if (spec) {
        price = spec.price
        stock = spec.stock
        productName = `${productName} (${spec.name})`
      }
    }

    const itemTotal = price * item.quantity
    if (item.selected) {
      totalAmount += itemTotal
    }

    // 确保 _id 是字符串
    const cartId = item._id ? String(item._id) : ''

    return {
      _id: cartId,
      cartId: cartId,
      userId: item.userId,
      productId: item.productId,
      specId: item.specId,
      quantity: item.quantity,
      selected: item.selected,
      createTime: item.createTime,
      updateTime: item.updateTime,
      productName,
      productImage,
      price,
      stock,
      itemTotal,
      status: product ? product.status : 0,
      isValid: product && product.status === 1 && stock >= item.quantity
    }
  })

  return {
    code: 0,
    message: 'success',
    data: {
      list,
      total: list.length,
      totalAmount: parseFloat(totalAmount.toFixed(2))
    }
  }
}

/**
 * 添加商品到购物车
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.productId - 商品ID
 * @param {String} data.specId - 规格ID
 * @param {Number} data.quantity - 数量
 */
async function add(openid, data) {
  const { productId, specId, quantity = 1 } = data

  if (!productId) {
    return { code: -1, message: '商品ID不能为空' }
  }

  if (quantity <= 0) {
    return { code: -1, message: '数量必须大于0' }
  }

  // 检查商品是否存在
  const productResult = await db.collection('products').doc(productId).get()
  if (!productResult.data) {
    return { code: -1, message: '商品不存在' }
  }

  const product = productResult.data

  if (product.status !== 1) {
    return { code: -1, message: '商品已下架' }
  }

  // 检查规格
  let stock = product.stock
  if (specId && product.specs) {
    const spec = product.specs.find(s => s._id === specId || s.id === specId)
    if (!spec) {
      return { code: -1, message: '规格不存在' }
    }
    stock = spec.stock
  }

  // 检查库存
  if (stock < quantity) {
    return { code: -1, message: '库存不足' }
  }

  // 查询购物车是否已存在该商品
  const where = {
    userId: openid,
    productId: productId
  }
  if (specId) {
    where.specId = specId
  }

  const existResult = await db.collection('cart').where(where).get()

  const now = db.serverDate()

  if (existResult.data.length > 0) {
    // 已存在，更新数量
    const existItem = existResult.data[0]
    const newQuantity = existItem.quantity + quantity

    // 检查新数量是否超过库存
    if (stock < newQuantity) {
      return { code: -1, message: '库存不足' }
    }

    await db.collection('cart').doc(existItem._id).update({
      data: {
        quantity: newQuantity,
        updateTime: now
      }
    })

    return {
      code: 0,
      message: '添加成功',
      data: {
        cartId: existItem._id,
        quantity: newQuantity
      }
    }
  } else {
    // 不存在，新增
    const addResult = await db.collection('cart').add({
      data: {
        userId: openid,
        productId: productId,
        specId: specId || '',
        quantity: quantity,
        selected: true,
        createTime: now,
        updateTime: now
      }
    })

    return {
      code: 0,
      message: '添加成功',
      data: {
        cartId: addResult._id,
        quantity: quantity
      }
    }
  }
}

/**
 * 更新购物车商品
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.cartId - 购物车ID
 * @param {Number} data.quantity - 数量
 * @param {Boolean} data.selected - 是否选中
 */
async function update(openid, data) {
  const { cartId, quantity, selected } = data

  console.log('[Cart Update] 接收参数:', { cartId, quantity, selected, openid })

  if (!cartId) {
    return { code: -1, message: '购物车ID不能为空' }
  }

  // 查询购物车项 - 使用 where 查询以确保匹配
  const cartResult = await db.collection('cart')
    .where({
      _id: cartId,
      userId: openid
    })
    .get()

  console.log('[Cart Update] 查询结果:', cartResult)

  if (!cartResult.data || cartResult.data.length === 0) {
    return { code: -1, message: '购物车项不存在或无权限' }
  }

  const cartItem = cartResult.data[0]
  const docId = cartItem._id

  const updateData = {
    updateTime: db.serverDate()
  }

  // 更新数量
  if (quantity !== undefined) {
    if (quantity <= 0) {
      return { code: -1, message: '数量必须大于0' }
    }

    // 检查库存
    const productResult = await db.collection('products').doc(cartItem.productId).get()
    if (!productResult.data) {
      return { code: -1, message: '商品不存在' }
    }

    const product = productResult.data
    let stock = product.stock

    if (cartItem.specId && product.specs) {
      const spec = product.specs.find(s => s._id === cartItem.specId || s.id === cartItem.specId)
      if (spec) {
        stock = spec.stock
      }
    }

    if (stock < quantity) {
      return { code: -1, message: '库存不足' }
    }

    updateData.quantity = quantity
  }

  // 更新选中状态
  if (selected !== undefined) {
    updateData.selected = selected
  }

  await db.collection('cart').doc(docId).update({
    data: updateData
  })

  return {
    code: 0,
    message: '更新成功',
    data: {
      cartId: docId,
      ...updateData
    }
  }
}

/**
 * 删除购物车商品
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.cartId - 购物车ID
 * @param {Array} data.cartIds - 购物车ID数组（批量删除）
 */
async function deleteCart(openid, data) {
  const { cartId, cartIds } = data

  if (!cartId && (!cartIds || cartIds.length === 0)) {
    return { code: -1, message: '购物车ID不能为空' }
  }

  // 单个删除
  if (cartId) {
    const cartResult = await db.collection('cart')
      .where({
        _id: cartId,
        userId: openid
      })
      .get()

    if (!cartResult.data || cartResult.data.length === 0) {
      return { code: -1, message: '购物车项不存在或无权限' }
    }

    await db.collection('cart').doc(cartResult.data[0]._id).remove()
  } else {
    // 批量删除
    const deleteTasks = cartIds.map(id => {
      return db.collection('cart').where({
        _id: id,
        userId: openid
      }).remove()
    })

    await Promise.all(deleteTasks)
  }

  return {
    code: 0,
    message: '删除成功'
  }
}

/**
 * 清空购物车
 * @param {String} openid - 用户openid
 */
async function clear(openid) {
  // 获取所有购物车项
  const cartResult = await db.collection('cart')
    .where({
      userId: openid
    })
    .get()

  const deleteTasks = cartResult.data.map(item => {
    return db.collection('cart').doc(item._id).remove()
  })

  await Promise.all(deleteTasks)

  return {
    code: 0,
    message: '清空成功',
    data: {
      deletedCount: deleteTasks.length
    }
  }
}

/**
 * 更新购物车选中状态
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {Array} data.cartIds - 购物车ID数组
 * @param {Boolean} data.selected - 选中状态
 */
async function updateSelected(openid, data) {
  const { cartIds, selected } = data

  if (!cartIds || cartIds.length === 0) {
    return { code: -1, message: '购物车ID不能为空' }
  }

  if (selected === undefined) {
    return { code: -1, message: '选中状态不能为空' }
  }

  const updateTasks = cartIds.map(id => {
    return db.collection('cart').where({
      _id: id,
      userId: openid
    }).update({
      data: {
        selected: selected,
        updateTime: db.serverDate()
      }
    })
  })

  await Promise.all(updateTasks)

  return {
    code: 0,
    message: '更新成功'
  }
}
