/**
 * 积分相关云函数
 * - getList: 获取积分明细列表
 * - add: 添加积分记录
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 主入口函数
exports.main = async (event, context) => {
  const { action, data = {} } = event;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { code: -1, message: '用户未登录' };
  }

  try {
    switch (action) {
      case 'getList':
        return await getList(OPENID, data);
      case 'add':
        return await add(OPENID, data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[Points] 错误:', err);
    return { code: -1, message: err.message };
  }
};

/**
 * 获取积分明细列表
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.type - 类型: earn获取, spend使用
 * @param {Number} data.page - 页码
 * @param {Number} data.pageSize - 每页数量
 */
async function getList(openid, data) {
  const { type, page = 1, pageSize = 20 } = data;

  // 先获取用户的 _id（后台充值可能使用 _id 作为 userId）
  let userDocId = null;
  try {
    const userResult = await db.collection('users')
      .where({ _openid: openid })
      .limit(1)
      .get();
    if (userResult.data.length > 0 && userResult.data[0]._id) {
      userDocId = userResult.data[0]._id;
    }
  } catch (e) {
    console.log('[Points/getList] 获取用户ID失败:', e.message);
  }

  // 构建查询条件 - 同时匹配 openid 或 userId
  // 支持新旧两种数据结构：
  // 新数据：有 openid 字段存储 _openid
  // 旧数据：userId 字段可能是 _openid 或 _id
  const where = {
    $or: [
      { openid: openid },           // 新格式：匹配 openid 字段
      { userId: openid },           // 旧格式：userId 存储的是 openid
      ...(userDocId ? [
        { userId: userDocId }       // userId 存储的是 _id
      ] : [])
    ]
  };

  // 根据类型筛选
  if (type) {
    where.type = type;
  }

  console.log('[Points/getList] 查询条件:', where, '当前用户openid:', openid, '用户_docId:', userDocId);

  // 查询总数
  const countResult = await db.collection('pointsHistory')
    .where(where)
    .count();

  const total = countResult.total;

  // 查询列表
  const listResult = await db.collection('pointsHistory')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  console.log('[Points/getList] 查询结果:', listResult.data.length, '条');

  return {
    code: 0,
    message: 'success',
    data: {
      list: listResult.data,
      total,
      page,
      pageSize,
      totalPage: Math.ceil(total / pageSize)
    }
  };
}

/**
 * 添加积分记录
 * @param {String} openid - 用户openid
 * @param {Object} data - 请求参数
 * @param {String} data.label - 记录标签
 * @param {String} data.desc - 记录描述（如订单号）
 * @param {Number} data.points - 积分变动值（正数增加，负数减少）
 * @param {String} data.type - 类型: earn获取, spend使用
 * @param {String} data.category - 类别: order, bonus, redeem, event, signin
 * @param {Number} data.balance - 变动后的余额
 * @param {String} data.orderId - 关联订单ID
 * @param {String} data.orderNo - 关联订单号
 */
async function add(openid, data) {
  const { label, desc, points, type, category, balance, orderId, orderNo } = data;

  if (!label || points === undefined) {
    return { code: -1, message: '参数不完整' };
  }

  const now = db.serverDate();

  // 获取用户的 _id
  let userDocId = null;
  try {
    const userResult = await db.collection('users')
      .where({ _openid: openid })
      .limit(1)
      .get();
    if (userResult.data.length > 0 && userResult.data[0]._id) {
      userDocId = userResult.data[0]._id;
    }
  } catch (e) {
    console.log('[Points/add] 获取用户_docId失败:', e.message);
  }

  const record = {
    userId: userDocId || openid,  // 优先使用 _id，获取不到则用 openid
    openid: openid,               // 同时存储 openid
    label,
    desc: desc || '',
    points,
    type: type || (points >= 0 ? 'earn' : 'spend'),
    category: category || 'default',
    balance: balance || 0,
    orderId: orderId || '',
    orderNo: orderNo || '',
    createTime: now
  };

  const result = await db.collection('pointsHistory').add({
    data: record
  });

  console.log('[Points/add] 添加记录:', result._id, 'userId:', record.userId, 'openid:', record.openid);

  return {
    code: 0,
    message: 'success',
    data: {
      _id: result._id,
      ...record
    }
  };
}
