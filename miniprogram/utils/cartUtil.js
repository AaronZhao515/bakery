/**
 * 购物车工具类
 * 提供购物车的增删改查等操作
 */

const CART_STORAGE_KEY = 'cartData';

/**
 * 获取购物车数据
 */
function getCartData() {
  return wx.getStorageSync(CART_STORAGE_KEY) || [];
}

/**
 * 保存购物车数据
 */
function saveCartData(cartData) {
  wx.setStorageSync(CART_STORAGE_KEY, cartData);
}

/**
 * 添加商品到购物车
 * @param {Object} product - 商品信息
 * @param {number} quantity - 添加数量
 */
function addToCart(product, quantity = 1) {
  const cartData = getCartData();
  
  // 查找是否已存在该商品
  const existingIndex = cartData.findIndex(item => item._id === product._id);
  
  if (existingIndex >= 0) {
    // 已存在，更新数量
    const newQuantity = cartData[existingIndex].quantity + quantity;
    
    // 检查库存
    if (newQuantity > product.stock) {
      return {
        success: false,
        message: '超出库存限制'
      };
    }
    
    cartData[existingIndex].quantity = newQuantity;
  } else {
    // 不存在，添加新商品
    cartData.push({
      _id: product._id,
      name: product.name,
      spec: product.spec,
      price: product.price,
      quantity: quantity,
      stock: product.stock,
      imageUrl: product.imageUrl,
      selected: true
    });
  }
  
  saveCartData(cartData);
  
  return {
    success: true,
    message: '已添加到购物车',
    cartCount: getCartCount()
  };
}

/**
 * 从购物车移除商品
 * @param {string} productId - 商品ID
 */
function removeFromCart(productId) {
  const cartData = getCartData();
  const newCartData = cartData.filter(item => item._id !== productId);
  
  saveCartData(newCartData);
  
  return {
    success: true,
    cartCount: getCartCount()
  };
}

/**
 * 更新购物车商品数量
 * @param {string} productId - 商品ID
 * @param {number} quantity - 新数量
 */
function updateQuantity(productId, quantity) {
  const cartData = getCartData();
  const index = cartData.findIndex(item => item._id === productId);
  
  if (index < 0) {
    return {
      success: false,
      message: '商品不在购物车中'
    };
  }
  
  // 检查库存
  if (quantity > cartData[index].stock) {
    return {
      success: false,
      message: '超出库存限制'
    };
  }
  
  if (quantity <= 0) {
    // 数量为0，移除商品
    return removeFromCart(productId);
  }
  
  cartData[index].quantity = quantity;
  saveCartData(cartData);
  
  return {
    success: true
  };
}

/**
 * 更新商品选中状态
 * @param {string} productId - 商品ID
 * @param {boolean} selected - 选中状态
 */
function updateSelected(productId, selected) {
  const cartData = getCartData();
  const index = cartData.findIndex(item => item._id === productId);
  
  if (index >= 0) {
    cartData[index].selected = selected;
    saveCartData(cartData);
  }
  
  return {
    success: true
  };
}

/**
 * 获取购物车商品数量
 */
function getCartCount() {
  const cartData = getCartData();
  return cartData.reduce((total, item) => total + item.quantity, 0);
}

/**
 * 获取选中商品的总价
 */
function getSelectedTotal() {
  const cartData = getCartData();
  return cartData
    .filter(item => item.selected)
    .reduce((total, item) => total + parseFloat(item.price) * item.quantity, 0);
}

/**
 * 获取选中商品列表
 */
function getSelectedItems() {
  const cartData = getCartData();
  return cartData.filter(item => item.selected);
}

/**
 * 清空购物车
 */
function clearCart() {
  saveCartData([]);
  return {
    success: true
  };
}

/**
 * 全选/取消全选
 * @param {boolean} selected - 选中状态
 */
function selectAll(selected) {
  const cartData = getCartData();
  cartData.forEach(item => {
    item.selected = selected;
  });
  saveCartData(cartData);
  
  return {
    success: true
  };
}

module.exports = {
  getCartData,
  saveCartData,
  addToCart,
  removeFromCart,
  updateQuantity,
  updateSelected,
  getCartCount,
  getSelectedTotal,
  getSelectedItems,
  clearCart,
  selectAll
};
