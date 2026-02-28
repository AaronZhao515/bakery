/**
 * 积分明细页面
 * 严格按照 Figma 设计稿实现
 */

const app = getApp();
const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

// 类别图标配置（与 Figma 设计一致）
const CATEGORY_META = {
  order: { icon: '🛍️', color: '#9B7355', bgColor: '#F5EDD8' },
  bonus: { icon: '🎁', color: '#D4A96A', bgColor: '#FFF6E8' },
  redeem: { icon: '🎫', color: '#B07AB0', bgColor: '#F8EEF8' },
  event: { icon: '⭐', color: '#C8883A', bgColor: '#FFF3E0' },
  signin: { icon: '✓', color: '#7A9E7E', bgColor: '#EEF6EF' },
  charge: { icon: '💎', color: '#D4A96A', bgColor: '#FFF8E1' },  // 充值类型
  default: { icon: '📋', color: '#9B7355', bgColor: '#F5EDD8' }
};

// 模拟数据（当接口不可用时使用）
const MOCK_DATA = [
  { _id: '1', label: '下单获得积分', desc: '订单 BD20260225', points: 50, type: 'earn', category: 'order', createTime: '2026-02-25T14:32:00' },
  { _id: '2', label: '新人注册礼', desc: '首次登录奖励', points: 100, type: 'earn', category: 'bonus', createTime: '2026-02-25T10:15:00' },
  { _id: '3', label: '下单获得积分', desc: '订单 BD20260218', points: 30, type: 'earn', category: 'order', createTime: '2026-02-18T16:48:00' },
  { _id: '4', label: '兑换优惠券', desc: '满减券 ¥15', points: -200, type: 'spend', category: 'redeem', createTime: '2026-02-15T11:20:00' },
  { _id: '5', label: '积分双倍卡奖励', desc: '活动奖励 × 2 倍', points: 200, type: 'earn', category: 'event', createTime: '2026-02-12T09:00:00' },
  { _id: '6', label: '下单获得积分', desc: '订单 BD20260210', points: 80, type: 'earn', category: 'order', createTime: '2026-02-10T13:05:00' },
  { _id: '7', label: '兑换优惠券', desc: '免运费券', points: -100, type: 'spend', category: 'redeem', createTime: '2026-02-05T17:33:00' },
  { _id: '8', label: '会员升级奖励', desc: '升级至黄金会员', points: 150, type: 'earn', category: 'bonus', createTime: '2026-01-28T08:12:00' },
  { _id: '9', label: '连续签到奖励', desc: '连续签到 7 天', points: 20, type: 'earn', category: 'signin', createTime: '2026-01-25T08:01:00' },
  { _id: '10', label: '下单获得积分', desc: '订单 BD20260120', points: 50, type: 'earn', category: 'order', createTime: '2026-01-20T12:47:00' },
  { _id: '11', label: '积分抵现', desc: '50积分抵¥1', points: -50, type: 'spend', category: 'redeem', createTime: '2026-01-18T10:22:00' },
  { _id: '12', label: '春节活动积分', desc: '限时活动奖励', points: 300, type: 'earn', category: 'event', createTime: '2026-01-15T00:00:00' },
];

Page({
  data: {
    // 当前用户积分
    userPoints: 1280,

    // 本月统计
    monthEarned: 0,
    monthSpent: 0,

    // 当前选中的标签: all全部, earn获取, spend消费
    activeTab: 'all',

    // 按日期分组的列表
    groupedList: [],

    // 加载状态
    isLoading: true,

    // 分页
    page: 1,
    pageSize: 20,
    hasMore: true,

    // 今天的日期
    today: '2026-02-25',
    yesterday: '2026-02-24'
  },

  onLoad(options) {
    console.log('[积分明细] 页面加载', options);

    // 检查登录状态
    const isLogin = auth.isLogin();
    if (!isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再查看积分明细',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/user' });
          } else {
            wx.navigateBack();
          }
        }
      });
      return;
    }

    // 获取传入的积分
    if (options.points) {
      this.setData({ userPoints: parseInt(options.points) || 1280 });
    }

    // 加载积分明细
    this.loadPointsHistory();
  },

  onShow() {
    console.log('[积分明细] 页面显示');
    if (auth.isLogin()) {
      this.loadUserPoints();
    }
  },

  /**
   * 加载用户当前积分
   */
  async loadUserPoints() {
    try {
      const result = await api.user.getUserInfo();
      if (result && result.success && result.data) {
        this.setData({
          userPoints: result.data.points || 0
        });
      }
    } catch (error) {
      console.error('[积分明细] 加载用户积分失败:', error);
    }
  },

  /**
   * 加载积分明细
   */
  async loadPointsHistory() {
    this.setData({ isLoading: true });

    try {
      const { activeTab, page, pageSize } = this.data;

      // 构建查询参数
      const params = {
        page,
        pageSize
      };

      // 根据标签筛选
      if (activeTab !== 'all') {
        params.type = activeTab;
      }

      // 调用云函数获取积分明细
      const result = await api.points.getList(params);
      console.log('[积分明细] 加载结果:', result);

      if (result && result.success && result.data) {
        const list = result.data.list || [];
        this.processData(list);
      } else {
        // 使用模拟数据
        this.processData(MOCK_DATA);
      }
    } catch (error) {
      console.error('[积分明细] 加载失败:', error);
      this.processData(MOCK_DATA);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 处理数据：格式化并分组
   */
  processData(list) {
    // 格式化每条记录
    const formattedList = list.map(item => {
      const meta = CATEGORY_META[item.category] || CATEGORY_META.default;
      const dateObj = new Date(item.createTime || item.date);
      const date = this.formatDate(dateObj);
      const time = this.formatTime(dateObj);

      // 优先使用 desc 字段（如云函数返回的订单号），否则使用 subtitle
      const subtitle = item.desc || item.subtitle || item.reason || '';

      // 处理 label：优先使用 label，否则根据类型生成
      const label = item.label || (item.type === 'charge' ? '积分充值' : '积分变动');

      // 处理类型：charge(充值) 视为 earn(获取)
      const displayType = item.type === 'charge' ? 'earn' : item.type;

      return {
        ...item,
        label: label,
        date: date,
        time: time,
        subtitle: subtitle,
        icon: meta.icon,
        iconColor: meta.color,
        bgColor: meta.bgColor,
        type: displayType,  // 使用处理后的类型
        points: Math.abs(item.points)
      };
    });

    // 按日期分组
    const grouped = this.groupByDate(formattedList);

    // 计算本月统计
    this.calculateMonthStats(formattedList);

    this.setData({
      groupedList: grouped,
      hasMore: list.length === this.data.pageSize
    });
  },

  /**
   * 按日期分组
   */
  groupByDate(list) {
    const map = new Map();

    list.forEach(item => {
      if (!map.has(item.date)) {
        map.set(item.date, []);
      }
      map.get(item.date).push(item);
    });

    return Array.from(map.entries()).map(([date, items]) => {
      // 计算当天小计 - charge(充值) 也视为 earn(获取)
      const earnTotal = items.filter(t => t.type === 'earn' || t.type === 'charge').reduce((s, t) => s + t.points, 0);
      const spendTotal = items.filter(t => t.type === 'spend').reduce((s, t) => s + t.points, 0);

      let subtotal = '';
      if (earnTotal > 0) subtotal += `+${earnTotal}`;
      if (spendTotal > 0) {
        if (subtotal) subtotal += '  ';
        subtotal += `−${spendTotal}`;
      }

      // 计算日期标签
      const dateLabel = this.getDateLabel(date);

      return { date, dateLabel, items, subtotal };
    });
  },

  /**
   * 获取日期标签（今天/昨天/月日）
   */
  getDateLabel(dateStr) {
    const { today, yesterday } = this.data;

    if (dateStr === today) return '今天';
    if (dateStr === yesterday) return '昨天';

    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}月${parseInt(d)}日`;
  },

  /**
   * 计算本月统计
   */
  calculateMonthStats(list) {
    const currentMonth = '2026-02';

    // charge(充值) 也视为 earn(获取)
    const monthEarned = list
      .filter(t => (t.type === 'earn' || t.type === 'charge') && t.date.startsWith(currentMonth))
      .reduce((s, t) => s + t.points, 0);

    const monthSpent = list
      .filter(t => t.type === 'spend' && t.date.startsWith(currentMonth))
      .reduce((s, t) => s + t.points, 0);

    this.setData({ monthEarned, monthSpent });
  },

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 格式化时间为 HH:mm
   */
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * 切换标签
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;

    this.setData({
      activeTab: tab,
      page: 1,
      groupedList: []
    }, () => {
      this.loadPointsHistory();
    });
  },

  /**
   * 返回上一页
   */
  onBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/user/user' });
      }
    });
  },

  /**
   * 跳转到预定页面
   */
  goToExchange() {
    wx.switchTab({
      url: '/pages/reserve/reserve'
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({ page: 1 });
    this.loadPointsHistory().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 上拉加载更多
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({ page: this.data.page + 1 });
      this.loadPointsHistory();
    }
  }
});
