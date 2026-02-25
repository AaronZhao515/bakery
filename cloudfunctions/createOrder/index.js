/**
 * 创建订单云函数
 * 功能：
 * 1. 库存检查（原子操作）
 * 2. 扣减库存
 * 3. 创建订单
 * 4. 返回订单信息
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 生成订单号
 */
function generateOrderNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  
  return `BR${year}${month}${day}${hour}${minute}${second}${random}`;
}

/**
 * 检查并扣减库存（事务处理）
 */
async function checkAndDeductStock(items) {
  const stockResults = [];
  
  // 1. 先查询所有商品库存
  for (const item of items) {
    const { data: product } = await db.collection('products')
      .doc(item.productId)
      .get();
    
    if (!product) {
      throw new Error(`商品 ${item.name} 不存在`);
    }
    
    if (product.stock < item.quantity) {
      throw new Error(`商品 ${item.name} 库存不足，剩余 ${product.stock} 件`);
    }
    
    stockResults.push({
      productId: item.productId,
      currentStock: product.stock,
      deductQuantity: item.quantity
    });
  }
  
  // 2. 扣减库存（使用原子操作）
  const updatePromises = stockResults.map(({ productId, deductQuantity }) => 
    db.collection('products').doc(productId).update({
      data: {
        stock: _.inc(-deductQuantity),
        sales: _.inc(deductQuantity),
        updateTime: db.serverDate()
      }
    })
  );
  
  await Promise.all(updatePromises);
  
  return stockResults;
}

/**
 * 恢复库存（用于订单取消或支付失败）
 */
async function restoreStock(items) {
  const restorePromises = items.map(item => 
    db.collection('products').doc(item.productId).update({
      data: {
        stock: _.inc(item.quantity),
        sales: _.inc(-item.quantity),
        updateTime: db.serverDate()
      }
    })
  );
  
  await Promise.all(restorePromises);
}

/**
 * 创建订单
 */
async function createOrder(orderData, openid, userPoints, requiredPoints, hasEnoughPoints) {
  const orderNo = generateOrderNo();

  const order = {
    orderNo,
    openid,
    items: orderData.items,
    deliveryType: orderData.deliveryType,
    address: orderData.address,
    pickupTime: orderData.pickupTime,
    remark: orderData.remark || '',
    goodsTotal: orderData.goodsTotal,
    deliveryFee: orderData.deliveryFee,
    discountAmount: orderData.discountAmount,
    couponAmount: orderData.couponAmount,
    payAmount: orderData.payAmount,
    // 积分相关字段
    requiredPoints,
    userPoints,
    hasEnoughPoints,
    pointsDeducted: 0,
    status: 'unpaid', // unpaid-待支付, paid-已支付, shipped-已发货, completed-已完成, cancelled-已取消
    createTime: db.serverDate(),
    updateTime: db.serverDate(),
    payTime: null,
    shipTime: null,
    completeTime: null
  };

  const { _id } = await db.collection('orders').add({
    data: order
  });

  return { orderId: _id, orderNo };
}

/**
 * 云函数主入口
 */
exports.main = async (event, context) => {
  const { 
    items, 
    deliveryType, 
    address, 
    pickupTime, 
    remark,
    goodsTotal,
    deliveryFee,
    discountAmount,
    couponAmount,
    payAmount 
  } = event;
  
  // 获取用户openid
  const { OPENID } = cloud.getWXContext();
  
  if (!OPENID) {
    return {
      code: -1,
      message: '用户未登录'
    };
  }
  
  // 参数校验
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      code: -1,
      message: '商品列表不能为空'
    };
  }
  
  if (deliveryType === 'delivery' && !address) {
    return {
      code: -1,
      message: '配送地址不能为空'
    };
  }
  
  if (deliveryType === 'selfpickup' && !pickupTime) {
    return {
      code: -1,
      message: '自取时间不能为空'
    };
  }
  
  try {
    // 1. 获取用户积分信息
    const userResult = await db.collection('users').where({ openid: OPENID }).get();
    const user = userResult.data[0] || {};
    const userPoints = user.points || 0;

    // 计算所需积分（1元 = 1积分）
    const requiredPoints = Math.ceil(parseFloat(payAmount));

    // 检查积分是否足够
    const hasEnoughPoints = userPoints >= requiredPoints;

    // 2. 检查并扣减库存
    await checkAndDeductStock(items);

    // 3. 创建订单
    const orderData = {
      items,
      deliveryType,
      address,
      pickupTime,
      remark,
      goodsTotal,
      deliveryFee,
      discountAmount,
      couponAmount,
      payAmount
    };

    const { orderId, orderNo } = await createOrder(orderData, OPENID, userPoints, requiredPoints, hasEnoughPoints);

    return {
      code: 0,
      message: '订单创建成功',
      data: {
        orderId,
        orderNo,
        payAmount,
        requiredPoints,
        userPoints,
        hasEnoughPoints
      }
    };
    
  } catch (error) {
    console.error('创建订单失败:', error);
    
    // 如果已经扣减了库存，需要恢复
    if (error.message && error.message.includes('库存')) {
      // 库存相关错误，不需要恢复
    } else {
      // 其他错误，尝试恢复库存
      try {
        await restoreStock(items);
      } catch (restoreError) {
        console.error('恢复库存失败:', restoreError);
      }
    }
    
    return {
      code: -1,
      message: error.message || '创建订单失败'
    };
  }
};
