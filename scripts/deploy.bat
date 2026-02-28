@echo off
chcp 65001 >nul

REM 暖心烘焙小程序 - 云函数部署批处理脚本
REM Bakery Mini Program - Cloud Function Deployment Batch Script

setlocal EnableDelayedExpansion

REM 配置
set "PROJECT_ROOT=%~dp0.."
set "FUNCTIONS_DIR=%PROJECT_ROOT%\cloudfunctions"
set "DEPLOY_ENV=development"

REM 颜色
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo.
echo ============================================================
echo   暖心烘焙小程序 - 云函数部署
echo ============================================================
echo.

REM 检查参数
if "%~1"=="--help" goto :help
if "%~1"=="-h" goto :help
if "%~1"=="--list" goto :list
if "%~1"=="-l" goto :list
if "%~1"=="--all" goto :deploy_all
if "%~1"=="-a" goto :deploy_all

REM 如果没有参数，显示帮助
if "%~1"=="" goto :help

REM 部署指定函数
goto :deploy_specific

:help
echo 使用方法:
echo   deploy.bat [选项] [云函数名...]
echo.
echo 选项:
echo   --all, -a       部署所有云函数
echo   --list, -l      列出所有云函数
echo   --help, -h      显示帮助
echo.
echo 示例:
echo   deploy.bat --list
echo   deploy.bat product cart order
echo   deploy.bat --all
echo.
echo 注意: 部署后需要在微信开发者工具中右键云函数选择
echo       "创建并部署：云端安装依赖"
echo.
goto :end

:list
echo 📋 可用云函数:
echo.
echo   user              - 用户服务
echo   address           - 地址服务
echo   product           - 商品服务
echo   cart              - 购物车
echo   coupon            - 优惠券
echo   points            - 积分服务
echo   getProducts       - 获取商品列表
echo   getProductDetail  - 商品详情
echo   getHomeData       - 首页数据
echo   checkStock        - 库存检查
echo   checkPayStatus    - 支付状态检查
echo   createOrder       - 创建订单 ⚠️ 关键
echo   order             - 订单管理
echo   pay               - 支付服务 ⚠️ 关键
echo   payCallback       - 支付回调 ⚠️ 关键
echo   admin             - 管理服务 ⚠️ 关键
echo.
goto :end

:deploy_all
echo 🚀 准备部署所有云函数...
echo.
echo 云函数列表:
echo   user, address, product, cart, coupon, points,
echo   getProducts, getProductDetail, getHomeData, checkStock,
echo   checkPayStatus, createOrder, order, pay, payCallback, admin
echo.
echo ⚠️  注意: 将部署关键云函数 (pay, payCallback, createOrder, admin)
echo.
set /p confirm="确认部署吗？ (y/N): "
if /i not "!confirm!"=="y" if /i not "!confirm!"=="yes" (
    echo ❌ 已取消部署
    goto :end
)

echo.
echo 📦 开始部署所有云函数...
echo.
echo 请使用以下 Claude Code 命令完成部署:
echo.
echo claude --dangerously-permission-skip -p "Deploy all cloud functions"
echo.
goto :end

:deploy_specific
echo 📦 准备部署云函数: %*
echo.
echo 请使用以下 Claude Code 命令完成部署:
echo.
echo claude --dangerously-permission-skip -p "Deploy cloud functions: %*"
echo.
goto :end

:end
endlocal
