/**
 * 微信支付回调云函数
 * 功能：
 * 1. 接收微信支付回调
 * 2. 验证支付结果
 * 3. 更新订单状态
 * 4. 发送支付成功通知
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 更新订单状态为已支付
 */
async function updateOrderPaid(orderNo, transactionId) {
  const { data: orders } = await db.collection('orders')
    .where({ orderNo })
    .get();

  if (orders.length === 0) {
    throw new Error('订单不存在: ' + orderNo);
  }

  const order = orders[0];

  // 更新订单状态
  await db.collection('orders').doc(order._id).update({
    data: {
      status: 'paid',
      transactionId,
      payTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });

  return order;
}

/**
 * 发放消费积分
 * 规则：每消费1元获得2积分
 */
async function grantOrderPoints(order) {
  try {
    const points = Math.floor(order.payAmount * 2); // 每元2积分
    const openid = order.openid || order._openid;

    if (!points || points <= 0) {
      console.log('[grantOrderPoints] 积分不足，不发放');
      return;
    }

    // 1. 查询用户当前积分
    const { data: users } = await db.collection('users')
      .where({ _openid: openid })
      .get();

    let currentPoints = 0;
    let userId = null;

    if (users.length > 0) {
      currentPoints = users[0].points || 0;
      userId = users[0]._id;
    }

    const newBalance = currentPoints + points;

    // 2. 创建积分记录
    await db.collection('pointsHistory').add({
      data: {
        userId: openid,
        label: '下单获得积分',
        desc: `订单 ${order.orderNo}`,
        points: points,
        type: 'earn',
        category: 'order',
        balance: newBalance,
        orderId: order._id,
        orderNo: order.orderNo,
        createTime: db.serverDate()
      }
    });

    console.log('[grantOrderPoints] 积分记录已创建:', points);

    // 3. 更新用户积分余额
    if (userId) {
      await db.collection('users').doc(userId).update({
        data: {
          points: newBalance,
          updateTime: db.serverDate()
        }
      });
      console.log('[grantOrderPoints] 用户积分已更新:', newBalance);
    }

    return { points, newBalance };
  } catch (error) {
    console.error('[grantOrderPoints] 发放积分失败:', error);
    // 积分发放失败不影响支付流程
  }
}

/**
 * 发送支付成功通知
 */
async function sendPaySuccessMessage(order, openid) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: 'YOUR_TEMPLATE_ID', // 替换为实际的订阅消息模板ID
      page: `/pages/order-detail/order-detail?id=${order._id}`,
      data: {
        character_string1: { value: order.orderNo },
        amount2: { value: `¥${order.payAmount}` },
        thing3: { value: '温馨烘焙坊' },
        time4: { value: new Date().toLocaleString() }
      }
    });
  } catch (error) {
    console.error('发送通知失败:', error);
  }
}

/**
 * 云函数主入口
 */
exports.main = async (event, context) => {
  console.log('收到支付回调:', event);
  
  const {
    returnCode,
    outTradeNo,      // 商户订单号
    transactionId,   // 微信订单号
    totalFee,        // 订单金额
    resultCode       // 业务结果
  } = event;
  
  // 返回给微信服务器的响应
  const response = {
    errcode: 0,
    errmsg: 'OK'
  };
  
  try {
    // 验证支付结果
    if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
      console.error('支付失败:', event);
      return response;
    }
    
    // 1. 更新订单状态
    const order = await updateOrderPaid(outTradeNo, transactionId);

    console.log('订单状态已更新:', outTradeNo);

    // 2. 发放消费积分
    await grantOrderPoints(order);

    // 3. 发送支付成功通知
    await sendPaySuccessMessage(order, order.openid);
    
    return response;
    
  } catch (error) {
    console.error('处理支付回调失败:', error);
    
    // 即使处理失败，也要返回成功给微信，避免重复回调
    return response;
  }
};
