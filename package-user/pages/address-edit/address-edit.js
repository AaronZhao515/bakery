/**
 * 地址编辑页面
 * 新增/编辑收货地址
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
    "佛山市": ["禅城区","南海区","顺德区","三水区","高明区"]
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

const PROVINCES = Object.keys(REGIONS);

Page({
  data: {
    // 页面模式: add/edit
    mode: 'add',
    // 编辑时的地址ID
    addressId: '',
    // 表单数据
    form: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      isDefault: false
    },
    // 表单错误
    errors: {},
    // 是否显示地区选择器
    showRegionPicker: false,
    // 地区选择器当前步骤
    pickerStep: 'province', // province/city/district
    pickerProvince: '',
    pickerCity: '',
    pickerDistrict: '',
    // 城市列表
    cities: [],
    // 区县列表
    districts: [],
    // Base64 icons
    icons: {}
  },

  onLoad(options) {
    console.log('[地址编辑] 页面加载', options);

    // 加载图标
    const icons = require('../../../utils/icons.js');
    this.setData({ icons });

    // 获取模式
    const mode = options.mode || 'add';
    this.setData({ mode });

    // 如果是编辑模式，加载地址详情
    if (mode === 'edit' && options.id) {
      this.setData({ addressId: options.id });
      this.loadAddressDetail(options.id);
    }
  },

  /**
   * 加载地址详情
   */
  async loadAddressDetail(addressId) {
    try {
      wx.showLoading({ title: '加载中...' });

      const result = await api.address.getList();
      wx.hideLoading();

      if (result && result.success) {
        const address = result.data.find(a => a._id === addressId);
        if (address) {
          this.setData({
            form: {
              name: address.name,
              phone: address.phone,
              province: address.province,
              city: address.city,
              district: address.district,
              detail: address.address,
              isDefault: address.isDefault || false
            }
          });
        }
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[地址编辑] 加载地址详情失败:', error);
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
   * 输入框变化
   */
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;

    this.setData({
      [`form.${field}`]: value,
      [`errors.${field}`]: ''
    });
  },

  /**
   * 切换默认地址
   */
  onDefaultToggle() {
    this.setData({
      'form.isDefault': !this.data.form.isDefault
    });
  },

  /**
   * 显示地区选择器
   */
  onShowRegionPicker() {
    const { province, city, district } = this.data.form;

    // 初始化选择器状态
    let pickerStep = 'province';
    if (province) {
      pickerStep = city ? (district ? 'district' : 'district') : 'city';
    }

    this.setData({
      showRegionPicker: true,
      pickerStep,
      pickerProvince: province || '',
      pickerCity: city || '',
      pickerDistrict: district || '',
      cities: province ? Object.keys(REGIONS[province] || {}) : [],
      districts: (province && city) ? (REGIONS[province]?.[city] || []) : []
    });
  },

  /**
   * 关闭地区选择器
   */
  onCloseRegionPicker() {
    this.setData({ showRegionPicker: false });
  },

  /**
   * 选择省份
   */
  onSelectProvince(e) {
    const { province } = e.currentTarget.dataset;

    const cities = Object.keys(REGIONS[province] || {});
    const autoCity = cities.length === 1 ? cities[0] : '';

    this.setData({
      pickerProvince: province,
      pickerCity: autoCity,
      pickerDistrict: '',
      cities,
      districts: autoCity ? (REGIONS[province]?.[autoCity] || []) : [],
      pickerStep: autoCity ? 'district' : 'city'
    });
  },

  /**
   * 选择城市
   */
  onSelectCity(e) {
    const { city } = e.currentTarget.dataset;
    const { pickerProvince } = this.data;

    this.setData({
      pickerCity: city,
      pickerDistrict: '',
      districts: REGIONS[pickerProvince]?.[city] || [],
      pickerStep: 'district'
    });
  },

  /**
   * 选择区县
   */
  onSelectDistrict(e) {
    const { district } = e.currentTarget.dataset;
    const { pickerProvince, pickerCity } = this.data;

    // 更新表单数据
    this.setData({
      'form.province': pickerProvince,
      'form.city': pickerCity,
      'form.district': district,
      'errors.province': '',
      showRegionPicker: false
    });
  },

  /**
   * 切换选择器步骤
   */
  onSwitchStep(e) {
    const { step } = e.currentTarget.dataset;
    const { pickerProvince, pickerCity } = this.data;

    // 检查是否可以切换到该步骤
    if (step === 'city' && !pickerProvince) return;
    if (step === 'district' && (!pickerProvince || !pickerCity)) return;

    this.setData({ pickerStep: step });
  },

  /**
   * 表单验证
   */
  validateForm() {
    const { form } = this.data;
    const errors = {};

    if (!form.name.trim()) {
      errors.name = '请填写收货人姓名';
    }

    if (!/^1\d{10}$/.test(form.phone.replace(/\s/g, ''))) {
      errors.phone = '请填写正确的手机号';
    }

    if (!form.province || !form.city || !form.district) {
      errors.province = '请选择所在地区';
    }

    if (!form.detail.trim()) {
      errors.detail = '请填写详细地址';
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  /**
   * 保存地址
   */
  async onSave() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请完善信息',
        icon: 'none'
      });
      return;
    }

    const { mode, addressId, form } = this.data;

    try {
      wx.showLoading({ title: '保存中...' });

      const addressData = {
        name: form.name,
        phone: form.phone,
        province: form.province,
        city: form.city,
        district: form.district,
        address: form.detail,
        isDefault: form.isDefault
      };

      let result;
      if (mode === 'edit') {
        result = await api.address.update(addressId, addressData);
      } else {
        result = await api.address.add(addressData);
      }

      wx.hideLoading();

      if (result && result.success) {
        wx.showToast({
          title: mode === 'edit' ? '修改成功' : '添加成功',
          icon: 'success'
        });

        // 延迟返回
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: result.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[地址编辑] 保存失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  }
});
