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

  onLoad(options) {
    this.loadCategories();
    
    if (options.id) {
      // 编辑模式
      this.setData({
        isEdit: true,
        productId: options.id
      });
      this.loadProductDetail(options.id);
    }
  },

  // 加载商品分类
  async loadCategories() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getCategories'
        }
      });

      if (result.result.code === 0) {
        this.setData({
          categories: result.result.data
        });
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      this.setData({
        categories: [
          { id: 'bread', name: '面包' },
          { id: 'cake', name: '蛋糕' },
          { id: 'pastry', name: '点心' },
          { id: 'drink', name: '饮品' }
        ]
      });
    }
  },

  // 加载商品详情
  async loadProductDetail(id) {
    wx.showLoading({ title: '加载中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getProductDetail',
          id
        }
      });

      if (result.result.code === 0) {
        const product = result.result.data;
        // 找到分类索引
        const categoryIndex = this.data.categories.findIndex(
          c => c.id === product.categoryId
        );

        this.setData({
          product: {
            ...this.data.product,
            ...product,
            hasSpecs: product.specs && product.specs.length > 0,
            specs: product.specs || []
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

      wx.showLoading({ title: '上传中' });

      // 上传图片到云存储
      const uploadTasks = res.tempFiles.map(file => {
        const cloudPath = `products/${Date.now()}_${Math.random().toString(36).substr(2)}.${file.tempFilePath.split('.').pop()}`;
        return wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath
        });
      });

      const uploadResults = await Promise.all(uploadTasks);
      const newImages = uploadResults.map(result => result.fileID);

      this.setData({
        'product.images': [...this.data.product.images, ...newImages]
      });

      wx.hideLoading();
    } catch (error) {
      console.error('上传图片失败:', error);
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
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.product.images.filter((_, i) => i !== index);
    this.setData({
      'product.images': images
    });
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

    if (!product.categoryId) {
      wx.showToast({ title: '请选择商品分类', icon: 'none' });
      return false;
    }

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
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        description: product.description.trim(),
        price: parseFloat(product.price),
        originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : 0,
        stock: parseInt(product.stock),
        warningStock: parseInt(product.warningStock) || 10,
        images: product.images,
        specs: product.hasSpecs ? product.specs.filter(s => s.name && s.values.length > 0) : [],
        status: product.status
      };

      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: isEdit ? 'updateProduct' : 'createProduct',
          id: isEdit ? productId : undefined,
          data: saveData
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: isEdit ? '保存成功' : '发布成功',
          icon: 'success'
        });

        // 通知列表页刷新
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage) {
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
