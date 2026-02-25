/**
 * 管理员相关云函数
 * 功能：登录验证、权限管理
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;

  switch (action) {
    case 'login':
      return await login(event);
    case 'wxLogin':
      return await wxLogin(event);
    case 'getAdminInfo':
      return await getAdminInfo(event);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 账号密码登录
async function login(event) {
  const { account, password } = event;

  try {
    // 查询管理员账号
    const adminRes = await db.collection('admins')
      .where({
        account: account,
        password: password, // 实际项目中应该使用加密后的密码
        status: 'active'
      })
      .get();

    if (adminRes.data.length === 0) {
      return { code: -1, message: '账号或密码错误' };
    }

    const admin = adminRes.data[0];

    // 生成登录token
    const token = generateToken();

    // 更新最后登录时间
    await db.collection('admins').doc(admin._id).update({
      data: {
        lastLoginTime: db.serverDate(),
        lastLoginIp: context.CLIENTIP
      }
    });

    return {
      code: 0,
      message: '登录成功',
      data: {
        id: admin._id,
        account: admin.account,
        nickName: admin.nickName,
        avatarUrl: admin.avatarUrl,
        role: admin.role,
        token: token
      }
    };
  } catch (error) {
    console.error('登录失败:', error);
    return { code: -1, message: '登录失败' };
  }
}

// 微信登录
async function wxLogin(event) {
  const { code, encryptedData, iv } = event;

  try {
    // 获取微信用户信息
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    // 查询是否已绑定管理员
    const adminRes = await db.collection('admins')
      .where({
        openid: openid,
        status: 'active'
      })
      .get();

    if (adminRes.data.length === 0) {
      return { code: -1, message: '该微信账号未绑定管理员' };
    }

    const admin = adminRes.data[0];
    const token = generateToken();

    return {
      code: 0,
      message: '登录成功',
      data: {
        id: admin._id,
        account: admin.account,
        nickName: admin.nickName,
        avatarUrl: admin.avatarUrl,
        role: admin.role,
        token: token
      }
    };
  } catch (error) {
    console.error('微信登录失败:', error);
    return { code: -1, message: '登录失败' };
  }
}

// 获取管理员信息
async function getAdminInfo(event) {
  const { adminId } = event;

  try {
    const adminRes = await db.collection('admins').doc(adminId).get();
    
    if (!adminRes.data) {
      return { code: -1, message: '管理员不存在' };
    }

    return {
      code: 0,
      data: adminRes.data
    };
  } catch (error) {
    console.error('获取管理员信息失败:', error);
    return { code: -1, message: '获取失败' };
  }
}

// 生成token
function generateToken() {
  return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2);
}
