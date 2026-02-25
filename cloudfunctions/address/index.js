/**
 * 地址相关云函数
 * - getList: 获取地址列表
 * - add: 添加地址
 * - update: 更新地址
 * - delete: 删除地址
 * - setDefault: 设置默认地址
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
  
  if (!OPENID) {
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
        return await deleteAddress(OPENID, data)
      case 'setDefault':
        return await setDefault(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('地址云函数错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 获取地址列表
 * @param {String} openid - 用户openid
 */
async function getList(openid) {
  const addressResult = await db.collection('addresses')
    .where({
      userId: openid
    })
    .orderBy('isDefault', 'desc')
    .orderBy('createTime', 'desc')
    .get()

  return {
    code: 0,
    message: 'success',
    data: {
      list: addressResult.data,
      total: addressResult.data.length
    }
  }
}

/**
 * 添加地址
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.name - 联系人姓名
 * @param {String} data.phone - 手机号
 * @param {String} data.province - 省
 * @param {String} data.city - 市
 * @param {String} data.district - 区
 * @param {String} data.detail - 详细地址
 * @param {Boolean} data.isDefault - 是否默认
 */
async function add(openid, data) {
  const { name, phone, province, city, district, detail, isDefault = false } = data

  // 参数校验
  if (!name || name.trim() === '') {
    return { code: -1, message: '联系人姓名不能为空' }
  }

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { code: -1, message: '手机号格式不正确' }
  }

  if (!province || !city || !district) {
    return { code: -1, message: '省市区信息不完整' }
  }

  if (!detail || detail.trim() === '') {
    return { code: -1, message: '详细地址不能为空' }
  }

  const now = db.serverDate()

  // 如果设置为默认地址，先将其他地址设为非默认
  if (isDefault) {
    await db.collection('addresses')
      .where({
        userId: openid,
        isDefault: true
      })
      .update({
        data: {
          isDefault: false
        }
      })
  }

  // 添加新地址
  const addResult = await db.collection('addresses').add({
    data: {
      userId: openid,
      name: name.trim(),
      phone: phone,
      province: province,
      city: city,
      district: district,
      detail: detail.trim(),
      isDefault: isDefault,
      createTime: now
    }
  })

  return {
    code: 0,
    message: '添加成功',
    data: {
      addressId: addResult._id
    }
  }
}

/**
 * 更新地址
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.addressId - 地址ID
 * @param {String} data.name - 联系人姓名
 * @param {String} data.phone - 手机号
 * @param {String} data.province - 省
 * @param {String} data.city - 市
 * @param {String} data.district - 区
 * @param {String} data.detail - 详细地址
 * @param {Boolean} data.isDefault - 是否默认
 */
async function update(openid, data) {
  const { addressId, name, phone, province, city, district, detail, isDefault } = data

  if (!addressId) {
    return { code: -1, message: '地址ID不能为空' }
  }

  // 查询地址
  const addressResult = await db.collection('addresses').doc(addressId).get()
  
  if (!addressResult.data) {
    return { code: -1, message: '地址不存在' }
  }

  const address = addressResult.data

  // 验证用户权限
  if (address.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  const updateData = {}

  if (name !== undefined) {
    if (name.trim() === '') {
      return { code: -1, message: '联系人姓名不能为空' }
    }
    updateData.name = name.trim()
  }

  if (phone !== undefined) {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return { code: -1, message: '手机号格式不正确' }
    }
    updateData.phone = phone
  }

  if (province !== undefined) updateData.province = province
  if (city !== undefined) updateData.city = city
  if (district !== undefined) updateData.district = district

  if (detail !== undefined) {
    if (detail.trim() === '') {
      return { code: -1, message: '详细地址不能为空' }
    }
    updateData.detail = detail.trim()
  }

  // 如果设置为默认地址
  if (isDefault === true && !address.isDefault) {
    await db.collection('addresses')
      .where({
        userId: openid,
        isDefault: true
      })
      .update({
        data: {
          isDefault: false
        }
      })
    updateData.isDefault = true
  }

  await db.collection('addresses').doc(addressId).update({
    data: updateData
  })

  return {
    code: 0,
    message: '更新成功',
    data: {
      addressId: addressId,
      ...updateData
    }
  }
}

/**
 * 删除地址
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.addressId - 地址ID
 */
async function deleteAddress(openid, data) {
  const { addressId } = data

  if (!addressId) {
    return { code: -1, message: '地址ID不能为空' }
  }

  // 查询地址
  const addressResult = await db.collection('addresses').doc(addressId).get()
  
  if (!addressResult.data) {
    return { code: -1, message: '地址不存在' }
  }

  const address = addressResult.data

  // 验证用户权限
  if (address.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  await db.collection('addresses').doc(addressId).remove()

  return {
    code: 0,
    message: '删除成功'
  }
}

/**
 * 设置默认地址
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.addressId - 地址ID
 */
async function setDefault(openid, data) {
  const { addressId } = data

  if (!addressId) {
    return { code: -1, message: '地址ID不能为空' }
  }

  // 查询地址
  const addressResult = await db.collection('addresses').doc(addressId).get()
  
  if (!addressResult.data) {
    return { code: -1, message: '地址不存在' }
  }

  const address = addressResult.data

  // 验证用户权限
  if (address.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  // 已经是默认地址
  if (address.isDefault) {
    return {
      code: 0,
      message: '设置成功',
      data: { addressId }
    }
  }

  // 先将其他地址设为非默认
  await db.collection('addresses')
    .where({
      userId: openid,
      isDefault: true
    })
    .update({
      data: {
        isDefault: false
      }
    })

  // 设置当前地址为默认
  await db.collection('addresses').doc(addressId).update({
    data: {
      isDefault: true
    }
  })

  return {
    code: 0,
    message: '设置成功',
    data: { addressId }
  }
}
