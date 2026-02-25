/**
 * 营销相关云函数
 * 功能：轮播图管理、优惠券管理、会员等级
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;

  switch (action) {
    case 'getBanners':
      return await getBanners();
    case 'createBanner':
      return await createBanner(event);
    case 'updateBanner':
      return await updateBanner(event);
    case 'deleteBanner':
      return await deleteBanner(event);
    case 'getCoupons':
      return await getCoupons();
    case 'createCoupon':
      return await createCoupon(event);
    case 'updateCoupon':
      return await updateCoupon(event);
    case 'deleteCoupon':
      return await deleteCoupon(event);
    case 'getMemberLevels':
      return await getMemberLevels();
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取轮播图列表
async function getBanners() {
  try {
    const res = await db.collection('banners')
      .where({ status: 'active' })
      .orderBy('sort', 'asc')
      .get();

    return {
      code: 0,
      data: res.data.map(item => ({
        id: item._id,
        image: item.image,
        linkType: item.linkType,
        linkTypeName: item.linkTypeName,
        linkValue: item.linkValue,
        sort: item.sort
      }))
    };
  } catch (error) {
    console.error('获取轮播图失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 创建轮播图
async function createBanner(event) {
  const { data } = event;

  try {
    // 获取当前最大排序
    const maxSortRes = await db.collection('banners')
      .orderBy('sort', 'desc')
      .limit(1)
      .get();
    
    const maxSort = maxSortRes.data.length > 0 ? maxSortRes.data[0].sort : 0;

    const res = await db.collection('banners').add({
      data: {
        ...data,
        sort: maxSort + 1,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '创建成功',
      data: { id: res._id }
    };
  } catch (error) {
    console.error('创建轮播图失败:', error);
    return { code: -1, message: '创建失败' };
  }
}

// 更新轮播图
async function updateBanner(event) {
  const { id, data } = event;

  try {
    await db.collection('banners').doc(id).update({
      data: {
        ...data,
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '更新成功'
    };
  } catch (error) {
    console.error('更新轮播图失败:', error);
    return { code: -1, message: '更新失败' };
  }
}

// 删除轮播图
async function deleteBanner(event) {
  const { id } = event;

  try {
    await db.collection('banners').doc(id).remove();

    return {
      code: 0,
      message: '删除成功'
    };
  } catch (error) {
    console.error('删除轮播图失败:', error);
    return { code: -1, message: '删除失败' };
  }
}

// 获取优惠券列表
async function getCoupons() {
  try {
    const res = await db.collection('coupons')
      .orderBy('createTime', 'desc')
      .get();

    const now = new Date();

    return {
      code: 0,
      data: res.data.map(item => {
        const endTime = new Date(item.endTime);
        const isExpired = endTime < now;
        
        return {
          id: item._id,
          name: item.name,
          type: item.type,
          value: item.value,
          minAmount: item.minAmount,
          totalCount: item.totalCount,
          receivedCount: item.receivedCount || 0,
          usedCount: item.usedCount || 0,
          startTime: item.startTime,
          endTime: item.endTime,
          status: isExpired ? 'expired' : item.status,
          statusText: isExpired ? '已过期' : item.status === 'active' ? '进行中' : '已暂停'
        };
      })
    };
  } catch (error) {
    console.error('获取优惠券失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 创建优惠券
async function createCoupon(event) {
  const { data } = event;

  try {
    const res = await db.collection('coupons').add({
      data: {
        ...data,
        receivedCount: 0,
        usedCount: 0,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '创建成功',
      data: { id: res._id }
    };
  } catch (error) {
    console.error('创建优惠券失败:', error);
    return { code: -1, message: '创建失败' };
  }
}

// 更新优惠券
async function updateCoupon(event) {
  const { id, data } = event;

  try {
    await db.collection('coupons').doc(id).update({
      data: {
        ...data,
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '更新成功'
    };
  } catch (error) {
    console.error('更新优惠券失败:', error);
    return { code: -1, message: '更新失败' };
  }
}

// 删除优惠券
async function deleteCoupon(event) {
  const { id } = event;

  try {
    await db.collection('coupons').doc(id).remove();

    return {
      code: 0,
      message: '删除成功'
    };
  } catch (error) {
    console.error('删除优惠券失败:', error);
    return { code: -1, message: '删除失败' };
  }
}

// 获取会员等级
async function getMemberLevels() {
  try {
    const res = await db.collection('member_levels')
      .orderBy('level', 'asc')
      .get();

    return {
      code: 0,
      data: res.data.map(item => ({
        id: item._id,
        name: item.name,
        level: item.level,
        minGrowth: item.minGrowth,
        maxGrowth: item.maxGrowth,
        discount: item.discount,
        color: item.color,
        privileges: item.privileges
      }))
    };
  } catch (error) {
    console.error('获取会员等级失败:', error);
    return { code: -1, message: '获取失败' };
  }
}
