/**
 * 商品卡片组件
 * @module components/product-card
 * @description 展示商品信息的卡片组件，支持多种布局
 * 
 * @property {Object} product - 商品数据
 * @property {string} layout - 布局方式：vertical/horizontal/list
 * @property {boolean} showTag - 是否显示标签
 * @property {boolean} showSold - 是否显示销量
 * @property {boolean} showCart - 是否显示加入购物车按钮
 * @property {boolean} selectable - 是否可选中
 * @property {boolean} selected - 是否已选中
 * 
 * @event tap - 点击卡片时触发
 * @event addCart - 点击加入购物车时触发
 * @event select - 选中状态变化时触发
 */

Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    // 商品数据
    product: {
      type: Object,
      value: {},
      observer(newVal) {
        if (newVal) {
          this.processProductData(newVal);
        }
      }
    },
    // 布局方式
    layout: {
      type: String,
      value: 'vertical' // vertical: 垂直布局 | horizontal: 水平布局 | list: 列表布局
    },
    // 是否显示标签
    showTag: {
      type: Boolean,
      value: true
    },
    // 是否显示销量
    showSold: {
      type: Boolean,
      value: true
    },
    // 是否显示加入购物车按钮
    showCart: {
      type: Boolean,
      value: true
    },
    // 是否可选中
    selectable: {
      type: Boolean,
      value: false
    },
    // 是否已选中
    selected: {
      type: Boolean,
      value: false
    },
    // 是否显示原价
    showOriginalPrice: {
      type: Boolean,
      value: true
    },
    // 图片模式
    imageMode: {
      type: String,
      value: 'aspectFill' // aspectFill | aspectFit | widthFix
    },
    // 自定义样式
    customStyle: {
      type: String,
      value: ''
    }
  },

  data: {
    // 处理后的商品数据
    processedProduct: {},
    // 是否显示骨架屏
    showSkeleton: false
  },

  lifetimes: {
    attached() {
      if (this.properties.product) {
        this.processProductData(this.properties.product);
      }
    }
  },

  methods: {
    /**
     * 处理商品数据
     * @param {Object} product - 原始商品数据
     */
    processProductData(product) {
      const processed = {
        ...product,
        // 格式化价格
        priceText: this.formatPrice(product.price),
        originalPriceText: product.originalPrice ? this.formatPrice(product.originalPrice) : '',
        // 计算折扣
        discount: product.originalPrice 
          ? Math.round((product.price / product.originalPrice) * 10) 
          : null,
        // 格式化销量
        soldText: this.formatSold(product.soldCount || 0),
        // 标签列表
        tags: product.tags || [],
        // 是否售罄
        isSoldOut: product.stock <= 0,
        // 是否新品
        isNew: this.checkIsNew(product.createTime),
        // 图片URL
        imageUrl: product.coverImage || product.mainImage || 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/product-default.png'
      };

      this.setData({ processedProduct: processed });
    },

    /**
     * 格式化价格
     * @param {number} price - 价格
     * @returns {string} 格式化后的价格
     */
    formatPrice(price) {
      if (!price && price !== 0) return '¥0.00';
      return `¥${parseFloat(price).toFixed(2)}`;
    },

    /**
     * 格式化销量
     * @param {number} count - 销量
     * @returns {string} 格式化后的销量
     */
    formatSold(count) {
      if (count >= 10000) {
        return `已售${(count / 10000).toFixed(1)}万`;
      }
      return `已售${count}`;
    },

    /**
     * 检查是否新品（7天内）
     * @param {string|Date} createTime - 创建时间
     * @returns {boolean} 是否新品
     */
    checkIsNew(createTime) {
      if (!createTime) return false;
      const create = new Date(createTime);
      const now = new Date();
      const diffDays = (now - create) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    },

    /**
     * 点击卡片
     */
    onCardTap() {
      const { processedProduct } = this.data;
      
      // 触发自定义事件
      this.triggerEvent('tap', {
        product: processedProduct,
        id: processedProduct._id || processedProduct.id
      });

      // 如果不可选，跳转到商品详情
      if (!this.properties.selectable) {
        wx.navigateTo({
          url: `/package-product/pages/product-detail/product-detail?id=${processedProduct._id || processedProduct.id}`
        });
      }
    },

    /**
     * 点击加入购物车
     */
    onAddCartTap(e) {
      // 阻止冒泡
      e.stopPropagation();

      const { processedProduct } = this.data;
      
      // 检查是否售罄
      if (processedProduct.isSoldOut) {
        wx.showToast({
          title: '商品已售罄',
          icon: 'none'
        });
        return;
      }

      // 触发加入购物车事件
      this.triggerEvent('addCart', {
        product: processedProduct,
        id: processedProduct._id || processedProduct.id
      });

      // 添加动画效果
      this.animate('.cart-btn', [
        { scale: [1, 1] },
        { scale: [0.8, 0.8] },
        { scale: [1.1, 1.1] },
        { scale: [1, 1] }
      ], 300);
    },

    /**
     * 选中状态变化
     */
    onSelectChange(e) {
      const selected = e.detail.value;
      
      this.triggerEvent('select', {
        selected,
        product: this.data.processedProduct,
        id: this.data.processedProduct._id || this.data.processedProduct.id
      });
    },

    /**
     * 图片加载完成
     */
    onImageLoad() {
      this.setData({ showSkeleton: false });
    },

    /**
     * 图片加载错误
     */
    onImageError() {
      this.setData({
        'processedProduct.imageUrl': 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/images/product-default.png'
      });
    }
  }
});
