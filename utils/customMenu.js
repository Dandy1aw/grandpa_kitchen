const CUSTOM_MENU_STORAGE_KEY = 'grandpa-kitchen-custom-dishes';

const CATEGORY_META = {
  hot: { name: '热菜', color: '#f8d78a' },
  staple: { name: '主食', color: '#f5a66f' },
  soup: { name: '汤粥', color: '#c8dfb0' },
  sweet: { name: '小甜口', color: '#f3b7b2' },
};

function buildCustomDish(form, id) {
  const name = cleanText(form && form.name);
  if (!name) {
    return null;
  }

  const category = CATEGORY_META[form && form.category] ? form.category : 'hot';
  const meta = CATEGORY_META[category];
  const desc = cleanText(form && form.desc) || '家里新加的一道菜';
  const tag = cleanText(form && form.tag) || '家里新增';
  const image = cleanText(form && form.image);

  return {
    id: id || `custom-${Date.now()}`,
    name,
    category,
    categoryName: meta.name,
    desc,
    tag,
    image,
    color: meta.color,
    recommended: false,
    custom: true,
  };
}

function normalizeCustomDishes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((dishes, item) => {
    const dish = buildCustomDish(item, item && item.id);
    if (dish && isCustomDish(dish)) {
      dishes.push(dish);
    }
    return dishes;
  }, []);
}

function mergeDishCatalog(baseCatalog, customDishes) {
  const catalog = Array.isArray(baseCatalog) ? baseCatalog.slice() : [];
  const ids = new Set(catalog.map((dish) => dish.id));

  normalizeCustomDishes(customDishes).forEach((dish) => {
    if (!ids.has(dish.id)) {
      catalog.push(dish);
      ids.add(dish.id);
    }
  });

  return catalog;
}

function getCustomDishesFromCart(cart) {
  const ids = new Set();
  const dishes = [];

  if (!Array.isArray(cart)) {
    return dishes;
  }

  cart.forEach((item) => {
    const dish = item && item.dish;
    if (isCustomDish(dish) && !ids.has(dish.id)) {
      dishes.push(dish);
      ids.add(dish.id);
    }
  });

  return dishes;
}

function serializeSharedMenuPayload(customDishes) {
  const dishes = normalizeCustomDishes(customDishes).map((dish) => ({
    ...dish,
    image: '',
  }));

  return encodeURIComponent(JSON.stringify({
    version: 1,
    dishes,
  }));
}

function parseSharedMenuPayload(value) {
  if (!value) {
    return [];
  }

  try {
    const payload = parseJsonPayload(value);
    return normalizeCustomDishes(payload && payload.dishes);
  } catch (error) {
    return [];
  }
}

function mergeSharedCustomDishes(existingDishes, sharedDishes) {
  const dishes = normalizeCustomDishes(existingDishes);
  const ids = new Set(dishes.map((dish) => dish.id));
  const nameKeys = new Set(dishes.map(getDishNameKey));
  let importedCount = 0;
  const newDishes = [];

  normalizeCustomDishes(sharedDishes).forEach((dish) => {
    const nameKey = getDishNameKey(dish);
    if (ids.has(dish.id) || nameKeys.has(nameKey)) {
      return;
    }

    dishes.push(dish);
    ids.add(dish.id);
    nameKeys.add(nameKey);
    importedCount += 1;
    newDishes.push(dish);
  });

  return {
    dishes,
    importedCount,
    newDishes,
  };
}

function isCustomDish(dish) {
  return Boolean(
    dish
      && dish.custom === true
      && typeof dish.id === 'string'
      && dish.id.length > 0
      && typeof dish.name === 'string'
      && dish.name.length > 0,
  );
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseJsonPayload(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return JSON.parse(decodeURIComponent(value));
  }
}

function getDishNameKey(dish) {
  return `${dish.category}:${dish.name}`;
}

const COLLECTION_CUSTOM_DISHES = 'custom_dishes';
const COLLECTION_DISH_OVERRIDES = 'dish_overrides';

function _db() {
  return wx.cloud.database();
}

async function loadCustomDishesFromCloud() {
  try {
    const res = await _db().collection(COLLECTION_CUSTOM_DISHES).get();
    return normalizeCustomDishes(res.data || []);
  } catch (e) {
    return [];
  }
}

async function saveCustomDishToCloud(dish) {
  try {
    const res = await _db()
      .collection(COLLECTION_CUSTOM_DISHES)
      .where({ id: dish.id })
      .get();
    if (res.data && res.data.length > 0) return;
    await _db().collection(COLLECTION_CUSTOM_DISHES).add({ data: dish });
  } catch (e) {}
}

async function saveCustomDishesToCloud(dishes) {
  await Promise.all(normalizeCustomDishes(dishes).map(saveCustomDishToCloud));
}

async function deleteCustomDishFromCloud(dishId) {
  try {
    const res = await _db()
      .collection(COLLECTION_CUSTOM_DISHES)
      .where({ id: dishId })
      .get();
    if (res.data && res.data[0]) {
      await _db().collection(COLLECTION_CUSTOM_DISHES).doc(res.data[0]._id).remove();
    }
  } catch (e) {}
}

async function updateCustomDishImageInCloud(dishId, imagePath) {
  try {
    const res = await _db().collection(COLLECTION_CUSTOM_DISHES).where({ id: dishId }).get();
    if (res.data && res.data[0]) {
      await _db().collection(COLLECTION_CUSTOM_DISHES).doc(res.data[0]._id).update({
        data: { image: imagePath },
      });
    }
  } catch (e) {}
}

async function getDishOverrides() {
  try {
    const res = await _db().collection(COLLECTION_DISH_OVERRIDES).limit(1).get();
    const doc = res.data && res.data[0];
    return {
      deletedIds: (doc && doc.deletedIds) || [],
      imageOverrides: (doc && doc.imageOverrides) || {},
    };
  } catch (e) {
    return { deletedIds: [], imageOverrides: {} };
  }
}

async function addDeletedBuiltinDish(dishId) {
  const db = _db();
  try {
    const res = await db.collection(COLLECTION_DISH_OVERRIDES).limit(1).get();
    const doc = res.data && res.data[0];
    if (doc) {
      const deletedIds = (doc.deletedIds || []).concat(dishId);
      await db.collection(COLLECTION_DISH_OVERRIDES).doc(doc._id).update({
        data: { deletedIds },
      });
    } else {
      await db.collection(COLLECTION_DISH_OVERRIDES).add({
        data: { deletedIds: [dishId], imageOverrides: {} },
      });
    }
  } catch (e) {}
}

async function updateBuiltinDishImage(dishId, imagePath) {
  const db = _db();
  try {
    const res = await db.collection(COLLECTION_DISH_OVERRIDES).limit(1).get();
    const doc = res.data && res.data[0];
    if (doc) {
      await db.collection(COLLECTION_DISH_OVERRIDES).doc(doc._id).update({
        data: { [`imageOverrides.${dishId}`]: imagePath },
      });
    } else {
      await db.collection(COLLECTION_DISH_OVERRIDES).add({
        data: { deletedIds: [], imageOverrides: { [dishId]: imagePath } },
      });
    }
  } catch (e) {}
}

module.exports = {
  CUSTOM_MENU_STORAGE_KEY,
  buildCustomDish,
  getCustomDishesFromCart,
  mergeSharedCustomDishes,
  mergeDishCatalog,
  normalizeCustomDishes,
  parseSharedMenuPayload,
  serializeSharedMenuPayload,
  loadCustomDishesFromCloud,
  saveCustomDishToCloud,
  saveCustomDishesToCloud,
  deleteCustomDishFromCloud,
  updateCustomDishImageInCloud,
  getDishOverrides,
  addDeletedBuiltinDish,
  updateBuiltinDishImage,
};
