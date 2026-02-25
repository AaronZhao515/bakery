# 手机号获取功能说明

## 功能概述

在"我的"页面添加了手机号获取和绑定功能，用户可以快速绑定手机号，方便后续订单配送和联系。

## 实现方式

### 1. 页面展示 (`pages/user/user.wxml`)

**用户信息卡片中显示：**
- 已绑定：显示手机号 📱 138****8888
- 未绑定：显示"点击绑定手机号"按钮

**菜单列表中新增：**
- "手机号"菜单项，点击可查看绑定状态

### 2. 获取手机号逻辑 (`pages/user/user.js`)

使用微信小程序标准 API `button` 的 `open-type="getPhoneNumber"`：

```javascript
async onGetPhoneNumber(e) {
  // 获取 code 或 encryptedData
  const { code, encryptedData, iv } = e.detail;

  // 调用云函数获取手机号
  const { result } = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'getPhoneNumber',
      data: { code, encryptedData, iv }
    }
  });

  // 更新本地和服务器数据
}
```

### 3. 云函数处理 (`cloudfunctions/user/index.js`)

支持两种获取方式：
- **新版方式（推荐）**：使用 `code` 调用 `openapi.phonenumber.getPhoneNumber`
- **旧版方式**：使用 `cloudID` 调用 `cloud.getOpenData`

获取成功后自动更新数据库：
```javascript
await db.collection('users').where({ openid: OPENID }).update({
  data: {
    phone: phoneData.phoneNumber,
    updateTime: db.serverDate()
  }
})
```

## 数据结构

获取手机号后，用户信息结构：
```javascript
userInfo: {
  userId: 'xxx',
  nickName: '微信昵称',
  avatarUrl: 'https://...',
  phone: '13800138000',  // 新增字段
  memberLevel: 0,
  points: 0
}
```

## 测试步骤

### 测试 1：首次绑定手机号

1. 确保已登录且未绑定手机号
2. 在"我的"页面点击"点击绑定手机号"按钮
3. 在授权弹窗中点击"允许"
4. **预期结果**：
   - 提示"手机号绑定成功"
   - 页面显示绑定的手机号
   - CloudBase 数据库中该用户的 phone 字段已更新

### 测试 2：查看已绑定手机号

1. 点击菜单中的"手机号"选项
2. **预期结果**：弹出提示显示已绑定的手机号

### 测试 3：重复绑定

1. 已绑定手机号的用户再次点击"点击绑定手机号"
2. **预期结果**：更新为新手机号（如果需要更换）

## 注意事项

1. **授权要求**：用户必须点击按钮触发，不能自动获取
2. **真机测试**：部分功能需要在真机上测试，开发者工具可能不支持
3. **权限配置**：确保小程序后台已开通"手机号"权限
4. **隐私协议**：需要在小程序后台配置隐私协议，说明收集手机号的目的

## 常见问题

### Q: 为什么点击绑定按钮没有反应？

A: 检查以下几点：
- 是否已登录
- 开发者工具基础库版本是否支持（建议 2.21.2+）
- 小程序后台是否已开通手机号权限

### Q: 如何查看数据库中的手机号？

A: 登录微信开发者工具 → 云开发 → 数据库 → 选择 `users` 集合 → 查看对应用户的 `phone` 字段

### Q: 用户拒绝授权后如何重新获取？

A: 用户再次点击绑定按钮即可重新触发授权弹窗

## 隐私合规

根据微信小程序隐私协议要求：

1. **收集目的**：仅用于订单配送、售后服务等必要场景
2. **用户授权**：必须用户主动点击授权
3. **数据存储**：存储在 CloudBase 数据库，确保数据安全
4. **隐私协议**：需在小程序后台配置隐私协议，说明数据使用范围

## 后续优化建议

1. **手机号验证**：添加短信验证码验证，确保手机号真实有效
2. **更换手机号**：提供更换手机号功能，需要验证原手机号或短信验证
3. **隐私设置**：允许用户选择是否对商家展示完整手机号
