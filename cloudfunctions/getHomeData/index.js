// 云函数：获取首页数据
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 模拟数据
const mockData = {
  // 轮播图数据
  banners: [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
      title: '新品上市',
      subtitle: '法式可颂 酥脆香甜',
      link: '/pages/product-detail/product-detail?id=1'
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
      title: '会员专享',
      subtitle: '充值享8折优惠',
      link: '/pages/member/member'
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=800',
      title: '每日限量',
      subtitle: '手工欧包 每日现烤',
      link: '/pages/category/category'
    }
  ],

  // 快捷入口
  quickEntries: [
    { id: 1, name: '会员储值', icon: '💳', bgColor: 'linear-gradient(135deg, #FFE0B2, #FFCC80)', link: '/pages/member/member' },
    { id: 2, name: '领券中心', icon: '🎫', bgColor: 'linear-gradient(135deg, #FFCDD2, #EF9A9A)', link: '/pages/coupon/coupon' },
    { id: 3, name: '每日限量', icon: '🔥', bgColor: 'linear-gradient(135deg, #FFCCBC, #FFAB91)', link: '/pages/category/category?type=limited' },
    { id: 4, name: '新品推荐', icon: '✨', bgColor: 'linear-gradient(135deg, #C8E6C9, #A5D6A7)', link: '/pages/category/category?type=new' }
  ],

  // 分类数据
  categories: [
    {
      id: 1,
      name: '全部',
      count: 156,
      banner: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
      description: '精选各类烘焙美食',
      children: []
    },
    {
      id: 2,
      name: '面包',
      count: 48,
      banner: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600',
      description: '新鲜出炉，香气四溢',
      children: [
        { id: 21, name: '吐司' },
        { id: 22, name: '欧包' },
        { id: 23, name: '甜面包' },
        { id: 24, name: '全麦' }
      ]
    },
    {
      id: 3,
      name: '蛋糕',
      count: 36,
      banner: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600',
      description: '甜蜜滋味，幸福时光',
      children: [
        { id: 31, name: '芝士' },
        { id: 32, name: '慕斯' },
        { id: 33, name: '奶油' },
        { id: 34, name: '千层' }
      ]
    },
    {
      id: 4,
      name: '甜点',
      count: 42,
      banner: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600',
      description: '精致小点，下午茶首选',
      children: [
        { id: 41, name: '马卡龙' },
        { id: 42, name: '泡芙' },
        { id: 43, name: '蛋挞' },
        { id: 44, name: '曲奇' }
      ]
    },
    {
      id: 5,
      name: '饮品',
      count: 30,
      banner: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600',
      description: '现磨咖啡，鲜榨果汁',
      children: [
        { id: 51, name: '咖啡' },
        { id: 52, name: '奶茶' },
        { id: 53, name: '果汁' }
      ]
    },
    {
      id: 6,
      name: '礼盒',
      count: 15,
      banner: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=600',
      description: '精美包装，送礼佳品',
      children: []
    }
  ],

  // 热门搜索
  hotKeywords: ['可颂', '吐司', '蛋糕', '贝果', '欧包', '马卡龙', '芝士', '巧克力']
}

exports.main = async (event, context) => {
  const { type } = event

  try {
    let data = null

    switch (type) {
      case 'banners':
        data = mockData.banners
        break
      case 'quickEntries':
        data = mockData.quickEntries
        break
      case 'categories':
        data = mockData.categories
        break
      case 'hotKeywords':
        data = mockData.hotKeywords
        break
      default:
        // 返回所有数据
        data = mockData
    }

    return {
      code: 0,
      message: 'success',
      data
    }
  } catch (error) {
    console.error('获取首页数据失败:', error)
    return {
      code: -1,
      message: error.message || '获取数据失败',
      data: null
    }
  }
}
