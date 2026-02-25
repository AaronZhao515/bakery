# 登录逻辑修复总结

## 修复的问题

### 1. 缺失的函数 `setUserInfo`
**文件**: `utils/auth.js`
**问题**: `login.js` 调用了 `auth.setUserInfo()`，但该函数未定义
**修复**: 添加了 `setUserInfo` 函数用于更新本地存储的用户信息

### 2. Action 名称不匹配
**文件**: `app.js` 和 `cloudfunctions/user/index.js`
**问题**: `app.js` 中的 `getUserProfile` 调用了 `updateProfile` action，但云函数中只有 `updateInfo`/`updateUserInfo`
**修复**:
- 在 `app.js` 中使用 `updateUserInfo` action
- 在云函数中添加 `updateProfile` 作为别名

### 3. Token 管理不完善
**文件**: `cloudfunctions/user/index.js`
**问题**:
- 登录时生成的 token 没有存储到数据库
- `checkLogin` 没有验证 token 是否有效
- 退出登录时没有清除服务器端 token
**修复**:
- 在 `login` 函数中将 token 和过期时间存入数据库
- 在 `checkLogin` 函数中添加 token 验证逻辑
- 在 `logout` 函数中清除数据库中的 token

### 4. 登录状态检查不一致
**文件**: `app.js`
**问题**: `checkLoginStatus` 返回的数据格式与登录时不一致
**修复**:
- 统一数据返回格式
- 添加 token 过期自动刷新（静默登录）
- 传递本地 token 给云函数进行验证

### 5. 手机号获取逻辑不兼容新版小程序
**文件**: `pages/login/login.js` 和 `cloudfunctions/user/index.js`
**问题**: 新版微信小程序（基础库 2.21.2+）推荐使用 `code` 方式获取手机号
**修复**:
- 云函数 `getPhone` 支持 `code` 和 `cloudID` 两种方式
- 前端优先使用 `code` 方式
- 添加了更完善的错误处理

### 6. 状态同步问题
**文件**: `app.js` 和 `pages/login/login.js`
**问题**:
- `app.js` 和 `auth.js` 中的登录逻辑重复
- 退出登录后全局状态未正确重置
**修复**:
- `app.js` 中的 `login`/`logout` 统一使用 `auth.js` 的方法
- 确保全局 store 和 `globalData` 同步更新

## 文件修改列表

### 客户端文件
1. `utils/auth.js` - 添加 `setUserInfo` 函数，完善导出
2. `app.js` - 修复 `checkLoginStatus`、`login`、`logout`、`getUserProfile`
3. `pages/login/login.js` - 修复 `checkLoginStatus`、`updateUserInfo`、`onGetPhoneNumber`
4. `utils/auth.test.js` - 新增测试文件

### 云函数文件
1. `cloudfunctions/user/index.js` - 修复 `login`、`checkLogin`、`logout`、`getPhone`，添加 `updateProfile` 别名

## 测试步骤

1. 在微信开发者工具中重新部署云函数 `user`
2. 清除本地缓存（开发者工具 → 清缓存 → 清除数据缓存）
3. 测试以下场景：
   - 新用户首次登录
   - 已登录用户进入登录页自动返回
   - 登录后获取用户信息
   - 绑定手机号
   - 退出登录
   - Token 过期后自动刷新

## 注意事项

1. **云函数部署**: 修改云函数后必须在微信开发者工具中右键点击云函数文件夹 → "创建并部署：云端安装依赖"
2. **权限配置**: 确保云函数有调用 `openapi.phonenumber.getPhoneNumber` 的权限（用于新版手机号获取）
3. **基础库版本**: 建议使用基础库版本 2.30.0 或更高版本

## 登录流程标准

```
1. 小程序启动 (app.js onLaunch)
   └── initCloud() - 初始化云开发
   └── checkLoginStatus() - 检查登录状态
       ├── 已登录且 token 有效 → 继续
       └── token 过期 → silentLogin() 静默登录

2. 用户点击登录按钮
   └── auth.doLogin()
       ├── 调用云函数 user/login
       ├── 存储 token 到本地
       └── 更新全局状态

3. 获取用户信息
   ├── 调用云函数 user/updateUserInfo
   └── 更新本地和全局状态

4. 获取手机号
   ├── 优先使用 code 方式（新版）
   └── 兼容 cloudID 方式（旧版）

5. 退出登录
   ├── 调用云函数 user/logout（清除服务器 token）
   ├── 清除本地认证信息
   └── 重置全局状态
```
