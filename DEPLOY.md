# 面包烘焙小程序 - 部署指南

## 📋 前置要求

1. **微信开发者工具** (最新稳定版)
   - 下载地址: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

2. **微信小程序账号**
   - 注册地址: https://mp.weixin.qq.com/
   - 需要完成企业认证以使用微信支付

3. **微信云开发环境**
   - 在小程序后台开通云开发
   - 记录环境ID

---

## 🚀 快速部署步骤

### 第一步：导入项目

1. 打开微信开发者工具
2. 点击「导入项目」
3. 选择项目目录: `bread-bakery-miniprogram/`
4. 填写你的 AppID
5. 点击「导入」

### 第二步：配置云开发环境

1. 打开 `app.js`
2. 修改云开发环境ID:

```javascript
wx.cloud.init({
  env: '你的云开发环境ID',  // 替换为实际环境ID
  traceUser: true
});
```

### 第三步：部署云函数

#### 方法一：通过微信开发者工具（推荐）

1. 在开发者工具中，右键点击 `cloudfunctions/` 目录下的每个云函数文件夹
2. 选择「创建并部署：云端安装依赖」

#### 方法二：批量部署

```bash
# 在微信开发者工具控制台执行
wx.cloud.callFunction({
  name: 'user',
  data: { action: 'login' }
})
```

需要部署的云函数列表:
- `product` - 商品相关
- `cart` - 购物车相关
- `order` - 订单相关
- `pay` - 支付相关
- `user` - 用户相关
- `address` - 地址相关
- `coupon` - 优惠券相关
- `admin` - 管理端相关

### 第四步：初始化数据库

1. 进入小程序后台 → 云开发 → 数据库
2. 创建以下集合:
   - `products` - 商品
   - `categories` - 分类
   - `orders` - 订单
   - `users` - 用户
   - `cart` - 购物车
   - `addresses` - 地址
   - `coupons` - 优惠券
   - `userCoupons` - 用户优惠券
   - `banners` - 轮播图

3. 设置数据库权限（参考 `cloudfunctions/db-permissions.json`）

### 第五步：配置微信支付

1. 进入小程序后台 → 功能 → 微信支付
2. 开通微信支付（需要企业资质）
3. 在「开发」→「开发管理」→「开发设置」中获取商户号
4. 配置支付回调地址

### 第六步：初始化数据

运行管理端初始化云函数，创建默认管理员账号:

```javascript
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'init',
    adminInfo: {
      openid: '管理员openid',
      role: 'admin'
    }
  }
})
```

---

## ⚙️ 详细配置

### 1. 数据库权限配置

每个集合的权限配置:

```json
{
  "products": {
    "read": true,
    "write": "auth.openid in get('admins').data.map(d => d.openid)"
  },
  "orders": {
    "read": "doc.userId == auth.openid || auth.openid in get('admins').data.map(d => d.openid)",
    "write": "doc.userId == auth.openid || auth.openid in get('admins').data.map(d => d.openid)"
  }
}
```

### 2. 云函数环境变量

在 `cloudfunctions/[函数名]/config.json` 中配置:

```json
{
  "permissions": {
    "openapi": [
      "wxacode.get",
      "uniformMessage.send",
      "subscribeMessage.send"
    ]
  }
}
```

### 3. 小程序配置

修改 `app.json` 中的导航栏样式:

```json
{
  "window": {
    "navigationBarBackgroundColor": "#FDF8F3",
    "navigationBarTitleText": "你的店铺名称"
  }
}
```

---

## 🧪 测试检查清单

### 客户端功能测试

- [ ] 首页轮播图正常显示
- [ ] 商品分类切换正常
- [ ] 商品详情页加载正常
- [ ] 加入购物车功能正常
- [ ] 购物车数量调整正常
- [ ] 提交订单流程正常
- [ ] 微信支付调起正常
- [ ] 订单列表显示正常
- [ ] 订单状态更新正常
- [ ] 地址管理功能正常

### 管理端功能测试

- [ ] 管理员登录正常
- [ ] 商品CRUD操作正常
- [ ] 库存调整正常
- [ ] 订单处理正常
- [ ] 数据统计显示正常

### 关键业务测试

- [ ] 库存扣减正确（防超卖）
- [ ] 支付回调处理正确
- [ ] 订单状态流转正确
- [ ] 退款流程正常

---

## 🔧 常见问题

### Q1: 云函数部署失败

**解决方案:**
1. 检查 Node.js 版本 (建议 14.x 或 16.x)
2. 删除 `node_modules` 后重新部署
3. 检查云函数代码是否有语法错误

### Q2: 微信支付调起失败

**解决方案:**
1. 确认已开通微信支付
2. 检查商户号配置
3. 确认支付目录已配置
4. 检查 `total_fee` 参数（单位为分）

### Q3: 数据库权限错误

**解决方案:**
1. 检查集合权限配置
2. 确认用户已登录（有 openid）
3. 检查权限规则语法

### Q4: 库存超卖

**解决方案:**
1. 确保使用事务处理
2. 检查 `order/create` 云函数逻辑
3. 增加库存校验逻辑

---

## 📱 发布上线

### 预览版

1. 点击开发者工具「预览」
2. 扫描二维码在真机测试

### 体验版

1. 点击「上传」
2. 在小程序后台提交体验版
3. 添加体验成员

### 正式版

1. 在小程序后台点击「提交审核」
2. 填写版本信息和功能说明
3. 等待审核通过
4. 发布上线

---

## 📚 相关文档

- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [微信支付开发文档](https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml)

---

## 💡 优化建议

1. **性能优化**
   - 使用图片懒加载
   - 启用分包加载
   - 优化云函数执行时间

2. **安全加固**
   - 敏感操作添加二次确认
   - 价格计算在服务端完成
   - 定期备份数据库

3. **监控告警**
   - 配置云开发监控
   - 设置异常告警
   - 定期检查日志

---

**部署完成！🎉**

如有问题，请查看项目 README.md 或提交 Issue。
