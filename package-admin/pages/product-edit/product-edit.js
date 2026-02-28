/**
 * 商品编辑页
 * 功能：商品信息编辑、图片上传、价格设置、库存设置、规格设置
 */
const app = getApp();

Page({
  data: {
    isEdit: false,
    isSaving: false,
    productId: '',
    categories: [],
    categoryIndex: 0,
    showCategoryPicker: false,
    product: {
      name: '',
      categoryId: '',
      categoryName: '',
      description: '',
      price: '',
      originalPrice: '',
      stock: '',
      warningStock: '10',
      images: [],
      hasSpecs: false,
      specs: [],
      status: 'on'
    }
  },

  async onLoad(options) {
    // 先加载分类，确保分类数据准备好
    await this.loadCategories();

    if (options.id) {
      // 编辑模式
      this.setData({
        isEdit: true,
        productId: options.id
      });
      this.loadProductDetail(options.id);
    }
  },

  onShow() {
    // 检查管理员权限
    const adminInfo = wx.getStorageSync('admin_info');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.redirectTo({
        url: '/package-admin/pages/login/login'
      });
      return;
    }
  },

  // 加载商品分类
  async loadCategories() {
    console.log('loadCategories called');
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'categoryManage',
          operation: 'list',
          status: 1
        }
      });
      console.log('loadCategories result:', result);

      if (result.result.code === 0) {
        const categories = result.result.data.list.map(cat => ({
          id: cat._id,
          name: cat.name
        }));
        console.log('categories loaded:', categories);
        // 确保数据设置完成
        await new Promise((resolve) => {
          this.setData({ categories }, resolve);
        });
      } else {
        console.log('loadCategories failed, using defaults');
        // 使用默认分类
        this.setDefaultCategories();
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      this.setDefaultCategories();
    }
  },

  // 设置默认分类
  async setDefaultCategories() {
    const defaultCategories = [
      { id: 'bread', name: '面包' },
      { id: 'cake', name: '蛋糕' },
      { id: 'pastry', name: '点心' },
      { id: 'drink', name: '饮品' }
    ];
    console.log('Setting default categories:', defaultCategories);
    return new Promise((resolve) => {
      this.setData({ categories: defaultCategories }, resolve);
    });
  },

  // 加载商品详情
  async loadProductDetail(id) {
    wx.showLoading({ title: '加载中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'productCRUD',
          operation: 'get',
          productId: id
        }
      });

      if (result.result.code === 0) {
        const product = result.result.data;
        console.log('加载商品详情:', product);
        console.log('当前分类列表:', this.data.categories);

        // 找到分类索引
        const categoryIndex = this.data.categories.findIndex(
          c => c.id === product.categoryId
        );
        console.log('分类索引:', categoryIndex, '分类ID:', product.categoryId);

        // 如果有分类ID但找不到对应分类名称，使用商品自带的categoryName
        let categoryName = product.categoryName;
        if (product.categoryId && categoryIndex >= 0) {
          categoryName = this.data.categories[categoryIndex].name;
        }

        this.setData({
          product: {
            ...this.data.product,
            ...product,
            // 确保表单字段为字符串类型
            price: product.price != null ? String(product.price) : '',
            originalPrice: product.originalPrice != null ? String(product.originalPrice) : '',
            stock: product.stock != null ? String(product.stock) : '',
            warningStock: product.warningStock != null ? String(product.warningStock) : '10',
            categoryName: categoryName || '',
            hasSpecs: product.specs && product.specs.length > 0,
            specs: product.specs || [],
            status: product.status === 1 ? 'on' : 'off',
            // 确保 images 是数组
            images: Array.isArray(product.images) ? product.images : []
          },
          categoryIndex: categoryIndex >= 0 ? categoryIndex : 0
        });
      }
    } catch (error) {
      console.error('加载商品详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 选择图片
  async chooseImage() {
    try {
      const res = await wx.chooseMedia({
        count: 9 - this.data.product.images.length,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      });

      wx.showLoading({ title: '压缩上传中...' });

      // 压缩并上传图片
      const uploadTasks = res.tempFiles.map(async (file) => {
        try {
          // 压缩图片
          const compressedRes = await wx.compressImage({
            src: file.tempFilePath,
            quality: 75, // 压缩质量 0-100，75平衡画质和体积
            compressedWidth: 1080 // 压缩后的最大宽度，高度自动等比缩放
          });

          const compressedPath = compressedRes.tempFilePath;
          console.log('图片压缩成功:', file.tempFilePath, '->', compressedPath);

          // 上传压缩后的图片到云存储
          const ext = compressedPath.split('.').pop() || 'jpg';
          const cloudPath = `products/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

          const uploadRes = await wx.cloud.uploadFile({
            cloudPath,
            filePath: compressedPath
          });

          return uploadRes.fileID;
        } catch (compressError) {
          console.error('图片压缩失败，使用原图上传:', compressError);
          // 压缩失败时使用原图上传
          const ext = file.tempFilePath.split('.').pop() || 'jpg';
          const cloudPath = `products/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

          const uploadRes = await wx.cloud.uploadFile({
            cloudPath,
            filePath: file.tempFilePath
          });

          return uploadRes.fileID;
        }
      });

      const newImages = await Promise.all(uploadTasks);

      this.setData({
        'product.images': [...this.data.product.images, ...newImages]
      });

      wx.hideLoading();
      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (error) {
      console.error('上传图片失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.product.images
    });
  },

  // 删除图片
  async deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    console.log('[删除图片] 点击删除，index:', index);
    console.log('[删除图片] 当前图片数组:', this.data.product.images);

    const deletedImage = this.data.product.images[index];
    console.log('[删除图片] 要删除的图片:', deletedImage);

    // 从数组中移除
    const images = this.data.product.images.filter((_, i) => i !== index);
    this.setData({
      'product.images': images
    });

    // 如果是编辑模式，立即从云存储删除文件
    if (this.data.isEdit && deletedImage) {
      console.log('[删除图片] 准备从云存储删除:', deletedImage);
      try {
        await this.deleteCloudImage(deletedImage);
        console.log('[删除图片] 已从云存储删除:', deletedImage);
      } catch (error) {
        console.error('[删除图片] 删除云存储文件失败:', error);
        // 失败不影响用户体验，记录日志即可
      }
    } else {
      console.log('[删除图片] 跳过云存储删除:', { isEdit: this.data.isEdit, deletedImage });
    }
  },

  // 从云存储删除图片
  async deleteCloudImage(fileID) {
    console.log('[删除图片] deleteCloudImage 接收到的 fileID:', fileID, '类型:', typeof fileID);

    if (!fileID || typeof fileID !== 'string') {
      console.log('[删除图片] fileID 为空或不是字符串:', fileID);
      return;
    }

    if (!fileID.startsWith('cloud://')) {
      console.log('[删除图片] 不是有效的云存储 fileID:', fileID);
      return;
    }

    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'deleteCloudFile',
        fileID: fileID
      }
    });

    console.log('[删除图片] 云函数返回结果:', result);

    if (result.result.code !== 0) {
      throw new Error(result.result.message || '删除失败');
    }
  },

  // 名称输入
  onNameInput(e) {
    this.setData({
      'product.name': e.detail.value
    });
  },

  // 分类选择
  onCategoryChange(e) {
    const index = e.detail.value;
    const category = this.data.categories[index];
    this.setData({
      'product.categoryId': category.id,
      'product.categoryName': category.name,
      categoryIndex: index
    });
  },

  // 描述输入
  onDescInput(e) {
    this.setData({
      'product.description': e.detail.value
    });
  },

  // 现价输入
  onPriceInput(e) {
    this.setData({
      'product.price': e.detail.value
    });
  },

  // 原价输入
  onOriginalPriceInput(e) {
    this.setData({
      'product.originalPrice': e.detail.value
    });
  },

  // 库存输入
  onStockInput(e) {
    this.setData({
      'product.stock': e.detail.value
    });
  },

  // 预警库存输入
  onWarningStockInput(e) {
    this.setData({
      'product.warningStock': e.detail.value
    });
  },

  // 切换规格开关
  toggleSpecs(e) {
    this.setData({
      'product.hasSpecs': e.detail.value
    });
  },

  // 添加规格
  addSpec() {
    const specs = this.data.product.specs || [];
    specs.push({
      name: '',
      values: []
    });
    this.setData({
      'product.specs': specs
    });
  },

  // 删除规格
  deleteSpec(e) {
    const index = e.currentTarget.dataset.index;
    const specs = this.data.product.specs.filter((_, i) => i !== index);
    this.setData({
      'product.specs': specs
    });
  },

  // 规格名称输入
  onSpecNameInput(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      [`product.specs[${index}].name`]: e.detail.value
    });
  },

  // 添加规格值
  addSpecValue(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value.trim();
    
    if (!value) return;

    const specs = this.data.product.specs;
    if (!specs[index].values.includes(value)) {
      specs[index].values.push(value);
      this.setData({
        'product.specs': specs
      });
    }
  },

  // 删除规格值
  removeSpecValue(e) {
    const { sindex, vindex } = e.currentTarget.dataset;
    const specs = this.data.product.specs;
    specs[sindex].values.splice(vindex, 1);
    this.setData({
      'product.specs': specs
    });
  },

  // 切换上架状态
  toggleStatus(e) {
    this.setData({
      'product.status': e.detail.value ? 'on' : 'off'
    });
  },

  // 显示分类选择弹窗
  showCategoryPicker() {
    console.log('showCategoryPicker called, categories:', this.data.categories);
    this.setData({
      showCategoryPicker: true
    }, () => {
      console.log('showCategoryPicker set to true');
    });
  },

  // 隐藏分类选择弹窗
  hideCategoryPicker() {
    console.log('hideCategoryPicker called');
    this.setData({
      showCategoryPicker: false
    });
  },

  // 选择分类
  selectCategory(e) {
    const index = e.currentTarget.dataset.index;
    const category = this.data.categories[index];
    console.log('selectCategory called, index:', index, 'category:', category);
    if (!category) return;
    this.setData({
      'product.categoryId': category.id,
      'product.categoryName': category.name,
      showCategoryPicker: false
    });
  },

  // 阻止事件冒泡（用于弹窗内部）
  onModalTap(e) {
    // 阻止事件冒泡，防止点击弹窗内容时关闭弹窗
    console.log('onModalTap - stop propagation');
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 表单验证
  validateForm() {
    const { product } = this.data;
    
    if (product.images.length === 0) {
      wx.showToast({ title: '请上传至少一张商品图片', icon: 'none' });
      return false;
    }

    if (!product.name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return false;
    }

    // 分类改为可选，不再强制要求
    // if (!product.categoryId) {
    //   wx.showToast({ title: '请选择商品分类', icon: 'none' });
    //   return false;
    // }

    if (!product.price || parseFloat(product.price) <= 0) {
      wx.showToast({ title: '请输入正确的价格', icon: 'none' });
      return false;
    }

    if (!product.stock || parseInt(product.stock) < 0) {
      wx.showToast({ title: '请输入正确的库存数量', icon: 'none' });
      return false;
    }

    return true;
  },

  // 保存商品
  async saveProduct() {
    if (!this.validateForm()) return;

    this.setData({ isSaving: true });

    try {
      const { isEdit, productId, product } = this.data;
      
      // 构建保存数据
      const saveData = {
        name: product.name.trim(),
        description: product.description.trim(),
        price: parseFloat(product.price),
        originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : 0,
        stock: parseInt(product.stock),
        warningStock: parseInt(product.warningStock) || 10,
        images: product.images,
        specs: product.hasSpecs ? product.specs.filter(s => s.name && s.values.length > 0) : [],
        status: product.status === 'on' ? 1 : 0
      };

      // 只有在选择了分类时才保存分类信息
      if (product.categoryId) {
        saveData.categoryId = product.categoryId;
        saveData.categoryName = product.categoryName;
      }

      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'productCRUD',
          operation: isEdit ? 'update' : 'create',
          productId: isEdit ? productId : undefined,
          productData: saveData
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: isEdit ? '保存成功' : '发布成功',
          icon: 'success'
        });

        // 设置全局刷新标记，确保各页面商品数据会刷新
        wx.setStorageSync('product_list_need_refresh', true);
        wx.setStorageSync('home_products_need_refresh', true);
        wx.setStorageSync('reserve_products_need_refresh', true);

        // 通知列表页刷新（兼容原有逻辑）
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && prevPage.route && prevPage.route.includes('product-list')) {
          prevPage.setData({ needRefresh: true });
        }

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: result.result.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('保存商品失败:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSaving: false });
    }
  }
});
