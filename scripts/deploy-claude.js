/**
 * Claude Code 云函数部署助手
 * 与 --dangerously-permission-skip 配合使用
 *
 * 使用方法:
 *   claude --dangerously-permission-skip -p "node scripts/deploy-claude.js --all"
 */

const fs = require('fs');
const path = require('path');

const FUNCTIONS_DIR = path.join(__dirname, '..', 'cloudfunctions');

// 关键云函数
const CRITICAL_FUNCTIONS = ['pay', 'payCallback', 'createOrder', 'admin'];

// 部署顺序
const DEPLOY_ORDER = [
  'user', 'address', 'product', 'cart', 'coupon', 'points',
  'getProducts', 'getProductDetail', 'getHomeData', 'checkStock', 'checkPayStatus',
  'createOrder', 'order', 'pay', 'payCallback', 'admin'
];

// 获取所有云函数
function getAllFunctions() {
  return fs.readdirSync(FUNCTIONS_DIR)
    .filter(name => fs.existsSync(path.join(FUNCTIONS_DIR, name, 'index.js')));
}

// 生成部署命令
function generateDeployCommands(functions) {
  return functions.map(name => {
    const isCritical = CRITICAL_FUNCTIONS.includes(name);
    const warning = isCritical ? ' /* ⚠️ 关键函数 */' : '';
    return `
// 部署 ${name}${warning}
await mcp__cloudbase__updateFunctionCode({
  name: '${name}',
  functionRootPath: '${FUNCTIONS_DIR.replace(/\\/g, '\\')}\\cloudfunctions'
});
console.log('✅ ${name} 部署完成');`;
  }).join('\n');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Claude Code 云函数部署助手

用法:
  claude --dangerously-permission-skip -p "node scripts/deploy-claude.js [选项]"

选项:
  --all, -a     部署所有云函数
  --list, -l    列出所有云函数
  --help, -h    显示帮助

示例:
  # 列出所有云函数
  claude -p "node scripts/deploy-claude.js --list"

  # 部署所有云函数（使用权限跳过）
  claude --dangerously-permission-skip -p "node scripts/deploy-claude.js --all"
`);
    return;
  }

  if (args.includes('--list') || args.includes('-l')) {
    const functions = getAllFunctions();
    console.log('\n📋 所有云函数:\n');

    DEPLOY_ORDER.forEach((name, index) => {
      if (functions.includes(name)) {
        const isCritical = CRITICAL_FUNCTIONS.includes(name);
        console.log(`  [${index + 1}] ${name}${isCritical ? ' ⚠️ 关键' : ''}`);
      }
    });

    console.log(`\n共计: ${functions.length} 个云函数`);
    return;
  }

  if (args.includes('--all') || args.includes('-a')) {
    const functions = getAllFunctions();

    // 按部署顺序排序
    const sortedFunctions = functions.sort((a, b) => {
      const indexA = DEPLOY_ORDER.indexOf(a);
      const indexB = DEPLOY_ORDER.indexOf(b);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    console.log('\n🚀 开始部署所有云函数...\n');
    console.log(`部署顺序: ${sortedFunctions.join(' → ')}\n`);

    // 输出 MCP 工具调用代码
    const deployCode = generateDeployCommands(sortedFunctions);

    console.log('请在 Claude Code 中执行以下代码:\n');
    console.log('```javascript');
    console.log(deployCode);
    console.log('```');

    return;
  }

  // 默认显示帮助
  console.log('使用 --help 查看帮助信息');
}

main().catch(console.error);
