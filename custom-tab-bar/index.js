const icons = require('../utils/icons.js');

Component({
  data: {
    selected: 0,
    // 使用 base64 编码的图标
    list: [
      { id: 'home', pagePath: '/pages/index/index', text: '首页', iconUrl: icons.home },
      { id: 'reserve', pagePath: '/pages/reserve/reserve', text: '预定', iconUrl: icons.calendar },
      { id: 'order', pagePath: '/pages/order/order', text: '订单', iconUrl: icons.order },
      { id: 'user', pagePath: '/pages/user/user', text: '我的', iconUrl: icons.user }
    ]
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      this.updateSelectedIndex();
    }
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 更新当前选中的 tab 索引
     */
    updateSelectedIndex() {
      const pages = getCurrentPages();
      if (pages.length === 0) return;

      const currentPage = pages[pages.length - 1];
      const route = (currentPage && currentPage.route) || '';

      console.log('[TabBar] 当前页面:', route);

      const index = this.data.list.findIndex(item => {
        // 精确匹配页面路径
        if (item.pagePath === `/${route}`) return true;
        // 或者路径包含 tab id
        if (route.includes(item.id)) return true;
        return false;
      });

      console.log('[TabBar] 匹配索引:', index, '当前选中:', this.data.selected);

      if (index !== -1 && this.data.selected !== index) {
        this.setData({ selected: index });
        console.log('[TabBar] 更新选中状态为:', index);
      }
    },

    /**
     * 点击切换 tab
     */
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      const index = data.index;

      // 如果点击的是当前已选中的 tab，不执行任何操作
      if (index === this.data.selected) {
        return;
      }

      // 先更新选中状态（提供即时反馈）
      this.setData({ selected: index });

      // 切换页面
      wx.switchTab({
        url,
        fail: (err) => {
          console.error('[TabBar] 切换页面失败:', err);
          // 如果切换失败，恢复原选中状态
          this.updateSelectedIndex();
        }
      });
    },

    /**
     * 供页面调用的设置选中方法
     * @param {number} index - 要选中的 tab 索引
     */
    setSelected(index) {
      if (index !== this.data.selected) {
        this.setData({ selected: index });
      }
    }
  }
});
