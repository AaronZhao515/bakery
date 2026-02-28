/**
 * 用户编辑/添加页面
 */
const app = getApp();

Page({
  data: {
    isEdit: false,
    userId: '',
    formData: {
      nickName: '',
      phone: '',
      isAdmin: false,
      points: 0,
      balance: 0,
      memberLevel: 0,
      avatarUrl: '',
      status: 'active'
    },
    memberLevels: [
      { value: 0, name: '普通会员' },
      { value: 1, name: '银卡会员' },
      { value: 2, name: '金卡会员' },
      { value: 3, name: '钻石会员' }
    ],
    // 启用禁用确认弹窗
    showEnableConfirm: false,
    enableConfirmData: {
      nickName: '',
      userId: ''
    },
    pendingFormData: null
  },

  onLoad(options) {
    // 检查管理员权限
    const adminInfo = wx.getStorageSync('admin_info');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.redirectTo({
        url: '/package-admin/pages/login/login'
      });
      return;
    }

    // 判断是添加还是编辑
    if (options.id) {
      // 编辑模式
      this.setData({
        isEdit: true,
        userId: options.id
      });
      this.loadUserDetail(options.id);
    } else {
      // 添加模式
      this.setData({
        isEdit: false,
        userId: '',
        formData: {
          nickName: '',
          phone: '',
          isAdmin: false,
          points: 0,
          balance: 0,
          memberLevel: 0,
          avatarUrl: '',
          status: 'active'
        }
      });
    }
  },

  // 加载用户详情
  async loadUserDetail(userId) {
    wx.showLoading({ title: '加载中...' });
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'userManage',
          operation: 'getUserDetail',
          userId: userId
        }
      });

      if (result.result.code === 0) {
        const user = result.result.data.user;
        this.setData({
          formData: {
            nickName: user.nickName || '',
            phone: user.phone || '',
            isAdmin: user.isAdmin || false,
            points: user.points || 0,
            balance: user.balance || 0,
            memberLevel: user.memberLevel || 0,
            avatarUrl: user.avatarUrl || '',
            status: user.status || 'active'
          }
        });
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('[用户编辑] 加载用户详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 输入处理
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`formData.${field}`]: value
    });
  },

  // 数字输入处理
  onNumberInput(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const numValue = field === 'balance' ? parseFloat(value) || 0 : parseInt(value) || 0;
    this.setData({
      [`formData.${field}`]: numValue
    });
  },

  // 开关切换
  onSwitchChange(e) {
    this.setData({
      'formData.isAdmin': e.detail.value
    });
  },

  // 会员等级选择
  onMemberLevelChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      'formData.memberLevel': index
    });
  },

  // 选择头像
  async chooseAvatar() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      });

      if (res.tempFiles && res.tempFiles[0]) {
        const tempFilePath = res.tempFiles[0].tempFilePath;

        wx.showLoading({ title: '压缩上传中...' });

        // 压缩头像图片
        let uploadPath = tempFilePath;
        try {
          const compressedRes = await wx.compressImage({
            src: tempFilePath,
            quality: 70, // 头像质量可以稍低
            compressedWidth: 400 // 头像尺寸较小
          });
          uploadPath = compressedRes.tempFilePath;
          console.log('头像压缩成功');
        } catch (compressError) {
          console.error('头像压缩失败，使用原图:', compressError);
        }

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`,
          filePath: uploadPath
        });

        this.setData({
          'formData.avatarUrl': uploadRes.fileID
        });
        wx.hideLoading();
        wx.showToast({ title: '上传成功', icon: 'success' });
      }
    } catch (error) {
      console.error('[用户编辑] 上传头像失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  // 保存用户
  async saveUser() {
    const { isEdit, userId, formData } = this.data;

    // 表单验证
    if (!formData.nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    if (!formData.phone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }

    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(formData.phone.trim())) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    wx.showLoading({ title: isEdit ? '保存中' : '添加中' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'userManage',
          operation: isEdit ? 'updateUser' : 'createUser',
          userId: userId,
          userData: {
            nickName: formData.nickName.trim(),
            phone: formData.phone.trim(),
            isAdmin: formData.isAdmin,
            points: formData.points,
            balance: formData.balance,
            memberLevel: formData.memberLevel,
            avatarUrl: formData.avatarUrl
          }
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: isEdit ? '保存成功' : '添加成功',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else if (result.result.code === -2) {
        // 用户被禁用，询问是否要启用
        wx.hideLoading();
        this.setData({
          showEnableConfirm: true,
          enableConfirmData: {
            nickName: result.result.data.nickName,
            userId: result.result.data.userId
          },
          pendingFormData: formData
        });
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('[用户编辑] 保存失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    }
  },

  // 隐藏启用确认弹窗
  hideEnableConfirm() {
    this.setData({
      showEnableConfirm: false,
      enableConfirmData: {
        nickName: '',
        userId: ''
      },
      pendingFormData: null
    });
  },

  // 确认启用被禁用的用户
  async confirmEnableUser() {
    const { pendingFormData } = this.data;

    if (!pendingFormData) return;

    this.hideEnableConfirm();
    wx.showLoading({ title: '启用中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'userManage',
          operation: 'createUser',
          userData: {
            nickName: pendingFormData.nickName.trim(),
            phone: pendingFormData.phone.trim(),
            isAdmin: pendingFormData.isAdmin,
            points: pendingFormData.points,
            balance: pendingFormData.balance,
            memberLevel: pendingFormData.memberLevel,
            avatarUrl: pendingFormData.avatarUrl
          },
          enableIfDisabled: true
        }
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: '用户已启用',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('[用户编辑] 启用失败:', error);
      wx.showToast({
        title: error.message || '启用失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 切换用户状态（启用/禁用）
  async toggleUserStatus() {
    const { userId, formData } = this.data;

    if (!userId) return;

    const newStatus = formData.status === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'active' ? '启用' : '禁用';

    wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}该用户吗？`,
      confirmColor: newStatus === 'disabled' ? '#E57373' : '#8B6347',
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
              this.setData({
                'formData.status': newStatus
              });
            } else {
              throw new Error(result.result.message);
            }
          } catch (error) {
            console.error('[用户编辑] 切换状态失败:', error);
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

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});
