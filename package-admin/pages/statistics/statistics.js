/**
 * 数据统计页面
 * 功能：销售数据统计、趋势分析、商品排行、数据洞察
 * 所有数据从 CloudBase 实时拉取
 */
const app = getApp();

Page({
  data: {
    // 统计数据
    statistics: {
      today: { salesAmount: 0, orderCount: 0 },
      yesterday: { salesAmount: 0 },
      week: { salesAmount: 0, orderCount: 0 },
      month: { salesAmount: 0, orderCount: 0 },
      year: { salesAmount: 0, orderCount: 0 }
    },
    todayComparePercent: 0,

    // 趋势数据
    trendPeriod: 'week',
    trendData: [],
    trendStats: {
      maxAmount: 0,
      avgAmount: 0,
      totalOrders: 0
    },
    hasTrendData: false,

    // 时段分析
    timeSlots: [],
    hasTimeData: false,

    // 商品排行
    rankPeriod: 'today',
    productRanking: [],
    hasRankingData: false,

    // 数据洞察
    insights: {
      avgOrderAmount: '0.00',
      conversionRate: '0.0',
      peakHour: '--:--',
      repurchaseRate: '0.0'
    },

    isLoading: false,
    loadError: false
  },

  onLoad(options) {
    this.loadAllStatistics();
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
    this.loadAllStatistics().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载所有统计数据
  async loadAllStatistics() {
    this.setData({ isLoading: true, loadError: false });

    try {
      await Promise.all([
        this.loadSummaryStatistics(),
        this.loadTrendData(),
        this.loadTimeAnalysis(),
        this.loadProductRanking(),
        this.loadInsights()
      ]);
    } catch (error) {
      console.error('[统计] 加载数据失败:', error);
      this.setData({ loadError: true });
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载汇总统计数据
  async loadSummaryStatistics() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getStatistics' }
      });

      if (result.result.code === 0) {
        const stats = result.result.data;

        // 计算今日较昨日增长率
        const todayComparePercent = stats.yesterday.salesAmount > 0
          ? Math.round(((stats.today.salesAmount - stats.yesterday.salesAmount) / stats.yesterday.salesAmount) * 100)
          : 0;

        this.setData({
          statistics: stats,
          todayComparePercent
        });
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('[统计] 加载汇总数据失败:', error);
      // 保持默认值，不显示 mock 数据
      this.setData({
        statistics: {
          today: { salesAmount: 0, orderCount: 0 },
          yesterday: { salesAmount: 0 },
          week: { salesAmount: 0, orderCount: 0 },
          month: { salesAmount: 0, orderCount: 0 },
          year: { salesAmount: 0, orderCount: 0 }
        },
        todayComparePercent: 0
      });
    }
  },

  // 加载趋势数据
  async loadTrendData() {
    const { trendPeriod } = this.data;

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'getSalesTrend',
          period: trendPeriod
        }
      });

      if (result.result.code === 0) {
        const { list, stats } = result.result.data;

        if (list && list.length > 0) {
          // 计算柱状图高度百分比
          const maxValue = Math.max(...list.map(item => item.amount), 1);
          const trendData = list.map(item => ({
            ...item,
            percent: Math.round((item.amount / maxValue) * 100) || 0,
            color: item.amount >= maxValue * 0.8 ? '#8B6347' :
                   item.amount >= maxValue * 0.5 ? '#D4A574' : '#E8D5C4'
          }));

          this.setData({
            trendData,
            trendStats: stats,
            hasTrendData: true
          });
        } else {
          // 无数据
          this.setData({
            trendData: [],
            trendStats: { maxAmount: 0, avgAmount: 0, totalOrders: 0 },
            hasTrendData: false
          });
        }
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('[统计] 加载趋势数据失败:', error);
      this.setData({
        trendData: [],
        trendStats: { maxAmount: 0, avgAmount: 0, totalOrders: 0 },
        hasTrendData: false
      });
    }
  },

  // 加载时段分析
  async loadTimeAnalysis() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getTimeAnalysis' }
      });

      if (result.result.code === 0) {
        const timeSlots = result.result.data;

        if (timeSlots && timeSlots.length > 0 && timeSlots.some(s => s.amount > 0)) {
          // 计算百分比
          const maxAmount = Math.max(...timeSlots.map(item => item.amount), 1);
          const formattedSlots = timeSlots.map(item => ({
            ...item,
            percent: Math.round((item.amount / maxAmount) * 100) || 0
          }));

          this.setData({
            timeSlots: formattedSlots,
            hasTimeData: true
          });
        } else {
          this.setData({
            timeSlots: [],
            hasTimeData: false
          });
        }
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('[统计] 加载时段分析失败:', error);
      this.setData({
        timeSlots: [],
        hasTimeData: false
      });
    }
  },

  // 加载商品排行
  async loadProductRanking() {
    const { rankPeriod } = this.data;

    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'getProductRanking',
          period: rankPeriod,
          limit: 10
        }
      });

      if (result.result.code === 0) {
        const productRanking = result.result.data;

        if (productRanking && productRanking.length > 0) {
          const formattedRanking = productRanking.map(item => ({
            ...item,
            salesAmount: parseFloat(item.salesAmount || 0).toFixed(2)
          }));

          this.setData({
            productRanking: formattedRanking,
            hasRankingData: true
          });
        } else {
          this.setData({
            productRanking: [],
            hasRankingData: false
          });
        }
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('[统计] 加载商品排行失败:', error);
      this.setData({
        productRanking: [],
        hasRankingData: false
      });
    }
  },

  // 加载数据洞察
  async loadInsights() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getDataInsights' }
      });

      if (result.result.code === 0) {
        const insights = result.result.data;
        this.setData({
          insights: {
            avgOrderAmount: insights.avgOrderAmount || '0.00',
            conversionRate: insights.conversionRate || '0.0',
            peakHour: insights.peakHour || '--:--',
            repurchaseRate: insights.repurchaseRate || '0.0'
          }
        });
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('[统计] 加载数据洞察失败:', error);
      this.setData({
        insights: {
          avgOrderAmount: '0.00',
          conversionRate: '0.0',
          peakHour: '--:--',
          repurchaseRate: '0.0'
        }
      });
    }
  },

  // 切换趋势周期
  switchTrendPeriod(e) {
    const period = e.currentTarget.dataset.period;
    this.setData({ trendPeriod: period }, () => {
      this.loadTrendData();
    });
  },

  // 切换排行周期
  switchRankPeriod(e) {
    const period = e.currentTarget.dataset.period;
    this.setData({ rankPeriod: period }, () => {
      this.loadProductRanking();
    });
  },

  // 重试加载
  retryLoad() {
    this.loadAllStatistics();
  }
});
