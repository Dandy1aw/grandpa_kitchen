const test = require('node:test');
const assert = require('node:assert/strict');

function createWxStorage() {
  const store = new Map();
  return {
    getStorageSync(key) {
      return store.get(key);
    },
    setStorageSync(key, value) {
      store.set(key, value);
    },
  };
}

function loadStorage() {
  const storagePath = require.resolve('../utils/storage');
  delete require.cache[storagePath];
  return require('../utils/storage');
}

function withMockedNow(value, callback) {
  const originalNow = Date.now;
  Date.now = () => value;
  try {
    callback();
  } finally {
    Date.now = originalNow;
  }
}

test('tracks unread local orders until grandpa acknowledges them', () => {
  global.wx = createWxStorage();
  const {
    getTodayOrders,
    getUnreadOrderSummary,
    markTodayOrdersSeen,
    saveOrder,
  } = loadStorage();

  withMockedNow(1000, () => {
    saveOrder({
      diner: '妈妈',
      taste: '清淡',
      note: '汤少放盐',
      items: [{ id: 'soup', name: '青菜豆腐汤', quantity: 1 }],
    });
  });

  assert.equal(getTodayOrders()[0].createdAt, 1000);
  assert.deepEqual(getUnreadOrderSummary(), {
    hasUnread: true,
    count: 1,
    latestText: '妈妈刚刚点了青菜豆腐汤',
  });

  withMockedNow(1100, () => {
    markTodayOrdersSeen();
  });

  assert.deepEqual(getUnreadOrderSummary(), {
    hasUnread: false,
    count: 0,
    latestText: '',
  });

  withMockedNow(1200, () => {
    saveOrder({
      diner: '爸爸',
      taste: '照常',
      note: '',
      items: [{ id: 'rib', name: '红烧排骨', quantity: 2 }],
    });
  });

  assert.deepEqual(getUnreadOrderSummary(), {
    hasUnread: true,
    count: 1,
    latestText: '爸爸刚刚点了红烧排骨',
  });
});
