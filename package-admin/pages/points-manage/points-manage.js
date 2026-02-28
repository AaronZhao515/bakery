/**
 * 积分充值管理页
 * 功能：为用户充值积分、查看充值记录、用户积分排行
 */
const app = getApp();

Page({
  data: {
    // 统计数据
    stats: {
      totalUsers: 0,
      totalPoints: 0,
      todayCharged: 0
    },
    // 当前标签
    currentTab: 'records',
    // 搜索关键词
    searchKeyword: '',
    searched: false,
    // 搜索结果
    searchResults: [],
    // 选中的用户
    selectedUser: null,
    // 充值积分
    chargePoints: '',
    // 充值原因
    chargeReason: '',
    // 是否正在充值
    isCharging: false,
    // 充值记录
    records: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    isLoading: false,
    // 筛选日期
    filterDate: '',
    // 用户积分列表
    userPointsList: [],
    userSearchKeyword: '',
    sortDesc: true
  },

  onLoad(options) {
    this.loadStats();

    // 如果是快速充值模式
    if (options.action === 'charge') {
      this.setData({ currentTab: 'charge' });
    } else {
      this.loadRecords();
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
    this.loadStats();

    if (this.data.currentTab === 'records') {
      this.setData({ page: 1, hasMore: true });
      this.loadRecords().then(() => {
        wx.stopPullDownRefresh();
      });
    } else if (this.data.currentTab === 'users') {
      this.setData({ page: 1, hasMore: true });
      this.loadUserPoints().then(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      if (this.data.currentTab === 'records') {
        this.loadMoreRecords();
      } else if (this.data.currentTab === 'users') {
        this.loadMoreUsers();
      }
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'pointsManage',
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

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      page: 1,
      hasMore: true
    });

    if (tab === 'records' && this.data.records.length === 0) {
      this.loadRecords();
    } else if (tab === 'users' && this.data.userPointsList.length === 0) {
      this.loadUserPoints();
    }
  },

  // 显示充值面板
  showChargePanel() {
    this.setData({
      currentTab: 'charge',
      selectedUser: null,
      searchKeyword: '',
      searchResults: [],
      chargePoints: '',
      chargeReason: ''
    });
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  // 搜索用户
  async searchUsers() {
    const { searchKeyword } = this.data;

    if (!searchKeyword.trim()) {
      wx.showToast({ title: '请输入搜索内容', icon: 'none' });
      return;
    }

    this.setData({ isLoading: true, searched: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'pointsManage',
          data: {
            operation: 'searchUsers',
            keyword: searchKeyword.trim()
          }
        }
      });

      if (result.result.code === 0) {
        this.setData({
          searchResults: result.result.data.list
        });
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 选择用户
  selectUser(e) {
    const user = e.currentTarget.dataset.user;
    this.setData({
      selectedUser: user,
      searchResults: []
    });
  },

  // 清除选中用户
  clearSelectedUser() {
    this.setData({
      selectedUser: null,
      chargePoints: '',
      chargeReason: ''
    });
  },

  // 积分输入
  onPointsInput(e) {
    this.setData({
      chargePoints: e.detail.value
    });
  },

  // 原因输入
  onReasonInput(e) {
    this.setData({
      chargeReason: e.detail.value
    });
  },

  // 选择快捷金额
  selectQuickAmount(e) {
    const amount = e.currentTarget.dataset.amount;
    this.setData({
      chargePoints: amount
    });
  },

  // 提交充值
  async submitCharge() {
    const { selectedUser, chargePoints, chargeReason } = this.data;

    if (!selectedUser) {
      wx.showToast({ title: '请先选择用户', icon: 'none' });
      return;
    }

    const points = parseInt(chargePoints);
    if (!points || points <= 0) {
      wx.showToast({ title: '请输入有效的积分数量', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认充值',
      content: `确定为用户「${selectedUser.nickName}」充值 ${points} 积分吗？`,
      success: async (res) => {
        if (res.confirm) {
          this.setData({ isCharging: true });

          try {
            const adminInfo = wx.getStorageSync('admin_info');

            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'pointsManage',
                data: {
                  operation: 'charge',
                  userId: selectedUser._id,
                  points: points,
                  reason: chargeReason.trim() || '管理员充值',
                  operator: adminInfo.nickName || '管理员'
                }
              }
            });

            if (result.result.code === 0) {
              wx.showToast({
                title: '充值成功',
                icon: 'success'
              });

              // 重置表单
              this.setData({
                selectedUser: null,
                chargePoints: '',
                chargeReason: '',
                searchKeyword: ''
              });

              // 刷新统计数据
              this.loadStats();
            } else {
              wx.showToast({
                title: result.result.message || '充值失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('充值失败:', error);
            wx.showToast({ title: '充值失败', icon: 'none' });
          } finally {
            this.setData({ isCharging: false });
          }
        }
      }
    });
  },

  // 加载充值记录
  async loadRecords() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true, page: 1 });

    try {
      const result = await this.fetchRecords(1);

      if (result.code === 0) {
        const records = result.data.list.map(item => ({
          ...item,
          createTime: this.formatDateTime(item.createTime)
        }));

        this.setData({
          records,
          hasMore: records.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载记录失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 加载更多记录
  async loadMoreRecords() {
    if (this.data.isLoading) return;

    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const result = await this.fetchRecords(nextPage);

      if (result.code === 0) {
        const newRecords = result.data.list.map(item => ({
          ...item,
          createTime: this.formatDateTime(item.createTime)
        }));

        this.setData({
          records: [...this.data.records, ...newRecords],
          page: nextPage,
          hasMore: this.data.records.length + newRecords.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载更多失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 获取记录数据
  async fetchRecords(page) {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'pointsManage',
        data: {
          operation: 'getRecords',
          page,
          pageSize: this.data.pageSize,
          date: this.data.filterDate
        }
      }
    });

    return result.result;
  },

  // 日期变化
  onDateChange(e) {
    this.setData({
      filterDate: e.detail.value,
      page: 1,
      hasMore: true
    });
    this.loadRecords();
  },

  // 清除筛选
  clearFilter() {
    this.setData({
      filterDate: '',
      page: 1,
      hasMore: true
    });
    this.loadRecords();
  },

  // 加载用户积分列表
  async loadUserPoints() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true, page: 1 });

    try {
      const result = await this.fetchUserPoints(1);

      if (result.code === 0) {
        this.setData({
          userPointsList: result.data.list,
          hasMore: result.data.list.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载用户积分失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 加载更多用户
  async loadMoreUsers() {
    if (this.data.isLoading) return;

    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const result = await this.fetchUserPoints(nextPage);

      if (result.code === 0) {
        this.setData({
          userPointsList: [...this.data.userPointsList, ...result.data.list],
          page: nextPage,
          hasMore: this.data.userPointsList.length + result.data.list.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('加载更多失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 获取用户积分数据
  async fetchUserPoints(page) {
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'pointsManage',
        data: {
          operation: 'getUserPoints',
          page,
          pageSize: this.data.pageSize,
          keyword: this.data.userSearchKeyword,
          sortDesc: this.data.sortDesc
        }
      }
    });

    return result.result;
  },

  // 用户搜索输入
  onUserSearchInput(e) {
    this.setData({
      userSearchKeyword: e.detail.value
    });
  },

  // 搜索用户积分
  searchUserPoints() {
    this.setData({ page: 1, hasMore: true });
    this.loadUserPoints();
  },

  // 切换排序
  toggleSort() {
    this.setData({
      sortDesc: !this.data.sortDesc,
      page: 1,
      hasMore: true
    });
    this.loadUserPoints();
  },

  // 快捷充值用户
  quickChargeUser(e) {
    const user = e.currentTarget.dataset.user;
    this.setData({
      currentTab: 'charge',
      selectedUser: user,
      chargePoints: '',
      chargeReason: ''
    });
  },

  // 格式化日期时间
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  }
});
