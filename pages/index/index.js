const { categories, dishes: defaultDishes } = require('../../utils/menuData');
const {
  buildCustomDish,
  getCustomDishesFromCart,
  mergeSharedCustomDishes,
  mergeDishCatalog,
  normalizeCustomDishes,
  parseSharedMenuPayload,
  serializeSharedMenuPayload,
  loadCustomDishesFromCloud,
  saveCustomDishToCloud,
  saveCustomDishesToCloud,
  deleteCustomDishFromCloud,
  updateCustomDishImageInCloud,
  getDishOverrides,
  addDeletedBuiltinDish,
  updateBuiltinDishImage,
} = require('../../utils/customMenu');
const {
  addDishToCart,
  compactCartItems,
  decrementDishInCart,
  getCartSummary,
  serializeOrderPayload,
} = require('../../utils/orderUtils');
const { getUnreadOrderSummary, getMoments } = require('../../utils/storage');

function _formatMomentTime(ts) {
  const d = new Date(Number(ts));
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}月${day}日 ${h}:${min}`;
}

const DEFAULT_DISH_IMAGE = '/assets/images/dish-default.jpg';
const NOTIFY_TEMPLATE_ID = 'ur3RRVfn4M-jMsVTP8wtEbzWzpzsW4xDpnKOcO8_g40';
const IDENTITY_KEY = 'grandpa_identity';

function decorateDishes(list, cart) {
  return list.map((dish) => {
    const cartItem = cart.find((item) => item.dish.id === dish.id);
    return {
      ...dish,
      quantity: cartItem ? cartItem.quantity : 0,
    };
  });
}

function createEmptyCustomDishForm() {
  return {
    name: '',
    category: 'hot',
    desc: '',
    tag: '',
    image: '',
  };
}

const categoryOptions = categories.filter((category) => category.id !== 'all');

const tagOptions = ['爷爷拿手', '今日推荐', '暖胃', '软乎乎', '清爽', '家常味', '治愈'];

Page({
  data: {
    categories,
    categoryOptions,
    tagOptions,
    activeCategory: 'all',
    catalog: defaultDishes,
    customDishes: [],
    dishes: decorateDishes(defaultDishes, []),
    recommendedDish: defaultDishes.find((dish) => dish.recommended),
    cart: [],
    summary: {
      totalCount: 0,
    },
    activePanel: 'menu',
    isCustomDishFormOpen: false,
    customDishForm: createEmptyCustomDishForm(),
    customDishCategoryIndex: 0,
    unread: { hasUnread: false, count: 0, latestText: '' },
    adminBadgeText: '',
    dishOverrides: { deletedIds: [], imageOverrides: {} },
    showIdentityModal: false,
    identityStep: 1,
    pendingRole: null,
    pendingName: '',
    avatarPreview: null,
    identity: null,
    recentMoments: [],
    momentsCurrent: 0,
  },

  async onLoad(options) {
    this._checkIdentity();
    const customDishes = await this.loadCustomDishes();
    this.importSharedMenu(options && options.sharedMenu, customDishes);
    this.refreshUnreadReminder();
  },

  async onShow() {
    await this.loadCustomDishes();
    this.refreshUnreadReminder();
    void this._loadRecentMoments();
  },

  selectCategory(event) {
    const activeCategory = event.currentTarget.dataset.id;
    this.setData({
      activeCategory,
      dishes: decorateDishes(this.getVisibleDishes(activeCategory), this.data.cart),
    });
  },

  addDish(event) {
    const dish = this.findDish(event.currentTarget.dataset.id);
    if (!dish) {
      return;
    }

    const cart = addDishToCart(this.data.cart, dish);
    this.syncCart(cart);
  },

  decrementDish(event) {
    const cart = decrementDishInCart(this.data.cart, event.currentTarget.dataset.id);
    this.syncCart(cart);
  },

  goConfirm() {
    if (!this.data.summary.totalCount) {
      return;
    }

    const identity = wx.getStorageSync(IDENTITY_KEY) || {};
    const payload = serializeOrderPayload({
      items: compactCartItems(this.data.cart),
      customDishes: getCustomDishesFromCart(this.data.cart),
      avatar: identity.avatar || '',
    });

    wx.navigateTo({
      url: `/pages/order/order?payload=${payload}`,
    });
  },

  switchPanel(event) {
    this.setData({
      activePanel: event.currentTarget.dataset.panel,
    });
  },

  openCustomDishForm() {
    this.setData({
      activePanel: 'menu',
      isCustomDishFormOpen: true,
    });
  },

  closeCustomDishForm() {
    this.setData({
      isCustomDishFormOpen: false,
    });
  },

  onCustomDishInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }

    this.setData({
      [`customDishForm.${field}`]: event.detail.value,
    });
  },

  selectTag(event) {
    const tag = event.currentTarget.dataset.tag;
    const current = this.data.customDishForm.tag;
    this.setData({
      'customDishForm.tag': current === tag ? '' : tag,
    });
  },

  onCustomDishCategoryChange(event) {
    const index = Number(event.detail.value);
    const category = this.data.categoryOptions[index];
    if (!category) {
      return;
    }

    this.setData({
      customDishCategoryIndex: index,
      'customDishForm.category': category.id,
    });
  },

  chooseDishImage() {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0];
          this.persistDishImage(file && file.tempFilePath);
        },
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.persistDishImage(res.tempFilePaths && res.tempFilePaths[0]);
      },
    });
  },

  persistDishImage(tempFilePath) {
    if (!tempFilePath) {
      return;
    }

    wx.saveFile({
      tempFilePath,
      success: (res) => {
        this.setData({
          'customDishForm.image': res.savedFilePath,
        });
      },
      fail: () => {
        this.setData({
          'customDishForm.image': tempFilePath,
        });
      },
    });
  },

  async saveCustomDish() {
    const dish = buildCustomDish(this.data.customDishForm);
    if (!dish) {
      wx.showToast({ title: '先写菜名', icon: 'none' });
      return;
    }

    await saveCustomDishToCloud(dish);
    const customDishes = await loadCustomDishesFromCloud();

    this.setData({
      isCustomDishFormOpen: false,
      customDishForm: createEmptyCustomDishForm(),
      customDishCategoryIndex: 0,
      activeCategory: 'all',
    });
    this.refreshCatalog(customDishes, this.data.cart, 'all');
    wx.showToast({ title: '已加到菜单', icon: 'success' });
  },

  getVisibleDishes(categoryId, catalog) {
    const menu = catalog || this.data.catalog;
    if (categoryId === 'all') {
      return menu;
    }

    return menu.filter((dish) => dish.category === categoryId);
  },

  findDish(dishId) {
    return this.data.catalog.find((dish) => dish.id === dishId);
  },

  syncCart(cart) {
    this.setData({
      cart,
      summary: getCartSummary(cart),
      dishes: decorateDishes(this.getVisibleDishes(this.data.activeCategory), cart),
    });
  },

  async loadCustomDishes() {
    const [customDishes, overrides] = await Promise.all([
      loadCustomDishesFromCloud(),
      getDishOverrides(),
    ]);
    this.setData({ dishOverrides: overrides });
    this.refreshCatalog(customDishes, this.data.cart, this.data.activeCategory, overrides);
    return customDishes;
  },

  refreshCatalog(customDishes, cart, activeCategory, overrides) {
    const ov = overrides || this.data.dishOverrides;
    const deletedIds = new Set(ov.deletedIds || []);
    const imageOverrides = ov.imageOverrides || {};
    const filteredDefaults = defaultDishes
      .filter((d) => !deletedIds.has(d.id))
      .map((d) => (imageOverrides[d.id] ? { ...d, image: imageOverrides[d.id] } : d));
    const catalog = mergeDishCatalog(filteredDefaults, customDishes);
    this.setData({
      catalog,
      customDishes,
      recommendedDish: catalog.find((dish) => dish.recommended),
      dishes: decorateDishes(this.getVisibleDishes(activeCategory, catalog), cart),
    });
  },

  async refreshUnreadReminder() {
    const unread = await getUnreadOrderSummary();
    this.setData({
      unread,
      adminBadgeText: getAdminBadgeText(unread.count),
    });
  },

  async importSharedMenu(sharedMenu, currentCustomDishes) {
    const sharedDishes = parseSharedMenuPayload(sharedMenu);
    if (!sharedDishes.length) {
      return;
    }

    const result = mergeSharedCustomDishes(
      currentCustomDishes || this.data.customDishes,
      sharedDishes,
    );

    if (!result.importedCount) {
      wx.showToast({ title: '菜单已在本地', icon: 'none' });
      return;
    }

    await saveCustomDishesToCloud(result.newDishes);
    this.setData({ activeCategory: 'all' });
    this.refreshCatalog(result.dishes, this.data.cart, 'all');
    wx.showToast({ title: `已导入${result.importedCount}道菜`, icon: 'success' });
  },

  previewSelectedDishImage(event) {
    const current = event
      && event.currentTarget
      && event.currentTarget.dataset
      && event.currentTarget.dataset.src;

    if (!current) {
      return;
    }

    const urls = this.data.cart.map((item) => (
      (item && item.dish && item.dish.image) || DEFAULT_DISH_IMAGE
    ));

    wx.previewImage({
      current,
      urls: urls.length ? urls : [current],
    });
  },

  onShareAppMessage(options) {
    const shareType = options
      && options.target
      && options.target.dataset
      && options.target.dataset.shareType;

    if (shareType === 'customMenu' && this.data.customDishes.length) {
      return {
        title: `爷爷分享了${this.data.customDishes.length}道家里菜单`,
        path: `/pages/index/index?sharedMenu=${serializeSharedMenuPayload(this.data.customDishes)}`,
        imageUrl: '/assets/images/grandpa-q-cooking.jpg',
      };
    }

    return {
      title: '爷爷的厨房',
      path: '/pages/index/index',
      imageUrl: '/assets/images/grandpa-q-cooking.jpg',
    };
  },

  deleteDish(event) {
    const { id, name, custom } = event.currentTarget.dataset;
    wx.showModal({
      title: '删除这道菜？',
      content: `「${name}」将从菜单中移除`,
      confirmText: '删除',
      cancelText: '再想想',
      confirmColor: '#e05a3a',
      success: async (res) => {
        if (!res.confirm) return;
        if (custom === true || custom === 'true') {
          await deleteCustomDishFromCloud(id);
        } else {
          await addDeletedBuiltinDish(id);
        }
        await this.loadCustomDishes();
        wx.showToast({ title: '已删除', icon: 'success' });
      },
    });
  },

  editDishImage(event) {
    const { id, custom } = event.currentTarget.dataset;
    const choose = wx.chooseMedia
      ? (cb) => wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: (r) => cb(r.tempFiles && r.tempFiles[0] && r.tempFiles[0].tempFilePath) })
      : (cb) => wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], success: (r) => cb(r.tempFilePaths && r.tempFilePaths[0]) });

    choose(async (tempFilePath) => {
      if (!tempFilePath) return;
      wx.showLoading({ title: '上传中...' });
      try {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `dish-images/${id}-${Date.now()}.jpg`,
          filePath: tempFilePath,
        });
        const fileID = uploadRes.fileID;
        if (custom === true || custom === 'true') {
          await updateCustomDishImageInCloud(id, fileID);
        } else {
          await updateBuiltinDishImage(id, fileID);
        }
        await this.loadCustomDishes();
        wx.showToast({ title: '封面已更新', icon: 'success' });
      } catch (e) {
        wx.showToast({ title: '上传失败', icon: 'none' });
      } finally {
        wx.hideLoading();
      }
    });
  },

  previewDishImage(event) {
    const src = event.currentTarget.dataset.src;
    if (!src) return;
    wx.previewImage({ current: src, urls: [src] });
  },

  _checkIdentity() {
    const stored = wx.getStorageSync(IDENTITY_KEY);
    if (stored && stored.role) {
      if (!stored.name) {
        stored.name = stored.role === 'grandpa' ? '爷爷' : '家人';
        wx.setStorageSync(IDENTITY_KEY, stored);
      }
      this.setData({ identity: stored.role, showIdentityModal: false });
    } else {
      this.setData({ showIdentityModal: true });
    }
  },

  selectIdentity(event) {
    const role = event.currentTarget.dataset.role;
    const pendingName = role === 'grandpa' ? '爷爷' : '';
    if (role === 'grandpa') {
      wx.requestSubscribeMessage({
        tmplIds: [NOTIFY_TEMPLATE_ID],
        complete: () => this.setData({ pendingRole: role, pendingName, identityStep: 2, avatarPreview: null }),
      });
    } else {
      this.setData({ pendingRole: role, pendingName, identityStep: 2, avatarPreview: null });
    }
  },

  onNameInput(e) {
    this.setData({ pendingName: e.detail.value });
  },

  onChooseAvatar(e) {
    this.setData({ avatarPreview: e.detail.avatarUrl });
  },

  onChoosePhoto() {
    const pick = wx.chooseMedia
      ? (cb) => wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: (r) => cb(r.tempFiles[0].tempFilePath) })
      : (cb) => wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], success: (r) => cb(r.tempFilePaths[0]) });
    pick((path) => this.setData({ avatarPreview: path }));
  },

  async confirmIdentity() {
    const { pendingRole, pendingName, avatarPreview } = this.data;
    if (!pendingRole) return;
    if (pendingRole === 'family' && !pendingName.trim()) {
      wx.showToast({ title: '请输入你的名字', icon: 'none' });
      return;
    }
    let avatar = '';
    if (avatarPreview) {
      try {
        wx.showLoading({ title: '保存中...' });
        const res = await wx.cloud.uploadFile({
          cloudPath: `avatars/${Date.now()}.jpg`,
          filePath: avatarPreview,
        });
        avatar = res.fileID;
      } catch (e) {} finally {
        wx.hideLoading();
      }
    }
    await this._saveIdentity(pendingRole, pendingName.trim() || (pendingRole === 'grandpa' ? '爷爷' : '家人'), avatar);
    this.setData({ identityStep: 1, pendingRole: null, pendingName: '', avatarPreview: null });
  },

  async _saveIdentity(role, name, avatar) {
    const identity = { role, name, avatar: avatar || '', createdAt: Date.now() };
    wx.setStorageSync(IDENTITY_KEY, identity);
    this.setData({ identity: role, showIdentityModal: false });
    if (role === 'grandpa') {
      try {
        const db = wx.cloud.database();
        const res = await db.collection('users').where({ role: 'grandpa' }).limit(1).get();
        if (res.data && res.data.length > 0) {
          await db.collection('users').doc(res.data[0]._id).update({ data: { avatar: avatar || '' } });
        } else {
          await db.collection('users').add({ data: { role: 'grandpa', avatar: avatar || '', createdAt: Date.now() } });
        }
      } catch (e) {}
    }
  },

  changeIdentity() {
    wx.removeStorageSync(IDENTITY_KEY);
    this.setData({ showIdentityModal: true, identityStep: 1, pendingName: '', identity: null });
  },

  async _loadRecentMoments() {
    try {
      const moments = await getMoments({ limit: 5, skip: 0 });
      const recentMoments = moments.map((m) => ({
        ...m,
        timeStr: _formatMomentTime(m.createdAt),
      }));
      this.setData({ recentMoments });
    } catch (e) {}
  },

  onMomentsChange(e) {
    this.setData({ momentsCurrent: e.detail.current });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/family' });
  },

  goMemories() {
    wx.navigateTo({ url: '/pages/family/memories' });
  },
});

function getAdminBadgeText(count) {
  if (!count) {
    return '';
  }

  if (count === 1) {
    return '新';
  }

  return count > 9 ? '9+' : String(count);
}
