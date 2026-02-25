/**
 * 支付结果页面逻辑
 * 功能：展示支付结果、订单信息、跳转操作
 */

Page({
  data: {
    // 支付状态: success-成功, fail-失败, pending-处理中
    payStatus: 'pending',
    // 订单编号
    orderNo: '',
    // 订单ID
    orderId: '',
    // 支付金额
    payAmount: '0.00',
    // 支付时间
    payTime: '',
    // 失败原因
    failMessage: '',
    // 配送信息
    deliveryInfo: null
  },

  onLoad(options) {
    // 获取页面参数
    const { status, orderId, orderNo, amount, message } = options;
    
    this.setData({
      payStatus: status || 'pending',
      orderId: orderId || '',
      orderNo: orderNo || '',
      payAmount: amount || '0.00',
      failMessage: message || ''
    });

    // 设置支付时间
    if (status === 'success') {
      this.setPayTime();
      this.loadDeliveryInfo();
    }

    // 如果是处理中状态，轮询查询支付结果
    if (status === 'pending') {
      this.pollPayResult();
    }
  },

  /**
   * 设置支付时间
   */
  setPayTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    this.setData({
      payTime: `${year}-${month}-${day} ${hour}:${minute}:${second}`
    });
  },

  /**
   * 加载配送信息
   */
  loadDeliveryInfo() {
    // 从本地存储获取订单详情
    const orderDetail = wx.getStorageSync('orderDetail');
    
    if (orderDetail) {
      const deliveryInfo = {
        type: orderDetail.deliveryType,
        name: orderDetail.address ? orderDetail.address.name : '',
        phone: orderDetail.address ? orderDetail.address.phone : '',
        address: orderDetail.address ? 
          `${orderDetail.address.province}${orderDetail.address.city}${orderDetail.address.district}${orderDetail.address.detail}` : '',
        storeAddress: '北京市朝阳区烘焙街88号温馨烘焙坊',
        pickupTime: orderDetail.pickupTime || '',
        estimatedTime: this.calculateEstimatedTime()
      };
      
      this.setData({ deliveryInfo });
    } else {
      // 模拟配送信息
      this.setData({
        deliveryInfo: {
          type: 'delivery',
          name: '张三',
          phone: '138****8888',
          address: '北京市朝阳区建国路88号SOHO现代城1号楼1201室',
          estimatedTime: this.calculateEstimatedTime()
        }
      });
    }
  },

  /**
   * 计算预计送达时间
   */
  calculateEstimatedTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const month = tomorrow.getMonth() + 1;
    const day = tomorrow.getDate();
    
    return `${month}月${day}日 10:00-12:00`;
  },

  /**
   * 轮询查询支付结果
   */
  pollPayResult() {
    let pollCount = 0;
    const maxPollCount = 10;
    
    const poll = async () => {
      if (pollCount >= maxPollCount) {
        // 超过最大轮询次数，显示失败
        this.setData({ payStatus: 'fail', failMessage: '支付超时，请查询订单状态' });
        return;
      }
      
      try {
        // 调用云函数查询支付结果
        const { result } = await wx.cloud.callFunction({
          name: 'checkPayStatus',
          data: {
            orderId: this.data.orderId
          }
        });
        
        if (result.code === 0) {
          const { status } = result.data;
          
          if (status === 'paid') {
            // 支付成功
            this.setData({ payStatus: 'success' });
            this.setPayTime();
            this.loadDeliveryInfo();
            return;
          } else if (status === 'failed') {
            // 支付失败
            this.setData({ 
              payStatus: 'fail',
              failMessage: result.data.message || '支付失败'
            });
            return;
          }
        }
        
        // 继续轮询
        pollCount++;
        setTimeout(poll, 2000);
        
      } catch (error) {
        console.error('查询支付结果失败:', error);
        pollCount++;
        setTimeout(poll, 2000);
      }
    };
    
    poll();
  },

  /**
   * 复制订单号
   */
  copyOrderNo() {
    wx.setClipboardData({
      data: this.data.orderNo,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  /**
   * 查看订单
   */
  viewOrder() {
    wx.redirectTo({
      url: `/pages/order-detail/order-detail?id=${this.data.orderId}`
    });
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 重新支付
   */
  retryPay() {
    wx.redirectTo({
      url: `/pages/payment/payment?orderId=${this.data.orderId}&orderNo=${this.data.orderNo}&amount=${this.data.payAmount}`
    });
  }
});
