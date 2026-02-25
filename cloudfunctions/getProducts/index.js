// 云函数：获取商品列表
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 模拟商品数据
const mockProducts = [
  {
    id: 1,
    name: '法式可颂',
    description: '层层酥脆，黄油香浓',
    price: 18,
    originalPrice: 22,
    sales: 1234,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',
    categoryId: 2,
    tag: '热销',
    tagColor: '#E57373'
  },
  {
    id: 2,
    name: '全麦吐司',
    description: '健康低糖，营养早餐',
    price: 28,
    sales: 856,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=400',
    categoryId: 2,
    tag: '新品',
    tagColor: '#81C784'
  },
  {
    id: 3,
    name: '巧克力麦芬',
    description: '浓郁巧克力，松软可口',
    price: 15,
    originalPrice: 18,
    sales: 2341,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400',
    categoryId: 4,
    tag: '特惠',
    tagColor: '#FFB74D'
  },
  {
    id: 4,
    name: '蓝莓贝果',
    description: '手工制作，嚼劲十足',
    price: 22,
    sales: 567,
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1621236378699-8597fab6a5b1?w=400',
    categoryId: 2
  },
  {
    id: 5,
    name: '肉桂卷',
    description: '香甜肉桂，温暖治愈',
    price: 20,
    sales: 789,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=400',
    categoryId: 2,
    tag: '限量',
    tagColor: '#BA68C8'
  },
  {
    id: 6,
    name: '芝士蛋糕',
    description: '入口即化，奶香浓郁',
    price: 35,
    sales: 432,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1524351199678-941a58a3df26?w=400',
    categoryId: 3
  },
  {
    id: 7,
    name: '提拉米苏',
    description: '意式经典，咖啡香浓',
    price: 38,
    sales: 321,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
    categoryId: 3
  },
  {
    id: 8,
    name: '草莓千层',
    description: '层层香滑，草莓鲜甜',
    price: 42,
    sales: 298,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
    categoryId: 3,
    tag: '新品',
    tagColor: '#81C784'
  },
  {
    id: 9,
    name: '马卡龙礼盒',
    description: '法式甜点，精美礼盒',
    price: 88,
    sales: 156,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=400',
    categoryId: 6
  },
  {
    id: 10,
    name: '美式咖啡',
    description: '现磨咖啡豆，香醇浓郁',
    price: 22,
    sales: 2100,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1497515114889-1c6a5e7cda82?w=400',
    categoryId: 5
  }
]

exports.main = async (event, context) => {
  const { type, categoryId, subCategoryId, sortType, priceSort, page = 1, pageSize = 10, keyword } = event

  try {
    let products = [...mockProducts]
    let total = mockProducts.length

    // 根据类型筛选
    switch (type) {
      case 'recommend':
        // 推荐商品，按销量排序取前几个
        products = products.sort((a, b) => b.sales - a.sales).slice(0, pageSize)
        break

      case 'category':
        // 按分类筛选
        if (categoryId && categoryId !== 1) {
          products = products.filter(p => p.categoryId === categoryId)
        }
        break

      case 'search':
        // 搜索商品
        if (keyword) {
          const lowerKeyword = keyword.toLowerCase()
          products = products.filter(p =>
            p.name.toLowerCase().includes(lowerKeyword) ||
            p.description.toLowerCase().includes(lowerKeyword)
          )
        }
        break

      case 'suggestions':
        // 搜索建议
        if (keyword) {
          const lowerKeyword = keyword.toLowerCase()
          const suggestions = products
            .filter(p => p.name.toLowerCase().includes(lowerKeyword))
            .map(p => p.name)
            .slice(0, 5)
          return {
            code: 0,
            message: 'success',
            data: suggestions
          }
        }
        return {
          code: 0,
          message: 'success',
          data: []
        }

      default:
        break
    }

    // 排序
    if (sortType === 'sales') {
      products.sort((a, b) => b.sales - a.sales)
    } else if (sortType === 'price') {
      if (priceSort === 'asc') {
        products.sort((a, b) => a.price - b.price)
      } else {
        products.sort((a, b) => b.price - a.price)
      }
    } else if (sortType === 'new') {
      products.sort((a, b) => b.id - a.id)
    }

    // 分页
    total = products.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    products = products.slice(start, end)

    return {
      code: 0,
      message: 'success',
      data: {
        list: products,
        total,
        page,
        pageSize
      }
    }
  } catch (error) {
    console.error('获取商品列表失败:', error)
    return {
      code: -1,
      message: error.message || '获取商品列表失败',
      data: null
    }
  }
}
