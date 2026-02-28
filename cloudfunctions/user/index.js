/**
 * 用户相关云函数
 * - login: 用户登录（获取openid）
 * - loginWithPhone: 手机号一键登录
 * - getInfo: 获取用户信息
 * - updateInfo: 更新用户信息
 * - getPhone: 获取用户手机号
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
  const { OPENID, UNIONID } = cloud.getWXContext()

  if (!OPENID) {
    return { code: -1, message: '获取用户身份失败' }
  }

  try {
    switch (action) {
      case 'login':
        return await login(OPENID, UNIONID, data)
      case 'loginWithPhone':
        return await loginWithPhone(OPENID, UNIONID, data)
      case 'checkLogin':
        return await checkLogin(OPENID, data.token)
      case 'getInfo':
      case 'getUserInfo':
        return await getInfo(OPENID)
      case 'updateInfo':
      case 'updateUserInfo':
      case 'updateProfile':
        return await updateInfo(OPENID, data)
      case 'getPhone':
      case 'getPhoneNumber':
        return await getPhone(data)
      case 'logout':
        return await logout(OPENID)
      case 'getAddressList':
        return await getAddressList(OPENID)
      case 'addAddress':
        return await addAddress(OPENID, data)
      case 'updateAddress':
        return await updateAddress(OPENID, data)
      case 'deleteAddress':
        return await deleteAddress(OPENID, data)
      case 'setDefaultAddress':
        return await setDefaultAddress(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('用户云函数错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 用户登录
 * @param {String} openid - 用户openid
 * @param {String} unionid - 用户unionid
 * @param {Object} data - 请求参数
 * @param {Object} data.userInfo - 用户信息
 */
/**
 * 检查登录状态
 * @param {String} openid - 用户openid
 * @param {String} token - 用户token
 */
async function checkLogin(openid, token) {
  try {
    const userResult = await db.collection('users')
      .where({ openid: openid })
      .get()

    if (userResult.data.length > 0) {
      const user = userResult.data[0]

      // 验证 token 是否有效
      let isTokenValid = false
      if (token && user.token === token && user.tokenExpireTime > Date.now()) {
        isTokenValid = true
      }

      return {
        code: 0,
        message: '已登录',
        data: {
          isLogin: true,
          isTokenValid: isTokenValid,
          userInfo: {
            userId: user._id,
            nickName: user.nickName || '',
            avatarUrl: user.avatarUrl || '',
            phone: user.phone || '',
            memberLevel: user.memberLevel || 0,
            points: user.points || 0,
            role: user.isAdmin ? 'admin' : 'customer'
          }
        }
      }
    } else {
      return {
        code: 0,
        message: '未登录',
        data: { isLogin: false }
      }
    }
  } catch (error) {
    console.error('[User] 检查登录状态失败:', error)
    return {
      code: -1,
      message: '检查登录状态失败',
      data: { isLogin: false }
    }
  }
}

// 生成简单token
function generateToken(openid) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 8)
  return `${openid}_${timestamp}_${random}`
}

/**
 * 手机号一键登录
 * @param {String} openid - 用户openid
 * @param {String} unionid - 用户unionid
 * @param {Object} data - 请求参数
 * @param {String} data.phoneCode - 手机号获取凭证
 * @param {Object} data.userInfo - 用户信息（昵称、头像）
 */
async function loginWithPhone(openid, unionid, data) {
  const { phoneCode, userInfo = {} } = data

  if (!phoneCode) {
    return { code: -1, message: '手机号授权凭证不能为空' }
  }

  try {
    // 1. 获取手机号
    const phoneResult = await cloud.openapi.phonenumber.getPhoneNumber({
      code: phoneCode
    })

    if (!phoneResult || !phoneResult.phoneNumber) {
      return { code: -1, message: '获取手机号失败' }
    }

    const phoneNumber = phoneResult.phoneNumber
    const purePhoneNumber = phoneResult.purePhoneNumber || phoneNumber
    const countryCode = phoneResult.countryCode || '86'

    const now = db.serverDate()
    const token = generateToken(openid)
    const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天有效期

    // 2. 查询手机号是否已存在
    const userResult = await db.collection('users')
      .where({
        phone: purePhoneNumber
      })
      .get()

    let userId
    let isNewUser = false
    let finalUserInfo = {}

    if (userResult.data.length > 0) {
      // 用户已存在，更新信息
      const user = userResult.data[0]
      userId = user._id

      const updateData = {
        openid: openid,
        updateTime: now,
        lastLoginTime: now,
        token: token,
        tokenExpireTime: expireTime
      }

      // 更新用户信息（如果有提供）
      if (userInfo.nickName) {
        updateData.nickName = userInfo.nickName
      }
      if (userInfo.avatarUrl) {
        updateData.avatarUrl = userInfo.avatarUrl
      }

      // 合并现有信息
      finalUserInfo = {
        userId: userId,
        nickName: userInfo.nickName || user.nickName || '',
        avatarUrl: userInfo.avatarUrl || user.avatarUrl || '',
        phone: purePhoneNumber,
        memberLevel: user.memberLevel || 0,
        points: user.points || 0
      }

      await db.collection('users').doc(userId).update({
        data: updateData
      })

      console.log('[User] 已有用户登录:', purePhoneNumber)
    } else {
      // 新用户，创建用户记录
      isNewUser = true

      const newUser = {
        phone: purePhoneNumber,
        openid: openid,
        unionid: unionid || '',
        nickName: userInfo.nickName || '',
        avatarUrl: userInfo.avatarUrl || '',
        memberLevel: 0,
        points: 0,
        balance: 0,
        isAdmin: false,
        token: token,
        tokenExpireTime: expireTime,
        createTime: now,
        updateTime: now,
        lastLoginTime: now
      }

      const addResult = await db.collection('users').add({
        data: newUser
      })

      userId = addResult._id
      finalUserInfo = {
        userId: userId,
        nickName: newUser.nickName,
        avatarUrl: newUser.avatarUrl,
        phone: purePhoneNumber,
        memberLevel: 0,
        points: 0
      }

      console.log('[User] 新用户注册:', purePhoneNumber)
    }

    // 3. 返回登录结果
    return {
      code: 0,
      message: isNewUser ? '注册成功' : '登录成功',
      data: {
        userId: userId,
        phone: purePhoneNumber,
        openid: openid,
        token: token,
        expireTime: expireTime,
        isNewUser: isNewUser,
        role: 'customer',
        userInfo: finalUserInfo
      }
    }

  } catch (err) {
    console.error('[User] 手机号登录失败:', err)
    return {
      code: -1,
      message: '登录失败: ' + (err.message || '未知错误')
    }
  }
}

async function login(openid, unionid, data) {
  const { userInfo = {} } = data

  const now = db.serverDate()
  const token = generateToken(openid)
  const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天有效期

  // 查询用户是否已存在
  const userResult = await db.collection('users')
    .where({
      openid: openid
    })
    .get()

  if (userResult.data.length > 0) {
    // 用户已存在，更新登录信息
    const user = userResult.data[0]

    const updateData = {
      updateTime: now,
      lastLoginTime: now,
      token: token,
      tokenExpireTime: expireTime
    }

    // 更新用户信息（如果有）
    if (userInfo.nickName) {
      updateData.nickName = userInfo.nickName
    }
    if (userInfo.avatarUrl) {
      updateData.avatarUrl = userInfo.avatarUrl
    }

    await db.collection('users').doc(user._id).update({
      data: updateData
    })

    // 构建userInfo对象
    const userInfoData = {
      userId: user._id,
      nickName: user.nickName || updateData.nickName || '',
      avatarUrl: user.avatarUrl || updateData.avatarUrl || '',
      phone: user.phone || '',
      memberLevel: user.memberLevel || 0,
      points: user.points || 0
    }

    return {
      code: 0,
      message: '登录成功',
      data: {
        userId: user._id,
        openid: openid,
        token: token,
        expireTime: expireTime,
        isNewUser: false,
        role: user.isAdmin ? 'admin' : 'customer',
        userInfo: userInfoData
      }
    }
  } else {
    // 新用户，创建用户记录
    const newUser = {
      openid: openid,
      unionid: unionid || '',
      nickName: userInfo.nickName || '',
      avatarUrl: userInfo.avatarUrl || '',
      phone: '',
      memberLevel: 0,
      points: 0,
      balance: 0,
      isAdmin: false,
      token: token,
      tokenExpireTime: expireTime,
      createTime: now,
      updateTime: now,
      lastLoginTime: now
    }

    const addResult = await db.collection('users').add({
      data: newUser
    })

    // 构建userInfo对象
    const userInfoData = {
      userId: addResult._id,
      nickName: newUser.nickName,
      avatarUrl: newUser.avatarUrl,
      phone: '',
      memberLevel: 0,
      points: 0
    }

    return {
      code: 0,
      message: '登录成功',
      data: {
        userId: addResult._id,
        openid: openid,
        token: token,
        expireTime: expireTime,
        isNewUser: true,
        role: 'customer',
        userInfo: userInfoData
      }
    }
  }
}

/**
 * 获取用户信息
 * @param {String} openid - 用户openid
 */
async function getInfo(openid) {
  const userResult = await db.collection('users')
    .where({
      openid: openid
    })
    .get()

  if (userResult.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }

  const user = userResult.data[0]

  // 获取订单统计
  const orderStats = await db.collection('orders')
    .where({
      userId: openid
    })
    .count()

  // 获取待支付订单数
  const pendingPayCount = await db.collection('orders')
    .where({
      userId: openid,
      status: 0
    })
    .count()

  // 获取待收货订单数
  const pendingReceiveCount = await db.collection('orders')
    .where({
      userId: openid,
      status: _.in([1, 2, 3])
    })
    .count()

  // 获取优惠券数量
  const couponCount = await db.collection('userCoupons')
    .where({
      userId: openid,
      status: 0
    })
    .count()

  return {
    code: 0,
    message: 'success',
    data: {
      ...user,
      stats: {
        orderCount: orderStats.total,
        pendingPayCount: pendingPayCount.total,
        pendingReceiveCount: pendingReceiveCount.total,
        couponCount: couponCount.total
      }
    }
  }
}

/**
 * 更新用户信息
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 */
async function updateInfo(openid, data) {
  const { nickName, avatarUrl, phone } = data

  const userResult = await db.collection('users')
    .where({
      openid: openid
    })
    .get()

  if (userResult.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }

  const user = userResult.data[0]

  const updateData = {
    updateTime: db.serverDate()
  }

  if (nickName !== undefined) {
    updateData.nickName = nickName
  }

  if (avatarUrl !== undefined) {
    updateData.avatarUrl = avatarUrl
  }

  if (phone !== undefined) {
    updateData.phone = phone
  }

  await db.collection('users').doc(user._id).update({
    data: updateData
  })

  return {
    code: 0,
    message: '更新成功',
    data: updateData
  }
}

/**
 * 获取用户手机号
 * @param {Object} data - 请求参数
 * @param {String} data.cloudID - 云端ID（旧版）
 * @param {String} data.code - 动态令牌（新版，推荐）
 */
async function getPhone(data) {
  const { cloudID, code } = data

  // 优先使用新版 code 方式
  if (code) {
    try {
      // 使用 code 方式获取手机号（需要云调用权限）
      const result = await cloud.openapi.phonenumber.getPhoneNumber({
        code: code
      })

      if (result && result.phoneNumber) {
        const { OPENID } = cloud.getWXContext()

        await db.collection('users')
          .where({
            openid: OPENID
          })
          .update({
            data: {
              phone: result.phoneNumber,
              updateTime: db.serverDate()
            }
          })

        return {
          code: 0,
          message: 'success',
          data: {
            phoneNumber: result.phoneNumber,
            purePhoneNumber: result.purePhoneNumber || result.phoneNumber,
            countryCode: result.countryCode || '86'
          }
        }
      }
    } catch (err) {
      console.error('[User] 使用 code 获取手机号失败:', err)
      // 如果 code 方式失败，尝试 cloudID 方式
    }
  }

  // 使用 cloudID 方式（兼容旧版）
  if (cloudID) {
    try {
      const res = await cloud.getOpenData({
        list: [cloudID]
      })

      if (res.list && res.list.length > 0) {
        const phoneData = res.list[0].data

        if (phoneData && phoneData.phoneNumber) {
          const { OPENID } = cloud.getWXContext()

          await db.collection('users')
            .where({
              openid: OPENID
            })
            .update({
              data: {
                phone: phoneData.phoneNumber,
                updateTime: db.serverDate()
              }
            })

          return {
            code: 0,
            message: 'success',
            data: {
              phoneNumber: phoneData.phoneNumber,
              purePhoneNumber: phoneData.purePhoneNumber,
              countryCode: phoneData.countryCode
            }
          }
        }
      }
    } catch (err) {
      console.error('[User] 使用 cloudID 获取手机号失败:', err)
    }
  }

  return { code: -1, message: '获取手机号失败，请稍后重试' }
}

/**
 * 退出登录
 * @param {String} openid - 用户openid
 */
async function logout(openid) {
  try {
    // 清除用户的 token
    const userResult = await db.collection('users')
      .where({ openid: openid })
      .get()

    if (userResult.data.length > 0) {
      const user = userResult.data[0]
      await db.collection('users').doc(user._id).update({
        data: {
          token: '',
          tokenExpireTime: 0,
          updateTime: db.serverDate()
        }
      })
    }

    return {
      code: 0,
      message: '退出成功'
    }
  } catch (error) {
    console.error('[User] 退出登录失败:', error)
    return {
      code: -1,
      message: '退出失败: ' + error.message
    }
  }
}

/**
 * 获取地址列表
 * @param {String} openid - 用户openid
 */
async function getAddressList(openid) {
  const result = await db.collection('addresses')
    .where({
      userId: openid
    })
    .orderBy('isDefault', 'desc')
    .orderBy('createTime', 'desc')
    .get()

  return {
    code: 0,
    message: 'success',
    data: result.data
  }
}

/**
 * 添加地址
 * @param {String} openid - 用户openid
 * @param {Object} data - 地址数据
 */
async function addAddress(openid, data) {
  const { name, phone, province, city, district, address, isDefault = false } = data

  if (!name || !phone || !province || !city || !address) {
    return { code: -1, message: '请填写完整的地址信息' }
  }

  const now = db.serverDate()

  // 如果设为默认，取消其他默认地址
  if (isDefault) {
    const defaultAddresses = await db.collection('addresses')
      .where({
        userId: openid,
        isDefault: true
      })
      .get()

    for (const item of defaultAddresses.data) {
      await db.collection('addresses').doc(item._id).update({
        data: { isDefault: false }
      })
    }
  }

  const addResult = await db.collection('addresses').add({
    data: {
      userId: openid,
      name,
      phone,
      province,
      city,
      district: district || '',
      address,
      isDefault,
      createTime: now,
      updateTime: now
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
 * @param {Object} data - 地址数据
 */
async function updateAddress(openid, data) {
  const { addressId, name, phone, province, city, district, address, isDefault } = data

  if (!addressId) {
    return { code: -1, message: '地址ID不能为空' }
  }

  const addressResult = await db.collection('addresses').doc(addressId).get()
  if (!addressResult.data || addressResult.data.userId !== openid) {
    return { code: -1, message: '地址不存在或无权限' }
  }

  const now = db.serverDate()
  const updateData = { updateTime: now }

  if (name !== undefined) updateData.name = name
  if (phone !== undefined) updateData.phone = phone
  if (province !== undefined) updateData.province = province
  if (city !== undefined) updateData.city = city
  if (district !== undefined) updateData.district = district
  if (address !== undefined) updateData.address = address
  if (isDefault !== undefined) updateData.isDefault = isDefault

  // 如果设为默认，取消其他默认地址
  if (isDefault) {
    const defaultAddresses = await db.collection('addresses')
      .where({
        userId: openid,
        isDefault: true,
        _id: _.neq(addressId)
      })
      .get()

    for (const item of defaultAddresses.data) {
      await db.collection('addresses').doc(item._id).update({
        data: { isDefault: false }
      })
    }
  }

  await db.collection('addresses').doc(addressId).update({
    data: updateData
  })

  return {
    code: 0,
    message: '更新成功'
  }
}

/**
 * 删除地址
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 */
async function deleteAddress(openid, data) {
  const { addressId } = data

  if (!addressId) {
    return { code: -1, message: '地址ID不能为空' }
  }

  const addressResult = await db.collection('addresses').doc(addressId).get()
  if (!addressResult.data || addressResult.data.userId !== openid) {
    return { code: -1, message: '地址不存在或无权限' }
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
 */
async function setDefaultAddress(openid, data) {
  const { addressId } = data

  if (!addressId) {
    return { code: -1, message: '地址ID不能为空' }
  }

  const addressResult = await db.collection('addresses').doc(addressId).get()
  if (!addressResult.data || addressResult.data.userId !== openid) {
    return { code: -1, message: '地址不存在或无权限' }
  }

  // 取消其他默认地址
  const defaultAddresses = await db.collection('addresses')
    .where({
      userId: openid,
      isDefault: true
    })
    .get()

  for (const item of defaultAddresses.data) {
    await db.collection('addresses').doc(item._id).update({
      data: { isDefault: false }
    })
  }

  // 设置当前地址为默认
  await db.collection('addresses').doc(addressId).update({
    data: {
      isDefault: true,
      updateTime: db.serverDate()
    }
  })

  return {
    code: 0,
    message: '设置成功'
  }
}
