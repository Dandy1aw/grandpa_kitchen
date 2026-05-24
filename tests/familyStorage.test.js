const test = require('node:test');
const assert = require('node:assert/strict');

function makeMockDb(initialDocs = []) {
  let docs = initialDocs.map((d, i) => ({ ...d, _id: `id_${i}` }));
  let idCounter = initialDocs.length;

  const makeCollection = () => ({
    _docs: docs,
    orderBy(field, dir) {
      this._orderField = field;
      this._orderDir = dir;
      return this;
    },
    limit(n) {
      this._limit = n;
      return this;
    },
    skip(n) {
      this._skip = n;
      return this;
    },
    async get() {
      let result = [...docs];
      if (this._orderField) {
        const f = this._orderField;
        const dir = this._orderDir === 'desc' ? -1 : 1;
        result.sort((a, b) => (a[f] > b[f] ? dir : -dir));
      }
      if (this._skip) result = result.slice(this._skip);
      if (this._limit) result = result.slice(0, this._limit);
      return { data: result };
    },
    async add({ data }) {
      const doc = { ...data, _id: `id_${idCounter++}` };
      docs.push(doc);
      return { _id: doc._id };
    },
    where(query) {
      const filtered = {
        _query: query,
        async get() {
          const result = docs.filter((d) =>
            Object.entries(query).every(([k, v]) => d[k] === v),
          );
          return { data: result };
        },
        doc(id) {
          return {
            async update({ data }) {
              const idx = docs.findIndex((d) => d._id === id);
              if (idx !== -1) {
                Object.assign(docs[idx], data);
              }
            },
          };
        },
      };
      return filtered;
    },
    doc(id) {
      return {
        async update({ data }) {
          const idx = docs.findIndex((d) => d._id === id);
          if (idx !== -1) {
            Object.assign(docs[idx], data);
          }
        },
        async get() {
          const doc = docs.find((d) => d._id === id);
          return { data: doc };
        },
      };
    },
    command: {
      push: (item) => ({ __push: item }),
    },
  });

  return {
    collection: () => makeCollection(),
    command: {
      push: (item) => ({ __push: item }),
    },
  };
}

function loadStorage() {
  const p = require.resolve('../utils/storage');
  delete require.cache[p];
  return require('../utils/storage');
}

test('saveMoment stores a moment and getMoments returns it', async () => {
  const mockDb = makeMockDb();
  global.wx = { cloud: { database: () => mockDb } };
  const { saveMoment, getMoments } = loadStorage();

  await saveMoment({
    userName: '小明',
    avatar: '',
    imageUrl: 'cloud://test.jpg',
    caption: '今天爷爷做了好吃的！',
    createdAt: 1000,
  });

  const moments = await getMoments({ limit: 10, skip: 0 });
  assert.equal(moments.length, 1);
  assert.equal(moments[0].caption, '今天爷爷做了好吃的！');
  assert.deepEqual(moments[0].likes, []);
  assert.deepEqual(moments[0].comments, []);
});

test('toggleLike adds userId to likes, second call removes it', async () => {
  const mockDb = makeMockDb();
  global.wx = { cloud: { database: () => mockDb } };
  const { saveMoment, getMoments, toggleLike } = loadStorage();

  await saveMoment({ userName: '爷爷', imageUrl: 'cloud://a.jpg', createdAt: 1 });
  const [moment] = await getMoments({ limit: 1, skip: 0 });

  await toggleLike(moment._id, 'user_abc', moment.likes);
  const [after1] = await getMoments({ limit: 1, skip: 0 });
  assert.deepEqual(after1.likes, ['user_abc']);

  await toggleLike(moment._id, 'user_abc', after1.likes);
  const [after2] = await getMoments({ limit: 1, skip: 0 });
  assert.deepEqual(after2.likes, []);
});

test('addComment appends comment to moment', async () => {
  const mockDb = makeMockDb();
  global.wx = { cloud: { database: () => mockDb } };
  const { saveMoment, getMoments, addComment } = loadStorage();

  await saveMoment({ userName: '奶奶', imageUrl: 'cloud://b.jpg', createdAt: 2 });
  const [moment] = await getMoments({ limit: 1, skip: 0 });

  await addComment(moment._id, { userName: '小红', text: '真好看！', createdAt: 100 });
  const [after] = await getMoments({ limit: 1, skip: 0 });
  assert.equal(after.comments.length, 1);
  assert.equal(after.comments[0].text, '真好看！');
});

test('addMenuEntry creates week doc on first add, appends on second', async () => {
  const mockDb = makeMockDb();
  global.wx = { cloud: { database: () => mockDb } };
  const { addMenuEntry, getWeeklyMenu } = loadStorage();

  await addMenuEntry({
    week: '2026-W21',
    day: 'mon',
    dishName: '红烧肉',
    suggestedBy: '小明',
    suggestedByAvatar: '',
    createdAt: 1000,
  });
  await addMenuEntry({
    week: '2026-W21',
    day: 'tue',
    dishName: '番茄炒蛋',
    suggestedBy: '爷爷',
    suggestedByAvatar: '',
    createdAt: 2000,
  });

  const entries = await getWeeklyMenu('2026-W21');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].dishName, '红烧肉');
  assert.equal(entries[1].day, 'tue');
});

test('saveDishReview stores review and getDishReviews returns it', async () => {
  const mockDb = makeMockDb();
  global.wx = { cloud: { database: () => mockDb } };
  const { saveDishReview, getDishReviews } = loadStorage();

  await saveDishReview({
    dishName: '红烧排骨',
    date: '2026-05-23',
    review: {
      userName: '小明',
      avatar: '',
      tags: ['夯爆了', '下次还要'],
      comment: '太好吃了！',
      createdAt: 1000,
    },
  });

  const reviews = await getDishReviews('红烧排骨', '2026-05-23');
  assert.equal(reviews.length, 1);
  assert.deepEqual(reviews[0].tags, ['夯爆了', '下次还要']);
});

test('getOrdersByDate returns orders for a specific date', async () => {
  const mockDb = makeMockDb([
    { date: '2026-04-23', diner: '妈妈', items: [{ name: '番茄炒蛋', quantity: 1 }], createdAt: 1 },
    { date: '2026-05-23', diner: '爸爸', items: [{ name: '红烧肉', quantity: 2 }], createdAt: 2 },
  ]);
  global.wx = { cloud: { database: () => mockDb } };
  const { getOrdersByDate } = loadStorage();
  const orders = await getOrdersByDate('2026-04-23');
  assert.equal(orders.length, 1);
  assert.equal(orders[0].diner, '妈妈');
});
