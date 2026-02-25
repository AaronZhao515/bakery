/**
 * 轻提示组件
 * @module components/toast
 * @description 轻量级提示组件，支持成功、失败、加载等多种类型
 * 
 * @property {boolean} visible - 是否显示
 * @property {string} title - 提示文字
 * @property {string} icon - 图标类型：success/error/loading/none
 * @property {string} image - 自定义图片URL
 * @property {number} duration - 显示时长（毫秒）
 * @property {boolean} mask - 是否显示遮罩
 * @property {string} position - 位置：top/middle/bottom
 * 
 * @event close - 提示关闭时触发
 */

Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: false,
      observer(newVal) {
        if (newVal) {
          this.show();
        } else {
          this.hide();
        }
      }
    },
    // 提示文字
    title: {
      type: String,
      value: ''
    },
    // 图标类型
    icon: {
      type: String,
      value: 'none' // success | error | loading | none
    },
    // 自定义图片URL
    image: {
      type: String,
      value: ''
    },
    // 显示时长
    duration: {
      type: Number,
      value: 2000
    },
    // 是否显示遮罩
    mask: {
      type: Boolean,
      value: false
    },
    // 位置
    position: {
      type: String,
      value: 'middle' // top | middle | bottom
    },
    // 自定义样式
    customStyle: {
      type: String,
      value: ''
    }
  },

  data: {
    // 是否正在显示
    isShowing: false,
    // 动画数据
    animationData: {},
    // 定时器
    timer: null
  },

  lifetimes: {
    detached() {
      // 清理定时器
      this.clearTimer();
    }
  },

  methods: {
    /**
     * 显示提示
     */
    show() {
      // 清理之前的定时器
      this.clearTimer();

      this.setData({ isShowing: true });

      // 创建动画
      const animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-out'
      });

      animation.opacity(1).scale(1).step();
      this.setData({ animationData: animation.export() });

      // 非loading类型，自动关闭
      if (this.properties.icon !== 'loading' && this.properties.duration > 0) {
        const timer = setTimeout(() => {
          this.close();
        }, this.properties.duration);
        
        this.setData({ timer });
      }

      // 触发显示事件
      this.triggerEvent('show');
    },

    /**
     * 隐藏提示
     */
    hide() {
      const animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-in'
      });

      animation.opacity(0).scale(0.9).step();
      this.setData({ animationData: animation.export() });

      // 延迟后隐藏
      setTimeout(() => {
        this.setData({ isShowing: false });
        this.triggerEvent('close');
      }, 200);
    },

    /**
     * 关闭提示
     */
    close() {
      this.setData({
        visible: false
      });
    },

    /**
     * 清理定时器
     */
    clearTimer() {
      if (this.data.timer) {
        clearTimeout(this.data.timer);
        this.setData({ timer: null });
      }
    },

    /**
     * 显示成功提示
     * @param {string} title - 提示文字
     * @param {Object} options - 其他配置
     */
    success(title, options = {}) {
      this.setData({
        visible: true,
        title: title || '操作成功',
        icon: 'success',
        ...options
      });
    },

    /**
     * 显示错误提示
     * @param {string} title - 提示文字
     * @param {Object} options - 其他配置
     */
    error(title, options = {}) {
      this.setData({
        visible: true,
        title: title || '操作失败',
        icon: 'error',
        ...options
      });
    },

    /**
     * 显示加载提示
     * @param {string} title - 提示文字
     * @param {Object} options - 其他配置
     */
    loading(title, options = {}) {
      this.setData({
        visible: true,
        title: title || '加载中...',
        icon: 'loading',
        duration: 0,
        ...options
      });
    },

    /**
     * 显示普通提示
     * @param {string} title - 提示文字
     * @param {Object} options - 其他配置
     */
    info(title, options = {}) {
      this.setData({
        visible: true,
        title: title || '',
        icon: 'none',
        ...options
      });
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {
      // 阻止事件冒泡
    }
  }
});
