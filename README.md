# 暖心烘焙 - 面包烘焙微信小程序

<p align="center">
  <img src="https://636c-cloud1-5gh4dyhpb180b5fb-1406006729.tcb.qcloud.la/images/logo.png" width="120" alt="暖心烘焙 Logo">
</p>

<p align="center">
  <b>基于微信云开发的面包烘焙电商小程序</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/微信小程序-2.30.0+-brightgreen" alt="微信小程序">
  <img src="https://img.shields.io/badge/云开发-TCB-blue" alt="微信云开发">
  <img src="https://img.shields.io/badge/微信支付-已集成-orange" alt="微信支付">
</p>

---

## 📖 项目介绍

暖心烘焙是一款面向面包烘焙店的微信小程序，采用**双角色架构**：
- **客户端**：面向普通用户，提供商品浏览、购物车、下单支付、订单追踪、会员中心等功能
- **管理端**：面向店主/员工，提供商品管理、库存管理、订单处理、数据统计、营销配置等功能

### 核心特性

| 特性 | 说明 |
|------|------|
| 🛡️ **防超卖机制** | 数据库事务确保库存扣减原子性 |
| 📦 **实时库存同步** | 订单创建、取消、退款时自动恢复库存 |
| 💳 **微信支付集成** | 云调用方式，免证书免签名 |
| 📊 **数据统计** | 销售趋势、商品排行、用户分析 |
| 🎫 **优惠券系统** | 支持满减券和折扣券 |
| 🔔 **消息通知** | 订单状态变更订阅消息推送 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        微信小程序                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   客户端    │  │   管理端    │  │     自定义组件      │  │
│  │  (用户端)   │  │  (店主端)   │  │  nav-bar/product-card│ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      微信云开发 (TCB)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   云函数    │  │   云数据库   │  │      云存储         │  │
│  │  Node.js    │  │   MongoDB   │  │    图片/文件        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

- **前端**: 微信小程序原生框架 (WXML/WXSS/JS)
- **后端**: 微信云开发 (云函数 + 云数据库 + 云存储)
- **状态管理**: 自定义全局状态管理
- **支付**: 微信支付 (云调用免鉴权)

---

## 📁 项目结构

```
bread-bakery-miniprogram/
├── app.js                          # 应用入口
├── app.json                        # 全局配置
├── app.wxss                        # 全局样式
├── sitemap.json                    # 站点地图
├── project.config.json             # 项目配置
├── README.md                       # 项目说明
├── DEPLOY.md                       # 部署指南
│
├── components/                     # 自定义组件
│   ├── nav-bar/                    # 导航栏组件
│   ├── product-card/               # 商品卡片组件
│   ├── loading/                    # 加载动画组件
│   ├── empty/                      # 空状态组件
│   ├── modal/                      # 弹窗组件
│   └── toast/                      # 轻提示组件
│
├── pages/                          # 主包页面
│   ├── index/                      # 首页
│   ├── reserve/                    # 预定页
│   ├── order/                      # 订单页
│   └── user/                       # 个人中心
│
├── miniprogram/pages/              # 分包页面
│   ├── home/                       # 首页（新版）
│   ├── category/                   # 商品分类
│   ├── product-detail/             # 商品详情
│   ├── search/                     # 搜索页
│   ├── cart/                       # 购物车
│   ├── order-confirm/              # 确认订单
│   ├── order-list/                 # 订单列表
│   ├── order-detail/               # 订单详情
│   ├── payment/                    # 支付页
│   ├── pay-result/                 # 支付结果
│   ├── profile/                    # 会员中心
│   ├── address/                    # 地址管理
│   ├── address-edit/               # 地址编辑
│   ├── coupon/                     # 优惠券
│   └── admin/                      # 管理端页面
│       ├── login/                  # 管理登录
│       ├── dashboard/              # 数据仪表盘
│       ├── product-list/           # 商品管理
│       ├── product-edit/           # 商品编辑
│       ├── stock/                  # 库存管理
│       ├── order-manage/           # 订单管理
│       ├── statistics/             # 数据统计
│       └── marketing/              # 营销配置
│
├── utils/                          # 工具函数
│   ├── util.js                     # 通用工具
│   ├── api.js                      # API封装
│   ├── constants.js                # 常量定义
│   ├── auth.js                     # 权限验证
│   └── store.js                    # 状态管理
│
├── cloudfunctions/                 # 云函数
│   ├── db-permissions.json         # 数据库权限配置
│   ├── product/                    # 商品云函数
│   ├── cart/                       # 购物车云函数
│   ├── order/                      # 订单云函数
│   ├── pay/                        # 支付云函数
│   ├── user/                       # 用户云函数
│   ├── address/                    # 地址云函数
│   ├── coupon/                     # 优惠券云函数
│   └── admin/                      # 管理端云函数
│
└── assets/                         # 静态资源
    ├── images/                     # 图片资源
    └── icons/                      # 图标资源
```

---

## 🚀 快速开始

### 环境要求

- 微信开发者工具 (v1.06.2307260+)
- Node.js (v14.x 或 v16.x)
- 微信小程序账号 (需企业认证使用支付)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/your-repo/bread-bakery-miniprogram.git
cd bread-bakery-miniprogram
```

2. **导入项目**
   - 打开微信开发者工具
   - 选择「导入项目」
   - 填写你的 AppID

3. **配置云开发**
   - 在小程序后台开通云开发
   - 修改 `app.js` 中的环境ID

4. **部署云函数**
   - 右键点击 `cloudfunctions/` 下的每个函数
   - 选择「创建并部署：云端安装依赖」

5. **初始化数据库**
   - 在云开发控制台创建集合
   - 导入权限配置

详细部署步骤请参考 [DEPLOY.md](./DEPLOY.md)

---

## 📱 功能模块

### 客户端功能

| 模块 | 功能 |
|------|------|
| 🏠 **首页** | 轮播图、快捷入口、推荐商品、配送方式选择 |
| 🛍️ **商品** | 分类浏览、商品搜索、商品详情、规格选择 |
| 🛒 **购物车** | 商品管理、数量调整、全选/单选、左滑删除 |
| 📋 **订单** | 确认订单、地址选择、优惠券、微信支付 |
| 📦 **订单追踪** | 订单列表、订单详情、物流追踪、状态更新 |
| 👤 **会员中心** | 用户信息、会员等级、积分、优惠券、地址管理 |

### 管理端功能

| 模块 | 功能 |
|------|------|
| 📊 **数据仪表盘** | 今日概览、待处理提醒、销售趋势 |
| 🍞 **商品管理** | 商品CRUD、上下架、图片上传 |
| 📦 **库存管理** | 实时库存、库存预警、入库出库记录 |
| 📋 **订单管理** | 订单列表、发货处理、退款处理 |
| 📈 **数据统计** | 销售数据、商品排行、用户统计 |
| 🎁 **营销配置** | 轮播图、优惠券、会员等级 |

---

## 💡 核心实现

### 防超卖机制

```javascript
// cloudfunctions/order/index.js
const transaction = await db.startTransaction()

try {
  // 1. 检查库存
  const product = await transaction.collection('products').doc(productId).get()
  if (product.data.stock < quantity) {
    await transaction.rollback()
    return { code: -1, message: '库存不足' }
  }
  
  // 2. 扣减库存
  await transaction.collection('products').doc(productId).update({
    data: { stock: _.inc(-quantity) }
  })
  
  // 3. 创建订单
  await transaction.collection('orders').add({ data: orderData })
  
  await transaction.commit()
} catch (err) {
  await transaction.rollback()
  return { code: -1, message: err.message }
}
```

### 微信支付

```javascript
// 客户端调用
const { result } = await wx.cloud.callFunction({
  name: 'pay',
  data: { action: 'unifiedOrder', orderId }
})

// 调起支付
await wx.requestPayment(result.data)
```

---

## 🎨 UI设计

### 配色方案

| 颜色 | 色值 | 用途 |
|------|------|------|
| 主色 | `#D4A574` | 按钮、强调 |
| 背景 | `#FDF8F3` | 页面背景 |
| 文字 | `#5D4037` | 主要文字 |
| 次要 | `#8D6E63` | 次要文字 |
| 边框 | `#E8E0D5` | 分割线 |

### 设计规范

- 圆角卡片设计 (12-16rpx)
- 统一的间距系统 (16rpx, 24rpx, 32rpx)
- 响应式布局适配各种屏幕

---

## 📊 数据库集合

| 集合名 | 说明 | 权限 |
|--------|------|------|
| `products` | 商品信息 | 公开读，管理员写 |
| `categories` | 商品分类 | 公开读，管理员写 |
| `orders` | 订单数据 | 用户私有，管理员可读写 |
| `users` | 用户信息 | 用户私有 |
| `cart` | 购物车 | 用户私有 |
| `addresses` | 收货地址 | 用户私有 |
| `coupons` | 优惠券 | 公开读，管理员写 |
| `userCoupons` | 用户优惠券 | 用户私有 |
| `banners` | 轮播图 | 公开读，管理员写 |

---

## 🔐 安全说明

1. **价格计算在服务端完成**，防止客户端篡改
2. **库存检查在服务端完成**，防止超卖
3. **敏感操作需要登录验证**
4. **数据库权限严格控制**

---

## 📄 开源协议

[MIT License](./LICENSE)

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

---

## 📞 联系我们

如有问题，请提交 Issue 或联系：
- 邮箱: support@breadbakery.com
- 微信: BreadBakeryOfficial

---

<p align="center">
  Made with ❤️ by Bread Bakery Team
</p>
