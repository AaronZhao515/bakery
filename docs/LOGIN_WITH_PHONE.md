# 登录同时获取手机号功能

## 功能概述

优化登录流程，在登录的同时获取用户手机号，减少用户操作步骤，提升用户体验。

## 实现方式

### 方案设计

由于微信小程序限制，`getPhoneNumber` 和 `login` 需要通过不同的 `open-type` 触发，无法在一个按钮上同时完成。因此采用以下方案：

**主按钮：登录并获取手机号**
- 使用 `open-type="getPhoneNumber"`
- 用户点击后同时获取手机号和完成登录
- 在回调中先执行登录，再处理手机号

**次要按钮：暂不绑定手机号**
- 普通按钮，仅执行登录
- 给不想绑定手机号的用户一个选择

### 代码实现

#### 1. 页面结构 (`pages/user/user.wxml`)

```xml
<!-- 登录并获取手机号按钮 -->
<button
  class="login-btn {{status}}"
  open-type="getPhoneNumber"
  bind:getphonenumber="onLoginWithPhone"
>
  <image class="btn-wechat-icon" src="{{icons.wechat}}" mode="aspectFit"/>
  <text>微信一键登录</text>
</button>

<!-- 仅登录按钮（不获取手机号） -->
<button
  class="login-btn-simple"
  bindtap="onWechatLogin"
>
  <text>暂不绑定手机号</text>
</button>
```

#### 2. 登录逻辑 (`pages/user/user.js`)

```javascript
async onLoginWithPhone(e) {
  // 1. 获取手机号凭证
  const { code, encryptedData, iv } = e.detail;

  // 2. 执行登录
  const result = await auth.doLogin();

  // 3. 获取手机号
  const phoneResult = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'getPhoneNumber',
      data: { code, encryptedData, iv }
    }
  });

  // 4. 获取微信用户信息
  const userProfile = await wx.getUserProfile({...});

  // 5. 统一更新用户信息（昵称、头像、手机号）
  await auth.updateUserInfo({
    nickName: wxUserInfo.nickName,
    avatarUrl: wxUserInfo.avatarUrl,
    phone: phoneNumber
  });
}
```

## 登录流程对比

### 传统流程（分步）
1. 点击登录按钮
2. 授权微信信息
3. 登录成功
4. 再点击绑定手机号
5. 授权手机号
6. 绑定成功

**用户操作：2次点击 + 2次授权弹窗**

### 优化流程（合并）
1. 点击"微信一键登录"按钮
2. 授权手机号
3. 授权微信信息
4. 登录成功，已绑定手机号

**用户操作：1次点击 + 2次授权弹窗**

## 用户界面

### 未登录状态

```
┌─────────────────────┐
│                     │
│    [头像预览]        │
│                     │
│    小赵面食          │
│                     │
├─────────────────────┤
│                     │
│  ┌───────────────┐  │
│  │  💬 微信一键登录 │  │  ← 获取手机号并登录
│  └───────────────┘  │
│                     │
│    暂不绑定手机号     │  ← 仅登录
│                     │
│  登录即代表同意...    │
│                     │
└─────────────────────┘
```

## 数据结构

登录成功后，用户信息包含：
```javascript
userInfo: {
  userId: 'xxx',
  nickName: '微信昵称',
  avatarUrl: 'https://...',
  phone: '13800138000',  // 同时获取
  memberLevel: 0,
  points: 0
}
```

## 测试步骤

### 测试 1：正常登录并获取手机号

1. 在未登录状态进入"我的"页面
2. 点击"微信一键登录"按钮
3. 在手机号授权弹窗中点击"允许"
4. 在微信信息授权弹窗中点击"允许"
5. **预期结果**：
   - 提示"登录成功，已绑定手机号"
   - 页面显示用户昵称、头像、手机号
   - CloudBase 数据库中用户信息包含 phone 字段

### 测试 2：拒绝手机号授权

1. 点击"微信一键登录"按钮
2. 在手机号授权弹窗中点击"拒绝"
3. **预期结果**：
   - 提示"需要授权手机号才能继续"
   - 登录流程中断
   - 用户可以选择"暂不绑定手机号"按钮仅登录

### 测试 3：暂不绑定手机号

1. 点击"暂不绑定手机号"按钮
2. 在微信信息授权弹窗中点击"允许"
3. **预期结果**：
   - 仅登录，不获取手机号
   - 页面显示"点击绑定手机号"按钮
   - 用户可以在登录后单独绑定手机号

## 注意事项

1. **授权顺序**：
   - 先获取手机号（通过 button open-type）
   - 再获取微信信息（通过 wx.getUserProfile）
   - 两者都是异步的，需要处理好顺序

2. **错误处理**：
   - 用户拒绝手机号授权时给出明确提示
   - 提供备用登录方式（暂不绑定手机号）

3. **隐私合规**：
   - 用户协议中需说明收集手机号的目的
   - 仅在必要时获取手机号（如需要配送的订单）

## 常见问题

### Q: 为什么不能在一个按钮上同时完成登录和获取手机号？

A: 微信小程序的限制：
- `getPhoneNumber` 需要 `open-type="getPhoneNumber"`
- `login` 需要通过 `wx.login()` 调用
- 两者无法在同一个按钮上同时触发

### Q: 用户拒绝授权手机号后还能登录吗？

A: 可以，用户可以选择"暂不绑定手机号"按钮仅完成登录，后续再单独绑定手机号。

### Q: 获取手机号失败会影响登录吗？

A: 不会，登录和获取手机号是独立的。即使获取手机号失败，登录仍然成功，只是用户信息中没有手机号。

## 后续优化

1. **智能提示**：根据业务场景判断是否需要强制绑定手机号（如下单时）
2. **短信验证**：对于关键操作，添加短信验证码二次确认
3. **隐私保护**：提供手机号脱敏显示，保护用户隐私
