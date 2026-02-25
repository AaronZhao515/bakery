/**
 * 商品相关云函数
 * 功能：商品CRUD、分类管理
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;

  switch (action) {
    case 'getCategories':
      return await getCategories();
    case 'getProductList':
      return await getProductList(event);
    case 'getProductDetail':
      return await getProductDetail(event);
    case 'createProduct':
      return await createProduct(event);
    case 'updateProduct':
      return await updateProduct(event);
    case 'deleteProduct':
      return await deleteProduct(event);
    case 'batchDeleteProducts':
      return await batchDeleteProducts(event);
    case 'updateProductStatus':
      return await updateProductStatus(event);
    case 'batchUpdateStatus':
      return await batchUpdateStatus(event);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取商品分类
async function getCategories() {
  try {
    const res = await db.collection('categories')
      .where({ status: 'active' })
      .orderBy('sort', 'asc')
      .get();

    return {
      code: 0,
      data: res.data.map(item => ({
        id: item._id,
        name: item.name,
        icon: item.icon
      }))
    };
  } catch (error) {
    console.error('获取分类失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取商品列表
async function getProductList(event) {
  const { page = 1, pageSize = 10, keyword = '', category = '', status = '' } = event;

  try {
    let where = {};
    
    if (keyword) {
      where.name = db.RegExp({
        regexp: keyword,
        options: 'i'
      });
    }
    
    if (category) {
      where.categoryId = category;
    }
    
    if (status) {
      where.status = status;
    }

    const countRes = await db.collection('products').where(where).count();
    
    const res = await db.collection('products')
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
          name: item.name,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          price: item.price,
          originalPrice: item.originalPrice,
          stock: item.stock,
          sales: item.sales || 0,
          status: item.status,
          images: item.images
        })),
        total: countRes.total
      }
    };
  } catch (error) {
    console.error('获取商品列表失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 获取商品详情
async function getProductDetail(event) {
  const { id } = event;

  try {
    const res = await db.collection('products').doc(id).get();
    
    if (!res.data) {
      return { code: -1, message: '商品不存在' };
    }

    return {
      code: 0,
      data: {
        id: res.data._id,
        name: res.data.name,
        categoryId: res.data.categoryId,
        categoryName: res.data.categoryName,
        description: res.data.description,
        price: res.data.price,
        originalPrice: res.data.originalPrice,
        stock: res.data.stock,
        warningStock: res.data.warningStock,
        images: res.data.images,
        specs: res.data.specs,
        status: res.data.status
      }
    };
  } catch (error) {
    console.error('获取商品详情失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 创建商品
async function createProduct(event) {
  const { data } = event;

  try {
    const res = await db.collection('products').add({
      data: {
        ...data,
        sales: 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '创建成功',
      data: { id: res._id }
    };
  } catch (error) {
    console.error('创建商品失败:', error);
    return { code: -1, message: '创建失败' };
  }
}

// 更新商品
async function updateProduct(event) {
  const { id, data } = event;

  try {
    await db.collection('products').doc(id).update({
      data: {
        ...data,
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '更新成功'
    };
  } catch (error) {
    console.error('更新商品失败:', error);
    return { code: -1, message: '更新失败' };
  }
}

// 删除商品
async function deleteProduct(event) {
  const { id } = event;

  try {
    await db.collection('products').doc(id).remove();

    return {
      code: 0,
      message: '删除成功'
    };
  } catch (error) {
    console.error('删除商品失败:', error);
    return { code: -1, message: '删除失败' };
  }
}

// 批量删除商品
async function batchDeleteProducts(event) {
  const { ids } = event;

  try {
    const tasks = ids.map(id => db.collection('products').doc(id).remove());
    await Promise.all(tasks);

    return {
      code: 0,
      message: '删除成功'
    };
  } catch (error) {
    console.error('批量删除失败:', error);
    return { code: -1, message: '删除失败' };
  }
}

// 更新商品状态
async function updateProductStatus(event) {
  const { id, status } = event;

  try {
    await db.collection('products').doc(id).update({
      data: {
        status,
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '更新成功'
    };
  } catch (error) {
    console.error('更新状态失败:', error);
    return { code: -1, message: '更新失败' };
  }
}

// 批量更新状态
async function batchUpdateStatus(event) {
  const { ids, status } = event;

  try {
    await db.collection('products')
      .where({
        _id: _.in(ids)
      })
      .update({
        data: {
          status,
          updateTime: db.serverDate()
        }
      });

    return {
      code: 0,
      message: '更新成功'
    };
  } catch (error) {
    console.error('批量更新失败:', error);
    return { code: -1, message: '更新失败' };
  }
}
