# 图片压缩云函数

## 功能
批量压缩 CloudBase 云存储中的产品图片，并直接替换原图。

## 特点
- ✅ 压缩后直接替换原图（覆盖）
- ✅ 自动跳过压缩后更大的文件
- ✅ 更新数据库中引用的图片ID
- ✅ 支持批量处理
- ✅ 动态从数据库获取产品图片列表
- ✅ 使用纯 JavaScript 的 Jimp 库（无需原生依赖）

## 部署步骤

1. 安装依赖（可选，云端安装依赖会自动完成）
```bash
cd cloudfunctions/image-compress
npm install
```

2. 部署云函数
在微信开发者工具中：
- 右键点击 `cloudfunctions/image-compress` 文件夹
- 选择 "创建并部署：云端安装依赖"

或者使用命令行：
```bash
# 使用 CloudBase CLI
tcb fn deploy image-compress
```

## 使用方法

### 在管理后台使用

1. 打开小程序 → 进入后台管理 → 点击"图片工具"
2. 页面会自动从数据库加载所有产品图片
3. 点击"开始压缩并替换"按钮
4. 确认操作后，系统将自动压缩并替换图片

### 云函数接口

**Action**: `compressAndReplace`

**参数**:
```javascript
{
  action: 'compressAndReplace',
  files: [{
    fileID: 'cloud://xxx/products/image.jpg',  // 云存储文件ID
    collection: 'products',                     // 数据库集合名（可选）
    docId: 'xxx',                              // 文档ID（可选）
    field: 'image',                            // 字段名（可选）
    maxWidth: 800,                             // 最大宽度（默认800）
    maxHeight: 800,                            // 最大高度（默认800）
    quality: 80                                // JPEG质量（默认80）
  }]
}
```

**返回**:
```javascript
{
  code: 0,
  message: '压缩完成',
  data: {
    results: [{
      originalFileID: 'cloud://...',
      newFileID: 'cloud://...',
      originalSize: '1.7 MB',
      compressedSize: '320 KB',
      compressionRatio: '81.2%',
      cloudPath: 'products/image.jpg',
      success: true
    }],
    summary: {
      total: 12,
      success: 10,
      failed: 0,
      skipped: 2,
      totalOriginalSize: '20.5 MB',
      totalCompressedSize: '4.8 MB',
      totalSaved: '15.7 MB',
      savedPercent: '76.59'
    }
  }
}
```

## 压缩参数

- **最大尺寸**: 800x800 像素
- **JPEG 质量**: 80%
- **PNG 压缩**: 使用 Jimp 自动优化

## 技术实现

- 使用 [Jimp](https://github.com/jimp-dev/jimp) 纯 JavaScript 图像处理库
- 无需原生依赖，兼容所有云函数运行环境
- 支持动态从 `products` 集合获取产品图片
- 自动处理单图和多图产品（images 数组）

## 注意事项

⚠️ **警告**: 此操作会直接替换云存储上的原图，不可撤销！

- 压缩后文件如果比原图更大，会自动跳过
- 数据库中的图片引用会自动更新
- 建议先备份重要图片
- 大尺寸图片（超过800x800）会被等比例缩放到800x800以内
