/**
 * 库存相关云函数
 * 功能：库存查询、库存调整、库存记录
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;

  switch (action) {
    case 'getStockStats':
      return await getStockStats();
    case 'getStockList':
      return await getStockList(event);
    case 'getLowStockItems':
      return await getLowStockItems(event);
    case 'getStockRecords':
      return await getStockRecords(event);
    case 'adjustStock':
      return await adjustStock(event);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取库存统计
async function getStockStats() {
  try {
    const totalRes = await db.collection('products').count();
    
    const lowStockRes = await db.collection('products')
      .where(_.expr(_.lte(['$stock', '$warningStock'])))
      .count();
    
    const outOfStockRes = await db.collection('products')
      .where({ stock: 0 })
      .count();

    return {
      code: 0,
      data: {
        totalProducts: totalRes.total,
        lowStockCount: lowStockRes.total,
        outOfStockCount: outOfStockRes.total
      }
    };
  } catch (error) {
    console.error('获取库存统计失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取库存列表
async function getStockList(event) {
  const { page = 1, pageSize = 10, type = 'all' } = event;

  try {
    let where = {};
    
    if (type === 'warning') {
      where = _.expr(_.lte(['$stock', '$warningStock']));
    }

    const countRes = await db.collection('products').where(where).count();
    
    const res = await db.collection('products')
      .where(where)
      .orderBy('stock', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      data: {
        list: res.data.map(item => ({
          id: item._id,
          name: item.name,
          image: item.images[0] || '',
          stock: item.stock,
          warningStock: item.warningStock
        })),
        total: countRes.total
      }
    };
  } catch (error) {
    console.error('获取库存列表失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取低库存商品
async function getLowStockItems(event) {
  const { limit = 5 } = event;

  try {
    const res = await db.collection('products')
      .where(_.expr(_.lte(['$stock', '$warningStock'])))
      .orderBy('stock', 'asc')
      .limit(limit)
      .get();

    return {
      code: 0,
      data: {
        list: res.data.map(item => ({
          id: item._id,
          name: item.name,
          stock: item.stock,
          warningStock: item.warningStock
        }))
      }
    };
  } catch (error) {
    console.error('获取低库存商品失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取库存记录
async function getStockRecords(event) {
  const { page = 1, pageSize = 10, startDate = '', endDate = '' } = event;

  try {
    let where = {};
    
    if (startDate && endDate) {
      where.createTime = _.gte(new Date(startDate)).and(_.lte(new Date(endDate + ' 23:59:59')));
    }

    const countRes = await db.collection('stock_records').where(where).count();
    
    const res = await db.collection('stock_records')
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
          productName: item.productName,
          type: item.type,
          typeName: item.operationTypeName,
          quantity: item.quantity,
          createTime: formatDate(item.createTime),
          remark: item.remark
        })),
        total: countRes.total
      }
    };
  } catch (error) {
    console.error('获取库存记录失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 调整库存
async function adjustStock(event) {
  const { productId, type, quantity, operationType, operationTypeName, remark = '' } = event;

  try {
    // 获取商品信息
    const productRes = await db.collection('products').doc(productId).get();
    
    if (!productRes.data) {
      return { code: -1, message: '商品不存在' };
    }

    const product = productRes.data;
    let newStock = product.stock;

    if (type === 'in') {
      newStock += quantity;
    } else {
      newStock -= quantity;
      if (newStock < 0) {
        return { code: -1, message: '库存不足' };
      }
    }

    // 更新库存
    await db.collection('products').doc(productId).update({
      data: {
        stock: newStock,
        updateTime: db.serverDate()
      }
    });

    // 添加库存记录
    await db.collection('stock_records').add({
      data: {
        productId,
        productName: product.name,
        type,
        operationType,
        operationTypeName,
        quantity,
        beforeStock: product.stock,
        afterStock: newStock,
        remark,
        createTime: db.serverDate(),
        operator: event.userInfo ? event.userInfo.openId : 'system'
      }
    });

    return {
      code: 0,
      message: '操作成功',
      data: { newStock }
    };
  } catch (error) {
    console.error('调整库存失败:', error);
    return { code: -1, message: '操作失败' };
  }
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
