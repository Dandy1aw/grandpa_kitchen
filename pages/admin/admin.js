const {
  getTodayOrders,
  getDoneDishes,
  getUnreadOrderSummary,
  markDishDone,
  markAllDishDone,
  markTodayOrdersSeen,
  getTodayDishReviews,
} = require('../../utils/storage');

const NOTIFY_TEMPLATE_ID = 'ur3RRVfn4M-jMsVTP8wtEbzWzpzsW4xDpnKOcO8_g40';

function _dateText() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function _weekday() {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()];
}

Page({
  data: {
    activeTab: 'byDish',
    byDish: [],
    byPerson: [],
    stats: { totalCount: 0, orderCount: 0, dishCount: 0, pendingCount: 0 },
    unread: { hasUnread: false, count: 0, latestText: '' },
    dateText: '',
    weekday: '',
    isEmpty: true,
  },

  onShow() {
    this._load();
  },

  async _load() {
    const today = new Date();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${today.getFullYear()}-${m}-${d}`;

    const [orders, doneDishes, unread, reviewDocs] = await Promise.all([
      getTodayOrders(),
      getDoneDishes(),
      getUnreadOrderSummary(),
      getTodayDishReviews(dateStr),
    ]);

    const dishReviewsMap = {};
    reviewDocs.forEach((doc) => {
      const existing = dishReviewsMap[doc.dishName] || [];
      dishReviewsMap[doc.dishName] = [...existing, ...(doc.reviews || [])];
    });

    const byDish = this._groupByDish(orders, doneDishes).map((dish) => ({
      ...dish,
      reviews: dishReviewsMap[dish.name] || [],
    }));
    const byPerson = orders.map((o) => ({
      ...o,
      avatarChar: o.diner ? o.diner.charAt(0) : '？',
    }));

    const totalCount = orders.reduce(
      (s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0),
      0,
    );
    const pendingCount = byDish.filter((d) => !d.done).length;

    this.setData({
      byDish,
      byPerson,
      stats: {
        totalCount,
        orderCount: orders.length,
        dishCount: byDish.length,
        pendingCount,
      },
      unread,
      dateText: _dateText(),
      weekday: _weekday(),
      isEmpty: orders.length === 0,
    });
  },

  _groupByDish(orders, doneDishes) {
    const map = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!map[item.name]) {
          map[item.name] = {
            name: item.name,
            totalCount: 0,
            orderDetails: [],
            done: Boolean(doneDishes[item.name]),
          };
        }
        map[item.name].totalCount += item.quantity;
        map[item.name].orderDetails.push({
          diner: order.diner,
          quantity: item.quantity,
          taste: order.taste,
          note: order.note,
        });
      });
    });

    return Object.values(map).sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return b.totalCount - a.totalCount;
    });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  async markDishDone(e) {
    const name = e.currentTarget.dataset.name;
    await markDishDone(name);
    await this._load();
    wx.showToast({ title: `${name} 完成！`, icon: 'success', duration: 1200 });
  },

  markAllDone() {
    const names = this.data.byDish.map((d) => d.name);
    if (names.length === 0) return;
    wx.showModal({
      title: '全部标记完成？',
      content: '把今天所有菜品标记为已完成',
      confirmText: '完成啦',
      cancelText: '再等等',
      success: async (res) => {
        if (res.confirm) {
          await markAllDishDone(names);
          await this._load();
          wx.showToast({ title: '今日菜单全部完成！', icon: 'success' });
        }
      },
    });
  },

  async acknowledgeUnreadOrders() {
    markTodayOrdersSeen();
    await this._load();
    wx.showToast({ title: '提醒已收下', icon: 'success', duration: 1200 });
  },

  onShareAppMessage() {
    return {
      title: '爷爷的厨房',
      path: '/pages/index/index',
      imageUrl: '/assets/images/grandpa-q-cooking.jpg',
    };
  },

  subscribeNotification() {
    wx.requestSubscribeMessage({
      tmplIds: [NOTIFY_TEMPLATE_ID],
      success(res) {
        if (res[NOTIFY_TEMPLATE_ID] === 'accept') {
          wx.showToast({ title: '通知已开启', icon: 'success' });
        }
      },
      fail() {
        wx.showToast({ title: '开启失败，请重试', icon: 'none' });
      },
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
