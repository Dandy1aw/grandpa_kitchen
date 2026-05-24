const { getHistoryOrders } = require('../../utils/storage');

const PAGE_SIZE = 20;

function _formatDate(dateStr) {
  const parts = dateStr.split('-');
  return `${parts[1]}月${parts[2]}日`;
}

function _weekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(y, m - 1, d).getDay()];
}

Page({
  data: {
    groups: [],
    loading: false,
    hasMore: true,
    skip: 0,
  },

  onLoad() {
    this._load();
  },

  async _load() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const orders = await getHistoryOrders({ skip: this.data.skip, limit: PAGE_SIZE });
      const grouped = this._group(orders);
      const mergedGroups = this._mergeGroups(this.data.groups, grouped);
      this.setData({
        groups: mergedGroups,
        skip: this.data.skip + orders.length,
        hasMore: orders.length === PAGE_SIZE,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  _group(orders) {
    const map = {};
    orders.forEach((o) => {
      if (!o.date) return;
      if (!map[o.date]) {
        map[o.date] = {
          dateStr: o.date,
          dateLabel: _formatDate(o.date),
          weekday: _weekday(o.date),
          orders: [],
        };
      }
      map[o.date].orders.push(o);
    });
    return Object.values(map).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  },

  _mergeGroups(existing, incoming) {
    const map = {};
    existing.forEach((g) => { map[g.dateStr] = g; });
    incoming.forEach((g) => {
      if (map[g.dateStr]) {
        map[g.dateStr].orders.push(...g.orders);
      } else {
        map[g.dateStr] = g;
      }
    });
    return Object.values(map).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  },

  onReachBottom() {
    this._load();
  },
});
