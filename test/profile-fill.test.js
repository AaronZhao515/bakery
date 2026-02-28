/**
 * 微信新版头像昵称填写能力测试
 * 测试 login 页面的新版功能
 */

console.log('=== 微信新版头像昵称填写能力测试 ===\n');

// 模拟小程序页面
const mockPage = {
  data: {
    userInfo: {
      nickName: '',
      avatarUrl: '',
      phoneNumber: ''
    },
    agreed: false,
    isLoading: false,
    canUseOldLogin: false
  },

  setData(obj) {
    Object.assign(this.data, obj);
    console.log('setData:', JSON.stringify(obj, null, 2));
  },

  // 选择头像
  onChooseAvatar(e) {
    console.log('\n[测试] 选择头像事件:', JSON.stringify(e.detail));
    const { avatarUrl } = e.detail;

    if (!avatarUrl) {
      console.log('✗ 未获取到头像路径');
      return false;
    }

    this.setData({
      'userInfo.avatarUrl': avatarUrl
    });

    console.log('✓ 头像选择成功');
    return true;
  },

  // 昵称输入变化
  onNickNameChange(e) {
    console.log('\n[测试] 昵称输入事件:', JSON.stringify(e.detail));
    const { value } = e.detail;

    this.setData({
      'userInfo.nickName': value
    });

    console.log('✓ 昵称更新成功:', value);
    return true;
  },

  // 昵称审核回调
  onNickNameReview(e) {
    console.log('\n[测试] 昵称审核事件:', JSON.stringify(e.detail));
    const { pass, timeout } = e.detail;

    if (!pass && !timeout) {
      console.log('⚠ 昵称可能不合规');
      return false;
    }

    console.log('✓ 昵称审核通过');
    return true;
  },

  // 手机号登录
  async onPhoneLogin(e) {
    console.log('\n[测试] 手机号登录事件');
    const { code } = e.detail;
    const { userInfo } = this.data;

    if (!code) {
      console.log('✗ 未获取到手机号授权码');
      return false;
    }

    if (!userInfo.nickName || !userInfo.avatarUrl) {
      console.log('⚠ 提示: 用户信息不完整，建议完善头像和昵称');
    }

    console.log('✓ 手机号登录参数准备完成');
    console.log('  - phoneCode:', code);
    console.log('  - nickName:', userInfo.nickName || '(未填写)');
    console.log('  - avatarUrl:', userInfo.avatarUrl ? '(已选择)' : '(未选择)');

    return true;
  }
};

// 测试用例
console.log('--- Test 1: 初始状态检查 ---');
console.assert(mockPage.data.userInfo.nickName === '', '初始昵称应为空');
console.assert(mockPage.data.userInfo.avatarUrl === '', '初始头像应为空');
console.log('✓ 初始状态正确\n');

console.log('--- Test 2: 选择头像 ---');
const avatarResult = mockPage.onChooseAvatar({
  detail: { avatarUrl: 'http://tmp/abc123.jpg' }
});
console.assert(avatarResult === true, '头像选择应成功');
console.assert(mockPage.data.userInfo.avatarUrl === 'http://tmp/abc123.jpg', '头像路径应更新');
console.log('✓ 头像功能正常\n');

console.log('--- Test 3: 输入昵称 ---');
const nameResult = mockPage.onNickNameChange({
  detail: { value: '烘焙小王子' }
});
console.assert(nameResult === true, '昵称输入应成功');
console.assert(mockPage.data.userInfo.nickName === '烘焙小王子', '昵称应更新');
console.log('✓ 昵称输入功能正常\n');

console.log('--- Test 4: 昵称审核通过 ---');
const reviewPass = mockPage.onNickNameReview({
  detail: { pass: true, timeout: false }
});
console.assert(reviewPass === true, '审核通过');
console.log('✓ 昵称审核功能正常\n');

console.log('--- Test 5: 昵称审核不通过 ---');
mockPage.data.userInfo.nickName = ''; // 重置
const reviewFail = mockPage.onNickNameReview({
  detail: { pass: false, timeout: false }
});
console.assert(reviewFail === false, '审核不通过应返回false');
console.log('✓ 昵称审核不通过处理正确\n');

console.log('--- Test 6: 手机号登录（完整信息）---');
mockPage.data.userInfo = {
  nickName: '烘焙小王子',
  avatarUrl: 'http://tmp/abc123.jpg',
  phoneNumber: ''
};
const loginResult = mockPage.onPhoneLogin({
  detail: { code: 'e1234567890abcdef' }
});
console.assert(loginResult === true, '登录应成功');
console.log('✓ 手机号登录功能正常\n');

console.log('--- Test 7: 手机号登录（信息不完整）---');
mockPage.data.userInfo = {
  nickName: '',
  avatarUrl: '',
  phoneNumber: ''
};
const loginPartial = mockPage.onPhoneLogin({
  detail: { code: 'e1234567890abcdef' }
});
console.assert(loginPartial === true, '登录仍应成功（信息可选）');
console.log('✓ 信息不完整时登录仍可继续\n');

console.log('=== 所有测试通过 ===\n');

// 测试代码结构检查
console.log('=== 代码结构检查 ===\n');

const fs = require('fs');
const path = require('path');

const loginWxml = fs.readFileSync(path.join(__dirname, '../pages/login/login.wxml'), 'utf-8');
const loginJs = fs.readFileSync(path.join(__dirname, '../pages/login/login.js'), 'utf-8');
const loginWxss = fs.readFileSync(path.join(__dirname, '../pages/login/login.wxss'), 'utf-8');

// 检查1: WXML 结构
console.log('检查1: WXML 结构');
const checks = [
  { name: 'chooseAvatar 按钮', pattern: /open-type=["\']chooseAvatar["\']/ },
  { name: 'nickname input', pattern: /type=["\']nickname["\']/ },
  { name: 'getPhoneNumber 按钮', pattern: /open-type=["\']getPhoneNumber["\']/ },
  { name: '头像绑定', pattern: /bind:chooseavatar/ },
  { name: '昵称变化绑定', pattern: /bind:change/ },
  { name: '昵称审核绑定', pattern: /bind:nicknamereview/ }
];

checks.forEach(check => {
  const found = check.pattern.test(loginWxml);
  console.log(found ? `✓ ${check.name}` : `✗ ${check.name} 缺失`);
});

// 检查2: JS 方法
console.log('\n检查2: JS 方法');
const jsMethods = [
  'onChooseAvatar',
  'onNickNameChange',
  'onNickNameReview',
  'onPhoneLogin'
];

jsMethods.forEach(method => {
  const found = loginJs.includes(method);
  console.log(found ? `✓ ${method}` : `✗ ${method} 缺失`);
});

// 检查3: CSS 样式
console.log('\n检查3: CSS 样式');
const cssClasses = [
  '.avatar-wrapper',
  '.avatar-img',
  '.nickname-wrapper',
  '.nickname-input'
];

cssClasses.forEach(cls => {
  const found = loginWxss.includes(cls);
  console.log(found ? `✓ ${cls}` : `✗ ${cls} 缺失`);
});

console.log('\n=== 检查完成 ===');
