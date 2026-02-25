/**
 * 数据统计相关云函数
 * 功能：销售统计、趋势分析、商品排行
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

exports.main = async (event, context) => {
  const { action } = event;

  switch (action) {
    case 'getTodayStats':
      return await getTodayStats();
    case 'getOverview':
      return await getOverview(event);
    case 'getTrendData':
      return await getTrendData(event);
    case 'getHotProducts':
      return await getHotProducts(event);
    case 'getProductRanking':
      return await getProductRanking(event);
    case 'getOrderStats':
      return await getOrderStats(event);
    case 'getUserStats':
      return await getUserStats(event);
    case 'getCategoryStats':
      return await getCategoryStats(event);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取今日统计数据
async function getTodayStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 今日订单统计
    const orderRes = await db.collection('orders')
      .where({
        createTime: _.gte(today).and(_.lt(tomorrow)),
        status: _.nin(['cancelled', 'refunded'])
      })
      .get();

    const orderCount = orderRes.data.length;
    const salesAmount = orderRes.data.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // 低库存商品数量
    const lowStockRes = await db.collection('products')
      .where(_.expr(_.lte(['$stock', '$warningStock'])))
      .count();

    // 访客数（模拟数据）
    const visitorCount = Math.floor(Math.random() * 100) + 50;

    return {
      code: 0,
      data: {
        orderCount,
        salesAmount: salesAmount.toFixed(2),
        visitorCount,
        lowStockCount: lowStockRes.total,
        orderTrend: 12,
        salesTrend: 8,
        visitorTrend: -5
      }
    };
  } catch (error) {
    console.error('获取今日统计失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取核心数据概览
async function getOverview(event) {
  const { dateRange, startDate, endDate } = event;

  try {
    const { start, end } = getDateRange(dateRange, startDate, endDate);

    // 销售额和订单数
    const orderRes = await db.collection('orders')
      .where({
        createTime: _.gte(start).and(_.lt(end)),
        status: _.nin(['cancelled', 'refunded'])
      })
      .get();

    const orderCount = orderRes.data.length;
    const salesAmount = orderRes.data.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const avgOrderAmount = orderCount > 0 ? (salesAmount / orderCount).toFixed(1) : 0;

    return {
      code: 0,
      data: {
        salesAmount: salesAmount.toFixed(2),
        salesTrend: 12.5,
        orderCount,
        orderTrend: 8.3,
        avgOrderAmount,
        avgTrend: 3.8
      }
    };
  } catch (error) {
    console.error('获取概览数据失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取销售趋势数据
async function getTrendData(event) {
  const { dateRange, startDate, endDate } = event;

  try {
    const { start, end } = getDateRange(dateRange, startDate, endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const trendData = [];
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    for (let i = 0; i < Math.min(days, 7); i++) {
      const dayStart = new Date(start);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const orderRes = await db.collection('orders')
        .where({
          createTime: _.gte(dayStart).and(_.lt(dayEnd)),
          status: _.nin(['cancelled', 'refunded'])
        })
        .get();

      const sales = orderRes.data.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      trendData.push({
        date: weekDays[dayStart.getDay()],
        sales: Math.round(sales),
        orders: orderRes.data.length
      });
    }

    return {
      code: 0,
      data: trendData
    };
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取热销商品
async function getHotProducts(event) {
  const { limit = 5 } = event;

  try {
    const res = await db.collection('products')
      .orderBy('sales', 'desc')
      .limit(limit)
      .get();

    return {
      code: 0,
      data: {
        list: res.data.map(item => ({
          id: item._id,
          name: item.name,
          image: item.images[0] || '',
          sales: item.sales || 0,
          amount: ((item.sales || 0) * item.price).toFixed(0)
        }))
      }
    };
  } catch (error) {
    console.error('获取热销商品失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取商品排行
async function getProductRanking(event) {
  const { dateRange, startDate, endDate, type = 'amount' } = event;

  try {
    const { start, end } = getDateRange(dateRange, startDate, endDate);

    // 获取订单中的商品销售数据
    const orderRes = await db.collection('orders')
      .where({
        createTime: _.gte(start).and(_.lt(end)),
        status: _.nin(['cancelled', 'refunded'])
      })
      .get();

    // 统计商品销售
    const productStats = {};
    
    for (const order of orderRes.data) {
      for (const goods of (order.goodsList || [])) {
        if (!productStats[goods.productId]) {
          productStats[goods.productId] = {
            id: goods.productId,
            name: goods.name,
            image: goods.image,
            quantity: 0,
            amount: 0
          };
        }
        productStats[goods.productId].quantity += goods.quantity;
        productStats[goods.productId].amount += goods.price * goods.quantity;
      }
    }

    // 排序
    const sortedList = Object.values(productStats).sort((a, b) => {
      return type === 'amount' ? b.amount - a.amount : b.quantity - a.quantity;
    }).slice(0, 10);

    return {
      code: 0,
      data: {
        list: sortedList.map(item => ({
          ...item,
          amount: item.amount.toFixed(0)
        }))
      }
    };
  } catch (error) {
    console.error('获取商品排行失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取订单统计
async function getOrderStats(event) {
  const { dateRange, startDate, endDate } = event;

  try {
    const { start, end } = getDateRange(dateRange, startDate, endDate);

    const statuses = ['pending', 'paid', 'shipped', 'completed', 'refunded', 'cancelled'];
    const stats = {};

    for (const status of statuses) {
      const res = await db.collection('orders')
        .where({
          createTime: _.gte(start).and(_.lt(end)),
          status
        })
        .count();
      stats[status] = res.total;
    }

    return {
      code: 0,
      data: stats
    };
  } catch (error) {
    console.error('获取订单统计失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取用户统计
async function getUserStats(event) {
  const { dateRange, startDate, endDate } = event;

  try {
    const { start, end } = getDateRange(dateRange, startDate, endDate);

    // 总用户数
    const totalRes = await db.collection('users').count();

    // 新增用户
    const newRes = await db.collection('users')
      .where({
        createTime: _.gte(start).and(_.lt(end))
      })
      .count();

    // 活跃用户（模拟）
    const activeRes = await db.collection('users')
      .where({
        lastLoginTime: _.gte(start).and(_.lt(end))
      })
      .count();

    // 会员用户
    const vipRes = await db.collection('users')
      .where({
        isVip: true
      })
      .count();

    return {
      code: 0,
      data: {
        totalUsers: totalRes.total,
        newUsers: newRes.total,
        activeUsers: activeRes.total,
        vipUsers: vipRes.total
      }
    };
  } catch (error) {
    console.error('获取用户统计失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取分类销售占比
async function getCategoryStats(event) {
  const { dateRange, startDate, endDate } = event;

  try {
    const { start, end } = getDateRange(dateRange, startDate, endDate);

    const orderRes = await db.collection('orders')
      .where({
        createTime: _.gte(start).and(_.lt(end)),
        status: _.nin(['cancelled', 'refunded'])
      })
      .get();

    // 统计分类销售
    const categoryStats = {};
    let totalAmount = 0;

    for (const order of orderRes.data) {
      for (const goods of (order.goodsList || [])) {
        // 获取商品分类
        const productRes = await db.collection('products').doc(goods.productId).get();
        const categoryName = (productRes.data && productRes.data.categoryName) || '其他';

        if (!categoryStats[categoryName]) {
          categoryStats[categoryName] = 0;
        }
        const amount = goods.price * goods.quantity;
        categoryStats[categoryName] += amount;
        totalAmount += amount;
      }
    }

    // 计算百分比
    const colors = ['#d4a574', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    const result = Object.entries(categoryStats).map(([name, amount], index) => ({
      id: name,
      name,
      amount: amount.toFixed(2),
      percent: totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : 0,
      color: colors[index % colors.length]
    })).sort((a, b) => b.amount - a.amount);

    return {
      code: 0,
      data: result
    };
  } catch (error) {
    console.error('获取分类统计失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取日期范围
function getDateRange(dateRange, startDate, endDate) {
  const now = new Date();
  let start, end;

  switch (dateRange) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;
    case 'week':
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
      break;
    case 'custom':
      start = new Date(startDate);
      end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      break;
    default:
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
  }

  return { start, end };
}
