/**
 * 商品管理页面测试脚本
 * 测试商品列表、编辑、分类等功能
 *
 * 使用方法：
 * 1. 打开微信开发者工具
 * 2. 进入商品管理页面
 * 3. 在控制台粘贴此脚本并运行
 */

// ==================== 测试配置 ====================
const TEST_CONFIG = {
  // 测试商品数据
  testProduct: {
    name: '测试商品-' + Date.now(),
    price: 99.99,
    stock: 100,
    categoryId: '',
    description: '这是一个测试商品',
    images: []
  }
};

// ==================== 测试函数 ====================

// 1. 测试分类管理API
async function testCategoryAPI() {
  console.log('\n📦 测试分类管理API\n');

  // 1.1 获取分类列表
  console.log('1.1 获取分类列表...');
  try {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'categoryManage',
        operation: 'list'
      }
    });

    if (result.result.code === 0) {
      const categories = result.result.data.list;
      console.log(`   ✅ 成功获取 ${categories.length} 个分类`);
      categories.forEach((cat, i) => {
        console.log(`   ${i + 1}. ${cat.name} (id: ${cat._id})`);
      });
      return categories;
    } else {
      console.log('   ❌ 获取失败:', result.result.message);
      return [];
    }
  } catch (e) {
    console.log('   ❌ 调用失败:', e.message);
    return [];
  }
}

// 2. 测试商品CRUD API
async function testProductCRUD(categories) {
  console.log('\n🛍️ 测试商品CRUD API\n');

  let createdProductId = null;

  // 2.1 创建商品
  console.log('2.1 创建商品...');
  try {
    const testProduct = {
      ...TEST_CONFIG.testProduct,
      categoryId: categories[0]?._id || 'bread',
      categoryName: categories[0]?.name || '面包',
      status: 1
    };

    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'productCRUD',
        operation: 'create',
        productData: testProduct
      }
    });

    if (result.result.code === 0) {
      createdProductId = result.result.data.productId;
      console.log('   ✅ 创建成功, ID:', createdProductId);
    } else {
      console.log('   ❌ 创建失败:', result.result.message);
    }
  } catch (e) {
    console.log('   ❌ 调用失败:', e.message);
  }

  if (!createdProductId) return;

  // 2.2 获取商品详情
  console.log('\n2.2 获取商品详情...');
  try {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'productCRUD',
        operation: 'get',
        productId: createdProductId
      }
    });

    if (result.result.code === 0) {
      const product = result.result.data;
      console.log('   ✅ 获取成功');
      console.log(`   - 名称: ${product.name}`);
      console.log(`   - 价格: ¥${product.price}`);
      console.log(`   - 库存: ${product.stock}`);
      console.log(`   - 状态: ${product.status === 1 ? '上架' : '下架'}`);
    } else {
      console.log('   ❌ 获取失败:', result.result.message);
    }
  } catch (e) {
    console.log('   ❌ 调用失败:', e.message);
  }

  // 2.3 更新商品
  console.log('\n2.3 更新商品...');
  try {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'productCRUD',
        operation: 'update',
        productId: createdProductId,
        productData: {
          price: 88.88,
          stock: 50
        }
      }
    });

    if (result.result.code === 0) {
      console.log('   ✅ 更新成功');
    } else {
      console.log('   ❌ 更新失败:', result.result.message);
    }
  } catch (e) {
    console.log('   ❌ 调用失败:', e.message);
  }

  // 2.4 获取商品列表
  console.log('\n2.4 获取商品列表...');
  try {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'productCRUD',
        operation: 'list',
        page: 1,
        pageSize: 10
      }
    });

    if (result.result.code === 0) {
      const { list, total } = result.result.data;
      console.log(`   ✅ 获取成功，共 ${total} 个商品`);
      list.slice(0, 3).forEach((product, i) => {
        console.log(`   ${i + 1}. ${product.name} (¥${product.price})`);
      });
    } else {
      console.log('   ❌ 获取失败:', result.result.message);
    }
  } catch (e) {
    console.log('   ❌ 调用失败:', e.message);
  }

  // 2.5 删除测试商品
  console.log('\n2.5 删除测试商品...');
  try {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'productCRUD',
        operation: 'delete',
        productId: createdProductId
      }
    });

    if (result.result.code === 0) {
      console.log('   ✅ 删除成功');
    } else {
      console.log('   ❌ 删除失败:', result.result.message);
    }
  } catch (e) {
    console.log('   ❌ 调用失败:', e.message);
  }
}

// 3. 测试页面状态
async function testPageState() {
  console.log('\n📱 测试页面状态\n');

  const pages = getCurrentPages();
  const productListPage = pages.find(p => p.route === 'package-admin/pages/product-list/product-list');
  const productEditPage = pages.find(p => p.route === 'package-admin/pages/product-edit/product-edit');

  if (productListPage) {
    console.log('✅ 当前在商品列表页');
    console.log(`   - 商品数量: ${productListPage.data.products?.length || 0}`);
    console.log(`   - 分类数量: ${productListPage.data.categories?.length || 0}`);
    console.log(`   - 当前分类筛选: ${productListPage.data.currentCategory}`);
    console.log(`   - 搜索关键词: ${productListPage.data.searchKeyword || '无'}`);
    console.log(`   - 批量模式: ${productListPage.data.isBatchMode ? '开启' : '关闭'}`);
  } else if (productEditPage) {
    console.log('✅ 当前在商品编辑页');
    console.log(`   - 编辑模式: ${productEditPage.data.isEdit ? '编辑' : '新建'}`);
    console.log(`   - 商品名称: ${productEditPage.data.product?.name || '未填写'}`);
    console.log(`   - 分类数量: ${productEditPage.data.categories?.length || 0}`);
    console.log(`   - 当前分类索引: ${productEditPage.data.categoryIndex}`);
  } else {
    console.log('⚠️ 不在商品管理页面');
    console.log('   当前页面:', pages[pages.length - 1]?.route);
  }
}

// 4. 测试批量操作
async function testBatchOperations() {
  console.log('\n🔄 测试批量操作API\n');

  // 获取商品列表
  try {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'productCRUD',
        operation: 'list',
        page: 1,
        pageSize: 5
      }
    });

    if (result.result.code === 0) {
      const products = result.result.data.list;
      if (products.length >= 2) {
        const testIds = products.slice(0, 2).map(p => p._id);
        console.log(`测试批量上架/下架，商品ID: ${testIds.join(', ')}`);

        // 批量下架
        console.log('\n4.1 批量下架...');
        const offResults = await Promise.all(
          testIds.map(id =>
            wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'productCRUD',
                operation: 'update',
                productId: id,
                productData: { status: 0 }
              }
            })
          )
        );
        const offSuccess = offResults.filter(r => r.result.code === 0).length;
        console.log(`   ✅ ${offSuccess}/${testIds.length} 个商品下架成功`);

        // 批量上架
        console.log('\n4.2 批量上架...');
        const onResults = await Promise.all(
          testIds.map(id =>
            wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'productCRUD',
                operation: 'update',
                productId: id,
                productData: { status: 1 }
              }
            })
          )
        );
        const onSuccess = onResults.filter(r => r.result.code === 0).length;
        console.log(`   ✅ ${onSuccess}/${testIds.length} 个商品上架成功`);
      } else {
        console.log('⚠️ 商品数量不足，跳过批量操作测试');
      }
    }
  } catch (e) {
    console.log('   ❌ 测试失败:', e.message);
  }
}

// ==================== 运行测试 ====================
async function runAllTests() {
  console.clear();
  console.log('╔════════════════════════════════════════╗');
  console.log('║     商品管理功能测试开始               ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 1. 测试分类API
  const categories = await testCategoryAPI();

  // 2. 测试商品CRUD
  await testProductCRUD(categories);

  // 3. 测试页面状态
  await testPageState();

  // 4. 测试批量操作
  await testBatchOperations();

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     商品管理功能测试完成               ║');
  console.log('╚════════════════════════════════════════╝\n');
}

// 导出测试函数
module.exports = {
  testCategoryAPI,
  testProductCRUD,
  testPageState,
  testBatchOperations,
  runAllTests
};

// 自动运行
runAllTests();
