/**
 * 登录功能测试脚本
 * 在微信开发者工具控制台运行此脚本测试登录功能
 *
 * 使用方法：
 * 1. 打开微信开发者工具
 * 2. 进入登录页面
 * 3. 在控制台粘贴此脚本并运行
 */

// 测试手机号一键登录
async function testLogin() {
  console.log('===== 开始测试登录功能 =====');

  // 1. 测试获取用户信息
  console.log('\n1. 测试获取微信用户信息...');
  try {
    const profileResult = await wx.getUserProfile({
      desc: '用于完善用户资料'
    });
    console.log('✅ 获取用户信息成功:', profileResult.userInfo);
  } catch (err) {
    console.log('⚠️ 获取用户信息失败:', err);
  }

  // 2. 测试云函数调用
  console.log('\n2. 测试云函数调用...');
  try {
    const result = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'login',
        data: {}
      }
    });
    console.log('✅ 云函数调用成功:', result.result);
  } catch (err) {
    console.log('❌ 云函数调用失败:', err);
  }

  // 3. 检查本地存储
  console.log('\n3. 检查本地存储...');
  const authInfo = wx.getStorageSync('auth_info');
  if (authInfo) {
    console.log('✅ 已有登录信息:', authInfo);
  } else {
    console.log('⚠️ 无登录信息，请先登录');
  }

  console.log('\n===== 测试完成 =====');
}

// 测试数据库用户记录
async function testDatabase() {
  console.log('\n===== 测试数据库 =====');

  try {
    // 获取当前用户 openid
    const { result } = await wx.cloud.callFunction({
      name: 'user',
      data: { action: 'getInfo' }
    });

    if (result.code === 0) {
      console.log('✅ 数据库用户记录:', result.data);
    } else {
      console.log('⚠️ 未找到用户记录:', result.message);
    }
  } catch (err) {
    console.log('❌ 查询失败:', err);
  }
}

// 运行测试
testLogin();

// 导出测试函数供手动调用
module.exports = {
  testLogin,
  testDatabase
};
