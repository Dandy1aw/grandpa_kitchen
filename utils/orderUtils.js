function addDishToCart(cart, dish) {
  const next = cart.map((item) => ({ dish: item.dish, quantity: item.quantity }));
  const existing = next.find((item) => item.dish.id === dish.id);

  if (existing) {
    existing.quantity += 1;
    return next;
  }

  next.push({ dish, quantity: 1 });
  return next;
}

function decrementDishInCart(cart, dishId) {
  return cart
    .map((item) => {
      if (item.dish.id !== dishId) {
        return { dish: item.dish, quantity: item.quantity };
      }

      return { dish: item.dish, quantity: item.quantity - 1 };
    })
    .filter((item) => item.quantity > 0);
}

function getCartSummary(cart) {
  return cart.reduce(
    (summary, item) => {
      if (!isValidFullCartItem(item)) {
        return summary;
      }

      return {
        totalCount: summary.totalCount + item.quantity,
      };
    },
    { totalCount: 0 },
  );
}

function compactCartItems(cart) {
  return cart
    .filter(isValidFullCartItem)
    .map((item) => ({
      id: item.dish.id,
      quantity: item.quantity,
    }));
}

function restoreCartItems(items, catalog) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.reduce((cart, item) => {
    if (!item || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return cart;
    }

    const dish = catalog.find((catalogDish) => catalogDish.id === item.id);
    if (!dish) {
      return cart;
    }

    cart.push({ dish, quantity: item.quantity });
    return cart;
  }, []);
}

function serializeOrderPayload(payload) {
  return encodeURIComponent(JSON.stringify(payload));
}

function parseOrderPayload(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(value));
  } catch (error) {
    return null;
  }
}

function isValidFullCartItem(item) {
  return Boolean(
    item
      && item.dish
      && typeof item.dish.id === 'string'
      && typeof item.dish.name === 'string'
      && Number.isInteger(item.quantity)
      && item.quantity > 0,
  );
}

module.exports = {
  addDishToCart,
  compactCartItems,
  decrementDishInCart,
  getCartSummary,
  serializeOrderPayload,
  parseOrderPayload,
  restoreCartItems,
};
