/**
 * 隐私政策页面
 */
Page({
  data: {
    lastUpdated: '2026年2月26日',
    contactEmail: 'privacy@bakery.com',
    contactPhone: '400-123-4567'
  },

  onLoad() {
    console.log('[隐私政策] 页面加载');
  },

  /**
   * 复制联系邮箱
   */
  copyEmail() {
    wx.setClipboardData({
      data: this.data.contactEmail,
      success: () => {
        wx.showToast({
          title: '已复制邮箱',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 拨打电话
   */
  makePhoneCall() {
    wx.makePhoneCall({
      phoneNumber: this.data.contactPhone.replace(/-/g, '')
    });
  },

  /**
   * 下载完整隐私政策
   */
  downloadPolicy() {
    wx.showModal({
      title: '下载隐私政策',
      content: '是否下载完整版隐私政策PDF文档？',
      success: (res) => {
        if (res.confirm) {
          // 这里可以添加下载PDF的逻辑
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          });
        }
      }
    });
  }
});
