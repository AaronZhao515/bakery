/**
 * 库存管理页
 * 功能：库存列表、库存调整（入库/出库）、库存记录查询、低库存预警
 */
const app = getApp();

Page({
  data: {
    // 统计数据
    totalProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,

    // Tab切换
    currentTab: 'all', // all, warning, record

    // 库存列表
    stockList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,

    // 库存记录
    stockRecords: [],
    startDate: '',
    endDate: '',
    recordPage: 1,

    // 弹窗
    showModal: false,
    modalType: 'in', // in, out
    modalProductId: '',
    modalProductName: '',
    modalQuantity: '',
    modalRemark: '',
    operationTypeIndex: 0,
    operationTypes: [
      { id: 'purchase', name: '采购入库' },
      { id: 'return', name: '退货入库' },
      { id: 'adjust', name: '盘点调整' },
      { id: 'other', name: '其他' }
    ]
  },

  onLoad(options) {
    this.loadStockStats();
    this.loadStockList();
  },

  onPullDownRefresh() {
    if (this.data.currentTab === 'record') {
      this.setData({ recordPage: 1 });
      this.loadStockRecords().then(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      this.setData({ page: 1 });
      this.loadStockList().then(() => {
        wx.stopPullDownRefresh();
      });
    }
  },

  onReachBottom() {
    if (this.data.isLoading) return;

    if (this.data.currentTab === 'record') {
      if (this.data.hasMore) {
        this.loadMoreRecords();
      }
    } else {
      if (this.data.hasMore) {
        this.loadMoreStock();
      }
    }
  },

  // 加载库存统计
  async loadStockStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'stock',
        data: {
          action: 'getStockStats'
        }
      });

      if (result.result.code === 0) {
        this.setData({
          totalProducts: result.result.data.totalProducts,
          lowStockCount: result.result.data.lowStockCount,
          outOfStockCount: result.result.data.outOfStockCount
        });
      }
    } catch (error) {
      console.error('加载库存统计失败:', error);
      // 使用模拟数据
      this.setData({
        totalProducts: 56,
        lowStockCount: 5,
        outOfStockCount: 2
      });
    }
  },

  // 加载库存列表
  async loadStockList() {
    this.setData({ isLoading: true, page: 1 });

    try {
      const result = await wx.cloud.callFunction({
        name: 'stock',
        data: {
          action: 'getStockList',
          page: 1,
          pageSize: this.data.pageSize,
          type: this.data.currentTab
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        this.setData({
          stockList: list,
          hasMore: list.length < total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载库存列表失败:', error);
      // 使用模拟数据
      this.setMockStockData();
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载更多库存
  async loadMoreStock() {
    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'stock',
        data: {
          action: 'getStockList',
          page: nextPage,
          pageSize: this.data.pageSize,
          type: this.data.currentTab
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        this.setData({
          stockList: [...this.data.stockList, ...list],
          page: nextPage,
          hasMore: this.data.stockList.length + list.length < total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载更多库存失败:', error);
      this.setData({ isLoading: false, hasMore: false });
    }
  },

  // 设置模拟库存数据
  setMockStockData() {
    const mockData = [
      { id: '1', name: '招牌吐司', stock: 50, warningStock: 10, image: '' },
      { id: '2', name: '法式长棍', stock: 5, warningStock: 15, image: '' },
      { id: '3', name: '可颂面包', stock: 8, warningStock: 10, image: '' },
      { id: '4', name: '提拉米苏', stock: 3, warningStock: 8, image: '' },
      { id: '5', name: '芝士蛋糕', stock: 0, warningStock: 5, image: '' }
    ];

    const filteredData = this.data.currentTab === 'warning' 
      ? mockData.filter(item => item.stock <= item.warningStock)
      : mockData;

    this.setData({
      stockList: filteredData,
      hasMore: false
    });
  },

  // 加载库存记录
  async loadStockRecords() {
    this.setData({ isLoading: true, recordPage: 1 });

    try {
      const result = await wx.cloud.callFunction({
        name: 'stock',
        data: {
          action: 'getStockRecords',
          page: 1,
          pageSize: this.data.pageSize,
          startDate: this.data.startDate,
          endDate: this.data.endDate
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        this.setData({
          stockRecords: list,
          hasMore: list.length < total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载库存记录失败:', error);
      // 使用模拟数据
      this.setMockRecordData();
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载更多记录
  async loadMoreRecords() {
    const nextPage = this.data.recordPage + 1;
    this.setData({ isLoading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'stock',
        data: {
          action: 'getStockRecords',
          page: nextPage,
          pageSize: this.data.pageSize,
          startDate: this.data.startDate,
          endDate: this.data.endDate
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        this.setData({
          stockRecords: [...this.data.stockRecords, ...list],
          recordPage: nextPage,
          hasMore: this.data.stockRecords.length + list.length < total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载更多记录失败:', error);
      this.setData({ isLoading: false, hasMore: false });
    }
  },

  // 设置模拟记录数据
  setMockRecordData() {
    const mockRecords = [
      { id: '1', productName: '招牌吐司', type: 'in', typeName: '采购入库', quantity: 50, createTime: '2024-01-15 10:30', remark: '日常补货' },
      { id: '2', productName: '法式长棍', type: 'out', typeName: '销售出库', quantity: 20, createTime: '2024-01-15 14:20', remark: '' },
      { id: '3', productName: '可颂面包', type: 'in', typeName: '盘点调整', quantity: 10, createTime: '2024-01-14 16:00', remark: '盘点发现' },
      { id: '4', productName: '提拉米苏', type: 'out', typeName: '损耗出库', quantity: 2, createTime: '2024-01-14 09:15', remark: '过期处理' }
    ];

    this.setData({
      stockRecords: mockRecords,
      hasMore: false
    });
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      page: 1,
      recordPage: 1,
      hasMore: true
    });

    if (tab === 'record') {
      // 设置默认日期范围（最近7天）
      const endDate = this.formatDate(new Date());
      const startDate = this.formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      this.setData({ startDate, endDate });
      this.loadStockRecords();
    } else {
      this.loadStockList();
    }
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 开始日期选择
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  // 结束日期选择
  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
  },

  // 查询记录
  filterRecords() {
    this.setData({ recordPage: 1 });
    this.loadStockRecords();
  },

  // 显示库存调整弹窗
  showStockModal(e) {
    const { type, id, name } = e.currentTarget.dataset;
    
    // 根据类型设置操作类型选项
    const operationTypes = type === 'in' 
      ? [
          { id: 'purchase', name: '采购入库' },
          { id: 'return', name: '退货入库' },
          { id: 'adjust', name: '盘点调整' },
          { id: 'other', name: '其他' }
        ]
      : [
          { id: 'sale', name: '销售出库' },
          { id: 'loss', name: '损耗出库' },
          { id: 'return', name: '退货出库' },
          { id: 'other', name: '其他' }
        ];

    this.setData({
      showModal: true,
      modalType: type,
      modalProductId: id,
      modalProductName: name,
      modalQuantity: '',
      modalRemark: '',
      operationTypeIndex: 0,
      operationTypes
    });
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({ showModal: false });
  },

  // 数量输入
  onQuantityInput(e) {
    this.setData({ modalQuantity: e.detail.value });
  },

  // 操作类型选择
  onOperationTypeChange(e) {
    this.setData({ operationTypeIndex: e.detail.value });
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({ modalRemark: e.detail.value });
  },

  // 确认库存操作
  async confirmStockOperation() {
    const { modalType, modalProductId, modalQuantity, modalRemark, operationTypes, operationTypeIndex } = this.data;

    if (!modalQuantity || parseInt(modalQuantity) <= 0) {
      wx.showToast({ title: '请输入正确的数量', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '处理中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'stock',
        data: {
          action: 'adjustStock',
          productId: modalProductId,
          type: modalType,
          quantity: parseInt(modalQuantity),
          operationType: operationTypes[operationTypeIndex].id,
          operationTypeName: operationTypes[operationTypeIndex].name,
          remark: modalRemark
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: modalType === 'in' ? '入库成功' : '出库成功',
          icon: 'success'
        });
        this.hideModal();
        this.loadStockStats();
        this.loadStockList();
      } else {
        wx.showToast({
          title: result.result.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('库存操作失败:', error);
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
