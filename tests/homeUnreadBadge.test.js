const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
}

test('home admin entry shows an unread order badge', () => {
  const js = read('pages/index/index.js');
  const wxml = read('pages/index/index.wxml');
  const wxss = read('pages/index/index.wxss');

  assert.match(js, /getUnreadOrderSummary/);
  assert.match(js, /adminBadgeText/);
  assert.match(js, /refreshUnreadReminder/);
  assert.match(js, /onShow\(\)/);
  assert.match(wxml, /class="admin-fab-badge"/);
  assert.match(wxml, /wx:if="{{unread\.hasUnread}}"/);
  assert.match(wxml, /{{adminBadgeText}}/);
  assert.match(wxss, /\.admin-fab-badge\s*\{/);
});
