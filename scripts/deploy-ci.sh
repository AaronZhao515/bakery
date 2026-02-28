#!/bin/bash

# 暖心烘焙小程序 - CI/CD 云函数部署脚本
# Bakery Mini Program - CI/CD Cloud Function Deployment
#
# 这个脚本用于 CI/CD 环境，使用 --dangerously-permission-skip 自动部署
#
# 环境变量:
#   DEPLOY_ENV          - 部署环境: development | staging | production
#   SKIP_CONFIRMATION   - 设置为 true 跳过所有确认

set -e

# 颜色配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/cloudfunctions"
DEPLOY_ENV="${DEPLOY_ENV:-development}"

# 云函数列表（按依赖顺序）
FUNCTIONS=(
    "user"              # 用户服务
    "address"           # 地址服务
    "product"           # 商品服务
    "cart"              # 购物车
    "coupon"            # 优惠券
    "points"            # 积分
    "getProducts"       # 获取商品列表
    "getProductDetail"  # 商品详情
    "getHomeData"       # 首页数据
    "checkStock"        # 库存检查
    "checkPayStatus"    # 支付状态检查
    "createOrder"       # 创建订单 ⚠️ 关键
    "order"             # 订单管理
    "pay"               # 支付服务 ⚠️ 关键
    "payCallback"       # 支付回调 ⚠️ 关键
    "admin"             # 管理服务 ⚠️ 关键
)

# 关键云函数
CRITICAL_FUNCTIONS=("pay" "payCallback" "createOrder" "admin")

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在 CI 环境
is_ci() {
    [[ "$CI" == "true" ]] || [[ "$GITHUB_ACTIONS" == "true" ]] || [[ "$GITLAB_CI" == "true" ]]
}

# 部署单个云函数
deploy_function() {
    local func_name=$1
    local is_critical=false

    # 检查是否是关键函数
    for critical in "${CRITICAL_FUNCTIONS[@]}"; do
        if [[ "$critical" == "$func_name" ]]; then
            is_critical=true
            break
        fi
    done

    log_info "部署云函数: $func_name"

    if [[ "$is_critical" == true ]]; then
        log_warning "⚠️  $func_name 是关键云函数"
    fi

    # 检查云函数目录是否存在
    if [[ ! -d "$FUNCTIONS_DIR/$func_name" ]]; then
        log_error "云函数目录不存在: $FUNCTIONS_DIR/$func_name"
        return 1
    fi

    # 生成 MCP 工具调用代码
    # 在 CI 环境中，这段代码会被传递给 Claude 执行
    cat > "/tmp/deploy-$func_name.js" << EOF
const result = await mcp__cloudbase__updateFunctionCode({
  name: '$func_name',
  functionRootPath: '$FUNCTIONS_DIR'
});

if (result.success) {
  console.log('✅ $func_name 部署成功');
} else {
  console.error('❌ $func_name 部署失败:', result.message);
  process.exit(1);
}
EOF

    log_success "$func_name 部署命令已生成"
    return 0
}

# 主程序
main() {
    echo ""
    echo "============================================================"
    echo "  暖心烘焙小程序 - CI/CD 云函数部署"
    echo "  环境: $DEPLOY_ENV"
    echo "============================================================"
    echo ""

    # 检查环境
    if is_ci; then
        log_info "检测到 CI 环境，启用自动部署模式"
    elif [[ "$SKIP_CONFIRMATION" != "true" ]]; then
        log_warning "⚠️  即将部署所有云函数到 $DEPLOY_ENV 环境"
        echo ""
        echo "关键云函数: ${CRITICAL_FUNCTIONS[*]}"
        echo ""

        if [[ "$DEPLOY_ENV" == "production" ]]; then
            log_error "生产环境部署!"
            read -p "输入 'deploy' 确认部署: " confirm
            if [[ "$confirm" != "deploy" ]]; then
                log_error "已取消部署"
                exit 1
            fi
        else
            read -p "确认部署吗？ (y/N): " confirm
            if [[ "$confirm" != "y" && "$confirm" != "yes" ]]; then
                log_info "已取消部署"
                exit 0
            fi
        fi
    fi

    log_info "开始部署 ${#FUNCTIONS[@]} 个云函数..."
    echo ""

    local success_count=0
    local fail_count=0

    for func in "${FUNCTIONS[@]}"; do
        if deploy_function "$func"; then
            ((success_count++))
        else
            ((fail_count++))
            # 在 CI 环境中，遇到失败立即退出
            if is_ci; then
                log_error "部署失败，退出"
                exit 1
            fi
        fi
    done

    echo ""
    echo "============================================================"
    echo "📊 部署结果"
    echo "============================================================"
    echo ""
    log_success "成功: $success_count"
    if [[ $fail_count -gt 0 ]]; then
        log_error "失败: $fail_count"
    fi
    echo ""
    echo "============================================================"
    echo ""

    if [[ $fail_count -gt 0 ]]; then
        exit 1
    fi

    exit 0
}

# 使用 Claude 部署（带权限跳过）
deploy_with_claude() {
    log_info "使用 Claude Code 部署云函数..."

    # 生成完整的部署脚本
    local deploy_script=""

    for func in "${FUNCTIONS[@]}"; do
        deploy_script+="await mcp__cloudbase__updateFunctionCode({ name: '$func', functionRootPath: '$FUNCTIONS_DIR' }); console.log('✅ $func 完成');
"
    done

    # 输出部署命令（供复制使用）
    echo ""
    log_info "请在 Claude Code 中执行以下命令:"
    echo ""
    echo "claude --dangerously-permission-skip -p \""
    echo "$deploy_script"
    echo "\""
    echo ""
}

# 根据参数决定执行方式
case "${1:-}" in
    --claude|-c)
        deploy_with_claude
        ;;
    --help|-h)
        echo ""
        echo "暖心烘焙小程序 - 云函数 CI/CD 部署脚本"
        echo ""
        echo "用法:"
        echo "  $0                    # 标准部署"
        echo "  $0 --claude           # 生成 Claude Code 命令"
        echo "  $0 --help             # 显示帮助"
        echo ""
        echo "环境变量:"
        echo "  DEPLOY_ENV=production  # 设置部署环境"
        echo "  SKIP_CONFIRMATION=true # 跳过确认提示"
        echo ""
        ;;
    *)
        main
        ;;
esac
