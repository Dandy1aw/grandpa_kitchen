const { dishes, familyMembers, tasteOptions } = require('../../utils/menuData');
const { getCustomDishesFromCart, mergeDishCatalog } = require('../../utils/customMenu');
const {
  compactCartItems,
  getCartSummary,
  parseOrderPayload,
  restoreCartItems,
  serializeOrderPayload,
} = require('../../utils/orderUtils');

Page({
  data: {
    items: [],
    summary: {
      totalCount: 0,
    },
    familyMembers,
    tasteOptions,
    diner: familyMembers[0],
    taste: tasteOptions[0],
    note: '',
    avatar: '',
    isSubmitting: false,
    hasOrder: false,
  },

  onLoad(options) {
    const payload = parseOrderPayload(options.payload);
    const catalog = mergeDishCatalog(dishes, payload && payload.customDishes);
    const items = restoreCartItems(payload && payload.items, catalog);

    this.setData({
      items,
      summary: getCartSummary(items),
      avatar: (payload && payload.avatar) || '',
      hasOrder: items.length > 0,
    });
  },

  selectDiner(event) {
    this.setData({
      diner: event.currentTarget.dataset.value,
    });
  },

  selectTaste(event) {
    this.setData({
      taste: event.currentTarget.dataset.value,
    });
  },

  onNoteInput(event) {
    this.setData({
      note: event.detail.value,
    });
  },

  submitOrder() {
    if (!this.data.hasOrder || this.data.isSubmitting) {
      return;
    }

    this.setData({ isSubmitting: true });

    const payload = serializeOrderPayload({
      items: compactCartItems(this.data.items),
      customDishes: getCustomDishesFromCart(this.data.items),
      diner: this.data.diner,
      taste: this.data.taste,
      note: this.data.note.trim(),
      avatar: this.data.avatar,
    });

    wx.navigateTo({
      url: `/pages/success/success?payload=${payload}`,
      complete: () => {
        this.setData({ isSubmitting: false });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: '爷爷的厨房',
      path: '/pages/index/index',
      imageUrl: '/assets/images/grandpa-q-cooking.jpg',
    };
  },

  goHome() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' });
      },
    });
  },
});
