# 微信新版头像昵称填写能力集成指南

> 本文档说明如何在小程序中使用微信2022年推出的新版头像昵称填写能力，实现更轻量的用户信息收集。

## 功能概述

微信于2022年推出新版头像昵称填写能力，允许用户在无需弹窗授权的情况下，直接填写头像和昵称。主要特点：

1. **无需授权弹窗** - 用户主动选择/输入，体验更流畅
2. **组件化集成** - 通过原生组件直接获取
3. **合规审核** - 微信自动审核昵称合规性
4. **一键登录结合** - 可与 `getPhoneNumber` 结合实现完整登录

## 核心组件

### 1. 头像选择按钮

```html
<button
  class="avatar-wrapper"
  open-type="chooseAvatar"
  bind:chooseavatar="onChooseAvatar"
>
  <image class="avatar-img" src="{{avatarUrl}}" mode="aspectFill"/>
</button>
```

**说明：**
- `open-type="chooseAvatar"` 触发头像选择
- 用户点击后从相册选择或直接拍摄
- 返回临时图片路径 `avatarUrl`

### 2. 昵称输入框

```html
<input
  type="nickname"
  class="nickname-input"
  placeholder="请输入或选择微信昵称"
  value="{{nickName}}"
  bind:change="onNickNameChange"
  bind:nicknamereview="onNickNameReview"
/>
```

**说明：**
- `type="nickname"` 启用昵称输入能力
- 支持自动填充微信昵称（用户授权后）
- 支持自定义输入
- 微信自动审核昵称合规性

### 3. 手机号一键登录

```html
<button
  open-type="getPhoneNumber"
  bind:getphonenumber="onPhoneLogin"
>
  微信一键登录
</button>
```

## 使用流程

### 标准登录流程

```
用户进入登录页
    ↓
显示头像选择器 + 昵称输入框
    ↓
用户点击头像选择 → 从相册/拍照获取头像
用户输入昵称 → 微信自动审核
    ↓
用户点击「微信一键登录」
    ↓
获取手机号 → 完成登录
    ↓
上传头像到云存储（可选）
    ↓
保存用户信息 → 登录成功
```

## 代码实现

### 页面 WXML 结构

```html
<!-- 头像选择 -->
<button
  class="avatar-wrapper"
  open-type="chooseAvatar"
  bind:chooseavatar="onChooseAvatar"
>
  <image class="avatar-img" src="{{userInfo.avatarUrl}}" mode="aspectFill"/>
  <text class="avatar-tip">点击选择头像</text>
</button>

<!-- 昵称输入 -->
<view class="nickname-wrapper">
  <text class="input-label">昵称</text>
  <input
    type="nickname"
    class="nickname-input"
    placeholder="请输入或选择微信昵称"
    value="{{userInfo.nickName}}"
    bind:change="onNickNameChange"
    bind:nicknamereview="onNickNameReview"
  />
</view>

<!-- 一键登录 -->
<button
  class="btn btn-primary"
  open-type="getPhoneNumber"
  bind:getphonenumber="onPhoneLogin"
>
  微信一键登录
</button>
```

### 页面 JS 逻辑

```javascript
Page({
  data: {
    userInfo: {
      nickName: '',
      avatarUrl: ''
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      'userInfo.avatarUrl': avatarUrl
    });
  },

  // 昵称输入变化
  onNickNameChange(e) {
    const { value } = e.detail;
    this.setData({
      'userInfo.nickName': value
    });
  },

  // 昵称审核回调
  onNickNameReview(e) {
    const { pass, timeout } = e.detail;
    if (!pass && !timeout) {
      wx.showToast({
        title: '昵称可能不合规，请修改',
        icon: 'none'
      });
    }
  },

  // 手机号登录
  async onPhoneLogin(e) {
    const { code } = e.detail;
    const { userInfo } = this.data;

    // 调用登录云函数，传入头像和昵称
    const result = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'loginWithPhone',
        data: {
          phoneCode: code,
          userInfo: userInfo  // 包含头像和昵称
        }
      }
    });

    // 处理登录结果...
  }
});
```

## 云函数适配

### 登录云函数改造

```javascript
// cloudfunctions/user/index.js
exports.main = async (event, context) => {
  const { action, data } = event;

  if (action === 'loginWithPhone') {
    const { phoneCode, userInfo } = data;

    // 1. 获取手机号
    const phoneResult = await getPhoneNumber(phoneCode);

    // 2. 上传头像到云存储（如果是临时文件）
    let avatarUrl = userInfo.avatarUrl;
    if (avatarUrl && avatarUrl.startsWith('http://tmp')) {
      const uploadResult = await cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}.jpg`,
        filePath: avatarUrl
      });
      const fileList = await cloud.getTempFileURL({
        fileList: [uploadResult.fileID]
      });
      avatarUrl = fileList.fileList[0].tempFileURL;
    }

    // 3. 保存用户信息
    await db.collection('users').doc(openid).set({
      data: {
        nickName: userInfo.nickName,
        avatarUrl: avatarUrl,
        phone: phoneResult.phoneNumber,
        updateTime: db.serverDate()
      }
    });

    return { code: 0, data: { ... } };
  }
};
```

## 注意事项

### 1. 头像上传
- `chooseAvatar` 返回的是临时文件路径
- 需要自行上传到云存储或服务器获取永久链接
- 临时文件有过期时间，需及时处理

### 2. 昵称审核
- `nicknamereview` 回调用于检测昵称合规性
- `pass: false` 表示昵称可能不合规
- `timeout: true` 表示审核超时，可继续使用

### 3. 兼容性
- 基础库版本要求：2.21.2+
- 低版本会自动降级为普通 input
- 建议做好降级处理

### 4. 用户体验
- 头像和昵称是可选的，不应强制要求
- 提供默认头像和提示文字
- 登录按钮应在信息填写后高亮显示

## 优势对比

| 特性 | 旧版 getUserProfile | 新版头像昵称填写 |
|------|---------------------|------------------|
| 授权方式 | 弹窗授权 | 无弹窗，主动选择 |
| 用户体验 | 需要确认 | 直接选择/输入 |
| 头像获取 | 返回网络图片 | 返回临时文件 |
| 昵称获取 | 返回微信昵称 | 可自动填充或自定义 |
| 合规审核 | 无 | 自动审核昵称 |

## 相关链接

- [微信官方文档 - 头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)
- [button 组件 open-type](https://developers.weixin.qq.com/miniprogram/dev/component/button.html)
- [input 组件 type](https://developers.weixin.qq.com/miniprogram/dev/component/input.html)

## 更新历史

| 日期 | 版本 | 说明 |
|------|------|------|
| 2022-10 | 基础库 2.21.2 | 新版头像昵称填写能力发布 |
| 2023-06 | 基础库 2.32.0 | 优化昵称审核逻辑 |

---

本文档最后更新：2026-02-27
