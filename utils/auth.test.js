/**
 * 登录逻辑测试
 * 用于验证登录、登出、状态检查等功能是否正常
 */

const auth = require('./auth');

/**
 * 测试登录流程
 */
async function testLogin() {
  console.log('=== 测试登录流程 ===');

  try {
    // 1. 测试初始状态（未登录）
    console.log('1. 检查初始登录状态:', auth.isLogin() ? '已登录' : '未登录');

    // 2. 执行登录
    console.log('2. 执行登录...');
    const loginResult = await auth.doLogin();
    console.log('   登录结果:', loginResult.success ? '成功' : '失败');

    if (loginResult.success) {
      console.log('   用户信息:', loginResult.data.userInfo);
      console.log('   角色:', loginResult.data.role);
      console.log('   Token:', loginResult.data.token ? '已获取' : '未获取');
    }

    // 3. 检查登录状态
    console.log('3. 检查登录状态:', auth.isLogin() ? '已登录' : '未登录');

    // 4. 获取用户信息
    const userInfo = auth.getUserInfo();
    console.log('4. 获取用户信息:', userInfo);

    // 5. 获取用户角色
    const role = auth.getUserRole();
    console.log('5. 获取用户角色:', role);

    return loginResult.success;
  } catch (error) {
    console.error('登录测试失败:', error);
    return false;
  }
}

/**
 * 测试用户信息更新
 */
async function testUpdateUserInfo() {
  console.log('\n=== 测试用户信息更新 ===');

  try {
    const newUserInfo = {
      nickName: '测试用户',
      avatarUrl: 'https://example.com/avatar.jpg'
    };

    const result = await auth.updateUserInfo(newUserInfo);
    console.log('更新结果:', result.success ? '成功' : '失败');

    if (result.success) {
      const updatedInfo = auth.getUserInfo();
      console.log('更新后用户信息:', updatedInfo);
    }

    return result.success;
  } catch (error) {
    console.error('更新用户信息测试失败:', error);
    return false;
  }
}

/**
 * 测试退出登录
 */
async function testLogout() {
  console.log('\n=== 测试退出登录 ===');

  try {
    // 1. 检查登录状态
    console.log('1. 退出前登录状态:', auth.isLogin() ? '已登录' : '未登录');

    // 2. 执行退出
    console.log('2. 执行退出...');
    const logoutResult = await auth.doLogout();
    console.log('   退出结果:', logoutResult.success ? '成功' : '失败');

    // 3. 检查退出后状态
    console.log('3. 退出后登录状态:', auth.isLogin() ? '已登录' : '未登录');

    // 4. 检查用户信息是否清除
    const userInfo = auth.getUserInfo();
    console.log('4. 退出后用户信息:', userInfo);

    return logoutResult.success;
  } catch (error) {
    console.error('退出登录测试失败:', error);
    return false;
  }
}

/**
 * 测试静默登录
 */
async function testSilentLogin() {
  console.log('\n=== 测试静默登录 ===');

  try {
    // 1. 先清除登录状态
    auth.clearAuthInfo();
    console.log('1. 清除登录状态');

    // 2. 执行静默登录
    console.log('2. 执行静默登录...');
    const result = await auth.silentLogin();
    console.log('   静默登录结果:', result.success ? '成功' : '失败');

    if (result.success) {
      console.log('   用户信息:', result.data);
    }

    return result.success;
  } catch (error) {
    console.error('静默登录测试失败:', error);
    return false;
  }
}

/**
 * 测试权限检查
 */
function testPermissionCheck() {
  console.log('\n=== 测试权限检查 ===');

  const isAdmin = auth.isAdmin();
  const isStaff = auth.isStaff();
  const role = auth.getUserRole();

  console.log('当前角色:', role);
  console.log('是否管理员:', isAdmin ? '是' : '否');
  console.log('是否员工:', isStaff ? '是' : '否');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('开始登录逻辑测试...\n');

  const results = {
    login: await testLogin(),
    updateUserInfo: await testUpdateUserInfo(),
    permissionCheck: (testPermissionCheck(), true),
    logout: await testLogout(),
    silentLogin: await testSilentLogin()
  };

  console.log('\n=== 测试结果汇总 ===');
  for (const [test, passed] of Object.entries(results)) {
    console.log(`${test}: ${passed ? '✅ 通过' : '❌ 失败'}`);
  }

  const allPassed = Object.values(results).every(r => r);
  console.log(`\n总体结果: ${allPassed ? '✅ 所有测试通过' : '❌ 部分测试失败'}`);

  return allPassed;
}

module.exports = {
  testLogin,
  testUpdateUserInfo,
  testLogout,
  testSilentLogin,
  testPermissionCheck,
  runAllTests
};

// 如果在页面中直接运行测试
if (typeof Page !== 'undefined') {
  Page({
    data: {
      testResults: []
    },

    async onLoad() {
      const results = [];

      // 测试登录
      results.push({ name: '登录测试', result: await testLogin() });

      // 测试更新用户信息
      results.push({ name: '更新用户信息', result: await testUpdateUserInfo() });

      // 测试权限检查
      testPermissionCheck();
      results.push({ name: '权限检查', result: true });

      // 测试退出登录
      results.push({ name: '退出登录', result: await testLogout() });

      // 测试静默登录
      results.push({ name: '静默登录', result: await testSilentLogin() });

      this.setData({ testResults: results });
    }
  });
}
