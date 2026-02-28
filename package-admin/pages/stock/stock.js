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
    console.log('[库存] 页面加载');
    this.loadStockStats();
    this.loadStockList();
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

    console.log('[库存] 页面显示, currentTab:', this.data.currentTab);
    // 如果列表为空，重新加载
    if (this.data.stockList.length === 0 && this.data.currentTab !== 'record') {
      this.loadStockList();
    }
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
      // 使用 admin 云函数获取统计数据
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'getStatistics'
        }
      });

      console.log('[库存] 统计数据:', result);

      if (result.result && result.result.code === 0) {
        this.setData({
          totalProducts: result.result.data.productCount,
          lowStockCount: result.result.data.stockWarningCount,
          outOfStockCount: result.result.data.outOfStockCount || 0
        });
      }
    } catch (error) {
      console.error('[库存] 加载统计失败:', error);
      // 使用模拟数据
      this.setData({
        totalProducts: 10,
        lowStockCount: 6,
        outOfStockCount: 0
      });
    }
  },

  // 加载库存列表
  async loadStockList() {
    this.setData({ isLoading: true, page: 1 });
    console.log('[库存] 开始加载库存列表, currentTab:', this.data.currentTab);

    try {
      // 使用 admin 云函数获取商品列表
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'productCRUD',
          operation: 'list',
          page: 1,
          pageSize: this.data.pageSize
        }
      });

      console.log('[库存] API返回:', result);

      if (result.result && result.result.code === 0) {
        const { list, total } = result.result.data;
        console.log('[库存] 获取商品列表:', list.length, '个商品, total:', total);
        console.log('[库存] 第一个商品:', list[0]);

        // 转换数据格式以适应库存显示，处理缺失字段
        const stockList = list.map(item => {
          const stock = typeof item.stock === 'number' ? item.stock : 0;
          const warningStock = typeof item.stockWarning === 'number' ? item.stockWarning : 10;
          return {
            id: item._id,
            name: item.name,
            stock: stock,
            warningStock: warningStock,
            image: item.image || (item.images && item.images[0]) || ''
          };
        });

        console.log('[库存] 转换后的数据:', stockList);

        // 如果当前是预警标签，过滤低库存商品
        const filteredList = this.data.currentTab === 'warning'
          ? stockList.filter(item => item.stock <= item.warningStock)
          : stockList;

        console.log('[库存] 过滤后显示:', filteredList.length, '个商品');

        this.setData({
          stockList: filteredList,
          hasMore: list.length < total,
          isLoading: false
        }, () => {
          console.log('[库存] setData完成, stockList长度:', this.data.stockList.length);
        });
      } else {
        console.error('[库存] API返回错误:', result.result);
        this.setData({ stockList: [], isLoading: false });
      }
    } catch (error) {
      console.error('[库存] 加载库存列表失败:', error);
      // 使用模拟数据
      this.setMockStockData();
    }
  },

  // 加载更多库存
  async loadMoreStock() {
    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'productCRUD',
          operation: 'list',
          page: nextPage,
          pageSize: this.data.pageSize
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        // 转换数据格式，处理缺失字段
        const newStockList = list.map(item => {
          const stock = typeof item.stock === 'number' ? item.stock : 0;
          const warningStock = typeof item.stockWarning === 'number' ? item.stockWarning : 10;
          return {
            id: item._id,
            name: item.name,
            stock: stock,
            warningStock: warningStock,
            image: item.image || (item.images && item.images[0]) || ''
          };
        });

        const allList = [...this.data.stockList, ...newStockList];
        // 如果当前是预警标签，过滤低库存商品
        const filteredList = this.data.currentTab === 'warning'
          ? allList.filter(item => item.stock <= item.warningStock)
          : allList;

        this.setData({
          stockList: filteredList,
          page: nextPage,
          hasMore: allList.length < total,
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
        name: 'admin',
        data: {
          action: 'stockRecordManage',
          operation: 'list',
          page: 1,
          pageSize: this.data.pageSize,
          startDate: this.data.startDate,
          endDate: this.data.endDate
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        // 转换数据格式
        const stockRecords = list.map(item => ({
          id: item._id,
          productName: item.productName,
          type: item.type,
          typeName: this.getOperationTypeName(item.operationType),
          quantity: item.quantity,
          createTime: this.formatDateTime(item.createTime),
          remark: item.remark
        }));

        this.setData({
          stockRecords: stockRecords,
          hasMore: list.length < total,
          isLoading: false
        });
      } else {
        // 使用模拟数据
        this.setMockRecordData();
      }
    } catch (error) {
      console.error('加载库存记录失败:', error);
      this.setMockRecordData();
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 获取操作类型名称
  getOperationTypeName(type) {
    const typeMap = {
      'purchase': '采购入库',
      'return': '退货入库',
      'adjust': '盘点调整',
      'other': '其他',
      'sale': '销售出库',
      'loss': '损耗出库'
    };
    return typeMap[type] || type;
  },

  // 格式化日期时间
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 加载更多记录
  async loadMoreRecords() {
    const nextPage = this.data.recordPage + 1;
    this.setData({ isLoading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'stockRecordManage',
          operation: 'list',
          page: nextPage,
          pageSize: this.data.pageSize,
          startDate: this.data.startDate,
          endDate: this.data.endDate
        }
      });

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        const newRecords = list.map(item => ({
          id: item._id,
          productName: item.productName,
          type: item.type,
          typeName: this.getOperationTypeName(item.operationType),
          quantity: item.quantity,
          createTime: this.formatDateTime(item.createTime),
          remark: item.remark
        }));

        const allRecords = [...this.data.stockRecords, ...newRecords];
        this.setData({
          stockRecords: allRecords,
          recordPage: nextPage,
          hasMore: allRecords.length < total,
          isLoading: false
        });
      } else {
        this.setData({ hasMore: false, isLoading: false });
      }
    } catch (error) {
      console.error('加载更多记录失败:', error);
      this.setData({ hasMore: false, isLoading: false });
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
    console.log('[库存] 切换tab到:', tab);

    // 先更新tab，然后在回调中加载数据
    this.setData({
      currentTab: tab,
      page: 1,
      recordPage: 1,
      hasMore: true,
      stockList: []  // 清空列表避免显示旧数据
    }, () => {
      // setData完成后的回调
      console.log('[库存] setData完成, currentTab现在是:', this.data.currentTab);

      if (tab === 'record') {
        // 设置默认日期范围（最近7天）
        const endDate = this.formatDate(new Date());
        const startDate = this.formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        this.setData({ startDate, endDate });
        this.loadStockRecords();
      } else {
        this.loadStockList();
      }
    });
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
    console.log('[库存] 显示弹窗, e:', e);
    const { type, id, name } = e.currentTarget.dataset;
    console.log('[库存] 弹窗参数:', { type, id, name });

    // 检查参数
    if (!id) {
      console.error('[库存] 商品ID为空');
      wx.showToast({ title: '商品信息有误', icon: 'none' });
      return;
    }

    // 获取当前商品库存
    const currentProduct = this.data.stockList.find(item => item.id === id);
    const currentStock = currentProduct ? currentProduct.stock : 0;

    // 出库时检查库存是否为0
    if (type === 'out' && currentStock <= 0) {
      wx.showToast({ title: '库存为0，无法出库', icon: 'none' });
      return;
    }

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
    }, () => {
      console.log('[库存] 弹窗已显示, showModal:', this.data.showModal);
    });
  },

  // 隐藏弹窗
  hideModal() {
    console.log('[库存] 隐藏弹窗');
    this.setData({ showModal: false });
  },

  // 阻止弹窗内部点击事件冒泡
  onModalTap() {
    console.log('[库存] 点击弹窗内容，阻止关闭');
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
    const { modalType, modalProductId, modalProductName, modalQuantity, modalRemark, stockList, operationTypeIndex, operationTypes } = this.data;

    if (!modalQuantity || parseInt(modalQuantity) <= 0) {
      wx.showToast({ title: '请输入正确的数量', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '处理中' });

    try {
      // 获取当前商品库存（重新查询，确保最新）
      const productResult = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'productCRUD',
          operation: 'get',
          productId: modalProductId
        }
      });

      let currentStock = 0;
      if (productResult.result.code === 0 && productResult.result.data) {
        currentStock = productResult.result.data.stock || 0;
      }

      // 计算新库存
      const quantity = parseInt(modalQuantity);

      // 出库时检查库存是否为0
      if (modalType === 'out' && currentStock <= 0) {
        wx.showToast({ title: '库存为0，无法出库', icon: 'none' });
        wx.hideLoading();
        return;
      }

      // 出库时检查库存是否足够
      if (modalType === 'out' && quantity > currentStock) {
        wx.showToast({ title: '库存不足，无法出库', icon: 'none' });
        wx.hideLoading();
        return;
      }

      const newStock = modalType === 'in'
        ? currentStock + quantity
        : Math.max(0, currentStock - quantity);

      // 获取操作类型
      const recordType = operationTypes[operationTypeIndex]?.id || (modalType === 'in' ? 'adjust' : 'sale');

      // 使用 admin 云函数更新库存
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'updateStock',
          productId: modalProductId,
          stock: newStock,
          recordType: recordType,
          recordRemark: modalRemark,
          operator: '管理员'
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
