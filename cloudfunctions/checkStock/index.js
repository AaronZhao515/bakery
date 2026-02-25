/**
 * 检查库存云函数
 * 功能：
 * 1. 批量检查商品库存
 * 2. 返回库存状态
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
  const { items } = event;
  
  // 参数校验
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      code: -1,
      message: '商品列表不能为空'
    };
  }
  
  try {
    const stockResults = [];
    const insufficientItems = [];
    
    // 批量查询商品库存
    for (const item of items) {
      const { data: product } = await db.collection('products')
        .doc(item.productId)
        .get()
        .catch(() => ({ data: null }));
      
      if (!product) {
        insufficientItems.push({
          productId: item.productId,
          name: item.name,
          reason: '商品不存在'
        });
        continue;
      }
      
      const isSufficient = product.stock >= item.quantity;
      
      stockResults.push({
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: product.stock,
        isSufficient
      });
      
      if (!isSufficient) {
        insufficientItems.push({
          productId: item.productId,
          name: item.name,
          requested: item.quantity,
          available: product.stock,
          reason: `库存不足，需要${item.quantity}件，仅剩${product.stock}件`
        });
      }
    }
    
    // 返回检查结果
    if (insufficientItems.length > 0) {
      return {
        code: -1,
        message: '部分商品库存不足',
        data: {
          allSufficient: false,
          stockResults,
          insufficientItems
        }
      };
    }
    
    return {
      code: 0,
      message: '库存充足',
      data: {
        allSufficient: true,
        stockResults
      }
    };
    
  } catch (error) {
    console.error('检查库存失败:', error);
    
    return {
      code: -1,
      message: error.message || '检查库存失败'
    };
  }
};
