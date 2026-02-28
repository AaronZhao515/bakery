/**
 * 滚动隐藏表头调试测试
 * 用于验证 reserve 页面的滚动事件
 */

console.log('=== 滚动隐藏表头调试测试 ===\n');

// 检查关键代码是否存在
const fs = require('fs');
const path = require('path');

const reserveJsPath = path.join(__dirname, '../pages/reserve/reserve.js');
const reserveWxmlPath = path.join(__dirname, '../pages/reserve/reserve.wxml');
const reserveWxssPath = path.join(__dirname, '../pages/reserve/reserve.wxss');

// 读取文件内容
const jsContent = fs.readFileSync(reserveJsPath, 'utf-8');
const wxmlContent = fs.readFileSync(reserveWxmlPath, 'utf-8');
const wxssContent = fs.readFileSync(reserveWxssPath, 'utf-8');

// 检查1: onScroll 方法是否存在
console.log('检查1: onScroll 方法');
const hasOnScroll = jsContent.includes('onScroll(e)');
console.log(hasOnScroll ? '✓ onScroll 方法存在' : '✗ onScroll 方法不存在');

// 检查2: bindscroll 绑定
console.log('\n检查2: bindscroll 绑定');
const hasBindScroll = wxmlContent.includes('bindscroll="onScroll"');
console.log(hasBindScroll ? '✓ bindscroll="onScroll" 绑定正确' : '✗ bindscroll 绑定缺失');

// 检查3: headerHidden 数据字段
console.log('\n检查3: headerHidden 数据字段');
const hasHeaderHidden = jsContent.includes('headerHidden');
console.log(hasHeaderHidden ? '✓ headerHidden 数据字段存在' : '✗ headerHidden 数据字段缺失');

// 检查4: CSS 类名
console.log('\n检查4: CSS 类名');
const hasHeaderHiddenClass = wxssContent.includes('.reserve-header.header-hidden');
const hasContentExpandedClass = wxssContent.includes('.reserve-content.content-expanded');
console.log(hasHeaderHiddenClass ? '✓ .reserve-header.header-hidden 样式存在' : '✗ .reserve-header.header-hidden 样式缺失');
console.log(hasContentExpandedClass ? '✓ .reserve-content.content-expanded 样式存在' : '✗ .reserve-content.content-expanded 样式缺失');

// 检查5: 动态类名绑定
console.log('\n检查5: 动态类名绑定');
const hasDynamicHeaderClass = wxmlContent.includes('reserve-header {{headerHidden');
const hasDynamicContentClass = wxmlContent.includes('reserve-content {{headerHidden');
console.log(hasDynamicHeaderClass ? '✓ 表头动态类名绑定正确' : '✗ 表头动态类名绑定缺失');
console.log(hasDynamicContentClass ? '✓ 内容区动态类名绑定正确' : '✗ 内容区动态类名绑定缺失');

// 检查6: 高度设置
console.log('\n检查6: scroll-view 高度设置');
const hasHeight = wxssContent.includes('height: 100vh') && wxssContent.includes('.reserve-content');
console.log(hasHeight ? '✓ scroll-view 有明确高度设置' : '✗ scroll-view 高度设置可能有问题');

// 检查7: 过渡动画
console.log('\n检查7: 过渡动画');
const hasTransition = wxssContent.includes('transition: transform 0.3s ease');
console.log(hasTransition ? '✓ 过渡动画设置正确' : '✗ 过渡动画缺失');

// 输出关键代码片段
console.log('\n=== 关键代码片段 ===\n');

console.log('【JS - onScroll 方法】');
const onScrollMatch = jsContent.match(/onScroll\(e\)[\s\S]{0,500}/);
if (onScrollMatch) {
  console.log(onScrollMatch[0].substring(0, 300) + '...');
}

console.log('\n【WXML - scroll-view】');
const scrollViewMatch = wxmlContent.match(/<scroll-view[^>]*>/);
if (scrollViewMatch) {
  console.log(scrollViewMatch[0]);
}

console.log('\n【WXSS - 隐藏样式】');
const hiddenStyleMatch = wxssContent.match(/\.reserve-header\.header-hidden[\s\S]{0,200}/);
if (hiddenStyleMatch) {
  console.log(hiddenStyleMatch[0]);
}

console.log('\n=== 调试建议 ===');
console.log('1. 打开微信开发者工具，进入 reserve 页面');
console.log('2. 打开 Console 面板，查看是否有 [滚动] 日志输出');
console.log('3. 检查 Elements 面板，查看 .reserve-header 是否动态添加 .header-hidden 类');
console.log('4. 检查 Computed 样式，查看 transform 和 opacity 是否正确变化');
console.log('5. 确保 scroll-view 内容高度超过可视区域，否则无法触发滚动');
