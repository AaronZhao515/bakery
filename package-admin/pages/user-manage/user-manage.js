/**
 * 用户管理页面
 * 功能：用户列表、搜索、跳转到添加/编辑页面
 */
const app = getApp();

Page({
  data: {
    users: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    isLoading: false,
    total: 0,
    keyword: '',
    searchFocus: false,
    currentRole: 'all',
    roleOptions: [
      { value: 'all', name: '全部角色' },
      { value: 'admin', name: '管理员' },
      { value: 'user', name: '普通用户' }
    ],
    currentStatus: 'all',
    statusOptions: [
      { value: 'all', name: '全部状态' },
      { value: 'active', name: '正常' },
      { value: 'disabled', name: '已禁用' }
    ]
  },

  onLoad(options) {
    this.loadUsers();
  },

  onShow() {
    const adminInfo = wx.getStorageSync('admin_info');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.redirectTo({
        url: '/package-admin/pages/login/login'
      });
      return;
    }
    this.loadUsers();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadUsers().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreUsers();
    }
  },

  async loadUsers() {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true, page: 1 });

    try {
      const result = await this.fetchUsers(1);
      if (result.code === 0) {
        this.setData({
          users: result.data.list,
          total: result.data.total,
          hasMore: result.data.list.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('[用户管理] 加载失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  async loadMoreUsers() {
    const nextPage = this.data.page + 1;
    this.setData({ isLoading: true });

    try {
      const result = await this.fetchUsers(nextPage);
      if (result.code === 0) {
        this.setData({
          users: [...this.data.users, ...result.data.list],
          page: nextPage,
          hasMore: this.data.users.length + result.data.list.length < result.data.total,
          isLoading: false
        });
      }
    } catch (error) {
      this.setData({ isLoading: false });
    }
  },

  async fetchUsers(page) {
    const { keyword, currentRole, currentStatus, pageSize } = this.data;
    const result = await wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'userManage',
        operation: 'getUsers',
        page,
        pageSize,
        keyword: keyword || undefined,
        role: currentRole !== 'all' ? currentRole : undefined,
        status: currentStatus !== 'all' ? currentStatus : undefined
      }
    });
    return result.result;
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchConfirm() {
    this.setData({ page: 1, hasMore: true });
    this.loadUsers();
  },

  clearSearch() {
    this.setData({ keyword: '', page: 1, hasMore: true });
    this.loadUsers();
  },

  onSearchFocus() {
    this.setData({ searchFocus: true });
  },

  onSearchBlur() {
    this.setData({ searchFocus: false });
  },

  switchRoleFilter(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ currentRole: role, page: 1, hasMore: true });
    this.loadUsers();
  },

  switchStatusFilter(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ currentStatus: status, page: 1, hasMore: true });
    this.loadUsers();
  },

  // 切换用户状态（启用/禁用）
  async toggleUserStatus(e) {
    const userId = e.currentTarget.dataset.id;
    const currentStatus = e.currentTarget.dataset.status;
    const nickName = e.currentTarget.dataset.name;

    if (!userId) return;

    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'active' ? '启用' : '禁用';

    wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}用户「${nickName || '未命名用户'}」吗？`,
      confirmColor: newStatus === 'disabled' ? '#E57373' : '#4CAF50',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: `${actionText}中...` });

          try {
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'userManage',
                operation: 'toggleUserStatus',
                userId: userId,
                status: newStatus
              }
            });

            if (result.result.code === 0) {
              wx.showToast({ title: `${actionText}成功`, icon: 'success' });
              // 更新本地数据
              const users = this.data.users.map(user => {
                if (user._id === userId) {
                  return { ...user, status: newStatus };
                }
                return user;
              });
              this.setData({ users });
            } else {
              throw new Error(result.result.message);
            }
          } catch (error) {
            console.error('[用户管理] 切换状态失败:', error);
            wx.showToast({
              title: error.message || `${actionText}失败`,
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // 跳转到添加用户页面
  showAddUser() {
    wx.navigateTo({
      url: '/package-admin/pages/user-edit/user-edit'
    });
  },

  // 跳转到编辑用户页面
  showEditUser(e) {
    const userId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/package-admin/pages/user-edit/user-edit?id=${userId}`
    });
  },

  makePhoneCall(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    } else {
      wx.showToast({ title: '用户未绑定手机号', icon: 'none' });
    }
  },

  // 阻止事件冒泡
  preventBubble() {
    // 什么都不做，只是阻止事件冒泡
  }
});
