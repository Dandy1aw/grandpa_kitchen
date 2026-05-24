const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCustomDish,
  getCustomDishesFromCart,
  mergeSharedCustomDishes,
  mergeDishCatalog,
  normalizeCustomDishes,
  parseSharedMenuPayload,
  serializeSharedMenuPayload,
} = require('../utils/customMenu');

const baseCatalog = [
  { id: 'rib', name: 'Braised ribs', category: 'hot' },
  { id: 'soup', name: 'Tofu soup', category: 'soup' },
];

test('builds a custom dish from the add menu form', () => {
  const dish = buildCustomDish(
    {
      name: '  番茄炒蛋  ',
      category: 'hot',
      desc: '  家里的甜口  ',
      tag: '',
      image: '/tmp/tomato-egg.jpg',
    },
    'custom-test',
  );

  assert.deepEqual(dish, {
    id: 'custom-test',
    name: '番茄炒蛋',
    category: 'hot',
    categoryName: '热菜',
    desc: '家里的甜口',
    tag: '家里新增',
    image: '/tmp/tomato-egg.jpg',
    color: '#f8d78a',
    recommended: false,
    custom: true,
  });
});

test('rejects a custom dish without a name', () => {
  assert.equal(buildCustomDish({ name: '  ', category: 'hot' }, 'custom-empty'), null);
});

test('normalizes stored custom dishes', () => {
  const dishes = normalizeCustomDishes([
    buildCustomDish({ name: '葱油拌面', category: 'staple' }, 'custom-noodle'),
    { id: 'broken', name: '' },
    null,
  ]);

  assert.equal(dishes.length, 1);
  assert.equal(dishes[0].id, 'custom-noodle');
});

test('merges custom dishes into the menu catalog without duplicating ids', () => {
  const customDish = buildCustomDish({ name: '鸡汤', category: 'soup' }, 'custom-soup');
  const duplicate = buildCustomDish({ name: '重复排骨', category: 'hot' }, 'rib');
  const catalog = mergeDishCatalog(baseCatalog, [customDish, duplicate]);

  assert.deepEqual(catalog.map((dish) => dish.id), ['rib', 'soup', 'custom-soup']);
});

test('extracts unique custom dishes from a cart for order payloads', () => {
  const customDish = buildCustomDish({ name: '蛋炒饭', category: 'staple' }, 'custom-rice');
  const customDishes = getCustomDishesFromCart([
    { dish: customDish, quantity: 1 },
    { dish: customDish, quantity: 2 },
    { dish: baseCatalog[0], quantity: 1 },
  ]);

  assert.deepEqual(customDishes, [customDish]);
});

test('serializes shared menu dishes without local image paths', () => {
  const customDish = buildCustomDish(
    { name: '番茄炒蛋', category: 'hot', image: 'wxfile://local-only.jpg' },
    'custom-tomato-egg',
  );
  const restored = parseSharedMenuPayload(serializeSharedMenuPayload([customDish]));

  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, 'custom-tomato-egg');
  assert.equal(restored[0].name, '番茄炒蛋');
  assert.equal(restored[0].image, '');
});

test('returns an empty shared menu for invalid payloads', () => {
  assert.deepEqual(parseSharedMenuPayload('%E0%A4%A'), []);
  assert.deepEqual(parseSharedMenuPayload(encodeURIComponent('{bad json')), []);
  assert.deepEqual(parseSharedMenuPayload(''), []);
});

test('parses shared menu payloads that Mini Program routing already decoded', () => {
  const customDish = buildCustomDish(
    { name: '50%少盐鸡汤', category: 'soup' },
    'custom-low-salt-soup',
  );
  const decodedPayload = decodeURIComponent(serializeSharedMenuPayload([customDish]));
  const restored = parseSharedMenuPayload(decodedPayload);

  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, 'custom-low-salt-soup');
  assert.equal(restored[0].name, '50%少盐鸡汤');
});

test('merges shared custom dishes without duplicating existing menu items', () => {
  const existing = [
    buildCustomDish({ name: '番茄炒蛋', category: 'hot' }, 'custom-existing'),
  ];
  const shared = [
    buildCustomDish({ name: '番茄炒蛋', category: 'hot' }, 'custom-shared-same-name'),
    buildCustomDish({ name: '鸡汤', category: 'soup' }, 'custom-soup'),
  ];

  const result = mergeSharedCustomDishes(existing, shared);

  assert.equal(result.importedCount, 1);
  assert.deepEqual(result.dishes.map((dish) => dish.id), ['custom-existing', 'custom-soup']);
});
