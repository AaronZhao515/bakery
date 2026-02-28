/**
 * 图片工具页
 * 功能：批量压缩云存储中的产品图片并替换原图
 */
const app = getApp();

Page({
  data: {
    isCompressing: false,
    progress: 0,
    currentFile: '',
    results: [],
    summary: null,
    totalCount: 0,
    productsToCompress: [],
    isLoading: false,
    // 压缩阈值设置（KB）
    sizeThreshold: 500,
    thresholdOptions: [
      { label: '200 KB', value: 200 },
      { label: '500 KB', value: 500 },
      { label: '1 MB', value: 1000 },
      { label: '2 MB', value: 2000 }
    ],
    // 统计信息
    stats: {
      totalImages: 0,      // 总图片数
      largeImages: 0,      // 大于阈值的图片数
      totalSize: 0,        // 总大小
      estimatedSavings: 0  // 预计可节省空间
    }
  },

  async onLoad() {
    // 检查权限
    const adminInfo = wx.getStorageSync('admin_info');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.redirectTo({ url: '/package-admin/pages/login/login' });
      return;
    }

    // 加载产品列表
    await this.loadProducts();
  },

  // 从数据库加载产品列表并检查文件大小
  async loadProducts() {
    this.setData({ isLoading: true });

    try {
      // 从数据库获取所有产品
      const { result } = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getList',
          page: 1,
          pageSize: 100, // 获取足够多的产品
        },
      });

      if (result.code !== 0 || !result.data || !result.data.list) {
        throw new Error(result.message || '获取产品列表失败');
      }

      const products = result.data.list;

      // 提取所有云存储图片
      const allImages = [];
      const imageSet = new Set(); // 用于去重

      products.forEach((product, index) => {
        // 获取产品图片
        const image = product.image || (product.images && product.images[0]);

        if (image && image.startsWith('cloud://') && !imageSet.has(image)) {
          imageSet.add(image);
          allImages.push({
            fileID: image,
            name: product.name || `产品${index + 1}`,
            docId: product._id,
            collection: 'products',
            field: 'image',
          });
        }

        // 处理多图产品
        if (product.images && Array.isArray(product.images)) {
          product.images.forEach((img, imgIndex) => {
            if (img && img.startsWith('cloud://') && img !== image && !imageSet.has(img)) {
              imageSet.add(img);
              allImages.push({
                fileID: img,
                name: `${product.name || `产品${index + 1}`}-图${imgIndex + 1}`,
                docId: product._id,
                collection: 'products',
                field: 'images',
              });
            }
          });
        }
      });

      // 获取文件大小信息
      const imagesWithSize = await this.checkFileSizes(allImages);

      // 根据阈值筛选需要压缩的图片
      const thresholdBytes = this.data.sizeThreshold * 1024;
      const productsToCompress = imagesWithSize.filter(item => item.size > thresholdBytes);

      // 计算统计信息
      const totalSize = imagesWithSize.reduce((sum, item) => sum + (item.size || 0), 0);
      const largeImagesSize = productsToCompress.reduce((sum, item) => sum + (item.size || 0), 0);
      // 估算可节省空间（假设压缩率为 40%）
      const estimatedSavings = Math.round(largeImagesSize * 0.4);

      this.setData({
        productsToCompress,
        totalCount: productsToCompress.length,
        isLoading: false,
        stats: {
          totalImages: allImages.length,
          largeImages: productsToCompress.length,
          totalSize: this.formatBytes(totalSize),
          estimatedSavings: this.formatBytes(estimatedSavings)
        }
      });

      console.log(`总图片: ${allImages.length}, 需压缩: ${productsToCompress.length} (>${this.data.sizeThreshold}KB)`);

    } catch (err) {
      console.error('加载产品列表失败:', err);
      wx.showToast({
        title: '加载产品列表失败',
        icon: 'none',
      });
      this.setData({ isLoading: false });
    }
  },

  // 检查文件大小（通过云函数批量获取）
  async checkFileSizes(images) {
    if (images.length === 0) return [];

    try {
      // 调用云函数获取文件信息
      const { result } = await wx.cloud.callFunction({
        name: 'image-compress',
        data: {
          action: 'checkFileSizes',
          fileIDs: images.map(img => img.fileID)
        }
      });

      if (result.code === 0 && result.data) {
        // 合并文件大小信息
        return images.map((img, index) => ({
          ...img,
          size: result.data[index]?.size || 0,
          sizeStr: result.data[index]?.sizeStr || '未知'
        }));
      }
    } catch (err) {
      console.error('获取文件大小失败:', err);
    }

    // 如果获取失败，返回原始数据（size 为 0）
    return images.map(img => ({ ...img, size: 0, sizeStr: '未知' }));
  },

  // 切换压缩阈值
  onThresholdChange(e) {
    const index = parseInt(e.detail.value);
    const threshold = this.data.thresholdOptions[index].value;
    this.setData({ sizeThreshold: threshold }, () => {
      this.loadProducts(); // 重新加载
    });
  },

  // 刷新产品列表
  async refreshProducts() {
    if (this.data.isCompressing) {
      wx.showToast({ title: '压缩进行中，请稍后再试', icon: 'none' });
      return;
    }
    await this.loadProducts();
    wx.showToast({ title: '已刷新', icon: 'success' });
  },

  // 格式化字节大小
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // 开始压缩
  async startCompress() {
    if (this.data.isCompressing) return;

    const { productsToCompress } = this.data;

    if (productsToCompress.length === 0) {
      wx.showToast({ title: '没有需要压缩的图片', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认压缩',
      content: `将从数据库中的 ${productsToCompress.length} 个产品提取图片进行压缩，直接替换云存储上的原图。此操作不可撤销。是否继续？`,
      confirmColor: '#8B6347',
      success: (res) => {
        if (res.confirm) {
          this.doCompress();
        }
      }
    });
  },

  // 执行压缩
  async doCompress() {
    const { productsToCompress } = this.data;

    this.setData({
      isCompressing: true,
      progress: 0,
      results: [],
      summary: null,
    });

    const batchSize = 3; // 每批处理3个文件
    const totalBatches = Math.ceil(productsToCompress.length / batchSize);
    const allResults = [];

    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * batchSize;
      const end = Math.min(start + batchSize, productsToCompress.length);
      const batchFiles = productsToCompress.slice(start, end);

      this.setData({
        currentFile: `正在处理第 ${batch + 1}/${totalBatches} 批 (${start + 1}-${end})`,
        progress: Math.round((batch / totalBatches) * 100),
      });

      try {
        const result = await this.compressBatch(batchFiles);
        if (result.code === 0 && result.data) {
          allResults.push(...result.data.results);
        }
      } catch (err) {
        console.error('批量压缩失败:', err);
        batchFiles.forEach(f => {
          allResults.push({
            fileID: f.fileID,
            name: f.name,
            success: false,
            error: err.message
          });
        });
      }

      // 更新进度
      this.setData({
        results: allResults,
        progress: Math.round(((batch + 1) / totalBatches) * 100),
      });
    }

    // 计算汇总
    const successful = allResults.filter(r => r.success && !r.skipped);
    const failed = allResults.filter(r => !r.success);
    const skipped = allResults.filter(r => r.skipped);

    const summary = {
      total: productsToCompress.length,
      success: successful.length,
      failed: failed.length,
      skipped: skipped.length,
      totalSaved: successful.reduce((sum, r) => {
        const saved = this.parseBytes(r.originalSize) - this.parseBytes(r.compressedSize);
        return sum + (saved > 0 ? saved : 0);
      }, 0)
    };

    this.setData({
      isCompressing: false,
      progress: 100,
      currentFile: '压缩完成',
      summary: summary,
      results: allResults,
    });

    wx.showToast({
      title: `完成: ${summary.success}个成功`,
      icon: 'success',
    });

    // 压缩完成后自动刷新列表
    if (summary.success > 0) {
      setTimeout(() => {
        this.loadProducts();
      }, 2000);
    }
  },

  // 批量压缩
  async compressBatch(files) {
    const { result } = await wx.cloud.callFunction({
      name: 'image-compress',
      data: {
        action: 'compressAndReplace',
        files: files.map(f => ({
          fileID: f.fileID,
          collection: f.collection,
          docId: f.docId,
          field: f.field,
          maxWidth: 800,
          maxHeight: 800,
          quality: 80,
        })),
      },
    });

    return result;
  },

  // 解析大小字符串
  parseBytes(sizeStr) {
    if (typeof sizeStr === 'number') return sizeStr;
    if (!sizeStr) return 0;
    const units = { B: 1, KB: 1024, MB: 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB)$/);
    if (match) {
      return parseFloat(match[1]) * units[match[2]];
    }
    return 0;
  },

  // 格式化字节
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
});
