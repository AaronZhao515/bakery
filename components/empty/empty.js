/**
 * 空状态组件
 * @module components/empty
 * @description 页面无数据时显示的空状态组件
 *
 * @property {string} type - 空状态类型：default/search/order/cart/network/error
 * @property {string} image - 自定义图片URL
 * @property {string} title - 标题文字
 * @property {string} description - 描述文字
 * @property {string} buttonText - 按钮文字
 * @property {boolean} showButton - 是否显示按钮
 *
 * @event buttonTap - 点击按钮时触发
 */

const icons = require('../../utils/icons.js');

Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    // 空状态类型
    type: {
      type: String,
      value: 'default'
    },
    // 自定义图片URL
    image: {
      type: String,
      value: ''
    },
    // 标题文字
    title: {
      type: String,
      value: ''
    },
    // 描述文字
    description: {
      type: String,
      value: ''
    },
    // 按钮文字
    buttonText: {
      type: String,
      value: ''
    },
    // 是否显示按钮
    showButton: {
      type: Boolean,
      value: true
    },
    // 按钮类型
    buttonType: {
      type: String,
      value: 'primary' // primary | outline | ghost
    },
    // 自定义样式
    customStyle: {
      type: String,
      value: ''
    }
  },

  data: {
    // 默认图标
    defaultIcon: icons.packageEmpty,

    // 预设的空状态配置
    presets: {
      default: {
        image: '/images/empty-default.png',
        title: '暂无数据',
        description: '这里什么都没有哦~',
        buttonText: '刷新试试'
      },
      search: {
        image: '/images/empty-search.png',
        title: '没有找到相关商品',
        description: '换个关键词试试看吧',
        buttonText: '重新搜索'
      },
      order: {
        image: '/images/empty-order.png',
        title: '暂无订单',
        description: '快去选购心仪的商品吧',
        buttonText: '去逛逛'
      },
      cart: {
        image: '/images/empty-cart.png',
        title: '购物车是空的',
        description: '把喜欢的商品加入购物车吧',
        buttonText: '去选购'
      },
      network: {
        image: '/images/empty-network.png',
        title: '网络连接失败',
        description: '请检查网络设置后重试',
        buttonText: '重新加载'
      },
      error: {
        image: '/images/empty-error.png',
        title: '出错了',
        description: '系统繁忙，请稍后重试',
        buttonText: '刷新页面'
      },
      favorite: {
        image: '/images/empty-favorite.png',
        title: '暂无收藏',
        description: '把喜欢的商品收藏起来吧',
        buttonText: '去逛逛'
      },
      coupon: {
        image: '/images/empty-coupon.png',
        title: '暂无优惠券',
        description: '关注店铺活动，领取优惠券',
        buttonText: '去领券'
      },
      address: {
        image: '/images/empty-address.png',
        title: '暂无收货地址',
        description: '添加收货地址，方便配送',
        buttonText: '添加地址'
      },
      message: {
        image: '/images/empty-message.png',
        title: '暂无消息',
        description: '还没有收到任何消息',
        buttonText: ''
      }
    }
  },

  lifetimes: {
    attached() {
      this.updateContent();
    }
  },

  observers: {
    'type, image, title, description, buttonText': function() {
      this.updateContent();
    }
  },

  methods: {
    /**
     * 更新显示内容
     */
    updateContent() {
      const { type, presets } = this.data;
      const preset = presets[type] || presets.default;
      
      // 优先使用自定义值，否则使用预设值
      const content = {
        image: this.properties.image || preset.image,
        title: this.properties.title || preset.title,
        description: this.properties.description || preset.description,
        buttonText: this.properties.buttonText !== '' ? this.properties.buttonText : preset.buttonText
      };

      this.setData({ content });
    },

    /**
     * 点击按钮
     */
    onButtonTap() {
      this.triggerEvent('buttonTap', {
        type: this.properties.type
      });
    }
  }
});
