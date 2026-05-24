const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
}

function extractRpx(css, selector, property) {
  const block = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(block, `missing selector ${selector}`);
  const value = block[1].match(new RegExp(`${property}:\\s*(\\d+)rpx`));
  assert.ok(value, `missing ${property} on ${selector}`);
  return Number(value[1]);
}

test('home hero uses the Q version grandpa image as a background illustration', () => {
  const wxml = read('pages/index/index.wxml');
  const css = read('pages/index/index.wxss');
  assert.match(wxml, /grandpa-q-cooking\.jpg/);
  assert.match(wxml, /class="hero-bg"/);
  assert.match(wxml, /mode="aspectFill"/);
  assert.doesNotMatch(wxml, /class="hero-figure"/);
  assert.match(css, /\.hero-bg\s*\{[\s\S]*?position:\s*absolute/);
  assert.match(css, /\.hero-overlay\s*\{[\s\S]*?position:\s*absolute/);
});

test('order UI no longer exposes money or price fields', () => {
  const files = [
    'pages/index/index.wxml',
    'pages/order/order.wxml',
    'pages/success/success.wxml',
    'pages/index/index.js',
    'pages/order/order.js',
    'pages/success/success.js',
    'utils/menuData.js',
    'utils/orderUtils.js',
  ];

  for (const file of files) {
    const content = read(file);
    assert.doesNotMatch(content, /price|totalPrice|¥|金额|合计|小计/);
  }
});

test('plus and minus controls use compact visual proportions', () => {
  const css = read('pages/index/index.wxss');
  assert.ok(extractRpx(css, '.step-button', 'width') <= 56);
  assert.ok(extractRpx(css, '.step-button', 'height') <= 56);
  assert.ok(extractRpx(css, '.step-button', 'font-size') <= 24);
});

test('home page has bottom UI switching and enough bottom inset', () => {
  const wxml = read('pages/index/index.wxml');
  const css = read('pages/index/index.wxss');
  assert.match(wxml, /data-panel="menu"/);
  assert.match(wxml, /data-panel="cart"/);
  assert.ok(extractRpx(css, '.page-shell', 'padding') <= 24);
  assert.match(css, /padding:\s*20rpx 28rpx 220rpx/);
});

test('bottom switch cannot overflow on small screens', () => {
  const css = read('pages/index/index.wxss');
  assert.match(css, /\.page-shell\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /\.bottom-dock\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.bottom-switch\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.bottom-switch\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(css, /\.switch-item\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(css, /\.switch-item\s*\{[\s\S]*?width:\s*100%/);
});

test('home page supports adding a custom dish with an uploaded image', () => {
  const wxml = read('pages/index/index.wxml');
  const js = read('pages/index/index.js');
  assert.match(wxml, /bindtap="openCustomDishForm"/);
  assert.match(wxml, /bindtap="chooseDishImage"/);
  assert.match(wxml, /bindtap="saveCustomDish"/);
  assert.match(wxml, /class="form-image"/);
  assert.match(wxml, /data-field="name"/);
  assert.match(js, /chooseMedia|chooseImage/);
  assert.match(js, /saveFile/);
  assert.match(js, /setStorageSync/);
  assert.match(js, /buildCustomDish/);
});

test('custom dish form has mobile-friendly field labels and touch targets', () => {
  const wxml = read('pages/index/index.wxml');
  const css = read('pages/index/index.wxss');
  assert.match(wxml, /class="form-field"/);
  assert.match(wxml, /class="form-label"/);
  assert.match(wxml, /class="required-mark"/);
  assert.match(wxml, /class="form-helper"/);
  assert.match(wxml, /class="form-actions"/);
  assert.match(wxml, /class="cancel-dish-button"/);
  assert.ok(extractRpx(css, '.form-input', 'min-height') >= 88);
  assert.ok(extractRpx(css, '.form-close', 'width') >= 80);
  assert.ok(extractRpx(css, '.form-close', 'height') >= 80);
  assert.match(css, /\.form-field\s*\{[\s\S]*?gap:\s*10rpx/);
  assert.match(css, /\.form-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
});

test('confirm order page uses a warm receipt and preference layout', () => {
  const wxml = read('pages/order/order.wxml');
  const css = read('pages/order/order.wxss');
  assert.match(wxml, /class="order-hero"/);
  assert.match(wxml, /class="hero-stamp"/);
  assert.match(wxml, /class="receipt-card"/);
  assert.match(wxml, /class="receipt-item"/);
  assert.match(wxml, /class="receipt-image"/);
  assert.match(wxml, /class="preference-panel"/);
  assert.match(wxml, /class="preference-group"/);
  assert.match(wxml, /class="note-card"/);
  assert.match(wxml, /class="submit-dock/);
  assert.match(wxml, /class="submit-summary"/);
  assert.match(css, /\.page-shell\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /\.receipt-item\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.ok(extractRpx(css, '.option-chip', 'min-height') >= 84);
  assert.ok(extractRpx(css, '.submit-button', 'min-height') >= 88);
});

test('confirm order options use two columns below the fixed submit dock', () => {
  const css = read('pages/order/order.wxss');
  assert.match(css, /\.chip-grid\s*\{[\s\S]*?display:\s*grid/);
  assert.match(css, /\.chip-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*1fr\)/);
  assert.match(css, /\.chip-grid\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.chip-grid\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(css, /\.option-chip\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.option-chip\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.submit-dock\s*\{[\s\S]*?z-index:\s*999/);
});

test('confirm order back arrow is visually compact while keeping a touch target', () => {
  const css = read('pages/order/order.wxss');
  assert.ok(extractRpx(css, '.back-button', 'width') <= 56);
  assert.ok(extractRpx(css, '.back-button', 'height') <= 56);
  assert.ok(extractRpx(css, '.back-line', 'width') <= 12);
  assert.ok(extractRpx(css, '.back-line', 'height') <= 12);
  assert.match(css, /\.back-line\s*\{[\s\S]*?border-bottom:\s*3rpx/);
  assert.match(css, /\.back-line\s*\{[\s\S]*?border-left:\s*3rpx/);
});

test('selected cart controls stay within selected cards', () => {
  const css = read('pages/index/index.wxss');
  assert.match(css, /\.selected-card\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.selected-stepper\s*\{[\s\S]*?flex:\s*0 0 150rpx/);
  assert.ok(extractRpx(css, '.step-button', 'width') <= 56);
  assert.ok(extractRpx(css, '.step-button', 'height') <= 56);
});

test('page typography stays within mobile-safe display sizes', () => {
  const cssFiles = [
    'pages/index/index.wxss',
    'pages/order/order.wxss',
    'pages/success/success.wxss',
  ];

  for (const file of cssFiles) {
    const sizes = [...read(file).matchAll(/font-size:\s*(\d+)rpx/g)].map((match) => Number(match[1]));
    assert.ok(Math.max(...sizes) <= 38, `${file} has oversized font`);
  }
});

test('project images are present and compressed for mini program use', () => {
  const imageFiles = [
    'assets/images/grandpa-q-cooking.jpg',
    'assets/images/dish-default.jpg',
    'assets/images/receipt-paper.jpg',
  ];

  for (const file of imageFiles) {
    const stats = fs.statSync(path.join(__dirname, '..', file));
    assert.ok(stats.size > 0, `${file} is empty`);
    assert.ok(stats.size < 320 * 1024, `${file} is too large`);
  }
});
