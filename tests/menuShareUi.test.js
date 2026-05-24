const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
}

test('home page supports sharing and importing custom menus', () => {
  const js = read('pages/index/index.js');
  const wxml = read('pages/index/index.wxml');
  const wxss = read('pages/index/index.wxss');

  assert.match(js, /serializeSharedMenuPayload/);
  assert.match(js, /parseSharedMenuPayload/);
  assert.match(js, /mergeSharedCustomDishes/);
  assert.match(js, /importSharedMenu/);
  assert.match(js, /sharedMenu/);
  assert.match(js, /shareType.*customMenu/s);
  assert.match(wxml, /open-type="share"/);
  assert.match(wxml, /data-share-type="customMenu"/);
  assert.match(wxml, /wx:if="{{customDishes\.length}}"/);
  assert.match(wxml, /class="share-menu-button"/);
  assert.match(wxss, /\.share-menu-button\s*\{/);
});

test('selected dish images can be previewed in the native image viewer', () => {
  const js = read('pages/index/index.js');
  const wxml = read('pages/index/index.wxml');

  assert.match(js, /previewSelectedDishImage/);
  assert.match(js, /wx\.previewImage/);
  assert.match(wxml, /bindtap="previewSelectedDishImage"/);
  assert.match(wxml, /data-src="{{item\.dish\.image \|\| '\/assets\/images\/dish-default\.jpg'}}"/);
  assert.match(wxml, /aria-label="查看{{item\.dish\.name}}大图"/);
});
