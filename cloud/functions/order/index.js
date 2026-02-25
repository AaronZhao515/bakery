/**
 * 订单相关云函数
 * 功能：订单查询、发货、退款处理
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;

  switch (action) {
    case 'getOrderList':
      return await getOrderList(event);
    case 'getOrderDetail':
      return await getOrderDetail(event);
    case 'getPendingOrders':
      return await getPendingOrders(event);
    case 'getStatusCounts':
      return await getStatusCounts();
    case 'shipOrder':
      return await shipOrder(event);
    case 'confirmDelivery':
      return await confirmDelivery(event);
    case 'handleRefund':
      return await handleRefund(event);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取订单列表
async function getOrderList(event) {
  const { page = 1, pageSize = 10, status = '', keyword = '' } = event;

  try {
    let where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (keyword) {
      where = _.or([
        { orderNo: db.RegExp({ regexp: keyword, options: 'i' }) },
        { userPhone: db.RegExp({ regexp: keyword, options: 'i' }) }
      ]);
    }

    const countRes = await db.collection('orders').where(where).count();
    
    const res = await db.collection('orders')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      data: {
        list: res.data.map(item => ({
          id: item._id,
          orderNo: item.orderNo,
          createTime: formatDate(item.createTime),
          status: item.status,
          statusText: getStatusText(item.status),
          totalQuantity: item.totalQuantity,
          totalAmount: item.totalAmount,
          userName: item.userName,
          userPhone: item.userPhone,
          userAvatar: item.userAvatar,
          goodsList: item.goodsList
        })),
        total: countRes.total
      }
    };
  } catch (error) {
    console.error('获取订单列表失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取订单详情
async function getOrderDetail(event) {
  const { id } = event;

  try {
    const res = await db.collection('orders').doc(id).get();
    
    if (!res.data) {
      return { code: -1, message: '订单不存在' };
    }

    return {
      code: 0,
      data: {
        id: res.data._id,
        orderNo: res.data.orderNo,
        createTime: formatDate(res.data.createTime),
        status: res.data.status,
        statusText: getStatusText(res.data.status),
        totalQuantity: res.data.totalQuantity,
        totalAmount: res.data.totalAmount,
        userName: res.data.userName,
        userPhone: res.data.userPhone,
        userAvatar: res.data.userAvatar,
        address: res.data.address,
        goodsList: res.data.goodsList,
        express: res.data.express,
        expressNo: res.data.expressNo,
        remark: res.data.remark
      }
    };
  } catch (error) {
    console.error('获取订单详情失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取待处理订单
async function getPendingOrders(event) {
  const { limit = 5 } = event;

  try {
    const res = await db.collection('orders')
      .where({
        status: _.in(['pending', 'paid', 'refunding'])
      })
      .orderBy('createTime', 'asc')
      .limit(limit)
      .get();

    return {
      code: 0,
      data: {
        list: res.data.map(item => ({
          id: item._id,
          orderNo: item.orderNo,
          status: item.status,
          statusText: getStatusText(item.status)
        }))
      }
    };
  } catch (error) {
    console.error('获取待处理订单失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取状态统计
async function getStatusCounts() {
  try {
    const statuses = ['pending', 'paid', 'shipped', 'completed', 'refunding', 'refunded', 'cancelled'];
    const counts = {};

    for (const status of statuses) {
      const res = await db.collection('orders').where({ status }).count();
      counts[status] = res.total;
    }

    return {
      code: 0,
      data: {
        all: Object.values(counts).reduce((a, b) => a + b, 0),
        pending: counts.pending,
        paid: counts.paid,
        shipped: counts.shipped,
        completed: counts.completed,
        refund: counts.refunding + counts.refunded,
        ...counts
      }
    };
  } catch (error) {
    console.error('获取状态统计失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 订单发货
async function shipOrder(event) {
  const { orderId, express, expressNo, remark = '' } = event;

  try {
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'shipped',
        express,
        expressNo,
        shipRemark: remark,
        shipTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '发货成功'
    };
  } catch (error) {
    console.error('发货失败:', error);
    return { code: -1, message: '发货失败' };
  }
}

// 确认送达
async function confirmDelivery(event) {
  const { orderId } = event;

  try {
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'completed',
        completeTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '确认成功'
    };
  } catch (error) {
    console.error('确认送达失败:', error);
    return { code: -1, message: '操作失败' };
  }
}

// 处理退款
async function handleRefund(event) {
  const { orderId, refundAction } = event;

  try {
    const orderRes = await db.collection('orders').doc(orderId).get();
    
    if (!orderRes.data) {
      return { code: -1, message: '订单不存在' };
    }

    const order = orderRes.data;

    if (refundAction === 'approve') {
      // 同意退款
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'refunded',
          refundTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });

      // 恢复库存
      for (const goods of order.goodsList) {
        await db.collection('products').doc(goods.productId).update({
          data: {
            stock: _.inc(goods.quantity)
          }
        });
      }

      return { code: 0, message: '退款成功' };
    } else {
      // 拒绝退款
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'paid',
          refundRejectReason: '商家拒绝退款',
          updateTime: db.serverDate()
        }
      });

      return { code: 0, message: '已拒绝退款' };
    }
  } catch (error) {
    console.error('退款处理失败:', error);
    return { code: -1, message: '处理失败' };
  }
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    'pending': '待付款',
    'paid': '待发货',
    'shipped': '待收货',
    'completed': '已完成',
    'refunding': '退款中',
    'refunded': '已退款',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

// 格式化日期
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
