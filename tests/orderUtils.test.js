const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addDishToCart,
  compactCartItems,
  decrementDishInCart,
  getCartSummary,
  parseOrderPayload,
  restoreCartItems,
  serializeOrderPayload,
} = require('../utils/orderUtils');

const rib = { id: 'rib', name: 'Braised ribs' };
const soup = { id: 'soup', name: 'Tofu soup' };
const catalog = [rib, soup];

test('adds a dish to an empty cart', () => {
  const cart = addDishToCart([], rib);
  assert.deepEqual(cart, [{ dish: rib, quantity: 1 }]);
});

test('increments an existing dish quantity', () => {
  const cart = addDishToCart([{ dish: rib, quantity: 1 }], rib);
  assert.equal(cart[0].quantity, 2);
});

test('decrements and removes a dish at zero', () => {
  const cart = decrementDishInCart([{ dish: rib, quantity: 1 }], rib.id);
  assert.deepEqual(cart, []);
});

test('keeps the cart unchanged when decrementing a missing dish', () => {
  const cart = decrementDishInCart([{ dish: rib, quantity: 1 }], 'missing');
  assert.deepEqual(cart, [{ dish: rib, quantity: 1 }]);
});

test('summarizes total count only', () => {
  const summary = getCartSummary([
    { dish: rib, quantity: 2 },
    { dish: soup, quantity: 1 },
  ]);
  assert.deepEqual(summary, { totalCount: 3 });
});

test('summarizes an empty cart', () => {
  assert.deepEqual(getCartSummary([]), { totalCount: 0 });
});

test('ignores malformed cart items when summarizing', () => {
  const summary = getCartSummary([
    { dish: rib, quantity: 1 },
    { dish: { id: 'bad' }, quantity: 2 },
    { dish: soup, quantity: -1 },
    null,
  ]);
  assert.deepEqual(summary, { totalCount: 1 });
});

test('compacts cart items before URL serialization', () => {
  const compact = compactCartItems([
    { dish: rib, quantity: 2 },
    { dish: soup, quantity: 1 },
  ]);
  assert.deepEqual(compact, [
    { id: 'rib', quantity: 2 },
    { id: 'soup', quantity: 1 },
  ]);
});

test('restores compact cart items from the dish catalog', () => {
  const restored = restoreCartItems([{ id: 'rib', quantity: 2 }], catalog);
  assert.deepEqual(restored, [{ dish: rib, quantity: 2 }]);
});

test('drops invalid restored cart items', () => {
  const restored = restoreCartItems(
    [
      { id: 'rib', quantity: 0 },
      { id: 'missing', quantity: 1 },
      { id: 'soup', quantity: -2 },
      { id: 'soup', quantity: 'lots' },
      { id: 'soup', quantity: 1 },
    ],
    catalog,
  );
  assert.deepEqual(restored, [{ dish: soup, quantity: 1 }]);
});

test('serializes and restores a compact order payload', () => {
  const payload = {
    items: compactCartItems([{ dish: rib, quantity: 1 }]),
    diner: 'Mom',
    taste: 'Less spicy',
    note: 'Make the ribs softer',
  };
  const restored = parseOrderPayload(serializeOrderPayload(payload));
  assert.deepEqual(restored, payload);
});

test('returns null for invalid serialized payloads', () => {
  assert.equal(parseOrderPayload('%E0%A4%A'), null);
  assert.equal(parseOrderPayload(encodeURIComponent('{bad json')), null);
});
