/**
 * 查询支付状态云函数
 * 功能：
 * 1. 查询订单支付状态
 * 2. 返回支付结果
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 云函数主入口
 */
exports.main = async (event, context) => {
  const { orderId } = event;
  
  // 参数校验
  if (!orderId) {
    return {
      code: -1,
      message: '订单ID不能为空'
    };
  }
  
  try {
    // 查询订单
    const { data: order } = await db.collection('orders')
      .doc(orderId)
      .get()
      .catch(() => ({ data: null }));
    
    if (!order) {
      return {
        code: -1,
        message: '订单不存在'
      };
    }
    
    // 返回支付状态
    const statusMap = {
      'unpaid': 'unpaid',
      'paid': 'paid',
      'shipped': 'paid',
      'completed': 'paid',
      'cancelled': 'failed'
    };
    
    return {
      code: 0,
      message: '查询成功',
      data: {
        orderId,
        orderNo: order.orderNo,
        status: statusMap[order.status] || 'unknown',
        orderStatus: order.status,
        payAmount: order.payAmount,
        payTime: order.payTime,
        transactionId: order.transactionId
      }
    };
    
  } catch (error) {
    console.error('查询支付状态失败:', error);
    
    return {
      code: -1,
      message: error.message || '查询支付状态失败'
    };
  }
};
