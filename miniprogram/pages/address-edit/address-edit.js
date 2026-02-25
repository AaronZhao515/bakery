/**
 * 地址编辑页
 * 功能：新增/编辑地址、地区选择、表单验证
 */
const app = getApp();

// 省市区数据（简化版，实际应从服务器获取）
const REGION_DATA = {
  provinces: [
    { code: '110000', name: '北京市' },
    { code: '310000', name: '上海市' },
    { code: '440000', name: '广东省' },
    { code: '330000', name: '浙江省' },
    { code: '320000', name: '江苏省' }
  ],
  cities: {
    '110000': [{ code: '110100', name: '北京市' }],
    '310000': [{ code: '310100', name: '上海市' }],
    '440000': [
      { code: '440100', name: '广州市' },
      { code: '440300', name: '深圳市' }
    ],
    '330000': [{ code: '330100', name: '杭州市' }],
    '320000': [{ code: '320100', name: '南京市' }]
  },
  districts: {
    '110100': [
      { code: '110101', name: '东城区' },
      { code: '110102', name: '西城区' },
      { code: '110105', name: '朝阳区' }
    ],
    '310100': [
      { code: '310101', name: '黄浦区' },
      { code: '310115', name: '浦东新区' }
    ],
    '440100': [
      { code: '440103', name: '荔湾区' },
      { code: '440104', name: '越秀区' },
      { code: '440105', name: '海珠区' }
    ],
    '440300': [
      { code: '440303', name: '罗湖区' },
      { code: '440304', name: '福田区' },
      { code: '440305', name: '南山区' }
    ],
    '330100': [
      { code: '330102', name: '上城区' },
      { code: '330103', name: '下城区' },
      { code: '330106', name: '西湖区' }
    ],
    '320100': [
      { code: '320102', name: '玄武区' },
      { code: '320104', name: '秦淮区' },
      { code: '320106', name: '鼓楼区' }
    ]
  }
};

Page({
  data: {
    isEdit: false,
    addressId: '',
    form: {
      name: '',
      phone: '',
      region: '',
      detail: '',
      isDefault: false
    },
    isValid: false,
    showRegionPicker: false,
    provinces: REGION_DATA.provinces,
    cities: [],
    districts: [],
    regionValue: [0, 0, 0],
    selectedRegion: {
      province: null,
      city: null,
      district: null
    }
  },

  onLoad(options) {
    // 判断是否编辑模式
    if (options.id) {
      this.setData({
        isEdit: true,
        addressId: options.id
      });
      this.loadAddressDetail(options.id);
    }

    // 处理从微信导入的数据
    if (options.import) {
      try {
        const importData = JSON.parse(decodeURIComponent(options.import));
        this.setData({
          'form.name': importData.name,
          'form.phone': importData.phone,
          'form.region': importData.region,
          'form.detail': importData.detail
        });
        this.checkFormValid();
      } catch (e) {
        console.error('解析导入数据失败:', e);
      }
    }

    // 初始化城市数据
    this.updateCities(0);
  },

  // 加载地址详情
  async loadAddressDetail(addressId) {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const { result } = await wx.cloud.callFunction({
        name: 'getAddressDetail',
        data: { addressId }
      });

      wx.hideLoading();

      if (result.code === 0) {
        const data = result.data;
        this.setData({
          'form.name': data.name,
          'form.phone': data.phone,
          'form.region': data.region,
          'form.detail': data.detail,
          'form.isDefault': data.isDefault
        });
        this.checkFormValid();
      } else {
        wx.showToast({
          title: result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('加载地址详情失败:', error);
      // 模拟数据
      this.setData({
        'form.name': '张三',
        'form.phone': '13888888888',
        'form.region': '北京市朝阳区',
        'form.detail': '某某街道某某小区1号楼101室',
        'form.isDefault': true
      });
      this.checkFormValid();
    }
  },

  // 输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`form.${field}`]: value
    });
    
    this.checkFormValid();
  },

  // 默认地址切换
  onDefaultChange(e) {
    this.setData({
      'form.isDefault': e.detail.value
    });
  },

  // 检查表单有效性
  checkFormValid() {
    const { name, phone, region, detail } = this.data.form;
    const isValid = name && phone && region && detail && this.validatePhone(phone);
    this.setData({ isValid });
  },

  // 验证手机号
  validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
  },

  // 选择地区
  chooseRegion() {
    this.setData({
      showRegionPicker: true
    });
  },

  // 隐藏地区选择器
  hideRegionPicker() {
    this.setData({
      showRegionPicker: false
    });
  },

  // 更新城市数据
  updateCities(provinceIndex) {
    const province = this.data.provinces[provinceIndex];
    const cities = REGION_DATA.cities[province.code] || [];
    const districts = cities.length > 0 ? (REGION_DATA.districts[cities[0].code] || []) : [];
    
    this.setData({
      cities,
      districts,
      'selectedRegion.province': province,
      'selectedRegion.city': cities[0] || null,
      'selectedRegion.district': districts[0] || null
    });
  },

  // 更新区县数据
  updateDistricts(cityIndex) {
    const city = this.data.cities[cityIndex];
    const districts = city ? (REGION_DATA.districts[city.code] || []) : [];
    
    this.setData({
      districts,
      'selectedRegion.city': city,
      'selectedRegion.district': districts[0] || null
    });
  },

  // 地区选择变化
  onRegionChange(e) {
    const value = e.detail.value;
    const [provinceIndex, cityIndex, districtIndex] = value;

    // 如果省份变化，更新城市列表
    if (provinceIndex !== this.data.regionValue[0]) {
      this.updateCities(provinceIndex);
      this.setData({
        regionValue: [provinceIndex, 0, 0]
      });
    }
    // 如果城市变化，更新区县列表
    else if (cityIndex !== this.data.regionValue[1]) {
      this.updateDistricts(cityIndex);
      this.setData({
        regionValue: [provinceIndex, cityIndex, 0]
      });
    }
    // 只更新区县
    else {
      const district = this.data.districts[districtIndex];
      this.setData({
        'selectedRegion.district': district,
        regionValue: value
      });
    }

    // 更新地区文本
    const { province, city, district } = this.data.selectedRegion;
    if (province && city && district) {
      this.setData({
        'form.region': `${province.name} ${city.name} ${district.name}`,
        showRegionPicker: false
      });
      this.checkFormValid();
    }
  },

  // 保存地址
  async saveAddress() {
    if (!this.data.isValid) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    const { name, phone, region, detail, isDefault } = this.data.form;

    // 验证手机号
    if (!this.validatePhone(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });

      const data = {
        name,
        phone,
        region,
        detail,
        isDefault
      };

      // 编辑模式添加addressId
      if (this.data.isEdit) {
        data.addressId = this.data.addressId;
      }

      const { result } = await wx.cloud.callFunction({
        name: this.data.isEdit ? 'updateAddress' : 'addAddress',
        data
      });

      wx.hideLoading();

      if (result.code === 0) {
        wx.showToast({
          title: this.data.isEdit ? '修改成功' : '添加成功',
          icon: 'success',
          success: () => {
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          }
        });
      } else {
        wx.showToast({
          title: result.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  // 删除地址
  deleteAddress() {
    wx.showModal({
      title: '提示',
      content: '确定要删除该地址吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            
            const { result } = await wx.cloud.callFunction({
              name: 'deleteAddress',
              data: { addressId: this.data.addressId }
            });

            wx.hideLoading();

            if (result.code === 0) {
              wx.showToast({
                title: '删除成功',
                icon: 'success',
                success: () => {
                  setTimeout(() => {
                    wx.navigateBack();
                  }, 1500);
                }
              });
            } else {
              wx.showToast({
                title: result.message || '删除失败',
                icon: 'none'
              });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
