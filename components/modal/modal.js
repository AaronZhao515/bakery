/**
 * 弹窗组件
 * @module components/modal
 * @description 自定义弹窗组件，支持确认/取消、自定义内容等
 * 
 * @property {boolean} visible - 是否显示
 * @property {string} title - 标题
 * @property {string} content - 内容
 * @property {boolean} showCancel - 是否显示取消按钮
 * @property {string} cancelText - 取消按钮文字
 * @property {string} confirmText - 确认按钮文字
 * @property {string} confirmColor - 确认按钮颜色
 * @property {boolean} closeOnClickOverlay - 点击遮罩是否关闭
 * @property {boolean} showClose - 是否显示关闭图标
 * 
 * @event confirm - 点击确认按钮时触发
 * @event cancel - 点击取消按钮时触发
 * @event close - 弹窗关闭时触发
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
          this.onShow();
        } else {
          this.onHide();
        }
      }
    },
    // 标题
    title: {
      type: String,
      value: '提示'
    },
    // 内容
    content: {
      type: String,
      value: ''
    },
    // 是否显示取消按钮
    showCancel: {
      type: Boolean,
      value: true
    },
    // 取消按钮文字
    cancelText: {
      type: String,
      value: '取消'
    },
    // 确认按钮文字
    confirmText: {
      type: String,
      value: '确定'
    },
    // 确认按钮颜色
    confirmColor: {
      type: String,
      value: '#D4A574'
    },
    // 取消按钮颜色
    cancelColor: {
      type: String,
      value: '#9E9E9E'
    },
    // 点击遮罩是否关闭
    closeOnClickOverlay: {
      type: Boolean,
      value: true
    },
    // 是否显示关闭图标
    showClose: {
      type: Boolean,
      value: false
    },
    // 是否显示标题
    showTitle: {
      type: Boolean,
      value: true
    },
    // 按钮排列方式
    buttonLayout: {
      type: String,
      value: 'horizontal' // horizontal | vertical
    },
    // 自定义样式
    customStyle: {
      type: String,
      value: ''
    },
    // 内容区域样式
    contentStyle: {
      type: String,
      value: ''
    },
    // 是否使用异步关闭
    asyncClose: {
      type: Boolean,
      value: false
    }
  },

  data: {
    // 动画数据
    animationData: {},
    // 遮罩动画数据
    maskAnimationData: {},
    // 是否正在显示
    isShowing: false
  },

  methods: {
    /**
     * 显示弹窗
     */
    onShow() {
      this.setData({ isShowing: true });
      
      // 创建动画
      const animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-out'
      });

      const maskAnimation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-out'
      });

      // 遮罩淡入
      maskAnimation.opacity(1).step();
      
      // 内容弹入
      animation.scale(1).opacity(1).step();

      this.setData({
        animationData: animation.export(),
        maskAnimationData: maskAnimation.export()
      });

      // 触发显示事件
      this.triggerEvent('show');
    },

    /**
     * 隐藏弹窗
     */
    onHide() {
      // 创建动画
      const animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-in'
      });

      const maskAnimation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-in'
      });

      // 遮罩淡出
      maskAnimation.opacity(0).step();
      
      // 内容弹出
      animation.scale(0.9).opacity(0).step();

      this.setData({
        animationData: animation.export(),
        maskAnimationData: maskAnimation.export()
      });

      // 延迟后隐藏
      setTimeout(() => {
        this.setData({ isShowing: false });
        this.triggerEvent('close');
      }, 200);
    },

    /**
     * 点击遮罩
     */
    onMaskTap() {
      if (this.properties.closeOnClickOverlay) {
        this.close();
      }
    },

    /**
     * 点击关闭图标
     */
    onCloseTap() {
      this.close();
    },

    /**
     * 点击取消按钮
     */
    onCancelTap() {
      if (this.properties.asyncClose) {
        this.triggerEvent('cancel', {
          close: () => this.close()
        });
      } else {
        this.triggerEvent('cancel');
        this.close();
      }
    },

    /**
     * 点击确认按钮
     */
    onConfirmTap() {
      if (this.properties.asyncClose) {
        this.triggerEvent('confirm', {
          close: () => this.close()
        });
      } else {
        this.triggerEvent('confirm');
        this.close();
      }
    },

    /**
     * 关闭弹窗
     */
    close() {
      this.setData({
        visible: false
      });
    },

    /**
     * 显示弹窗（方法调用）
     */
    show() {
      this.setData({
        visible: true
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
