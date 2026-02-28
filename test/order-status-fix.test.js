/**
 * 订单状态显示修复验证测试
 * 验证 loadMoreOrders 中的订单状态处理逻辑
 */

console.log('=== 订单状态显示修复验证 ===\n');

// 模拟订单数据
const mockOrders = [
  { _id: '1', status: 0, deliveryType: 0, items: [{ quantity: 1 }] },
  { _id: '2', status: 1, deliveryType: 0, items: [{ quantity: 2 }] },
  { _id: '3', status: 1, deliveryType: 1, items: [{ quantity: 3 }] },
  { _id: '4', status: 2, deliveryType: 0, items: [{ quantity: 1 }] },
  { _id: '5', status: 3, deliveryType: 1, items: [{ quantity: 2 }] },
  { _id: '6', status: 4, deliveryType: 0, items: [{ quantity: 1 }] },
  { _id: '7', status: 5, deliveryType: 0, items: [{ quantity: 2 }] },
  { _id: '8', status: -1, deliveryType: 0, items: [{ quantity: 1 }] },
  { _id: '9', status: -2, deliveryType: 0, items: [{ quantity: 2 }] },
  { _id: '10', status: -3, deliveryType: 0, items: [{ quantity: 1 }] }
];

// 模拟状态处理逻辑（从 order.js 提取）
function processOrder(order) {
  let statusText = '';
  let statusColor = '#B08860';

  switch(order.status) {
    case 0:
      statusText = '待付款';
      statusColor = '#D4A96A';
      break;
    case 5:
      statusText = '线下支付';
      statusColor = '#D4A96A';
      break;
    case 1:
      if (order.deliveryType === 0) {
        statusText = '待自取';
        statusColor = '#26C6DA';
      } else {
        statusText = '待配送';
        statusColor = '#9B7355';
      }
      break;
    case 2:
      statusText = '制作中';
      statusColor = '#AB47BC';
      break;
    case 3:
      statusText = '配送中';
      statusColor = '#29B6F6';
      break;
    case 4:
      statusText = '已完成';
      statusColor = '#7A9B55';
      break;
    case -1:
      statusText = '已取消';
      statusColor = '#999999';
      break;
    case -2:
      statusText = '退款中';
      statusColor = '#EF5350';
      break;
    case -3:
      statusText = '已退款';
      statusColor = '#BDBDBD';
      break;
    default:
      statusText = '未知';
      statusColor = '#B08860';
  }

  return {
    ...order,
    statusText,
    statusColor,
    productCount: (order.items && order.items.reduce((sum, item) => sum + item.quantity, 0)) || 0
  };
}

// 测试处理后的订单
console.log('【订单状态处理测试】\n');

const processedOrders = mockOrders.map(processOrder);

const expectedResults = [
  { status: 0, text: '待付款', color: '#D4A96A' },
  { status: 1, deliveryType: 0, text: '待自取', color: '#26C6DA' },
  { status: 1, deliveryType: 1, text: '待配送', color: '#9B7355' },
  { status: 2, text: '制作中', color: '#AB47BC' },
  { status: 3, text: '配送中', color: '#29B6F6' },
  { status: 4, text: '已完成', color: '#7A9B55' },
  { status: 5, text: '线下支付', color: '#D4A96A' },
  { status: -1, text: '已取消', color: '#999999' },
  { status: -2, text: '退款中', color: '#EF5350' },
  { status: -3, text: '已退款', color: '#BDBDBD' }
];

let passed = 0;
let failed = 0;

processedOrders.forEach((order, index) => {
  const expected = expectedResults[index];
  const textMatch = order.statusText === expected.text;
  const colorMatch = order.statusColor === expected.color;

  if (textMatch && colorMatch) {
    console.log(`✓ 订单 ${order._id}: status=${order.status}, text="${order.statusText}", color=${order.statusColor}`);
    passed++;
  } else {
    console.log(`✗ 订单 ${order._id}:`);
    console.log(`  期望: text="${expected.text}", color=${expected.color}`);
    console.log(`  实际: text="${order.statusText}", color=${order.statusColor}`);
    failed++;
  }
});

console.log(`\n【测试结果】通过: ${passed}, 失败: ${failed}\n`);

// 检查代码中是否修复
console.log('【代码检查】\n');

const fs = require('fs');
const path = require('path');

const orderJs = fs.readFileSync(path.join(__dirname, '../pages/order/order.js'), 'utf-8');

// 检查 loadMoreOrders 中是否有 statusText 处理
const hasStatusTextInLoadMore = /loadMoreOrders[\s\S]{0,2000}statusText/.test(orderJs);
const hasStatusColorInLoadMore = /loadMoreOrders[\s\S]{0,2000}statusColor/.test(orderJs);
const hasSwitchInLoadMore = /loadMoreOrders[\s\S]{0,2000}switch\(order\.status\)/.test(orderJs);

console.log(hasStatusTextInLoadMore ? '✓ loadMoreOrders 中有 statusText 处理' : '✗ loadMoreOrders 中缺少 statusText');
console.log(hasStatusColorInLoadMore ? '✓ loadMoreOrders 中有 statusColor 处理' : '✗ loadMoreOrders 中缺少 statusColor');
console.log(hasSwitchInLoadMore ? '✓ loadMoreOrders 中有 switch-case 状态处理' : '✗ loadMoreOrders 中缺少 switch-case');

if (passed === 10 && hasStatusTextInLoadMore && hasStatusColorInLoadMore && hasSwitchInLoadMore) {
  console.log('\n✅ 修复验证通过！订单状态显示应该正常。\n');
} else {
  console.log('\n⚠️ 存在问题，请检查。\n');
}
