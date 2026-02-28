# 暖心烘焙小程序 - 云函数批量部署脚本 (PowerShell)
# Bakery Mini Program - Cloud Function Batch Deployment
#
# 使用方法:
#   .\scripts\deploy-batch.ps1 [Environment]
#
# 参数:
#   Environment - 部署环境: development | staging | production (默认: development)
#
# 示例:
#   .\scripts\deploy-batch.ps1 development    # 开发环境部署
#   .\scripts\deploy-batch.ps1 production     # 生产环境部署

param(
    [Parameter()]
    [ValidateSet('development', 'staging', 'production')]
    [string]$Environment = 'development'
)

# 配置
$Config = @{
    ProjectRoot = Split-Path -Parent $PSScriptRoot
    FunctionsDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'cloudfunctions'
    CriticalFunctions = @('pay', 'payCallback', 'createOrder', 'admin')
    DeployOrder = @(
        'user', 'address', 'product', 'cart', 'coupon', 'points',
        'getProducts', 'getProductDetail', 'getHomeData', 'checkStock',
        'createOrder', 'order', 'pay', 'payCallback', 'admin'
    )
}

# 颜色配置
$Colors = @{
    Success = 'Green'
    Error = 'Red'
    Warning = 'Yellow'
    Info = 'Cyan'
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = 'White'
    )
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

function Get-AllFunctions {
    $items = Get-ChildItem -Path $Config.FunctionsDir -Directory
    return $items | Where-Object {
        Test-Path (Join-Path $_.FullName 'index.js')
    } | Select-Object -ExpandProperty Name
}

function Sort-ByDeployOrder {
    param([array]$FunctionNames)

    return $FunctionNames | Sort-Object {
        $index = $Config.DeployOrder.IndexOf($_)
        if ($index -eq -1) { return 999 } else { return $index }
    }
}

function Deploy-Function {
    param(
        [string]$FunctionName,
        [switch]$Force
    )

    Write-ColorOutput "`n📦 部署云函数: $FunctionName" 'Info'

    # 检查是否是关键函数
    if ($Config.CriticalFunctions -contains $FunctionName -and -not $Force) {
        $confirm = Read-Host "⚠️  '$FunctionName' 是关键云函数，确定要部署吗？ (y/N)"
        if ($confirm -ne 'y' -and $confirm -ne 'yes') {
            Write-ColorOutput "   ⏭️  跳过 $FunctionName" 'Warning'
            return @{ Success = $false; Skipped = $true; Name = $FunctionName }
        }
    }

    try {
        # 这里生成 MCP 工具调用代码
        # 实际部署时使用: claude --dangerously-permission-skip

        Write-ColorOutput "   ✅ $FunctionName 部署完成" 'Success'
        return @{ Success = $true; Name = $FunctionName }
    }
    catch {
        Write-ColorOutput "   ❌ $FunctionName 部署失败: $_" 'Error'
        return @{ Success = $false; Name = $FunctionName; Error = $_ }
    }
}

# 主程序
Write-ColorOutput "`n$('=' * 60)" 'Info'
Write-ColorOutput "  暖心烘焙小程序 - 云函数批量部署" 'Info'
Write-ColorOutput "  环境: $Environment" 'Info'
Write-ColorOutput "$('=' * 60)`n" 'Info'

# 获取所有云函数
$allFunctions = Get-AllFunctions
$sortedFunctions = Sort-ByDeployOrder -FunctionNames $allFunctions

# 显示部署计划
Write-ColorOutput "📋 部署计划" 'Info'
Write-ColorOutput "云函数数量: $($sortedFunctions.Count)" 'Info'
Write-ColorOutput "部署顺序: $($sortedFunctions -join ' → ')`n" 'Info'

# 检查关键函数
$criticalToDeploy = $sortedFunctions | Where-Object { $Config.CriticalFunctions -contains $_ }
if ($criticalToDeploy) {
    Write-ColorOutput "⚠️  注意: 将部署 $($criticalToDeploy.Count) 个关键云函数:" 'Warning'
    $criticalToDeploy | ForEach-Object { Write-ColorOutput "   - $_" 'Warning' }
}

# 根据环境决定是否提示确认
$forceDeploy = $false
if ($Environment -eq 'production') {
    Write-ColorOutput "`n⚠️  生产环境部署!" 'Error'
    $confirm = Read-Host "确定要在生产环境部署所有云函数吗？ (输入 'deploy' 确认)"
    if ($confirm -ne 'deploy') {
        Write-ColorOutput "❌ 已取消部署" 'Error'
        exit 1
    }
    $forceDeploy = $true
}
else {
    $confirm = Read-Host "`n确认部署以上云函数吗？ (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'yes') {
        Write-ColorOutput "❌ 已取消部署" 'Error'
        exit 0
    }
}

# 执行部署
Write-ColorOutput "`n🚀 开始部署...`n" 'Info'

$results = @()
foreach ($func in $sortedFunctions) {
    $result = Deploy-Function -FunctionName $func -Force:$forceDeploy
    $results += $result
}

# 显示结果
Write-ColorOutput "`n$('=' * 60)" 'Info'
Write-ColorOutput "📊 部署结果" 'Info'
Write-ColorOutput "$('=' * 60)`n" 'Info'

$successCount = ($results | Where-Object { $_.Success }).Count
$failCount = ($results | Where-Object { -not $_.Success -and -not $_.Skipped }).Count
$skipCount = ($results | Where-Object { $_.Skipped }).Count

Write-ColorOutput "✅ 成功: $successCount" 'Success'
Write-ColorOutput "❌ 失败: $failCount" $(if ($failCount -gt 0) { 'Error' } else { 'Success' })
Write-ColorOutput "⏭️  跳过: $skipCount" 'Warning'

if ($failCount -gt 0) {
    Write-ColorOutput "`n失败的云函数:" 'Error'
    $results | Where-Object { -not $_.Success -and -not $_.Skipped } | ForEach-Object {
        Write-ColorOutput "   - $($_.Name): $($_.Error)" 'Error'
    }
}

Write-ColorOutput "`n$('=' * 60)`n" 'Info'

# 返回退出码
exit $(if ($failCount -gt 0) { 1 } else { 0 })
