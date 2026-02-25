/**
 * 配送地址页面
 * 收货地址管理 - 基于 Figma 设计稿
 */

const app = getApp();
const api = require('../../../utils/api.js');

// 省市区数据
const REGIONS = {
  "上海市": {
    "上海市": ["浦东新区","黄浦区","徐汇区","长宁区","静安区","普陀区","虹口区","杨浦区","闵行区","宝山区","嘉定区","松江区","青浦区","奉贤区","崇明区"]
  },
  "北京市": {
    "北京市": ["东城区","西城区","朝阳区","海淀区","丰台区","石景山区","通州区","顺义区","昌平区","大兴区","怀柔区","密云区","延庆区"]
  },
  "广东省": {
    "广州市": ["天河区","越秀区","海珠区","荔湾区","白云区","黄埔区","番禺区","花都区","南沙区","从化区","增城区"],
    "深圳市": ["南山区","福田区","罗湖区","盐田区","龙华区","龙岗区","宝安区","光明区","坪山区","大鹏新区"],
    "佛山市": ["禅城区","南海区","顺德区","三水区","高明区"],
    "东莞市": ["莞城街道","南城街道","东城街道","万江街道"]
  },
  "浙江省": {
    "杭州市": ["上城区","拱墅区","西湖区","滨江区","萧山区","余杭区","临平区","钱塘区","富阳区","临安区"],
    "宁波市": ["海曙区","江北区","北仑区","镇海区","鄞州区","奉化区"],
    "温州市": ["鹿城区","龙湾区","瓯海区","洞头区"]
  },
  "江苏省": {
    "南京市": ["玄武区","秦淮区","建邺区","鼓楼区","浦口区","栖霞区","雨花台区","江宁区","六合区","溧水区","高淳区"],
    "苏州市": ["姑苏区","相城区","吴中区","吴江区","虎丘区"],
    "无锡市": ["梁溪区","锡山区","惠山区","滨湖区","新吴区"]
  }
};

Page({
  data: {
    // 地址列表
    addresses: [],
    // 是否正在加载
    isLoading: true,
    // 删除确认中的地址ID
    deleteConfirmingId: null,
    // 是否为选择模式（从订单页进入）
    isSelectMode: false,
    // Base64 icons
    icons: {}
  },

  onLoad(options) {
    console.log('[地址列表] 页面加载', options);

    // 加载图标
    const icons = require('../../../utils/icons.js');
    this.setData({ icons });

    // 检查是否为选择模式
    const isSelectMode = options.select === 'true';
    this.setData({ isSelectMode });

    // 加载地址列表
    this.loadAddressList();
  },

  onShow() {
    console.log('[地址列表] 页面显示');
    // 刷新地址列表
    this.loadAddressList();
  },

  /**
   * 加载地址列表
   */
  async loadAddressList() {
    this.setData({ isLoading: true });

    try {
      const result = await api.address.getList();
      console.log('[地址列表] 获取结果:', result);

      if (result && result.success) {
        // 格式化地址数据
        const addresses = (result.data || []).map(item => ({
          id: item._id,
          name: item.name,
          phone: item.phone,
          province: item.province,
          city: item.city,
          district: item.district,
          detail: item.address,
          isDefault: item.isDefault || false
        }));

        this.setData({
          addresses,
          isLoading: false
        });
      } else {
        this.setData({
          addresses: [],
          isLoading: false
        });
      }
    } catch (error) {
      console.error('[地址列表] 加载失败:', error);
      this.setData({
        addresses: [],
        isLoading: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 返回上一页
   */
  onBackTap() {
    wx.navigateBack();
  },

  /**
   * 新增地址
   */
  onAddAddress() {
    // 检查是否超过最大数量
    if (this.data.addresses.length >= 5) {
      wx.showToast({
        title: '最多可添加5个地址',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: '/package-user/pages/address-edit/address-edit?mode=add'
    });
  },

  /**
   * 编辑地址
   */
  onEditAddress(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/package-user/pages/address-edit/address-edit?mode=edit&id=${id}`
    });
  },

  /**
   * 删除地址 - 显示确认
   */
  onDeleteTap(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({ deleteConfirmingId: id });
  },

  /**
   * 取消删除
   */
  onDeleteCancel() {
    this.setData({ deleteConfirmingId: null });
  },

  /**
   * 确认删除
   */
  async onDeleteConfirm(e) {
    const { id } = e.currentTarget.dataset;

    try {
      wx.showLoading({ title: '删除中...' });

      const result = await api.address.remove(id);
      wx.hideLoading();

      if (result && result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        // 刷新列表
        this.loadAddressList();
      } else {
        wx.showToast({
          title: result.message || '删除失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[地址列表] 删除失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }

    this.setData({ deleteConfirmingId: null });
  },

  /**
   * 设为默认地址
   */
  async onSetDefault(e) {
    const { id } = e.currentTarget.dataset;

    try {
      wx.showLoading({ title: '设置中...' });

      const result = await api.address.setDefault(id);
      wx.hideLoading();

      if (result && result.success) {
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        });
        // 刷新列表
        this.loadAddressList();
      } else {
        wx.showToast({
          title: result.message || '设置失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[地址列表] 设置默认失败:', error);
      wx.showToast({
        title: '设置失败',
        icon: 'none'
      });
    }
  },

  /**
   * 选择地址（选择模式下）
   */
  onSelectAddress(e) {
    if (!this.data.isSelectMode) return;

    const { id } = e.currentTarget.dataset;
    const address = this.data.addresses.find(a => a.id === id);

    if (!address) return;

    // 存储选中的地址
    wx.setStorageSync('selectedAddressForOrder', address);

    // 返回上一页
    wx.navigateBack();
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '暖心烘焙 - 配送地址',
      path: '/package-user/pages/address/address'
    };
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 阻止事件冒泡
  }
});
