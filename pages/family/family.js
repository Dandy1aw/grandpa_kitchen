const { dishes: menuDishes } = require('../../utils/menuData');

const IDENTITY_KEY = 'grandpa_identity';

const {
  saveMoment, getMoments, toggleLike, addComment,
  getWeeklyMenu, addMenuEntry, deleteMenuEntry,
  getDishReviews, saveDishReview, getTodayDishReviews,
  getDoneDishes, getTodayOrders,
  getMenuDishHistory,
} = require('../../utils/storage');

function _formatTime(ts) {
  const d = new Date(Number(ts));
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}月${day}日 ${h}:${min}`;
}

function _today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function _getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function _buildWeekDays(date) {
  const d = new Date(date);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  return DAY_KEYS.map((key, i) => {
    const cur = new Date(mon);
    cur.setDate(mon.getDate() + i);
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    const todayStr = _today();
    const curStr = `${cur.getFullYear()}-${m}-${dd}`;
    return { key, label: DAY_LABELS[i], date: `${m}/${dd}`, isToday: curStr === todayStr, entries: [] };
  });
}

function _weekLabel(date) {
  const days = _buildWeekDays(date);
  return `${days[0].date} - ${days[6].date}`;
}

Page({
  data: {
    activeTab: 'moments',
    identity: null,
    // 温馨时刻
    moments: [],
    momentsLoading: false,
    showPostForm: false,
    postCaption: '',
    postImagePath: '',
    expandedCommentId: null,
    commentInput: '',
    // 菜单计划
    currentWeek: '',
    weekLabel: '',
    weekDays: [],
    showAddEntryDay: null,
    newDishName: '',
    dishCandidates: [],
    filteredCandidates: [],
    // 菜品评价
    doneDishes: [],
    myReviews: {},
    // selectedTags and comment are inlined on each doneDishes item
    reviewTags: {
      positive: ['夯爆了', '绝绝子', '暴风吸入', '真香'],
      neutral:  ['太香了', '下次还要', '满足感', '可以再来'],
      critical: ['偏咸了', '有点淡', '有点腻'],
    },
  },

  onLoad() {
    const identity = wx.getStorageSync(IDENTITY_KEY) || { name: '家人', avatar: '', role: 'family' };
    this.setData({ identity });
    this._initWeek();
    this._loadTab('moments');
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this._loadTab(tab);
  },

  _loadTab(tab) {
    if (tab === 'moments') this._loadMoments();
    else if (tab === 'menu') this._loadWeeklyMenu();
    else if (tab === 'reviews') this._loadReviews();
  },

  // ── 温馨时刻 ──

  async _loadMoments() {
    this.setData({ momentsLoading: true });
    const raw = await getMoments({ limit: 20, skip: 0 });
    const moments = raw.map((m) => ({ ...m, timeStr: _formatTime(m.createdAt) }));
    this.setData({ moments, momentsLoading: false });
  },

  openPostForm() {
    this.setData({ showPostForm: true, postCaption: '', postImagePath: '' });
  },

  closePostForm() {
    this.setData({ showPostForm: false });
  },

  async choosePostImage() {
    try {
      let path;
      if (wx.chooseMedia) {
        const res = await new Promise((resolve, reject) =>
          wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: resolve, fail: reject })
        );
        path = res.tempFiles[0].tempFilePath;
      } else {
        const res = await new Promise((resolve, reject) =>
          wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], success: resolve, fail: reject })
        );
        path = res.tempFilePaths[0];
      }
      this.setData({ postImagePath: path });
    } catch (e) {}
  },

  onPostCaptionInput(e) {
    this.setData({ postCaption: e.detail.value });
  },

  async submitPost() {
    const { postImagePath, postCaption, identity } = this.data;
    if (!postImagePath) {
      wx.showToast({ title: '请选择一张照片', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '发布中…' });
    try {
      const ext = postImagePath.split('.').pop() || 'jpg';
      const cloudPath = `moments/${Date.now()}.${ext}`;
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: postImagePath });
      await saveMoment({
        userId: identity.name || '家人',
        userName: identity.name || '家人',
        avatar: identity.avatar || '',
        imageUrl: uploadRes.fileID,
        caption: postCaption,
        createdAt: Date.now(),
      });
      this.setData({ showPostForm: false });
      await this._loadMoments();
      wx.showToast({ title: '发布成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '发布失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async onToggleLike(e) {
    const { id } = e.currentTarget.dataset;
    const { identity } = this.data;
    try {
      await toggleLike(id, identity.name || '家人');
      await this._loadMoments();
    } catch (err) {
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  toggleComments(e) {
    const { id } = e.currentTarget.dataset;
    const current = this.data.expandedCommentId;
    this.setData({ expandedCommentId: current === id ? null : id, commentInput: '' });
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value });
  },

  async submitComment(e) {
    const { id } = e.currentTarget.dataset;
    const { commentInput, identity } = this.data;
    if (!commentInput.trim()) return;
    try {
      await addComment(id, {
        userId: identity.name || '家人',
        userName: identity.name || '家人',
        text: commentInput.trim(),
        createdAt: Date.now(),
      });
      this.setData({ commentInput: '' });
      await this._loadMoments();
    } catch (err) {
      wx.showToast({ title: '评论失败，请重试', icon: 'none' });
    }
  },

  previewMomentPhoto(e) {
    const src = e.currentTarget.dataset.src;
    if (src) wx.previewImage({ urls: [src], current: src });
  },

  // ── 菜单计划 ──

  _initWeek() {
    const now = new Date();
    const week = _getWeekKey(now);
    const days = _buildWeekDays(now);
    this.setData({ currentWeek: week, weekLabel: _weekLabel(now), weekDays: days });
  },

  async _loadWeeklyMenu() {
    const { currentWeek, weekDays } = this.data;
    const entries = await getWeeklyMenu(currentWeek);
    const updatedDays = weekDays.map((d) => ({
      ...d,
      entries: entries.filter((e) => e.day === d.key),
    }));
    this.setData({ weekDays: updatedDays });
  },

  async openAddEntry(e) {
    const day = e.currentTarget.dataset.day;
    this._addEntrySeq = (this._addEntrySeq || 0) + 1;
    const seq = this._addEntrySeq;
    this.setData({ showAddEntryDay: day, newDishName: '', filteredCandidates: [] });
    try {
      const history = await getMenuDishHistory();
      if (seq !== this._addEntrySeq) return;
      const menuNames = menuDishes.map((d) => d.name);
      const all = [...new Set([...menuNames, ...history])];
      this.setData({ dishCandidates: all, filteredCandidates: all.slice(0, 8) });
    } catch (err) {
      if (seq !== this._addEntrySeq) return;
      this.setData({ dishCandidates: [], filteredCandidates: [] });
    }
  },

  closeAddEntry() {
    this.setData({ showAddEntryDay: null, newDishName: '', dishCandidates: [], filteredCandidates: [] });
  },

  onNewDishInput(e) {
    const val = e.detail.value;
    const filtered = val.trim()
      ? this.data.dishCandidates.filter((n) => n.includes(val.trim())).slice(0, 8)
      : this.data.dishCandidates.slice(0, 8);
    this.setData({ newDishName: val, filteredCandidates: filtered });
  },

  onSelectCandidate(e) {
    this.setData({ newDishName: e.currentTarget.dataset.name, filteredCandidates: [] });
  },

  async confirmAddEntry() {
    const { showAddEntryDay, newDishName, currentWeek, identity } = this.data;
    if (!newDishName.trim()) {
      wx.showToast({ title: '请输入菜名', icon: 'none' });
      return;
    }
    try {
      await addMenuEntry({
        week: currentWeek,
        day: showAddEntryDay,
        dishName: newDishName.trim(),
        suggestedBy: identity.name || '家人',
        suggestedByAvatar: identity.avatar || '',
        createdAt: Date.now(),
      });
      this.setData({ showAddEntryDay: null, newDishName: '' });
      await this._loadWeeklyMenu();
    } catch (err) {
      wx.showToast({ title: '添加失败，请重试', icon: 'none' });
    }
  },

  async onDeleteEntry(e) {
    const { day, createdAt } = e.currentTarget.dataset;
    const { currentWeek, identity } = this.data;
    try {
      await deleteMenuEntry(currentWeek, createdAt, identity.name || '家人');
      await this._loadWeeklyMenu();
    } catch (err) {
      wx.showToast({ title: '删除失败，请重试', icon: 'none' });
    }
  },

  // ── 菜品评价 ──

  async _loadReviews() {
    try {
      const [orders, doneDishes] = await Promise.all([
        getTodayOrders(),
        getDoneDishes(),
      ]);
      const allDishNames = [...new Set(
        orders.flatMap((o) => (o.items || []).map((i) => i.name))
      )];

      const { identity } = this.data;
      const allReviews = await Promise.all(
        allDishNames
          .filter((name) => doneDishes[name])
          .map((name) => getDishReviews(name, _today()))
      );

      const myReviews = {};
      const doneDishList = allDishNames
        .filter((name) => doneDishes[name])
        .map((name, i) => {
          const mine = allReviews[i].find((r) => r.userName === (identity.name || '家人'));
          if (mine) myReviews[name] = mine;
          return { name, selectedTags: [], comment: '' };
        });

      this.setData({ doneDishes: doneDishList, myReviews });
    } catch (err) {
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  toggleReviewTag(e) {
    const { dish, tag } = e.currentTarget.dataset;
    const { doneDishes } = this.data;
    const idx = doneDishes.findIndex((d) => d.name === dish);
    if (idx < 0) return;
    const tags = doneDishes[idx].selectedTags;
    const newTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    this.setData({ [`doneDishes[${idx}].selectedTags`]: newTags });
  },

  onReviewCommentInput(e) {
    const dish = e.currentTarget.dataset.dish;
    const { doneDishes } = this.data;
    const idx = doneDishes.findIndex((d) => d.name === dish);
    if (idx < 0) return;
    this.setData({ [`doneDishes[${idx}].comment`]: e.detail.value });
  },

  async submitReview(e) {
    const dish = e.currentTarget.dataset.dish;
    const { doneDishes, identity } = this.data;
    const dishItem = doneDishes.find((d) => d.name === dish);
    if (!dishItem || (!dishItem.selectedTags.length && !dishItem.comment.trim())) {
      wx.showToast({ title: '请选一个标签或写留言', icon: 'none' });
      return;
    }
    try {
      await saveDishReview({
        dishName: dish,
        date: _today(),
        review: {
          userName: identity.name || '家人',
          avatar: identity.avatar || '',
          tags: dishItem.selectedTags,
          comment: dishItem.comment.trim(),
          createdAt: Date.now(),
        },
      });
      wx.showToast({ title: '评价成功！', icon: 'success' });
      await this._loadReviews();
    } catch (err) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  },
});
