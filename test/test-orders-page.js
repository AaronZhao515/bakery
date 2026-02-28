/**
 * 订单页面测试脚本
 * 测试订单筛选和状态显示功能
 *
 * 使用方法：
 * 1. 打开微信开发者工具
 * 2. 进入订单页面
 * 3. 在控制台粘贴此脚本并运行
 */

const TEST_CONFIG = {
  // 测试用例期望结果（基于当前数据库数据）
  expectedCounts: {
    all: 23,              // 全部订单
    pending_payment: 2,   // status=0
    pending_pickup: 5,    // status=1 + deliveryType=0
    pending_delivery: 2,  // (status=1 + deliveryType=1) + (status=3 + deliveryType=1)
    completed: 2,         // status=4
    cancelled: 10         // status=-1
  }
};

// 测试订单列表API
async function testOrderListAPI() {
  console.log('===== 测试订单列表API =====\n');

  const testCases = [
    { name: '全部', params: {} },
    { name: '待付款', params: { status: 0 } },
    { name: '待自取', params: { filter: { status: 1, deliveryType: 0 } } },
    { name: '待配送', params: { filter: { statusList: [1, 3], deliveryType: 1 } } },
    { name: '已完成', params: { status: 4 } },
    { name: '已取消', params: { status: -1 } }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`测试【${testCase.name}】...`);
      const result = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getList',
          data: {
            page: 1,
            pageSize: 100,
            ...testCase.params
          }
        }
      });

      if (result.result.code === 0) {
        const count = result.result.data.list.length;
        const expected = TEST_CONFIG.expectedCounts[Object.keys(testCase.params)[0] || 'all'];
        const match = count === expected ? '✅' : '⚠️';
        console.log(`${match} ${testCase.name}: ${count} 个订单 (期望: ${expected})\n`);

        // 显示前3个订单的详细信息
        if (count > 0) {
          console.log('   订单示例:');
          result.result.data.list.slice(0, 3).forEach((order, idx) => {
            const statusText = getStatusText(order.status, order.deliveryType);
            console.log(`   ${idx + 1}. #${order.orderNo} | 状态:${order.status} | 配送:${order.deliveryType} | ${statusText}`);
          });
          console.log('');
        }
      } else {
        console.log(`❌ ${testCase.name}: API 错误 - ${result.result.message}\n`);
      }
    } catch (err) {
      console.log(`❌ ${testCase.name}: 调用失败 - ${err.message}\n`);
    }
  }
}

// 获取状态文字（与页面逻辑一致）
function getStatusText(status, deliveryType) {
  switch(status) {
    case 0: return '待付款';
    case 5: return '线下支付';
    case 1:
      return deliveryType === 0 ? '待自取' : '待配送';
    case 3: return '配送中';
    case 4: return '已完成';
    case -1: return '已取消';
    default: return '未知';
  }
}

// 测试页面数据渲染
async function testPageRender() {
  console.log('\n===== 测试页面数据渲染 =====\n');

  // 获取页面实例
  const pages = getCurrentPages();
  const orderPage = pages.find(p => p.route === 'pages/order/order');

  if (!orderPage) {
    console.log('⚠️ 请先进入订单页面再运行测试');
    return;
  }

  console.log('当前页面数据:');
  console.log('- 当前标签:', orderPage.data.activeTab);
  console.log('- 订单数量:', orderPage.data.orders.length);
  console.log('- 是否登录:', orderPage.data.isLogin);

  // 检查订单状态显示
  console.log('\n订单状态分布:');
  const statusCount = {};
  orderPage.data.orders.forEach(order => {
    const text = order.statusText;
    statusCount[text] = (statusCount[text] || 0) + 1;
  });
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`- ${status}: ${count} 个`);
  });
}

// 测试标签切换
async function testTabSwitch() {
  console.log('\n===== 测试标签切换 =====\n');

  const pages = getCurrentPages();
  const orderPage = pages.find(p => p.route === 'pages/order/order');

  if (!orderPage) {
    console.log('⚠️ 请先进入订单页面再运行测试');
    return;
  }

  const tabs = [
    { code: 'all', name: '全部' },
    { code: 0, name: '待付款' },
    { code: 'pending_pickup', name: '待自取' },
    { code: 'pending_delivery', name: '待配送' },
    { code: 4, name: '已完成' },
    { code: -1, name: '已取消' }
  ];

  console.log('可用标签:');
  tabs.forEach(tab => {
    const active = orderPage.data.activeTab === tab.code ? ' [当前]' : '';
    console.log(`- ${tab.name} (code: ${tab.code})${active}`);
  });
}

// 运行所有测试
async function runAllTests() {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║     订单页面功能测试开始           ║');
  console.log('╚════════════════════════════════════╝\n');

  await testOrderListAPI();
  await testPageRender();
  await testTabSwitch();

  console.log('\n╔════════════════════════════════════╗');
  console.log('║     订单页面功能测试完成           ║');
  console.log('╚════════════════════════════════════╝\n');
}

// 导出测试函数
module.exports = {
  testOrderListAPI,
  testPageRender,
  testTabSwitch,
  runAllTests
};

// 自动运行
runAllTests();
