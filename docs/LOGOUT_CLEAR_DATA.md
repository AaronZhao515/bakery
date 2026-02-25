# 退出登录数据清理说明

## 问题描述

用户反馈：退出登录后，订单信息等仍然能看到。

## 解决方案

优化退出登录逻辑，确保清除所有本地用户数据。

## 修改内容

### 1. 个人中心页面 (`pages/user/user.js`)

**退出登录时清除的数据：**

```javascript
// 1. 清除全局 store 用户数据
app.store.userStore.update({
  userInfo: null,
  openid: '',
  isLogin: false,
  role: 'customer',
  permissions: [],
  addressList: [],
  defaultAddress: null
});

// 2. 清除全局 app 数据
app.globalData.isLogin = false;
app.globalData.userRole = 'customer';

// 3. 清除页面数据
this.setData({
  isLogin: false,
  userInfo: null,
  tempAvatarUrl: null,
  stats: { couponCount: 0, points: 0, balance: 0 },
  orderStats: { total: 0, pendingPayment: 0, ... }
});

// 4. 清除本地存储
wx.removeStorageSync('cart_data');
wx.removeStorageSync('address_list');
wx.removeStorageSync('order_history');
```

### 2. App 全局 (`app.js`)

**退出登录时清除的数据：**

```javascript
// 清空全局用户状态
this.store.userStore.update({
  userInfo: null,
  openid: '',
  unionid: '',
  isLogin: false,
  role: 'customer',
  permissions: [],
  addressList: [],
  defaultAddress: null
});

// 清空购物车数据
this.store.cartStore.update({
  items: [],
  totalCount: 0,
  totalPrice: 0,
  selectedCount: 0,
  selectedPrice: 0
});

// 清空全局数据
this.globalData.isLogin = false;
this.globalData.userRole = 'customer';
this.globalData.shopInfo = null;

// 清除本地存储
wx.removeStorageSync('cart_data');
wx.removeStorageSync('address_list');
wx.removeStorageSync('order_history');
wx.removeStorageSync('user_coupons');
```

### 3. Auth 模块 (`utils/auth.js`)

**退出登录时清除的数据：**

```javascript
function clearAuthInfo() {
  removeStorage(AUTH_STORAGE_KEY); // 清除 auth_info
}

async function doLogout() {
  // 调用云函数清除服务器端 token
  await wx.cloud.callFunction({
    name: 'user',
    data: { action: 'logout' }
  });

  // 清除本地认证信息
  clearAuthInfo();
}
```

## 清理的数据清单

| 数据类型 | 存储位置 | 清理方式 |
|---------|---------|---------|
| 用户信息 (auth_info) | 本地 Storage | removeStorage |
| 全局 Store 用户数据 | app.store.userStore | update 为空 |
| 全局 Store 购物车数据 | app.store.cartStore | update 为空 |
| 页面 data 用户信息 | page.data | setData 为空 |
| 页面 data 统计数据 | page.data | setData 为 0 |
| 购物车数据 (cart_data) | 本地 Storage | removeStorageSync |
| 地址列表 (address_list) | 本地 Storage | removeStorageSync |
| 订单历史 (order_history) | 本地 Storage | removeStorageSync |
| 用户优惠券 (user_coupons) | 本地 Storage | removeStorageSync |
| 服务器端 token | CloudBase | 云函数清除 |

## 测试步骤

### 测试 1：退出登录后数据清除

1. 登录账号
2. 查看"我的"页面，确认显示用户信息、订单统计等
3. 点击"退出登录"
4. **预期结果**：
   - 页面切换到未登录状态
   - 用户信息显示区域清空
   - 统计数据归零（积分、优惠券、订单数显示 0）
   - 头像恢复默认

### 测试 2：退出登录后订单页面

1. 登录账号并进入订单页面
2. 确认能看到订单列表
3. 退出登录
4. 切换到订单页面
5. **预期结果**：
   - 订单列表为空
   - 显示"请先登录"或空状态提示

### 测试 3：重新登录数据恢复

1. 退出登录后，确认数据已清除
2. 重新登录
3. **预期结果**：
   - 用户信息重新显示
   - 订单统计重新加载
   - 所有数据恢复正常

## 注意事项

1. **本地缓存策略**：退出登录只清除用户相关数据，不清除：
   - 商品列表缓存
   - 店铺配置信息
   - 非用户相关的全局配置

2. **服务器端数据**：
   - 退出登录不会删除服务器端数据
   - 只是清除本地 token，使本地无法访问服务器数据
   - 重新登录后可以再次获取数据

3. **多设备登录**：
   - 退出登录只影响当前设备
   - 其他设备如果已登录，仍然保持登录状态

## 常见问题

### Q: 退出登录后还能看到数据？

A: 可能原因：
1. 页面没有正确刷新（尝试下拉刷新或重新进入页面）
2. 数据缓存在内存中没有清除（重启小程序）
3. 退出登录逻辑没有执行成功（检查控制台日志）

### Q: 退出登录后重新登录，数据没有恢复？

A: 这是正常行为，因为：
1. 退出登录清除了本地 token
2. 重新登录后会重新从服务器获取数据
3. 如果网络问题导致获取失败，会显示空数据

### Q: 如何彻底清空所有数据？

A: 除了退出登录，还可以：
1. 在微信中删除小程序（会清除所有本地存储）
2. 在开发者工具中清除缓存
3. 调用 `wx.clearStorageSync()`（会清除所有本地数据）
