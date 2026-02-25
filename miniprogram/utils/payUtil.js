/**
 * 支付工具类
 * 提供微信支付相关功能
 */

/**
 * 发起微信支付
 * @param {Object} payParams - 支付参数
 * @returns {Promise} 支付结果
 */
function requestPayment(payParams) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      ...payParams,
      success: (res) => {
        resolve({
          success: true,
          data: res
        });
      },
      fail: (err) => {
        // 处理支付失败
        let message = '支付失败';
        
        if (err.errCode === 1000) {
          message = '参数错误';
        } else if (err.errCode === 1001) {
          message = '商户账号异常';
        } else if (err.errCode === 1002) {
          message = '用户取消支付';
        } else if (err.errCode === 1003) {
          message = '发送失败';
        } else if (err.errCode === 1004) {
          message = '授权失败';
        } else if (err.errCode === 1005) {
          message = '微信不支持';
        } else if (err.errCode === 1006) {
          message = '余额不足';
        } else if (err.errCode === 1007) {
          message = '支付失败，请重试';
        }
        
        reject({
          success: false,
          code: err.errCode,
          message: message,
          data: err
        });
      }
    });
  });
}

/**
 * 获取支付参数（调用云函数）
 * @param {Object} orderInfo - 订单信息
 */
async function getPayParams(orderInfo) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'pay',
      data: {
        orderId: orderInfo.orderId,
        orderNo: orderInfo.orderNo,
        amount: orderInfo.amount,
        description: orderInfo.description
      }
    });
    
    if (result.code !== 0) {
      throw new Error(result.message);
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取支付参数失败'
    };
  }
}

/**
 * 完整的支付流程
 * @param {Object} orderInfo - 订单信息
 */
async function doPayment(orderInfo) {
  try {
    // 1. 获取支付参数
    const payParamsResult = await getPayParams(orderInfo);
    
    if (!payParamsResult.success) {
      throw new Error(payParamsResult.message);
    }
    
    const payParams = payParamsResult.data;
    
    // 2. 调起微信支付
    const paymentResult = await requestPayment({
      appId: payParams.appId,
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign
    });
    
    return {
      success: true,
      data: paymentResult.data
    };
  } catch (error) {
    return {
      success: false,
      code: error.code,
      message: error.message || '支付失败'
    };
  }
}

/**
 * 查询支付状态
 * @param {string} orderId - 订单ID
 */
async function checkPayStatus(orderId) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'checkPayStatus',
      data: { orderId }
    });
    
    if (result.code !== 0) {
      throw new Error(result.message);
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '查询支付状态失败'
    };
  }
}

module.exports = {
  requestPayment,
  getPayParams,
  doPayment,
  checkPayStatus
};
