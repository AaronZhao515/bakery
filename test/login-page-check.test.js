/**
 * 登录页面完整验证测试
 * 检查微信登录页面实现是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('=== 微信登录页面完整验证 ===\n');

// 读取文件
const loginJs = fs.readFileSync(path.join(__dirname, '../pages/login/login.js'), 'utf-8');
const loginWxml = fs.readFileSync(path.join(__dirname, '../pages/login/login.wxml'), 'utf-8');
const loginWxss = fs.readFileSync(path.join(__dirname, '../pages/login/login.wxss'), 'utf-8');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}`);
    failed++;
  }
}

// ==================== WXML 结构检查 ====================
console.log('【WXML 结构检查】\n');

check('1. chooseAvatar 按钮存在',
  /open-type=["\']chooseAvatar["\']/.test(loginWxml));

check('2. chooseAvatar 事件绑定正确',
  /bind:chooseavatar=["\']onChooseAvatar["\']/.test(loginWxml));

check('3. nickname input 存在',
  /type=["\']nickname["\']/.test(loginWxml));

check('4. nickname change 事件绑定正确',
  /bind:change=["\']onNickNameChange["\']/.test(loginWxml));

check('5. nickname review 事件绑定正确',
  /bind:nicknamereview=["\']onNickNameReview["\']/.test(loginWxml));

check('6. getPhoneNumber 按钮存在',
  /open-type=["\']getPhoneNumber["\']/.test(loginWxml));

check('7. getPhoneNumber 事件绑定正确',
  /bind:getphonenumber=["\']onPhoneLogin["\']/.test(loginWxml));

check('8. 头像图片绑定正确',
  /src=\{\{userInfo\.avatarUrl/.test(loginWxml));

check('9. 昵称输入值绑定正确',
  /value=\{\{userInfo\.nickName\}\}/.test(loginWxml));

check('10. 协议勾选框存在',
  /checkbox.*agreed/.test(loginWxml));

// ==================== JS 逻辑检查 ====================
console.log('\n【JS 逻辑检查】\n');

check('11. onChooseAvatar 方法存在',
  loginJs.includes('onChooseAvatar(e)'));

check('12. onNickNameChange 方法存在',
  loginJs.includes('onNickNameChange(e)'));

check('13. onNickNameReview 方法存在',
  loginJs.includes('onNickNameReview(e)'));

check('14. onPhoneLogin 方法存在',
  loginJs.includes('async onPhoneLogin(e)'));

check('15. onWechatLogin 方法存在',
  loginJs.includes('async onWechatLogin()'));

check('16. onAgreementToggle 方法存在',
  loginJs.includes('onAgreementToggle()'));

check('17. checkLoginStatus 方法存在',
  loginJs.includes('checkLoginStatus()'));

check('18. goBack 方法存在',
  loginJs.includes('goBack()'));

check('19. userInfo 数据字段存在',
  /userInfo:\s*\{/.test(loginJs));

check('20. agreed 数据字段存在',
  /agreed:\s*false/.test(loginJs));

check('21. isLoading 数据字段存在',
  /isLoading:\s*false/.test(loginJs));

check('22. auth.doLoginWithPhone 调用正确',
  loginJs.includes('auth.doLoginWithPhone'));

check('23. 登录成功后同步 store',
  loginJs.includes('app.store.userStore.update'));

check('24. 登录成功延迟返回',
  loginJs.includes('setTimeout') && loginJs.includes('goBack()'));

check('25. 协议检查逻辑存在',
  loginJs.includes('!this.data.agreed'));

// ==================== CSS 样式检查 ====================
console.log('\n【CSS 样式检查】\n');

check('26. .avatar-wrapper 样式存在',
  loginWxss.includes('.avatar-wrapper'));

check('27. .avatar-img 样式存在',
  loginWxss.includes('.avatar-img'));

check('28. .nickname-wrapper 样式存在',
  loginWxss.includes('.nickname-wrapper'));

check('29. .nickname-input 样式存在',
  loginWxss.includes('.nickname-input'));

check('30. .login-card 样式存在',
  loginWxss.includes('.login-card'));

check('31. .btn-primary 样式存在',
  loginWxss.includes('.btn-primary'));

check('32. .agreement-box 样式存在',
  loginWxss.includes('.agreement-box'));

// ==================== 安全与最佳实践检查 ====================
console.log('\n【安全与最佳实践检查】\n');

check('33. 登录中状态防止重复点击',
  loginJs.includes('if (this.data.isLoading) return'));

check('34. 错误处理 try-catch 存在',
  /try\s*\{[\s\S]*?catch\s*\(/.test(loginJs));

check('35. finally 释放 loading 状态',
  loginJs.includes('finally') && loginJs.includes('isLoading: false'));

check('36. 手机号授权码检查',
  loginJs.includes('!code') || loginJs.includes('code,'));

check('37. 错误日志记录',
  loginJs.includes('console.error'));

check('38. 用户信息初始化为空字符串',
  /nickName:\s*['"]{2}/.test(loginJs) && /avatarUrl:\s*['"]{2}/.test(loginJs));

// ==================== 功能完整性检查 ====================
console.log('\n【功能完整性检查】\n');

check('39. 支持一键登录（手机号）',
  loginJs.includes('getPhoneNumber'));

check('40. 支持传统登录（备用）',
  loginJs.includes('canUseOldLogin'));

check('41. 支持头像选择',
  loginJs.includes('chooseAvatar'));

check('42. 支持昵称输入',
  loginJs.includes('type="nickname"') || loginJs.includes('nickname'));

check('43. 协议同意机制',
  loginJs.includes('agreed'));

check('44. 支持返回来源页面',
  loginJs.includes('this.data.from'));

check('45. 支持暂不登录',
  loginJs.includes('onBackTap'));

// ==================== 总结 ====================
console.log('\n【验证总结】\n');
console.log(`通过: ${passed} 项`);
console.log(`失败: ${failed} 项`);
console.log(`总计: ${passed + failed} 项`);
console.log(`通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n✅ 所有检查通过！登录页面实现正确。\n');
} else {
  console.log('\n⚠️ 存在未通过项，请检查以上标记为 ✗ 的项目。\n');
}

// 输出关键代码片段
console.log('【关键代码片段】\n');

console.log('1. 数据定义:');
const dataMatch = loginJs.match(/data:\s*\{[\s\S]{0,400}\},/);
if (dataMatch) {
  console.log(dataMatch[0].substring(0, 300) + '...\n');
}

console.log('2. onChooseAvatar 方法:');
const avatarMatch = loginJs.match(/onChooseAvatar\(e\)\s*\{[\s\S]{0,300}\}/);
if (avatarMatch) {
  console.log(avatarMatch[0] + '\n');
}

console.log('3. onNickNameChange 方法:');
const nameMatch = loginJs.match(/onNickNameChange\(e\)\s*\{[\s\S]{0,200}\}/);
if (nameMatch) {
  console.log(nameMatch[0] + '\n');
}
