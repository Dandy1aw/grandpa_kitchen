const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const pageFiles = [
  'pages/index/index.js',
  'pages/order/order.js',
  'pages/success/success.js',
  'pages/admin/admin.js',
  'pages/logs/logs.js',
];

function loadPageConfig(filePath) {
  const absolutePath = path.join(__dirname, '..', filePath);
  const previousPage = global.Page;
  let pageConfig = null;

  global.Page = (config) => {
    pageConfig = config;
  };

  delete require.cache[require.resolve(absolutePath)];
  require(absolutePath);

  if (previousPage) {
    global.Page = previousPage;
  } else {
    delete global.Page;
  }

  return pageConfig;
}

test('main pages use native Mini Program sharing back to the home menu', () => {
  for (const filePath of pageFiles) {
    const pageConfig = loadPageConfig(filePath);

    assert.equal(typeof pageConfig.onShareAppMessage, 'function', filePath);
    assert.deepEqual(pageConfig.onShareAppMessage(), {
      title: '爷爷的厨房',
      path: '/pages/index/index',
      imageUrl: '/assets/images/grandpa-q-cooking.jpg',
    });
  }
});
