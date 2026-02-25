# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Mini Program (微信小程序) for a bakery e-commerce platform called "暖心烘焙" (Warm Heart Bakery). It uses WeChat Cloud Development (云开发) for the backend.

**Tech Stack:**
- Frontend: WeChat Mini Program native framework (WXML/WXSS/JS)
- Backend: WeChat Cloud Development (Cloud Functions + Cloud Database + Cloud Storage)
- Payment: WeChat Pay (云调用免鉴权方式)
- State Management: Custom lightweight reactive store (`utils/store.js`)

## Development Environment

**Required Tool:** WeChat Developer Tools (微信开发者工具)
- Download: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
- This is the ONLY IDE/supported development environment
- No npm/node.js build process for the client code

**Project Configuration:**
- AppID: `wxcfc0df6b16555181` (in `project.config.json`)
- Cloud environment ID: `cloud1-5gh4dyhpb180b5fb` (in `app.js`)
- Base library version: 2.30.0

**Common Development Commands:**

There are no traditional build/lint/test commands. Development workflow:
1. Open project in WeChat Developer Tools
2. Edit code -> auto-compiled on save
3. Use IDE's "预览" (Preview) for testing
4. Use IDE's "上传" (Upload) to submit for review

**Cloud Function Deployment:**
- Right-click any folder in `cloudfunctions/` → "创建并部署：云端安装依赖"
- Cloud functions use Node.js 14.x/16.x

## Project Architecture

### Directory Structure

```
├── app.js                    # Application entry - initializes cloud and global state
├── app.json                  # Global page config, tab bar, navigation
├── app.wxss                  # Global styles (11KB)
├── project.config.json       # WeChat DevTools settings
│
├── components/               # Custom reusable components
│   ├── nav-bar/              # Navigation bar with back button
│   ├── product-card/         # Product display card
│   ├── loading/              # Loading spinner
│   ├── empty/                # Empty state placeholder
│   ├── modal/                # Modal dialog
│   └── toast/                # Toast notifications
│
├── pages/                    # Main package (4 tab pages)
│   ├── index/                # Home page
│   ├── reserve/              # Reservation page
│   ├── order/                # Orders list
│   └── user/                 # User profile
│
├── miniprogram/pages/        # Extended client pages (15+ pages)
│   ├── home/                 # New home page
│   ├── category/             # Product categories
│   ├── product-detail/       # Product detail
│   ├── cart/                 # Shopping cart
│   ├── order-confirm/        # Order confirmation
│   ├── payment/              # Payment page
│   └── admin/                # Admin pages (8 pages)
│
├── package-product/          # Product subpackage (3 pages)
├── package-order/            # Order subpackage (3 pages)
├── package-user/             # User subpackage (5 pages)
├── package-admin/            # Admin subpackage (4 pages)
│
├── utils/                    # Core utilities
│   ├── api.js                # API wrappers for all cloud functions
│   ├── store.js              # Reactive state management system
│   ├── auth.js               # Authentication utilities
│   ├── constants.js          # App constants
│   └── util.js               # General utilities
│
├── cloudfunctions/           # Cloud functions (Node.js)
│   ├── product/              # Product management
│   ├── cart/                 # Cart operations
│   ├── order/                # Order processing
│   ├── pay/                  # Payment handling (408 lines)
│   ├── user/                 # User management
│   ├── address/              # Address operations
│   ├── coupon/               # Coupon system
│   ├── admin/                # Admin operations
│   └── db-permissions.json   # Database security rules
│
└── assets/images/            # Static image resources
```

### State Management Architecture

The app uses a custom reactive store system (`utils/store.js`), NOT Redux/MobX:

```javascript
// In app.js - global store is created
this.store = createStoreBindings({
  userStore: { userInfo, isLogin, role, ... },
  cartStore: { items, totalCount, totalPrice, ... },
  appStore: { isLoading, toast, modal, ... }
});

// In pages - bind to store
const app = getApp();
app.store.bindToPage(this, {
  userInfo: 'userStore.userInfo',
  cartCount: 'cartStore.totalCount'
});
```

Key patterns:
- Stores are namespaced: `userStore`, `cartStore`, `appStore`
- Use `store.namespace('userStore').update({...})` for updates
- Page bindings auto-sync store → page data

### API Architecture

All backend calls go through `utils/api.js`:

```javascript
// API pattern - always returns { success, code, message, data }
const { success, data } = await api.product.getList({ categoryId });
const { success, data } = await api.order.create(orderData);
```

API modules:
- `api.user.*` - Login, profile
- `api.product.*` - Products, categories, search
- `api.order.*` - Create, pay, cancel orders
- `api.cart.*` - Cart operations
- `api.address.*` - Address management
- `api.coupon.*` - Coupons
- `api.admin.*` - Admin dashboard, statistics

### Cloud Function Pattern

Cloud functions use action-based routing:

```javascript
// cloudfunctions/product/index.js
exports.main = async (event, context) => {
  const { action, ...params } = event;

  switch (action) {
    case 'getList': return await getList(params);
    case 'getDetail': return await getDetail(params);
    // ...
  }
};
```

**Critical Pattern - Anti-Overselling:**
Stock operations MUST use database transactions:

```javascript
const transaction = await db.startTransaction();
try {
  const product = await transaction.collection('products').doc(id).get();
  if (product.data.stock < quantity) {
    await transaction.rollback();
    return { code: -1, message: '库存不足' };
  }
  await transaction.collection('products').doc(id).update({
    data: { stock: _.inc(-quantity) }
  });
  await transaction.commit();
} catch (err) {
  await transaction.rollback();
}
```

### Payment Flow

1. Client calls `api.order.pay(orderId)`
2. Cloud function `pay/unifiedOrder` calls WeChat Pay API
3. Returns payment params to client
4. Client calls `wx.requestPayment(params)`
5. WeChat server notifies `payCallback` cloud function
6. Order status updated to 'paid'

## Database Collections

| Collection | Purpose | Permission |
|------------|---------|------------|
| `products` | Product catalog | Public read, admin write |
| `categories` | Product categories | Public read, admin write |
| `orders` | Order transactions | User private, admin read/write |
| `users` | User profiles | User private |
| `cart` | Shopping cart items | User private |
| `addresses` | Shipping addresses | User private |
| `coupons` | Available coupons | Public read, admin write |
| `userCoupons` | User's claimed coupons | User private |
| `banners` | Home page banners | Public read, admin write |

See `cloudfunctions/db-permissions.json` for detailed security rules.

## Key Files Reference

| File | Purpose |
|------|---------|
| `app.js:72` | Cloud environment initialization |
| `app.js:115-166` | Global store initialization |
| `utils/api.js:91-188` | Cloud function call wrapper with retry logic |
| `utils/store.js:12-348` | Reactive store implementation |
| `utils/constants.js` | App constants, order status enums |
| `cloudfunctions/pay/index.js` | Payment processing |
| `cloudfunctions/order/index.js` | Order creation with stock deduction |

## Security Guidelines

1. **Price calculation must be server-side** - Never trust client-calculated prices
2. **Stock checks must use transactions** - Prevent overselling with atomic operations
3. **User authentication via OpenID** - From `cloud.getWXContext()`
4. **Role-based access** - `customer`, `admin`, `staff` roles checked in cloud functions
5. **Database permissions** - Strict rules per collection

## Testing

No automated test suite. Manual testing via WeChat Developer Tools:

1. **Simulate:** Use IDE's simulator for basic UI testing
2. **Preview:** Click "预览" (Preview) → scan QR with WeChat for real-device testing
3. **Experience version:** Upload → submit as experience version → add testers

## Deployment

See `DEPLOY.md` for detailed steps. Quick checklist:

1. Update cloud env ID in `app.js`
2. Deploy all cloud functions (right-click → deploy)
3. Create database collections with proper permissions
4. Configure WeChat Pay (requires enterprise account)
5. Upload → submit for review → publish
