const { dishes } = require('../../utils/menuData');
const { mergeDishCatalog } = require('../../utils/customMenu');
const { getCartSummary, parseOrderPayload, restoreCartItems } = require('../../utils/orderUtils');
const { saveOrder } = require('../../utils/storage');

function formatDishList(items) {
  return items.map((item) => `${item.dish.name} x${item.quantity}`).join('、');
}

Page({
  data: {
    items: [],
    summary: {
      totalCount: 0,
    },
    diner: '',
    taste: '',
    note: '',
    dishText: '',
    hasOrder: false,
  },

  onLoad(options) {
    const payload = parseOrderPayload(options.payload);
    const catalog = mergeDishCatalog(dishes, payload && payload.customDishes);
    const items = restoreCartItems(payload && payload.items, catalog);

    this.setData({
      items,
      summary: getCartSummary(items),
      diner: payload && payload.diner ? payload.diner : '家人',
      taste: payload && payload.taste ? payload.taste : '照常',
      note: payload && payload.note ? payload.note : '不用留言，爷爷懂你。',
      dishText: items.length ? formatDishList(items) : '还没有点菜',
      hasOrder: items.length > 0,
    });

    if (items.length > 0 && payload) {
      const orderItems = items.map((it) => ({
        id: it.dish.id,
        name: it.dish.name,
        quantity: it.quantity,
      }));
      saveOrder({
        diner: payload.diner,
        taste: payload.taste,
        note: payload.note || '',
        avatar: payload.avatar || '',
        items: orderItems,
      }).catch(() => {});

      const dishText = orderItems.map((it) => `${it.name}x${it.quantity}`).join('、');
      wx.cloud.callFunction({
        name: 'notify',
        data: {
          diner: payload.diner || '家人',
          dishText,
          taste: payload.taste || '',
          note: payload.note || '',
        },
      }).catch(() => {});
    }
  },

  onShareAppMessage() {
    return {
      title: '爷爷的厨房',
      path: '/pages/index/index',
      imageUrl: '/assets/images/grandpa-q-cooking.jpg',
    };
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },
});
