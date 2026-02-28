// ================== 订单页面快速测试 ==================
// 在微信开发者工具控制台中粘贴运行
// =====================================================

(async () => {
  console.clear();
  console.log('🧪 开始测试订单页面...\n');

  // 1. 测试云函数 - 待自取
  console.log('1️⃣ 测试【待自取】查询 (status=1 + deliveryType=0)');
  try {
    const pickupRes = await wx.cloud.callFunction({
      name: 'order',
      data: {
        action: 'getList',
        data: {
          page: 1,
          pageSize: 100,
          filter: { status: 1, deliveryType: 0 }
        }
      }
    });

    if (pickupRes.result.code === 0) {
      const orders = pickupRes.result.data.list;
      console.log(`   ✅ 查询成功，找到 ${orders.length} 个订单`);
      orders.slice(0, 3).forEach((order, i) => {
        console.log(`   ${i+1}. #${order.orderNo} | status:${order.status} | deliveryType:${order.deliveryType}`);
      });
    } else {
      console.log('   ❌ 查询失败:', pickupRes.result.message);
    }
  } catch (e) {
    console.log('   ❌ 调用失败:', e.message);
  }

  // 2. 测试云函数 - 待配送
  console.log('\n2️⃣ 测试【待配送】查询 (statusList=[1,3] + deliveryType=1)');
  try {
    const deliveryRes = await wx.cloud.callFunction({
      name: 'order',
      data: {
        action: 'getList',
        data: {
          page: 1,
          pageSize: 100,
          filter: { statusList: [1, 3], deliveryType: 1 }
        }
      }
    });

    if (deliveryRes.result.code === 0) {
      const orders = deliveryRes.result.data.list;
      console.log(`   ✅ 查询成功，找到 ${orders.length} 个订单`);
      orders.forEach((order, i) => {
        const statusText = order.status === 1 ? '待配送' : '配送中';
        console.log(`   ${i+1}. #${order.orderNo} | ${statusText} (status:${order.status})`);
      });
    } else {
      console.log('   ❌ 查询失败:', deliveryRes.result.message);
    }
  } catch (e) {
    console.log('   ❌ 调用失败:', e.message);
  }

  // 3. 检查当前页面
  console.log('\n3️⃣ 检查当前页面状态');
  const pages = getCurrentPages();
  const orderPage = pages.find(p => p.route === 'pages/order/order');

  if (orderPage) {
    console.log('   ✅ 当前在订单页面');
    console.log(`   - 当前标签: ${orderPage.data.activeTab}`);
    console.log(`   - 订单数量: ${orderPage.data.orders.length}`);
    console.log(`   - 是否登录: ${orderPage.data.isLogin}`);

    // 检查标签配置
    console.log('\n   标签配置:');
    orderPage.data.tabs.forEach(tab => {
      console.log(`   - ${tab.label} (code: ${tab.code})`);
    });
  } else {
    console.log('   ⚠️ 不在订单页面，当前页面:', pages[pages.length-1]?.route);
  }

  console.log('\n✅ 测试完成');
})();
