const SEEN_KEY_PREFIX = 'grandpa_seen_';
const COLLECTION_ORDERS = 'orders';
const COLLECTION_DONE = 'done_dishes';
const COLLECTION_MOMENTS = 'moments';
const COLLECTION_WEEKLY_MENU = 'weekly_menu';
const COLLECTION_DISH_REVIEWS = 'dish_reviews';

function _db() {
  return wx.cloud.database();
}

function _today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function _timeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function saveOrder(payload) {
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) return;
  await _db().collection(COLLECTION_ORDERS).add({
    data: {
      date: _today(),
      time: _timeStr(),
      createdAt: Date.now(),
      diner: payload.diner || '家人',
      taste: payload.taste || '照常',
      note: payload.note || '',
      avatar: payload.avatar || '',
      items: payload.items,
    },
  });
}

async function getTodayOrders() {
  try {
    const res = await _db()
      .collection(COLLECTION_ORDERS)
      .where({ date: _today() })
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    return res.data || [];
  } catch (e) {
    return [];
  }
}

async function getDoneDishes() {
  try {
    const res = await _db()
      .collection(COLLECTION_DONE)
      .where({ date: _today() })
      .get();
    return (res.data && res.data[0] && res.data[0].dishes) || {};
  } catch (e) {
    return {};
  }
}

async function markDishDone(dishName) {
  const db = _db();
  const today = _today();
  const res = await db.collection(COLLECTION_DONE).where({ date: today }).get();
  if (res.data && res.data[0]) {
    await db.collection(COLLECTION_DONE).doc(res.data[0]._id).update({
      data: { [`dishes.${dishName}`]: true },
    });
  } else {
    await db.collection(COLLECTION_DONE).add({
      data: { date: today, dishes: { [dishName]: true } },
    });
  }
}

async function markAllDishDone(names) {
  const db = _db();
  const today = _today();
  const dishes = {};
  names.forEach((n) => { dishes[n] = true; });
  const res = await db.collection(COLLECTION_DONE).where({ date: today }).get();
  if (res.data && res.data[0]) {
    await db.collection(COLLECTION_DONE).doc(res.data[0]._id).update({ data: { dishes } });
  } else {
    await db.collection(COLLECTION_DONE).add({ data: { date: today, dishes } });
  }
}

async function getUnreadOrderSummary() {
  const lastSeenAt = _getLastSeenAt();
  const orders = await getTodayOrders();
  const unreadOrders = orders
    .filter((o) => Number(o.createdAt) > lastSeenAt)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  const latest = unreadOrders[0];
  return {
    hasUnread: unreadOrders.length > 0,
    count: unreadOrders.length,
    latestText: latest ? _formatLatestOrderText(latest) : '',
  };
}

function markTodayOrdersSeen() {
  try {
    wx.setStorageSync(SEEN_KEY_PREFIX + _today(), Date.now());
  } catch (e) {}
}

function _getLastSeenAt() {
  try {
    return Number(wx.getStorageSync(SEEN_KEY_PREFIX + _today())) || 0;
  } catch (e) {
    return 0;
  }
}

function _formatLatestOrderText(order) {
  const diner = order.diner || '家人';
  const firstItem = Array.isArray(order.items) && order.items[0];
  const dishName = firstItem && firstItem.name ? firstItem.name : '一道菜';
  return `${diner}刚刚点了${dishName}`;
}

async function saveMoment(payload) {
  await _db().collection(COLLECTION_MOMENTS).add({
    data: {
      userId: payload.userId || '',
      userName: payload.userName || '家人',
      avatar: payload.avatar || '',
      imageUrl: payload.imageUrl || '',
      caption: payload.caption || '',
      createdAt: payload.createdAt || Date.now(),
      likes: [],
      comments: [],
    },
  });
}

async function getMoments({ limit = 20, skip = 0 } = {}) {
  try {
    const res = await _db()
      .collection(COLLECTION_MOMENTS)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get();
    return res.data || [];
  } catch (e) {
    return [];
  }
}

async function toggleLike(momentId, userId) {
  const db = _db();
  const res = await db.collection(COLLECTION_MOMENTS).doc(momentId).get();
  const currentLikes = (res.data && res.data.likes) || [];
  const already = currentLikes.includes(userId);
  const newLikes = already
    ? currentLikes.filter((id) => id !== userId)
    : [...currentLikes, userId];
  await db.collection(COLLECTION_MOMENTS).doc(momentId).update({
    data: { likes: newLikes },
  });
}

async function addComment(momentId, comment) {
  if (!comment) return;
  const db = _db();
  await db.collection(COLLECTION_MOMENTS).doc(momentId).update({
    data: { comments: db.command.push(comment) },
  });
}

async function getWeeklyMenu(week) {
  try {
    const res = await _db()
      .collection(COLLECTION_WEEKLY_MENU)
      .where({ week })
      .get();
    return (res.data && res.data[0] && res.data[0].entries) || [];
  } catch (e) {
    return [];
  }
}

async function addMenuEntry(entry) {
  const db = _db();
  const res = await db.collection(COLLECTION_WEEKLY_MENU).where({ week: entry.week }).get();
  if (res.data && res.data[0]) {
    const existing = res.data[0].entries || [];
    await db.collection(COLLECTION_WEEKLY_MENU)
      .doc(res.data[0]._id)
      .update({ data: { entries: [...existing, entry] } });
  } else {
    await db.collection(COLLECTION_WEEKLY_MENU).add({
      data: { week: entry.week, entries: [entry] },
    });
  }
}

async function deleteMenuEntry(week, createdAt, userId) {
  const db = _db();
  const res = await db.collection(COLLECTION_WEEKLY_MENU).where({ week }).get();
  if (!res.data || !res.data[0]) return;
  const entries = (res.data[0].entries || []).filter(
    (e) => !(Number(e.createdAt) === Number(createdAt) && e.suggestedBy === userId),
  );
  await db.collection(COLLECTION_WEEKLY_MENU)
    .doc(res.data[0]._id)
    .update({ data: { entries } });
}

async function saveDishReview({ dishName, date, review }) {
  const db = _db();
  const res = await db.collection(COLLECTION_DISH_REVIEWS)
    .where({ dishName, date })
    .get();
  if (res.data && res.data[0]) {
    const existing = res.data[0].reviews || [];
    await db.collection(COLLECTION_DISH_REVIEWS)
      .doc(res.data[0]._id)
      .update({ data: { reviews: [...existing, review] } });
  } else {
    await db.collection(COLLECTION_DISH_REVIEWS).add({
      data: { dishName, date, reviews: [review] },
    });
  }
}

async function getDishReviews(dishName, date) {
  try {
    const res = await _db()
      .collection(COLLECTION_DISH_REVIEWS)
      .where({ dishName, date })
      .get();
    return (res.data && res.data[0] && res.data[0].reviews) || [];
  } catch (e) {
    return [];
  }
}

async function getTodayDishReviews(date) {
  try {
    const res = await _db()
      .collection(COLLECTION_DISH_REVIEWS)
      .where({ date })
      .limit(50)
      .get();
    return res.data || [];
  } catch (e) {
    return [];
  }
}

async function getOrdersByDate(date) {
  try {
    const res = await _db()
      .collection(COLLECTION_ORDERS)
      .where({ date })
      .limit(100)
      .get();
    return res.data || [];
  } catch (e) {
    return [];
  }
}

async function getHistoryOrders({ skip = 0, limit = 20 } = {}) {
  try {
    const res = await _db()
      .collection(COLLECTION_ORDERS)
      .orderBy('date', 'desc')
      .skip(skip)
      .limit(limit)
      .get();
    return res.data || [];
  } catch (e) {
    return [];
  }
}

async function getMenuDishHistory() {
  try {
    const res = await _db()
      .collection(COLLECTION_WEEKLY_MENU)
      .orderBy('week', 'desc')
      .limit(8)
      .get();
    const names = new Set();
    (res.data || []).forEach((doc) =>
      (doc.entries || []).forEach((e) => { if (e.dishName) names.add(e.dishName); })
    );
    return [...names];
  } catch (e) {
    return [];
  }
}

module.exports = {
  saveOrder,
  getTodayOrders,
  getUnreadOrderSummary,
  markTodayOrdersSeen,
  getDoneDishes,
  markDishDone,
  markAllDishDone,
  saveMoment,
  getMoments,
  toggleLike,
  addComment,
  getWeeklyMenu,
  addMenuEntry,
  deleteMenuEntry,
  saveDishReview,
  getDishReviews,
  getTodayDishReviews,
  getOrdersByDate,
  getHistoryOrders,
  getMenuDishHistory,
};
