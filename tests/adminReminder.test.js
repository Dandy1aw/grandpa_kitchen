const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
}

test('admin page shows a dismissible unread order reminder', () => {
  const js = read('pages/admin/admin.js');
  const wxml = read('pages/admin/admin.wxml');
  const wxss = read('pages/admin/admin.wxss');

  assert.match(js, /getUnreadOrderSummary/);
  assert.match(js, /markTodayOrdersSeen/);
  assert.match(js, /acknowledgeUnreadOrders/);
  assert.match(wxml, /wx:if="{{unread\.hasUnread}}"/);
  assert.match(wxml, /class="unread-banner"/);
  assert.match(wxml, /{{unread\.count}}/);
  assert.match(wxml, /{{unread\.latestText}}/);
  assert.match(wxml, /bindtap="acknowledgeUnreadOrders"/);
  assert.match(wxss, /\.unread-banner\s*\{/);
  assert.match(wxss, /\.unread-action\s*\{/);
});
