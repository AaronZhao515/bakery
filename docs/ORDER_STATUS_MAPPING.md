# 订单状态映射说明文档

> 本文档说明暖心烘焙小程序中订单状态的定义、映射关系及使用规范。
> 最后更新：2026-02-27

---

## 一、订单状态定义（云函数）

**文件位置**: `cloudfunctions/order/index.js:19-29`

```javascript
const ORDER_STATUS = {
  PENDING_PAY: 0,      // 待支付
  PAID: 1,             // 已支付
  PREPARING: 2,        // 制作中（备餐中）
  DELIVERING: 3,       // 配送中
  COMPLETED: 4,        // 已完成
  OFFLINE_PAY: 5,      // 线下支付
  CANCELLED: -1,       // 已取消
  REFUNDING: -2,       // 退款中
  REFUNDED: -3         // 已退款
}
```

---

## 二、各端状态映射对照表

| 状态码 | 云函数定义 | 用户列表页<br>(pages/order) | 用户详情页<br>(package-order/order-detail) | 后台列表页<br>(package-admin/order-manage) | 后台详情页<br>(package-admin/order-detail) | 颜色值 |
|--------|-----------|---------------------------|-------------------------------------------|-------------------------------------------|-------------------------------------------|--------|
| 0 | `PENDING_PAY` | 待付款 | 待支付 | 待支付 | 待支付 | `#D4A96A` |
| 1 | `PAID` | 待自取 / 待配送* | 已支付 | 已支付 | 已支付 | `#26C6DA` / `#9B7355` |
| 2 | `PREPARING` | 制作中 | 制作中 | 制作中 | 制作中 | `#AB47BC` |
| 3 | `DELIVERING` | 配送中 | 配送中 | 配送中 | 配送中 | `#29B6F6` |
| 4 | `COMPLETED` | 已完成 | 已完成 | 已完成 | 已完成 | `#7A9B55` |
| 5 | `OFFLINE_PAY` | 线下支付 | 线下支付 | 线下支付 | 线下支付 | `#D4A96A` |
| -1 | `CANCELLED` | 已取消 | 已取消 | 已取消 | 已取消 | `#999999` |
| -2 | `REFUNDING` | 退款中 | 退款中 | 退款中 | 退款中 | `#EF5350` |
| -3 | `REFUNDED` | 已退款 | 已退款 | 已退款 | 已退款 | `#BDBDBD` |

> **\* 特殊说明**: 用户列表页 `status=1` 时，根据 `deliveryType` 字段区分显示：
> - `deliveryType=0` → "待自取"
> - `deliveryType=1` → "待配送"

---

## 三、文件位置索引

### 3.1 云函数状态定义
```
cloudfunctions/order/index.js        # ORDER_STATUS 常量 (第19-29行)
cloudfunctions/admin/index.js        # ORDER_STATUS 常量 (第20-29行)
```

### 3.2 用户端状态映射
```
pages/order/order.js                 # switch-case 状态映射 (第205-250行)
package-order/pages/order-detail/order-detail.js  # ORDER_STATUS 对象 (第12-22行)
```

### 3.3 管理后台状态映射
```
package-admin/pages/order-manage/order-manage.js      # ORDER_STATUS_MAP 对象 (第8-18行)
package-admin/pages/order-manage/order-manage.wxss    # 状态样式类 (第294-340行)
package-admin/pages/order-detail/order-detail.js      # ORDER_STATUS_MAP 对象 (第7-17行)
```

### 3.4 工具函数
```
utils/constants.js                   # ORDER_STATUS 常量定义及 getOrderStatusByCode 函数
```

---

## 四、状态流转说明

### 4.1 正常流程
```
待支付(0) → 已支付(1) → 制作中(2) → 配送中(3) → 已完成(4)
               ↓
           待自取(1+deliveryType=0)
```

### 4.2 线下支付流程
```
待支付(0) → 线下支付(5) → 制作中(2) → ... → 已完成(4)
```

### 4.3 取消流程
```
待支付(0) → 已取消(-1)
已支付(1) → 已取消(-1) [恢复库存、退还积分/优惠券]
```

### 4.4 退款流程
```
已支付(1) / 制作中(2) → 退款中(-2) → 已退款(-3)
```

---

## 五、使用示例

### 5.1 用户端根据状态显示操作按钮

```javascript
// pages/order/order.js
canCancel: ![4, -1, -2, -3].includes(order.status),
canPay: order.status === 0,
isCompleted: order.status === 4,
isCancelled: order.status === -1
```

### 5.2 状态显示（用户列表页）

```javascript
// 特殊处理 status=1，根据 deliveryType 显示不同文案
if (order.status === 1) {
  if (order.deliveryType === 0) {
    statusText = '待自取';
    statusColor = '#26C6DA';
  } else {
    statusText = '待配送';
    statusColor = '#9B7355';
  }
}
```

### 5.3 后台状态样式类

```wxss
<!-- 后台使用 class 控制样式 -->
<view class="order-status {{item.statusClass}}">{{item.statusText}}</view>

/* 对应的样式定义 */
.order-status.pending { /* 待支付 */ }
.order-status.paid { /* 已支付 */ }
.order-status.preparing { /* 制作中 */ }
.order-status.delivering { /* 配送中 */ }
.order-status.completed { /* 已完成 */ }
.order-status.offline { /* 线下支付 */ }
.order-status.cancelled { /* 已取消 */ }
.order-status.refunding { /* 退款中 */ }
.order-status.refunded { /* 已退款 */ }
```

---

## 六、修改历史

| 日期 | 修改内容 | 修改人 |
|------|---------|--------|
| 2026-02-27 | 添加状态 5(线下支付)定义到后台 | Claude |
| 2026-02-27 | 补充用户列表页缺失的状态 2/-2/-3 | Claude |
| 2026-02-27 | 统一"备餐中"→"制作中"命名 | Claude |

---

## 七、注意事项

1. **状态码唯一性**: 所有状态码在系统中必须唯一，新增状态需同步更新所有映射表
2. **样式同步**: 后台新增状态时，需同步添加对应的 `.order-status.xxx` 样式类
3. **事务处理**: 涉及状态变更的操作（如取消订单）必须使用数据库事务
4. **用户视角**: 用户列表页将 `status=1` 根据 `deliveryType` 细分显示，提升用户体验
5. **权限校验**: 所有状态变更操作需校验用户权限（openid匹配或管理员权限）

---

## 八、相关文档

- [数据库权限配置](../cloudfunctions/db-permissions.json)
- [订单云函数](../cloudfunctions/order/index.js)
- [管理后台云函数](../cloudfunctions/admin/index.js)
- [常量定义](../utils/constants.js)
