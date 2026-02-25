/**
 * 地址管理页
 * 功能：地址列表展示、设置默认地址、编辑删除地址、从微信导入
 */
const app = getApp();

Page({
  data: {
    addressList: [],
    canImport: true,
    isLoading: false,
    fromOrder: false // 是否从订单页面进入
  },

  onLoad(options) {
    // 判断是否从订单页面进入（用于选择地址）
    if (options.from === 'order') {
      this.setData({ fromOrder: true });
    }
    this.loadAddressList();
  },

  onShow() {
    this.loadAddressList();
  },

  // 加载地址列表
  async loadAddressList() {
    this.setData({ isLoading: true });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getAddressList'
      });

      if (result.code === 0) {
        // 默认地址排在最前面
        const addressList = result.data.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return b.createTime - a.createTime;
        });

        this.setData({
          addressList,
          isLoading: false
        });
      } else {
        wx.showToast({
          title: result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载地址列表失败:', error);
      // 模拟数据（开发测试用）
      this.loadMockData();
    }
  },

  // 模拟数据（开发测试用）
  loadMockData() {
    const mockAddresses = [
      {
        _id: 'addr001',
        name: '张三',
        phone: '13888888888',
        region: '北京市朝阳区',
        detail: '某某街道某某小区1号楼101室',
        isDefault: true,
        createTime: Date.now()
      },
      {
        _id: 'addr002',
        name: '李四',
        phone: '13999999999',
        region: '上海市浦东新区',
        detail: '陆家嘴金融中心88层',
        isDefault: false,
        createTime: Date.now() - 100000
      },
      {
        _id: 'addr003',
        name: '王五',
        phone: '13777777777',
        region: '广东省深圳市南山区',
        detail: '科技园南区某某大厦',
        isDefault: false,
        createTime: Date.now() - 200000
      }
    ];

    this.setData({
      addressList: mockAddresses,
      isLoading: false
    });
  },

  // 选择地址（从订单页面进入时）
  selectAddress(e) {
    if (!this.data.fromOrder) return;

    const addressId = e.currentTarget.dataset.id;
    const address = this.data.addressList.find(item => item._id === addressId);
    
    if (address) {
      // 返回上一页并传递选中的地址
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        prevPage.setData({
          selectedAddress: address
        });
      }
      wx.navigateBack();
    }
  },

  // 设置默认地址
  async setDefault(e) {
    const addressId = e.currentTarget.dataset.id;

    try {
      wx.showLoading({ title: '设置中...' });
      
      const { result } = await wx.cloud.callFunction({
        name: 'setDefaultAddress',
        data: { addressId }
      });

      wx.hideLoading();

      if (result.code === 0) {
        wx.showToast({ title: '设置成功', icon: 'success' });
        this.loadAddressList();
      } else {
        wx.showToast({
          title: result.message || '设置失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '设置失败', icon: 'none' });
    }
  },

  // 编辑地址
  editAddress(e) {
    const addressId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/address-edit/address-edit?id=${addressId}`
    });
  },

  // 删除地址
  deleteAddress(e) {
    const addressId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '提示',
      content: '确定要删除该地址吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            
            const { result } = await wx.cloud.callFunction({
              name: 'deleteAddress',
              data: { addressId }
            });

            wx.hideLoading();

            if (result.code === 0) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadAddressList();
            } else {
              wx.showToast({
                title: result.message || '删除失败',
                icon: 'none'
              });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 新增地址
  addAddress() {
    wx.navigateTo({
      url: '/pages/address-edit/address-edit'
    });
  },

  // 从微信导入地址
  importFromWechat() {
    wx.chooseAddress({
      success: (res) => {
        const addressData = {
          name: res.userName,
          phone: res.telNumber,
          region: `${res.provinceName} ${res.cityName} ${res.countyName}`,
          detail: res.detailInfo
        };

        // 跳转到编辑页，预填充数据
        wx.navigateTo({
          url: `/pages/address-edit/address-edit?import=${encodeURIComponent(JSON.stringify(addressData))}`
        });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth')) {
          wx.showModal({
            title: '授权提示',
            content: '需要授权才能获取微信地址',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
        }
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadAddressList().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
