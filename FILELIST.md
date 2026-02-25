# 项目文件清单

## 统计信息
- **总文件数**: 202 个
- **项目大小**: 1.4 MB
- **代码行数**: 约 15,000+ 行

## 目录结构

### 根目录配置 (6 个文件)
```
/
├── app.js                      # 应用入口
├── app.json                    # 全局配置
├── app.wxss                    # 全局样式
├── sitemap.json                # 站点地图
├── project.config.json         # 项目配置
├── README.md                   # 项目说明
├── DEPLOY.md                   # 部署指南
└── FILELIST.md                 # 本文件
```

### 自定义组件 (24 个文件)
```
components/
├── nav-bar/                    # 导航栏组件
│   ├── nav-bar.js
│   ├── nav-bar.json
│   ├── nav-bar.wxml
│   └── nav-bar.wxss
├── product-card/               # 商品卡片组件
│   ├── product-card.js
│   ├── product-card.json
│   ├── product-card.wxml
│   └── product-card.wxss
├── loading/                    # 加载动画组件
│   ├── loading.js
│   ├── loading.json
│   ├── loading.wxml
│   └── loading.wxss
├── empty/                      # 空状态组件
│   ├── empty.js
│   ├── empty.json
│   ├── empty.wxml
│   └── empty.wxss
├── modal/                      # 弹窗组件
│   ├── modal.js
│   ├── modal.json
│   ├── modal.wxml
│   └── modal.wxss
└── toast/                      # 轻提示组件
    ├── toast.js
    ├── toast.json
    ├── toast.wxml
    └── toast.wxss
```

### 主包页面 (16 个文件)
```
pages/
├── index/                      # 首页
│   ├── index.js
│   ├── index.json
│   ├── index.wxml
│   └── index.wxss
├── reserve/                    # 预定页
│   ├── reserve.js
│   ├── reserve.json
│   ├── reserve.wxml
│   └── reserve.wxss
├── order/                      # 订单页
│   ├── order.js
│   ├── order.json
│   ├── order.wxml
│   └── order.wxss
└── user/                       # 个人中心
    ├── user.js
    ├── user.json
    ├── user.wxml
    └── user.wxss
```

### 分包页面 - 客户端 (64 个文件)
```
miniprogram/pages/
├── home/                       # 首页（新版）
│   ├── home.js, home.json, home.wxml, home.wxss
├── category/                   # 商品分类
│   ├── category.js, category.json, category.wxml, category.wxss
├── product-detail/             # 商品详情
│   ├── product-detail.js, product-detail.json, product-detail.wxml, product-detail.wxss
├── search/                     # 搜索页
│   ├── search.js, search.json, search.wxml, search.wxss
├── cart/                       # 购物车
│   ├── cart.js, cart.json, cart.wxml, cart.wxss
├── order-confirm/              # 确认订单
│   ├── order-confirm.js, order-confirm.json, order-confirm.wxml, order-confirm.wxss
├── order-list/                 # 订单列表
│   ├── order-list.js, order-list.json, order-list.wxml, order-list.wxss
├── order-detail/               # 订单详情
│   ├── order-detail.js, order-detail.json, order-detail.wxml, order-detail.wxss
├── payment/                    # 支付页
│   ├── payment.js, payment.json, payment.wxml, payment.wxss
├── pay-result/                 # 支付结果
│   ├── pay-result.js, pay-result.json, pay-result.wxml, pay-result.wxss
├── profile/                    # 会员中心
│   ├── profile.js, profile.json, profile.wxml, profile.wxss
├── address/                    # 地址管理
│   ├── address.js, address.json, address.wxml, address.wxss
├── address-edit/               # 地址编辑
│   ├── address-edit.js, address-edit.json, address-edit.wxml, address-edit.wxss
├── coupon/                     # 优惠券
│   ├── coupon.js, coupon.json, coupon.wxml, coupon.wxss
├── order/                      # 订单（备用）
│   ├── order.js, order.json, order.wxml, order.wxss
└── user/                       # 用户（备用）
    ├── user.js, user.json, user.wxml, user.wxss
```

### 分包页面 - 管理端 (32 个文件)
```
miniprogram/pages/admin/
├── login/                      # 管理登录
│   ├── login.js, login.json, login.wxml, login.wxss
├── dashboard/                  # 数据仪表盘
│   ├── dashboard.js, dashboard.json, dashboard.wxml, dashboard.wxss
├── product-list/               # 商品管理
│   ├── product-list.js, product-list.json, product-list.wxml, product-list.wxss
├── product-edit/               # 商品编辑
│   ├── product-edit.js, product-edit.json, product-edit.wxml, product-edit.wxss
├── stock/                      # 库存管理
│   ├── stock.js, stock.json, stock.wxml, stock.wxss
├── order-manage/               # 订单管理
│   ├── order-manage.js, order-manage.json, order-manage.wxml, order-manage.wxss
├── statistics/                 # 数据统计
│   ├── statistics.js, statistics.json, statistics.wxml, statistics.wxss
└── marketing/                  # 营销配置
    ├── marketing.js, marketing.json, marketing.wxml, marketing.wxss
```

### 工具函数 (30 个文件)
```
utils/
├── util.js                     # 通用工具函数
├── api.js                      # API封装
├── constants.js                # 常量定义
├── auth.js                     # 权限验证
└── store.js                    # 状态管理

miniprogram/utils/
├── util.js                     # 工具函数
├── cartUtil.js                 # 购物车工具
└── payUtil.js                  # 支付工具
```

### 云函数 (60 个文件)
```
cloudfunctions/
├── db-permissions.json         # 数据库权限配置
│
├── product/                    # 商品云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── cart/                       # 购物车云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── order/                      # 订单云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── pay/                        # 支付云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── user/                       # 用户云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── address/                    # 地址云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── coupon/                     # 优惠券云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── admin/                      # 管理端云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── getHomeData/                # 首页数据云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── getProducts/                # 商品列表云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── getProductDetail/           # 商品详情云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── createOrder/                # 创建订单云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── checkStock/                 # 库存检查云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
├── payCallback/                # 支付回调云函数
│   ├── config.json
│   ├── package.json
│   └── index.js
│
└── checkPayStatus/             # 支付状态检查云函数
    ├── config.json
    ├── package.json
    └── index.js
```

## 功能模块统计

| 模块 | 页面数 | 云函数 | 说明 |
|------|--------|--------|------|
| 首页/商品 | 4 | 3 | 首页、分类、详情、搜索 |
| 购物车 | 1 | 1 | 购物车管理 |
| 订单 | 4 | 3 | 确认订单、支付、列表、详情 |
| 会员中心 | 4 | 2 | 个人中心、地址、优惠券 |
| 管理端 | 8 | 2 | 仪表盘、商品、库存、订单、统计、营销 |
| **合计** | **21** | **11** | - |

## 数据库集合

| 集合名 | 用途 | 文档数预估 |
|--------|------|-----------|
| products | 商品信息 | 100-500 |
| categories | 商品分类 | 5-20 |
| orders | 订单数据 | 1000+/月 |
| users | 用户信息 | 1000+ |
| cart | 购物车 | 与用户数相当 |
| addresses | 收货地址 | 用户数×3 |
| coupons | 优惠券 | 10-50 |
| userCoupons | 用户优惠券 | 1000+ |
| banners | 轮播图 | 5-10 |
