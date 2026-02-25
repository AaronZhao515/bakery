/**
 * 商品相关云函数
 * - getList: 获取商品列表（支持分类筛选、分页）
 * - getDetail: 获取商品详情
 * - search: 搜索商品
 */
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

// 主入口函数
exports.main = async (event, context) => {
  const { action, data = {} } = event

  try {
    switch (action) {
      case 'getList':
        return await getList(data)
      case 'getDetail':
        return await getDetail(data)
      case 'search':
        return await search(data)
      case 'getCategories':
        return await getCategories(data)
      case 'getRecommend':
        return await getRecommend(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('商品云函数错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 获取商品列表
 * @param {Object} data - 请求参数
 * @param {String} data.categoryId - 分类ID
 * @param {String} data.keyword - 关键词
 * @param {Number} data.status - 状态筛选 0下架 1上架
 * @param {Number} data.page - 页码，默认1
 * @param {Number} data.pageSize - 每页数量，默认10
 * @param {String} data.sortField - 排序字段
 * @param {String} data.sortOrder - 排序方式 asc/desc
 */
async function getList(data) {
  const {
    categoryId,
    keyword,
    status = 1,
    page = 1,
    pageSize = 10,
    limit,
    sortField = 'sort',
    sortOrder = 'asc'
  } = data

  // 支持 limit 或 pageSize 参数
  const finalPageSize = limit || pageSize

  // 构建查询条件
  const where = {
    status: status
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  if (keyword) {
    where.name = db.RegExp({
      regexp: keyword,
      options: 'i'
    })
  }

  // 构建排序条件
  const sort = {}
  sort[sortField] = sortOrder === 'asc' ? 1 : -1

  // 查询总数
  const countResult = await db.collection('products').where(where).count()
  const total = countResult.total

  // 查询列表
  const listResult = await db.collection('products')
    .where(where)
    .orderBy(sortField, sortOrder)
    .skip((page - 1) * finalPageSize)
    .limit(finalPageSize)
    .get()

  // 获取分类信息
  const categoryIds = [...new Set(listResult.data.map(item => item.categoryId).filter(Boolean))]
  let categoryMap = {}
  
  if (categoryIds.length > 0) {
    const categoryResult = await db.collection('categories')
      .where({
        _id: _.in(categoryIds)
      })
      .get()
    
    categoryMap = categoryResult.data.reduce((map, cat) => {
      map[cat._id] = cat.name
      return map
    }, {})
  }

  // 组装数据
  const list = listResult.data.map(item => ({
    ...item,
    categoryName: categoryMap[item.categoryId] || ''
  }))

  return {
    code: 0,
    message: 'success',
    data: {
      list,
      total,
      page,
      pageSize: finalPageSize,
      totalPage: Math.ceil(total / finalPageSize)
    }
  }
}

/**
 * 获取商品详情
 * @param {Object} data - 请求参数
 * @param {String} data.productId - 商品ID
 */
async function getDetail(data) {
  const { productId } = data

  if (!productId) {
    return { code: -1, message: '商品ID不能为空' }
  }

  // 查询商品详情
  const productResult = await db.collection('products').doc(productId).get()
  
  if (!productResult.data) {
    return { code: -1, message: '商品不存在' }
  }

  const product = productResult.data

  // 获取分类信息
  let categoryName = ''
  if (product.categoryId) {
    const categoryResult = await db.collection('categories').doc(product.categoryId).get()
    categoryName = categoryResult.data ? categoryResult.data.name : ''
  }

  // 获取推荐商品（同分类）
  let recommendList = []
  if (product.categoryId) {
    const recommendResult = await db.collection('products')
      .where({
        categoryId: product.categoryId,
        _id: _.neq(productId),
        status: 1
      })
      .limit(4)
      .get()
    recommendList = recommendResult.data
  }

  return {
    code: 0,
    message: 'success',
    data: {
      ...product,
      categoryName,
      recommendList
    }
  }
}

/**
 * 搜索商品
 * @param {Object} data - 请求参数
 * @param {String} data.keyword - 搜索关键词
 * @param {Number} data.page - 页码
 * @param {Number} data.pageSize - 每页数量
 */
async function search(data) {
  const { keyword, page = 1, pageSize = 10 } = data

  if (!keyword || keyword.trim() === '') {
    return { code: -1, message: '搜索关键词不能为空' }
  }

  // 构建搜索条件（支持名称和描述搜索）
  const where = {
    status: 1,
    $or: [
      {
        name: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      },
      {
        description: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      }
    ]
  }

  // 查询总数
  const countResult = await db.collection('products').where(where).count()
  const total = countResult.total

  // 查询列表
  const listResult = await db.collection('products')
    .where(where)
    .orderBy('sales', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    code: 0,
    message: 'success',
    data: {
      list: listResult.data,
      total,
      page,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
      keyword
    }
  }
}

/**
 * 获取商品分类
 */
async function getCategories(data) {
  try {
    const result = await db.collection('categories')
      .orderBy('sort', 'asc')
      .get()

    return {
      code: 0,
      message: 'success',
      data: result.data
    }
  } catch (err) {
    console.error('获取分类失败:', err)
    return { code: -1, message: '获取分类失败' }
  }
}

/**
 * 获取推荐商品
 * @param {Object} data - 请求参数
 * @param {Number} data.limit - 数量限制
 */
async function getRecommend(data) {
  const { limit = 6 } = data

  try {
    const result = await db.collection('products')
      .where({
        status: 1
      })
      .orderBy('sales', 'desc')
      .limit(limit)
      .get()

    return {
      code: 0,
      message: 'success',
      data: result.data
    }
  } catch (err) {
    console.error('获取推荐商品失败:', err)
    return { code: -1, message: '获取推荐商品失败' }
  }
}
