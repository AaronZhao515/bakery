/**
 * 优惠券管理页
 * 功能：优惠券列表、搜索筛选、创建/编辑/删除优惠券
 */
const app = getApp();

// 优惠券状态映射
const COUPON_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  EXPIRED: 'expired'
};

Page({
  data: {
    // 统计数据
    stats: {
      total: 0,
      active: 0,
      expired: 0,
      totalReceived: 0
    },
    // 搜索关键词
    searchKeyword: '',
    // 当前标签
    currentTab: 'all',
    // 优惠券列表
    coupons: [],
    // 分页
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    // 弹窗显示
    showModal: false,
    isEdit: false,
    editId: null,
    isSubmitting: false,
    // 表单数据
    formData: {
      type: 'amount',
      name: '',
      value: '',
      minSpend: '',
      totalCount: '',
      limitPerUser: 1,
      startDate: '',
      endDate: '',
      scope: 'all',
      description: '',
      selectedProducts: []
    },
    // 发放相关
    showDistributeModal: false,
    distributeCoupon: null,
    userSearchKeyword: '',
    userSearchResults: [],
    selectedUser: null,
    distributeCount: 1,
    isDistributing: false,
    // 发放记录
    showRecordsModal: false,
    recordsCouponId: null,
    distributionRecords: [],
    recordsPage: 1,
    recordsHasMore: true,
    isLoadingRecords: false,
    // 回收相关
    showRecallModal: false,
    recallCoupon: null,
    recallRecord: null,
    recallableRecords: [],
    isRecalling: false,
    // 批量发放
    showBatchDistributeModal: false,
    batchUserIds: [],
    batchResults: [],
    // 商品选择
    showProductSelector: false,
    productSearchKeyword: '',
    productList: [],
    tempSelectedProducts: [],
    productPage: 1,
    hasMoreProducts: true,
    isLoadingProducts: false
  },

  onLoad(options) {
    this.loadStats();
    this.loadCoupons();

    // 如果是快速创建模式
    if (options.action === 'create') {
      this.createCoupon();
    }
  },

  onShow() {
    // 检查管理员权限
    const adminInfo = wx.getStorageSync('admin_info');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.redirectTo({
        url: '/package-admin/pages/login/login'
      });
      return;
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    Promise.all([
      this.loadStats(),
      this.loadCoupons()
    ]).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreCoupons();
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          data: { operation: 'getStats' }
        }
      });

      if (result.result.code === 0) {
        this.setData({
          stats: result.result.data
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  // 加载优惠券列表
  async loadCoupons() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true, page: 1 });

    try {
      const result = await this.fetchCoupons(1);

      if (result.code === 0) {
        const coupons = this.processCouponData(result.data.list);
        this.setData({
          coupons,
          hasMore: coupons.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载优惠券失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 加载更多
  async loadMoreCoupons() {
    if (this.data.isLoading) return;

    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const result = await this.fetchCoupons(nextPage);

      if (result.code === 0) {
        const newCoupons = this.processCouponData(result.data.list);
        this.setData({
          coupons: [...this.data.coupons, ...newCoupons],
          page: nextPage,
          hasMore: this.data.coupons.length + newCoupons.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载更多失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 获取优惠券数据
  async fetchCoupons(page) {
    const { searchKeyword, currentTab } = this.data;

    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'couponManage',
        data: {
          operation: 'list',
          page,
          pageSize: this.data.pageSize,
          keyword: searchKeyword,
          status: currentTab === 'all' ? '' : currentTab
        }
      }
    });

    return result.result;
  },

  // 处理优惠券数据
  processCouponData(list) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);

    return list.map(item => {
      // 字段兼容处理
      const startTime = item.startTime || item.startDate || new Date().toISOString();
      const endTime = item.endTime || item.endDate;

      // 如果没有结束时间，默认30天
      let endDateObj, startDateObj;
      try {
        startDateObj = new Date(startTime);
        endDateObj = endTime ? new Date(endTime) : new Date(startDateObj.getTime() + 30 * 24 * 60 * 60 * 1000);
      } catch (e) {
        startDateObj = new Date();
        endDateObj = new Date(startDateObj.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // 将结束日期设置为当天的最后一毫秒
      const endDateCompare = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
      endDateCompare.setHours(23, 59, 59, 999);

      let status = COUPON_STATUS.ACTIVE;
      let statusText = '进行中';

      // 使用与后端一致的逻辑判断状态
      const startDateCompare = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());
      startDateCompare.setHours(0, 0, 0, 0);

      if (today < startDateCompare) {
        status = COUPON_STATUS.PENDING;
        statusText = '未开始';
      } else if (now > endDateCompare) {
        status = COUPON_STATUS.EXPIRED;
        statusText = '已结束';
      }

      // 统一字段名
      const title = item.title || item.name || '优惠券';
      const type = item.type || item.discountType || 'amount';
      const value = item.value || item.amount || 0;
      const minSpend = item.minSpend || item.minAmount || 0;
      const desc = item.desc || item.description || (type === 'amount' ? '满减券' : '折扣券');

      // 根据优惠券类型设置默认颜色和图标
      let iconBg = item.iconBg;
      let iconColor = item.iconColor;
      let amountColor = item.amountColor;
      let tag = item.tag;
      let tagBg = item.tagBg;
      let tagColor = item.tagColor;

      // 如果没有设置，根据类型使用默认配色
      if (!iconBg) {
        if (type === 'newcomer') {
          iconBg = '#FFF8E1';
          iconColor = '#D4A96A';
          amountColor = '#D4A96A';
          tag = tag || '新人专享';
          tagBg = '#FFF8E1';
          tagColor = '#D4A96A';
        } else if (type === 'limited') {
          iconBg = '#FFE5E5';
          iconColor = '#FF6B6B';
          amountColor = '#FF6B6B';
          tag = tag || '限时';
          tagBg = '#FFE5E5';
          tagColor = '#FF6B6B';
        } else {
          // 普通优惠券
          iconBg = '#E8F5E9';
          iconColor = '#4caf50';
          amountColor = '#4caf50';
        }
      }

      return {
        ...item,
        // 保持原始字段兼容性
        name: title,
        description: desc,
        // 处理后用于显示的字段
        title,
        type,
        value,
        minSpend,
        desc,
        iconBg,
        iconColor,
        amountColor,
        tag,
        tagBg,
        tagColor,
        status,
        statusText,
        receivedCount: item.receivedCount || 0,
        usedCount: item.usedCount || 0,
        // 确保编辑时有这些字段
        startDate: item.startDate || this.formatDateStr(startDateObj),
        endDate: item.endDate || this.formatDateStr(endDateObj),
        totalCount: item.totalCount !== undefined ? item.totalCount : '',
        limitPerUser: item.limitPerUser || 1,
        scope: item.scope || 'all',
        description: item.description || item.desc || '',
        selectedProducts: item.selectedProducts || []
      };
    });
  },

  // 格式化日期
  formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  // 执行搜索
  onSearch() {
    this.loadCoupons();
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      searchKeyword: ''
    });
    this.loadCoupons();
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      page: 1,
      hasMore: true
    });
    this.loadCoupons();
  },

  // 创建优惠券
  createCoupon() {
    console.log('[DEBUG] ===== createCoupon called =====');

    const startDate = this.formatDateStr(new Date());
    const endDate = this.formatDateStr(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    console.log('[DEBUG] startDate:', startDate, 'endDate:', endDate);

    const formData = {
      type: 'amount',
      name: '',
      value: '',
      minSpend: '',
      totalCount: '',
      limitPerUser: 1,
      startDate: startDate,
      endDate: endDate,
      scope: 'all',
      description: '',
      selectedProducts: []
    };

    console.log('[DEBUG] Setting showModal to true');

    this.setData({
      showModal: true,
      isEdit: false,
      editId: null,
      formData: formData
    }, () => {
      console.log('[DEBUG] Callback executed, showModal:', this.data.showModal);
    });
  },

  // 编辑优惠券
  editCoupon(e) {
    console.log('[DEBUG] editCoupon called, e:', e);
    const id = e.currentTarget.dataset.id;
    console.log('[DEBUG] editCoupon - id:', id);
    const coupon = this.data.coupons.find(item => item._id === id);
    console.log('[DEBUG] editCoupon - coupon found:', coupon ? 'yes' : 'no');

    if (!coupon) {
      console.log('[DEBUG] editCoupon - coupon not found, returning');
      return;
    }

    const formData = {
      type: coupon.type,
      name: coupon.name,
      value: coupon.value,
      minSpend: coupon.minSpend || '',
      totalCount: coupon.totalCount || '',
      limitPerUser: coupon.limitPerUser || 1,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      scope: coupon.scope || 'all',
      description: coupon.description || '',
      selectedProducts: coupon.selectedProducts || []
    };

    this.setData({
      showModal: true,
      isEdit: true,
      editId: id,
      formData: formData
    }, async () => {
      console.log('[DEBUG] editCoupon - showModal set to:', this.data.showModal);
      // 如果是指定商品类型且有选中商品，查询商品详情获取图片
      if (formData.scope === 'product' && formData.selectedProducts.length > 0) {
        await this.loadProductImages(formData.selectedProducts);
      }
    });
  },

  // 删除优惠券
  deleteCoupon(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '删除后该优惠券将不可使用，确定要删除吗？',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteCoupon(id);
        }
      }
    });
  },

  // 执行删除
  async doDeleteCoupon(id) {
    wx.showLoading({ title: '删除中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          data: {
            operation: 'delete',
            couponId: id
          }
        }
      });

      if (result.result.code === 0) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.loadCoupons();
        this.loadStats();
      } else {
        wx.showToast({ title: result.result.message || '删除失败', icon: 'none' });
      }
    } catch (error) {
      console.error('删除优惠券失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showModal: false
    });
  },

  // 选择类型
  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'formData.type': type
    });
  },

  // 名称输入
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 金额/折扣输入
  onValueInput(e) {
    this.setData({
      'formData.value': e.detail.value
    });
  },

  // 最低消费输入
  onMinSpendInput(e) {
    this.setData({
      'formData.minSpend': e.detail.value
    });
  },

  // 总量输入
  onTotalCountInput(e) {
    this.setData({
      'formData.totalCount': e.detail.value
    });
  },

  // 选择限领数量
  selectLimit(e) {
    const limit = parseInt(e.currentTarget.dataset.limit);
    this.setData({
      'formData.limitPerUser': limit
    });
  },

  // 开始日期变化
  onStartDateChange(e) {
    this.setData({
      'formData.startDate': e.detail.value
    });
  },

  // 结束日期变化
  onEndDateChange(e) {
    this.setData({
      'formData.endDate': e.detail.value
    });
  },

  // 选择适用范围
  selectScope(e) {
    const scope = e.currentTarget.dataset.scope;
    this.setData({
      'formData.scope': scope
    });
  },

  // 描述输入
  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 提交表单
  async submitForm() {
    const { formData, isEdit, editId } = this.data;

    // 验证表单
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入优惠券名称', icon: 'none' });
      return;
    }

    if (!formData.value || parseFloat(formData.value) <= 0) {
      wx.showToast({ title: `请输入${formData.type === 'amount' ? '优惠金额' : '折扣'}`, icon: 'none' });
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      wx.showToast({ title: '请选择有效期', icon: 'none' });
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
      return;
    }

    // 验证指定商品时是否选择了商品
    if (formData.scope === 'product' && (!formData.selectedProducts || formData.selectedProducts.length === 0)) {
      wx.showToast({ title: '请选择至少一件适用商品', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      const submitData = {
        name: formData.name.trim(),
        type: formData.type,
        value: parseFloat(formData.value),
        minSpend: parseFloat(formData.minSpend) || 0,
        totalCount: parseInt(formData.totalCount) || 0,
        limitPerUser: formData.limitPerUser,
        startTime: formData.startDate,
        endTime: formData.endDate,
        scope: formData.scope,
        description: formData.description.trim(),
        selectedProducts: formData.selectedProducts || []
      };

      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          data: {
            operation: isEdit ? 'update' : 'create',
            couponId: isEdit ? editId : undefined,
            ...submitData
          }
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: isEdit ? '修改成功' : '创建成功',
          icon: 'success'
        });
        this.closeModal();
        this.loadCoupons();
        this.loadStats();
      } else {
        wx.showToast({
          title: result.result.message || (isEdit ? '修改失败' : '创建失败'),
          icon: 'none'
        });
      }
    } catch (error) {
      console.error(isEdit ? '更新优惠券失败:' : '创建优惠券失败:', error);
      wx.showToast({
        title: isEdit ? '修改失败' : '创建失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 格式化日期字符串
  formatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // ========== 发放优惠券相关方法 ==========

  // 打开发放弹窗
  openDistributeModal(e) {
    const id = e.currentTarget.dataset.id;
    const coupon = this.data.coupons.find(item => item._id === id);

    if (!coupon) return;

    // 检查优惠券是否可发放
    if (coupon.status === 'expired') {
      wx.showToast({ title: '该优惠券已过期，无法发放', icon: 'none' });
      return;
    }

    // 检查库存
    if (coupon.totalCount > 0 && coupon.receivedCount >= coupon.totalCount) {
      wx.showToast({ title: '该优惠券已发放完毕', icon: 'none' });
      return;
    }

    this.setData({
      showDistributeModal: true,
      distributeCoupon: coupon,
      userSearchKeyword: '',
      userSearchResults: [],
      selectedUser: null,
      distributeCount: 1
    });
  },

  // 关闭发放弹窗
  closeDistributeModal() {
    this.setData({
      showDistributeModal: false,
      distributeCoupon: null,
      userSearchKeyword: '',
      userSearchResults: [],
      selectedUser: null,
      distributeCount: 1
    });
  },

  // 用户搜索输入
  onUserSearchInput(e) {
    this.setData({
      userSearchKeyword: e.detail.value
    });

    // 防抖搜索
    clearTimeout(this.userSearchTimer);
    this.userSearchTimer = setTimeout(() => {
      if (this.data.userSearchKeyword.trim()) {
        this.searchUsers();
      }
    }, 300);
  },

  // 搜索用户
  async searchUsers() {
    const keyword = this.data.userSearchKeyword.trim();
    if (!keyword) return;

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          data: {
            operation: 'searchUsers',
            keyword: keyword,
            limit: 10
          }
        }
      });

      if (result.result.code === 0) {
        this.setData({
          userSearchResults: result.result.data.list
        });
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    }
  },

  // 选择用户
  selectUser(e) {
    const userId = e.currentTarget.dataset.id;
    const user = this.data.userSearchResults.find(u => u._id === userId);

    if (user) {
      this.setData({
        selectedUser: user,
        userSearchResults: []
      });
    }
  },

  // 取消选择用户
  clearSelectedUser() {
    this.setData({
      selectedUser: null,
      userSearchKeyword: ''
    });
  },

  // 改变发放数量
  changeDistributeCount(e) {
    const delta = e.currentTarget.dataset.delta;
    const currentCount = this.data.distributeCount;
    const newCount = currentCount + parseInt(delta);

    this.validateAndSetCount(newCount);
  },

  // 输入发放数量
  onDistributeCountInput(e) {
    const count = parseInt(e.detail.value) || 1;
    this.validateAndSetCount(count);
  },

  // 验证并设置数量
  validateAndSetCount(count) {
    const coupon = this.data.distributeCoupon;
    let finalCount = Math.max(1, count);

    // 检查是否超过限领数量
    if (coupon && coupon.limitPerUser > 0 && finalCount > coupon.limitPerUser) {
      wx.showToast({
        title: `该优惠券每人限领${coupon.limitPerUser}张`,
        icon: 'none'
      });
      finalCount = coupon.limitPerUser;
    }

    // 检查是否超过库存
    if (coupon && coupon.totalCount > 0) {
      const remaining = coupon.totalCount - coupon.receivedCount;
      if (finalCount > remaining) {
        wx.showToast({
          title: `该优惠券仅剩${remaining}张`,
          icon: 'none'
        });
        finalCount = remaining;
      }
    }

    this.setData({ distributeCount: finalCount });
  },

  // 执行发放
  async doDistribute() {
    const { distributeCoupon, selectedUser, distributeCount } = this.data;

    if (!selectedUser) {
      wx.showToast({ title: '请先选择用户', icon: 'none' });
      return;
    }

    this.setData({ isDistributing: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          data: {
            operation: 'distribute',
            couponId: distributeCoupon._id,
            userId: selectedUser._id,
            count: distributeCount
          }
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: `成功发放给${result.result.data.userName}`,
          icon: 'success'
        });
        this.closeDistributeModal();
        this.loadCoupons();
        this.loadStats();
      } else {
        wx.showToast({
          title: result.result.message || '发放失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('发放优惠券失败:', error);
      wx.showToast({ title: '发放失败', icon: 'none' });
    } finally {
      this.setData({ isDistributing: false });
    }
  },

  // ========== 发放记录相关方法 ==========

  // 打开发放记录弹窗
  openRecordsModal(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      showRecordsModal: true,
      recordsCouponId: id,
      distributionRecords: [],
      recordsPage: 1,
      recordsHasMore: true
    });
    this.loadDistributionRecords();
  },

  // 关闭发放记录弹窗
  closeRecordsModal() {
    this.setData({
      showRecordsModal: false,
      recordsCouponId: null,
      distributionRecords: []
    });
  },

  // 加载发放记录
  async loadDistributionRecords() {
    if (this.data.isLoadingRecords) return;

    this.setData({ isLoadingRecords: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          data: {
            operation: 'getDistributionRecords',
            couponId: this.data.recordsCouponId,
            page: this.data.recordsPage,
            pageSize: 10
          }
        }
      });

      if (result.result.code === 0) {
        const newRecords = result.result.data.list;
        this.setData({
          distributionRecords: [...this.data.distributionRecords, ...newRecords],
          recordsHasMore: newRecords.length === 10,
          isLoadingRecords: false
        });
      }
    } catch (error) {
      console.error('加载发放记录失败:', error);
      this.setData({ isLoadingRecords: false });
    }
  },

  // 加载更多记录
  loadMoreRecords() {
    if (this.data.recordsHasMore && !this.data.isLoadingRecords) {
      this.setData({ recordsPage: this.data.recordsPage + 1 });
      this.loadDistributionRecords();
    }
  },

  // ========== 回收优惠券相关方法 ==========

  // 打开回收弹窗
  openRecallModal(e) {
    const id = e.currentTarget.dataset.id;
    const coupon = this.data.coupons.find(item => item._id === id);

    if (!coupon) return;

    // 检查是否有已发放未使用的优惠券
    if (coupon.receivedCount === 0) {
      wx.showToast({ title: '该优惠券尚未发放', icon: 'none' });
      return;
    }

    this.setData({
      showRecallModal: true,
      recallCoupon: coupon,
      recallRecord: null
    });

    // 加载可回收的记录
    this.loadRecallableRecords(id);
  },

  // 关闭回收弹窗
  closeRecallModal() {
    this.setData({
      showRecallModal: false,
      recallCoupon: null,
      recallRecord: null
    });
  },

  // 加载可回收的记录（未使用的用户优惠券）
  async loadRecallableRecords(couponId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'couponManage',
          data: {
            operation: 'getRecallableRecords',
            couponId: couponId,
            page: 1,
            pageSize: 50
          }
        }
      });

      if (result.result.code === 0) {
        this.setData({
          recallableRecords: result.result.data.list
        });
      }
    } catch (error) {
      console.error('加载可回收记录失败:', error);
    }
  },

  // 选择要回收的记录
  selectRecallRecord(e) {
    const recordId = e.currentTarget.dataset.id;
    const record = this.data.recallableRecords.find(r => r._id === recordId);

    this.setData({
      recallRecord: record
    });
  },

  // 执行回收
  async doRecall() {
    const { recallCoupon, recallRecord } = this.data;

    if (!recallRecord) {
      wx.showToast({ title: '请选择要回收的优惠券', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认回收',
      content: `确定要回收发给 ${recallRecord.userName} 的优惠券吗？`,
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ isRecalling: true });

          try {
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'couponManage',
                data: {
                  operation: 'recall',
                  userCouponId: recallRecord._id,
                  couponId: recallCoupon._id
                }
              }
            });

            if (result.result.code === 0) {
              wx.showToast({
                title: '回收成功',
                icon: 'success'
              });
              this.closeRecallModal();
              this.loadCoupons();
              this.loadStats();
            } else {
              wx.showToast({
                title: result.result.message || '回收失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('回收优惠券失败:', error);
            wx.showToast({ title: '回收失败', icon: 'none' });
          } finally {
            this.setData({ isRecalling: false });
          }
        }
      }
    });
  },

  // ========== 批量发放相关方法 ==========

  // 打开批量发放弹窗
  openBatchDistributeModal(e) {
    const id = e.currentTarget.dataset.id;
    const coupon = this.data.coupons.find(item => item._id === id);

    if (!coupon) return;

    // 检查优惠券是否可发放
    if (coupon.status === 'expired') {
      wx.showToast({ title: '该优惠券已过期，无法发放', icon: 'none' });
      return;
    }

    // 检查库存
    if (coupon.totalCount > 0 && coupon.receivedCount >= coupon.totalCount) {
      wx.showToast({ title: '该优惠券已发放完毕', icon: 'none' });
      return;
    }

    this.setData({
      showBatchDistributeModal: true,
      distributeCoupon: coupon,
      batchUserIds: [],
      batchResults: []
    });
  },

  // 关闭批量发放弹窗
  closeBatchDistributeModal() {
    this.setData({
      showBatchDistributeModal: false,
      distributeCoupon: null,
      batchUserIds: [],
      batchResults: []
    });
  },

  // 批量发放给所有用户
  async doBatchDistribute() {
    const { distributeCoupon } = this.data;

    wx.showModal({
      title: '确认批量发放',
      content: '确定要批量发放给符合条件的用户吗？',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ isDistributing: true });

          try {
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'couponManage',
                data: {
                  operation: 'batchDistribute',
                  couponId: distributeCoupon._id
                }
              }
            });

            if (result.result.code === 0) {
              wx.showToast({
                title: `成功发放给${result.result.data.successCount}位用户`,
                icon: 'success'
              });
              this.closeBatchDistributeModal();
              this.loadCoupons();
              this.loadStats();
            } else {
              wx.showToast({
                title: result.result.message || '批量发放失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('批量发放优惠券失败:', error);
            wx.showToast({ title: '批量发放失败', icon: 'none' });
          } finally {
            this.setData({ isDistributing: false });
          }
        }
      }
    });
  },

  // 全部回收（清空所有未使用的优惠券）
  async recallAll(e) {
    const id = e.currentTarget.dataset.id;
    const coupon = this.data.coupons.find(item => item._id === id);

    if (!coupon || coupon.receivedCount === 0) {
      wx.showToast({ title: '没有可回收的优惠券', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认全部回收',
      content: `确定要回收所有未使用的「${coupon.name}」吗？此操作不可恢复！`,
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '回收中...' });

          try {
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'couponManage',
                data: {
                  operation: 'recallAll',
                  couponId: id
                }
              }
            });

            if (result.result.code === 0) {
              wx.showToast({
                title: `成功回收${result.result.data.recallCount}张`,
                icon: 'success'
              });
              this.loadCoupons();
              this.loadStats();
            } else {
              wx.showToast({
                title: result.result.message || '回收失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('全部回收失败:', error);
            wx.showToast({ title: '回收失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // ========== 商品选择相关方法 ==========

  // 打开商品选择器
  async openProductSelector() {
    console.log('[DEBUG] ========== 打开商品选择器 ==========');
    console.log('[DEBUG] 当前 formData.scope:', this.data.formData.scope);

    const newData = {
      showProductSelector: true,
      productSearchKeyword: '',
      productList: [],
      tempSelectedProducts: [...(this.data.formData.selectedProducts || [])],
      productPage: 1,
      hasMoreProducts: true,
      isLoadingProducts: false
    };

    console.log('[DEBUG] 设置数据:', newData);

    this.setData(newData, () => {
      console.log('[DEBUG] setData 回调执行，showProductSelector:', this.data.showProductSelector);
    });

    // 加载商品列表
    try {
      await this.loadProducts();
    } catch (error) {
      console.error('[DEBUG] 加载商品失败:', error);
      wx.showToast({ title: '加载商品失败', icon: 'none' });
    }
  },

  // 关闭商品选择器
  closeProductSelector() {
    console.log('[DEBUG] 关闭商品选择器');
    this.setData({
      showProductSelector: false,
      tempSelectedProducts: [],
      productList: []
    }, () => {
      console.log('[DEBUG] 弹窗已关闭，showProductSelector:', this.data.showProductSelector);
    });
  },

  // 加载商品列表
  async loadProducts() {
    const { productPage, productSearchKeyword, isLoadingProducts, hasMoreProducts } = this.data;

    if (isLoadingProducts || !hasMoreProducts) {
      console.log('[DEBUG] 跳过加载: isLoadingProducts=', isLoadingProducts, 'hasMoreProducts=', hasMoreProducts);
      return;
    }

    console.log('[DEBUG] 开始加载商品列表, page:', productPage);
    this.setData({ isLoadingProducts: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getList',
          page: productPage,
          pageSize: 20,
          keyword: productSearchKeyword
        }
      });

      console.log('[DEBUG] 商品列表返回:', result);

      // 检查返回值结构
      if (!result || !result.result) {
        console.error('[DEBUG] 返回结果格式错误:', result);
        wx.showToast({ title: '加载失败: 数据格式错误', icon: 'none' });
        return;
      }

      if (result.result.code === 0) {
        const list = (result.result.data && result.result.data.list) || [];
        console.log('[DEBUG] 获取到商品数量:', list.length);

        const newProducts = list.map(item => ({
          ...item,
          selected: this.data.tempSelectedProducts.some(p => p._id === item._id)
        }));

        this.setData({
          productList: productPage === 1 ? newProducts : [...this.data.productList, ...newProducts],
          hasMoreProducts: newProducts.length === 20,
          productPage: productPage + 1
        });
      } else {
        console.error('[DEBUG] 加载商品失败:', result.result.message);
        wx.showToast({ title: result.result.message || '加载商品失败', icon: 'none' });
      }
    } catch (error) {
      console.error('[DEBUG] 加载商品异常:', error);
      wx.showToast({ title: '加载商品失败: ' + (error.message || '未知错误'), icon: 'none' });
    } finally {
      this.setData({ isLoadingProducts: false });
    }
  },

  // 搜索商品输入
  onProductSearchInput(e) {
    this.setData({ productSearchKeyword: e.detail.value });
  },

  // 搜索商品
  async searchProducts() {
    this.setData({
      productPage: 1,
      hasMoreProducts: true,
      productList: []
    });
    await this.loadProducts();
  },

  // 加载更多商品
  loadMoreProducts() {
    this.loadProducts();
  },

  // 切换商品选择
  toggleProductSelect(e) {
    const id = e.currentTarget.dataset.id;
    const product = this.data.productList.find(p => p._id === id);

    if (!product) return;

    const newSelected = !product.selected;

    // 更新商品列表中的选中状态
    const productList = this.data.productList.map(p => {
      if (p._id === id) {
        return { ...p, selected: newSelected };
      }
      return p;
    });

    // 更新临时选中列表
    let tempSelectedProducts = [...this.data.tempSelectedProducts];
    if (newSelected) {
      tempSelectedProducts.push(product);
    } else {
      tempSelectedProducts = tempSelectedProducts.filter(p => p._id !== id);
    }

    this.setData({
      productList,
      tempSelectedProducts
    });
  },

  // 清空所有选中的商品
  clearAllProducts() {
    this.setData({
      productList: this.data.productList.map(p => ({ ...p, selected: false })),
      tempSelectedProducts: []
    });
  },

  // 加载商品图片（用于编辑时获取完整商品信息）
  async loadProductImages(selectedProducts) {
    // 检查是否需要加载图片（如果已有图片则跳过）
    const needLoad = selectedProducts.some(p => !p.image && (!p.images || p.images.length === 0));
    if (!needLoad) return;

    console.log('[DEBUG] 加载商品图片...');
    const productIds = selectedProducts.map(p => p._id);

    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: {
          action: 'getList',
          page: 1,
          pageSize: 100
        }
      });

      if (result.result.code === 0) {
        const allProducts = result.result.data.list || [];
        const productMap = {};
        allProducts.forEach(p => {
          productMap[p._id] = p;
        });

        // 更新 selectedProducts 的图片信息
        const updatedProducts = selectedProducts.map(p => {
          const fullProduct = productMap[p._id];
          if (fullProduct) {
            return {
              ...p,
              name: fullProduct.name || p.name,
              price: fullProduct.price || p.price,
              images: fullProduct.images || [],
              image: fullProduct.image || (fullProduct.images && fullProduct.images[0]) || ''
            };
          }
          return p;
        });

        this.setData({
          'formData.selectedProducts': updatedProducts
        });

        console.log('[DEBUG] 商品图片加载完成');
      }
    } catch (error) {
      console.error('[DEBUG] 加载商品图片失败:', error);
    }
  },

  // 确认商品选择
  confirmProductSelect() {
    const { tempSelectedProducts } = this.data;

    // 只存储必要的字段（包含 productId 和图片）
    const selectedProducts = tempSelectedProducts.map(item => ({
      _id: item._id,
      name: item.name,
      price: item.price,
      // 优先存储图片数组或图片字段
      images: item.images || [],
      image: item.image || (item.images && item.images[0]) || ''
    }));

    this.setData({
      'formData.selectedProducts': selectedProducts,
      showProductSelector: false,
      tempSelectedProducts: [],
      productList: []
    });

    wx.showToast({
      title: `已选择${selectedProducts.length}件商品`,
      icon: 'none'
    });
  }
});
