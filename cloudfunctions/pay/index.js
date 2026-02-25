/**
 * 支付相关云函数
 * - unifiedOrder: 统一下单（调用微信支付）
 * - notify: 支付回调处理
 * - refund: 退款申请
 */
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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

// 主入口函数
exports.main = async (event, context) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'unifiedOrder':
        return await unifiedOrder(OPENID, data)
      case 'notify':
        return await notify(event)
      case 'refund':
        return await refund(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('支付云函数错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 统一下单
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.orderId - 订单ID
 */
async function unifiedOrder(openid, data) {
  const { orderId } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  // 查询订单
  const orderResult = await db.collection('orders').doc(orderId).get()
  
  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const order = orderResult.data

  // 验证用户
  if (order.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  // 检查订单状态
  if (order.status !== ORDER_STATUS.PENDING_PAY) {
    return { code: -1, message: '订单状态不允许支付' }
  }

  // 检查订单是否过期（30分钟）
  const createTime = new Date(order.createTime)
  const now = new Date()
  const diffMinutes = (now - createTime) / (1000 * 60)
  
  if (diffMinutes > 30) {
    // 自动取消订单
    await cancelOrder(orderId)
    return { code: -1, message: '订单已过期，请重新下单' }
  }

  // 调用微信支付统一下单
  const res = await cloud.cloudPay.unifiedOrder({
    body: `面包烘焙-${order.products.map(p => p.name).join(',')}`,
    outTradeNo: order.orderNo,
    spbillCreateIp: '127.0.0.1',
    subMchId: 'YOUR_MCH_ID', // 替换为实际的商户号
    totalFee: Math.round(order.payAmount * 100), // 转换为分
    envId: cloud.DYNAMIC_CURRENT_ENV,
    functionName: 'pay',
    tradeType: 'JSAPI',
    openid: openid
  })

  if (res.returnCode === 'SUCCESS' && res.resultCode === 'SUCCESS') {
    return {
      code: 0,
      message: 'success',
      data: {
        appId: res.appId,
        timeStamp: String(Math.floor(Date.now() / 1000)),
        nonceStr: res.nonceStr,
        package: res.package,
        signType: 'MD5',
        paySign: res.paySign,
        orderId: orderId
      }
    }
  } else {
    return {
      code: -1,
      message: res.errCodeDes || '支付下单失败'
    }
  }
}

/**
 * 支付回调处理
 * @param {Object} event - 回调参数
 */
async function notify(event) {
  const { returnCode, resultCode, outTradeNo, transactionId, timeEnd } = event

  console.log('支付回调:', event)

  if (returnCode === 'SUCCESS' && resultCode === 'SUCCESS') {
    // 查询订单
    const orderResult = await db.collection('orders')
      .where({
        orderNo: outTradeNo
      })
      .get()

    if (orderResult.data.length === 0) {
      console.error('支付回调：订单不存在', outTradeNo)
      return { code: 'FAIL', message: '订单不存在' }
    }

    const order = orderResult.data[0]

    // 已支付，直接返回成功
    if (order.status === ORDER_STATUS.PAID) {
      return { code: 'SUCCESS', message: 'OK' }
    }

    const now = db.serverDate()

    // 更新订单状态
    await db.collection('orders').doc(order._id).update({
      data: {
        status: ORDER_STATUS.PAID,
        payTime: now,
        transactionId: transactionId,
        updateTime: now
      }
    })

    // 发送支付成功通知
    try {
      await sendPaySuccessMessage(order)
    } catch (err) {
      console.error('发送支付通知失败:', err)
    }

    return { code: 'SUCCESS', message: 'OK' }
  }

  return { code: 'FAIL', message: '支付失败' }
}

/**
 * 发送支付成功通知
 * @param {Object} order - 订单数据
 */
async function sendPaySuccessMessage(order) {
  // 这里可以调用微信订阅消息发送支付成功通知
  // 需要先在小程序端获取用户订阅授权
  
  // 示例：发送统一服务消息
  // await cloud.openapi.uniformMessage.send({
  //   touser: order.userId,
  //   mpTemplateMsg: {
  //     appid: 'YOUR_APPID',
  //     templateId: 'YOUR_TEMPLATE_ID',
  //     url: '',
  //     miniprogram: {
  //       appid: 'YOUR_APPID',
  //       pagepath: `pages/order/detail?id=${order._id}`
  //     },
  //     data: {
  //       // 模板消息数据
   //     }
  //   }
  // })
}

/**
 * 退款申请
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.orderId - 订单ID
 * @param {Number} data.refundAmount - 退款金额
 * @param {String} data.reason - 退款原因
 */
async function refund(openid, data) {
  const { orderId, refundAmount, reason } = data

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' }
  }

  // 查询订单
  const orderResult = await db.collection('orders').doc(orderId).get()
  
  if (!orderResult.data) {
    return { code: -1, message: '订单不存在' }
  }

  const order = orderResult.data

  // 验证用户
  if (order.userId !== openid) {
    return { code: -1, message: '无权限操作' }
  }

  // 检查订单状态（已支付或备餐中可申请退款）
  if (order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.PREPARING) {
    return { code: -1, message: '订单状态不允许退款' }
  }

  // 检查退款金额
  const maxRefundAmount = order.payAmount
  const actualRefundAmount = refundAmount || maxRefundAmount

  if (actualRefundAmount <= 0 || actualRefundAmount > maxRefundAmount) {
    return { code: -1, message: '退款金额不合法' }
  }

  const now = db.serverDate()

  // 生成退款单号
  const refundNo = `REF${Date.now()}${Math.floor(Math.random() * 1000)}`

  // 调用微信退款接口
  try {
    const res = await cloud.cloudPay.refund({
      outTradeNo: order.orderNo,
      outRefundNo: refundNo,
      subMchId: 'YOUR_MCH_ID', // 替换为实际的商户号
      totalFee: Math.round(order.payAmount * 100),
      refundFee: Math.round(actualRefundAmount * 100)
    })

    if (res.returnCode === 'SUCCESS') {
      // 更新订单状态
      await db.collection('orders').doc(orderId).update({
        data: {
          status: ORDER_STATUS.REFUNDING,
          refundNo: refundNo,
          refundAmount: actualRefundAmount,
          refundReason: reason || '',
          refundTime: now,
          updateTime: now
        }
      })

      // 恢复库存
      await restoreStock(order)

      return {
        code: 0,
        message: '退款申请已提交',
        data: {
          refundNo: refundNo,
          refundAmount: actualRefundAmount
        }
      }
    } else {
      return {
        code: -1,
        message: res.errCodeDes || '退款申请失败'
      }
    }
  } catch (err) {
    console.error('退款失败:', err)
    return { code: -1, message: '退款申请失败: ' + err.message }
  }
}

/**
 * 取消订单（内部方法）
 * @param {String} orderId - 订单ID
 */
async function cancelOrder(orderId) {
  const orderResult = await db.collection('orders').doc(orderId).get()
  
  if (!orderResult.data) return

  const order = orderResult.data

  if (order.status !== ORDER_STATUS.PENDING_PAY) return

  const now = db.serverDate()

  // 事务处理：恢复库存
  const transaction = await db.startTransaction()

  try {
    // 恢复库存
    for (const item of order.products) {
      const productResult = await transaction.collection('products').doc(item.productId).get()
      const product = productResult.data

      if (item.specId && product.specs) {
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
        await transaction.collection('products').doc(item.productId).update({
          data: {
            stock: _.inc(item.quantity),
            sales: _.inc(-item.quantity),
            updateTime: now
          }
        })
      }
    }

    // 恢复优惠券
    if (order.couponId) {
      await transaction.collection('userCoupons').where({
        couponId: order.couponId
      }).update({
        data: {
          status: 0,
          useTime: null,
          orderId: null
        }
      })
    }

    // 更新订单状态
    await transaction.collection('orders').doc(orderId).update({
      data: {
        status: ORDER_STATUS.CANCELLED,
        updateTime: now
      }
    })

    await transaction.commit()

  } catch (err) {
    await transaction.rollback()
    console.error('自动取消订单失败:', err)
  }
}

/**
 * 恢复库存（内部方法）
 * @param {Object} order - 订单数据
 */
async function restoreStock(order) {
  const now = db.serverDate()

  for (const item of order.products) {
    const productResult = await db.collection('products').doc(item.productId).get()
    const product = productResult.data

    if (item.specId && product.specs) {
      const specIndex = product.specs.findIndex(s => s._id === item.specId || s.id === item.specId)
      if (specIndex >= 0) {
        await db.collection('products').doc(item.productId).update({
          data: {
            [`specs.${specIndex}.stock`]: _.inc(item.quantity),
            sales: _.inc(-item.quantity),
            updateTime: now
          }
        })
      }
    } else {
      await db.collection('products').doc(item.productId).update({
        data: {
          stock: _.inc(item.quantity),
          sales: _.inc(-item.quantity),
          updateTime: now
        }
      })
    }
  }
}
