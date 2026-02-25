/**
 * 自定义导航栏组件
 * @module components/nav-bar
 * @description 自定义导航栏，支持返回按钮、标题、右侧操作等
 * 
 * @property {string} title - 导航栏标题
 * @property {boolean} showBack - 是否显示返回按钮
 * @property {string} backText - 返回按钮文字
 * @property {string} backgroundColor - 背景颜色
 * @property {string} textColor - 文字颜色
 * @property {boolean} fixed - 是否固定定位
 * @property {boolean} placeholder - 是否显示占位元素
 * @property {slot} left - 左侧插槽
 * @property {slot} right - 右侧插槽
 * 
 * @event back - 点击返回按钮时触发
 */

Component({
  options: {
    multipleSlots: true, // 启用多插槽
    styleIsolation: 'shared', // 样式共享
    addGlobalClass: true
  },

  properties: {
    // 导航栏标题
    title: {
      type: String,
      value: ''
    },
    // 是否显示返回按钮
    showBack: {
      type: Boolean,
      value: true
    },
    // 返回按钮文字
    backText: {
      type: String,
      value: ''
    },
    // 返回按钮图标
    backIcon: {
      type: String,
      value: 'arrow-left'
    },
    // 背景颜色
    backgroundColor: {
      type: String,
      value: '#FDF8F3'
    },
    // 文字颜色
    textColor: {
      type: String,
      value: '#5D4037'
    },
    // 是否固定定位
    fixed: {
      type: Boolean,
      value: true
    },
    // 是否显示占位元素
    placeholder: {
      type: Boolean,
      value: true
    },
    // 是否显示首页按钮
    showHome: {
      type: Boolean,
      value: false
    },
    // 是否显示边框
    border: {
      type: Boolean,
      value: false
    },
    // 背景透明度（0-1）
    opacity: {
      type: Number,
      value: 1
    },
    // 自定义样式
    customStyle: {
      type: String,
      value: ''
    }
  },

  data: {
    // 状态栏高度
    statusBarHeight: 0,
    // 导航栏高度
    navBarHeight: 0,
    // 胶囊按钮信息
    menuButtonInfo: null,
    // 是否显示返回按钮（根据页面栈判断）
    canBack: false
  },

  lifetimes: {
    attached() {
      this.initNavBar();
      this.checkCanBack();
    }
  },

  methods: {
    /**
     * 初始化导航栏
     */
    initNavBar() {
      const systemInfo = wx.getSystemInfoSync();
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

      // 计算导航栏高度
      const statusBarHeight = systemInfo.statusBarHeight;
      const navBarHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height;

      this.setData({
        statusBarHeight,
        navBarHeight,
        menuButtonInfo
      });

      // 将导航栏高度存储到全局
      const app = getApp();
      if (app) {
        app.globalData.statusBarHeight = statusBarHeight;
        app.globalData.navBarHeight = navBarHeight;
      }
    },

    /**
     * 检查是否可以返回
     */
    checkCanBack() {
      const pages = getCurrentPages();
      this.setData({
        canBack: pages.length > 1
      });
    },

    /**
     * 点击返回按钮
     */
    onBackTap() {
      // 触发自定义事件
      this.triggerEvent('back');

      // 如果页面栈大于1，自动返回
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({
          delta: 1,
          fail: () => {
            // 返回失败，跳转到首页
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
      } else {
        // 没有上一页，跳转到首页
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    },

    /**
     * 点击首页按钮
     */
    onHomeTap() {
      wx.switchTab({
        url: '/pages/index/index'
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
