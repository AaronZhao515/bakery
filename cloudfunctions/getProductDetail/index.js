// 云函数：获取商品详情
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 模拟商品详情数据
const mockProductDetails = {
  1: {
    id: 1,
    name: '法式可颂',
    description: '采用法国进口黄油，层层酥脆，奶香浓郁。每日现烤，新鲜出炉。经典法式风味，搭配咖啡的绝佳选择。',
    price: 18,
    originalPrice: 22,
    sales: 1234,
    rating: 4.9,
    stock: 99,
    reviewCount: 328,
    goodReviewCount: 312,
    imageReviewCount: 156,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
    images: [
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
      'https://images.unsplash.com/photo-1555507029-9fff6b090ac3?w=600',
      'https://images.unsplash.com/photo-1585476263060-b7a6b710f2a1?w=600'
    ],
    tags: [
      { name: '热销', color: '#E57373' },
      { name: '新品', color: '#81C784' }
    ],
    skus: [
      { id: 1, name: '原味', price: 18, originalPrice: 22, stock: 50 },
      { id: 2, name: '杏仁', price: 22, originalPrice: 26, stock: 30 },
      { id: 3, name: '巧克力', price: 24, originalPrice: 28, stock: 0 },
      { id: 4, name: '抹茶', price: 24, originalPrice: 28, stock: 20 }
    ],
    detailImages: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
      'https://images.unsplash.com/photo-1585476263060-b7a6b710f2a1?w=800',
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800'
    ],
    params: [
      { name: '品牌', value: '暖心烘焙' },
      { name: '产地', value: '中国大陆' },
      { name: '净含量', value: '80g/个' },
      { name: '保质期', value: '3天' },
      { name: '储存方式', value: '常温避光' },
      { name: '配料', value: '小麦粉、黄油、牛奶、鸡蛋、酵母、糖' }
    ]
  },
  2: {
    id: 2,
    name: '全麦吐司',
    description: '选用优质全麦粉，低糖低脂，健康营养。适合早餐搭配，是健身人士的首选。',
    price: 28,
    sales: 856,
    rating: 4.8,
    stock: 50,
    reviewCount: 186,
    goodReviewCount: 175,
    imageReviewCount: 89,
    image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600',
    images: [
      'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600',
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600'
    ],
    tags: [
      { name: '新品', color: '#81C784' },
      { name: '健康', color: '#4CAF50' }
    ],
    skus: [
      { id: 1, name: '整条约500g', price: 28, stock: 30 },
      { id: 2, name: '半条约250g', price: 15, stock: 20 }
    ],
    detailImages: [
      'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=800'
    ],
    params: [
      { name: '品牌', value: '暖心烘焙' },
      { name: '净含量', value: '500g/条' },
      { name: '保质期', value: '5天' },
      { name: '储存方式', value: '常温避光' }
    ]
  }
}

// 模拟评价数据
const mockReviews = [
  {
    id: 1,
    nickname: '烘焙爱好者',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
    rating: 5,
    date: '2024-01-15',
    content: '超级好吃！酥脆可口，黄油香味很浓，每天早上都要来一个配咖啡。强烈推荐！',
    images: [
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=200',
      'https://images.unsplash.com/photo-1585476263060-b7a6b710f2a1?w=200'
    ],
    sku: '原味'
  },
  {
    id: 2,
    nickname: '美食达人',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
    rating: 5,
    date: '2024-01-14',
    content: '包装很用心，送过来还是热的，口感非常好，会回购的！',
    images: [],
    sku: '杏仁'
  },
  {
    id: 3,
    nickname: '下午茶控',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
    rating: 4,
    date: '2024-01-13',
    content: '味道不错，就是稍微有点甜，如果能减糖就更好了。',
    images: [],
    sku: '原味'
  }
]

exports.main = async (event, context) => {
  const { type, productId } = event

  try {
    let data = null

    switch (type) {
      case 'reviews':
        // 获取评价列表
        data = mockReviews
        break

      default:
        // 获取商品详情
        const product = mockProductDetails[productId]
        if (product) {
          data = product
        } else {
          // 返回默认商品
          data = mockProductDetails[1]
          data.id = productId
        }
    }

    return {
      code: 0,
      message: 'success',
      data
    }
  } catch (error) {
    console.error('获取商品详情失败:', error)
    return {
      code: -1,
      message: error.message || '获取商品详情失败',
      data: null
    }
  }
}
