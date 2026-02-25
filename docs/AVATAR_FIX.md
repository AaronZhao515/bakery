# 头像选择功能修复

## 问题

使用 `chooseAvatar` API 时出现超时错误：
```
[渲染层错误] [Component] <button>: chooseAvatar:fail timeout
```

## 原因

`chooseAvatar` 是微信小程序的开放能力，在开发者工具中可能不支持或会超时。该功能需要在真机上才能正常使用。

## 解决方案

将头像选择方式从 `chooseAvatar` 改为 `wx.chooseImage`，这种方式更稳定且在开发者工具和真机上都能正常工作。

### 修改内容

#### 1. 已登录状态头像 (`pages/user/user.wxml`)

**修改前：**
```xml
<button
  class="avatar-wrap"
  open-type="chooseAvatar"
  bind:chooseavatar="onChooseAvatar"
>
  <image class="user-avatar" src="..."/>
</button>
```

**修改后：**
```xml
<view
  class="avatar-wrap"
  bindtap="chooseAvatarFromAlbum"
>
  <image class="user-avatar" src="..."/>
  <view class="avatar-edit-hint">更换</view>
</view>
```

#### 2. 未登录状态头像 (`pages/user/user.wxml`)

**修改前：**
```xml
<button
  class="avatar-preview"
  open-type="chooseAvatar"
  bind:chooseavatar="onChooseAvatar"
>
  <image class="avatar-img" src="..."/>
</button>
```

**修改后：**
```xml
<view
  class="avatar-preview"
  bindtap="chooseAvatarFromAlbum"
>
  <image class="avatar-img" src="..."/>
  <view class="avatar-hint" wx:if="{{!tempAvatarUrl}}">点击选择头像</view>
</view>
```

#### 3. JS 方法 (`pages/user/user.js`)

新增 `chooseAvatarFromAlbum` 方法，使用 `wx.chooseImage`：

```javascript
async chooseAvatarFromAlbum() {
  try {
    const res = await wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    });

    const tempFilePath = res.tempFilePaths[0];

    if (!this.data.isLogin) {
      // 未登录状态：暂存头像
      this.setData({
        tempAvatarUrl: tempFilePath
      });
      util.showToast('头像已选择，登录后将自动使用', 'success');
    } else {
      // 已登录状态：上传头像
      this.uploadAndUpdateAvatar(tempFilePath);
    }
  } catch (error) {
    console.error('[个人中心] 选择图片失败:', error);
  }
}
```

## 功能对比

| 特性 | chooseAvatar (旧) | wx.chooseImage (新) |
|------|-------------------|---------------------|
| 开发者工具支持 | ❌ 可能超时 | ✅ 正常支持 |
| 真机支持 | ✅ 正常 | ✅ 正常 |
| 图片来源 | 仅微信头像 | 相册/相机 |
| 用户体验 | 一键选择微信头像 | 多步骤选择图片 |

## 注意事项

1. **开发者工具**：现在可以在开发者工具中正常测试头像选择功能
2. **图片压缩**：使用 `sizeType: ['compressed']` 自动压缩图片
3. **图片来源**：支持从相册选择或拍照

## 测试步骤

1. 在开发者工具中进入"我的"页面
2. 点击头像区域
3. 选择"从相册选择"或"拍照"
4. 选择图片后，头像应该更新
5. 登录后，头像会自动上传到云存储

## 后续优化

如果需要恢复使用微信原生头像选择（`chooseAvatar`），可以在检测到真机环境时切换回该 API：

```javascript
// 检测是否在真机上
const isRealDevice = wx.getSystemInfoSync().platform !== 'devtools';

if (isRealDevice) {
  // 使用 chooseAvatar
} else {
  // 使用 wx.chooseImage
}
```
