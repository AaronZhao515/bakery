/**
 * 加载动画组件
 * @module components/loading
 * @description 提供多种加载动画效果
 * 
 * @property {string} type - 加载类型：spinner/circle/dots/pulse
 * @property {string} size - 尺寸：small/medium/large
 * @property {string} color - 颜色
 * @property {string} text - 提示文字
 * @property {boolean} fullScreen - 是否全屏显示
 * @property {boolean} mask - 是否显示遮罩
 * @property {boolean} visible - 是否显示
 */

Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    // 加载类型
    type: {
      type: String,
      value: 'spinner' // spinner | circle | dots | pulse | bread
    },
    // 尺寸
    size: {
      type: String,
      value: 'medium' // small | medium | large
    },
    // 颜色
    color: {
      type: String,
      value: '#D4A574'
    },
    // 提示文字
    text: {
      type: String,
      value: '加载中...'
    },
    // 是否全屏显示
    fullScreen: {
      type: Boolean,
      value: false
    },
    // 是否显示遮罩
    mask: {
      type: Boolean,
      value: true
    },
    // 是否显示
    visible: {
      type: Boolean,
      value: true
    },
    // 自定义样式
    customStyle: {
      type: String,
      value: ''
    }
  },

  data: {
    // 动画状态
    animationData: {}
  },

  lifetimes: {
    attached() {
      this.initAnimation();
    }
  },

  methods: {
    /**
     * 初始化动画
     */
    initAnimation() {
      if (this.properties.type === 'dots') {
        this.createDotsAnimation();
      }
    },

    /**
     * 创建圆点动画
     */
    createDotsAnimation() {
      const animation = wx.createAnimation({
        duration: 600,
        timingFunction: 'ease-in-out'
      });

      let step = 0;
      const animate = () => {
        step = (step + 1) % 3;
        
        if (step === 0) {
          animation.scale(1, 1).step();
          animation.scale(1.5, 1.5).step();
        } else if (step === 1) {
          animation.scale(1, 1).step();
        } else {
          animation.scale(0.8, 0.8).step();
        }

        this.setData({
          animationData: animation.export()
        });

        setTimeout(animate, 600);
      };

      animate();
    },

    /**
     * 显示加载
     */
    show(text = '') {
      this.setData({
        visible: true,
        text: text || this.properties.text
      });
    },

    /**
     * 隐藏加载
     */
    hide() {
      this.setData({
        visible: false
      });
    },

    /**
     * 切换显示状态
     */
    toggle() {
      this.setData({
        visible: !this.properties.visible
      });
    }
  }
});
