import { UsageError } from './errors.js';

/**
 * Favorites storage model:
 * - favorites: { [title: string]: string } (title -> relative path suffix)
 * - favoriteOrder: string[] (ordered list of titles)
 */

export async function getFavorites() {
  const { favorites = {} } = await chrome.storage.local.get(['favorites']);
  return favorites;
}

export async function getFavoriteOrder() {
  const { favoriteOrder = [] } = await chrome.storage.local.get(['favoriteOrder']);
  return Array.isArray(favoriteOrder) ? favoriteOrder : [];
}

export async function setFavoritesAndOrder(favorites, favoriteOrder) {
  await chrome.storage.local.set({ favorites, favoriteOrder });
}

/**
 * Ensure `favoriteOrder` matches keys in `favorites` and return ordered titles.
 */
export async function getOrderedFavoriteTitles() {
  const { favorites = {}, favoriteOrder = [] } = await chrome.storage.local.get([
    'favorites',
    'favoriteOrder',
  ]);

  const keys = Object.keys(favorites);
  const validOrder = (Array.isArray(favoriteOrder) ? favoriteOrder : []).filter(t => favorites[t]);
  const missing = keys.filter(k => !validOrder.includes(k));
  const finalOrder = [...validOrder, ...missing];

  if (
    finalOrder.length !== (Array.isArray(favoriteOrder) ? favoriteOrder.length : 0) ||
    missing.length > 0
  ) {
    await chrome.storage.local.set({ favoriteOrder: finalOrder });
  }

  return finalOrder;
}

export async function getFavoritePath(title) {
  const favorites = await getFavorites();
  return favorites[title] || null;
}

export async function deleteFavorite(title) {
  const { favorites = {}, favoriteOrder = [] } = await chrome.storage.local.get([
    'favorites',
    'favoriteOrder',
  ]);
  if (!Object.prototype.hasOwnProperty.call(favorites, title)) return false;

  delete favorites[title];
  const newOrder = (Array.isArray(favoriteOrder) ? favoriteOrder : []).filter(t => t !== title);
  await chrome.storage.local.set({ favorites, favoriteOrder: newOrder });
  return true;
}

export async function renameFavorite(oldTitle, newTitle) {
  const trimmed = (newTitle || '').trim();
  if (!trimmed) throw new UsageError('Favorite name cannot be empty.');

  const { favorites = {}, favoriteOrder = [] } = await chrome.storage.local.get([
    'favorites',
    'favoriteOrder',
  ]);

  if (!Object.prototype.hasOwnProperty.call(favorites, oldTitle)) {
    throw new UsageError('Favorite no longer exists.');
  }
  if (Object.prototype.hasOwnProperty.call(favorites, trimmed)) {
    throw new UsageError(`A favorite named "${trimmed}" already exists.`);
  }

  favorites[trimmed] = favorites[oldTitle];
  delete favorites[oldTitle];

  const order = Array.isArray(favoriteOrder) ? [...favoriteOrder] : [];
  const idx = order.indexOf(oldTitle);
  if (idx !== -1) order[idx] = trimmed;
  else order.push(trimmed);

  await chrome.storage.local.set({ favorites, favoriteOrder: order });
  return trimmed;
}

export async function reorderFavoriteOrder(srcIndex, targetIndex) {
  const order = await getOrderedFavoriteTitles();
  if (
    srcIndex < 0 ||
    srcIndex >= order.length ||
    targetIndex < 0 ||
    targetIndex >= order.length ||
    srcIndex === targetIndex
  ) {
    return false;
  }

  const next = [...order];
  const [item] = next.splice(srcIndex, 1);
  next.splice(targetIndex, 0, item);
  await chrome.storage.local.set({ favoriteOrder: next });
  return true;
}

export function exportFavoritesPayload({ favorites, favoriteOrder }) {
  return {
    favorites,
    favoriteOrder,
    exportedAt: new Date().toISOString(),
    version: 1,
  };
}

function isRecordOfStrings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(v => typeof v === 'string');
}

/**
 * If `favoriteOrder` contains titles not present in favorites keys, treat it as a rename intent
 * and rename unused keys to those missing titles (only when unambiguous).
 */
export function reconcileImportedFavorites(importedFavorites, importedOrderRaw) {
  const favorites = { ...(importedFavorites || {}) };
  const favoriteKeys = Object.keys(favorites);
  let order = Array.isArray(importedOrderRaw)
    ? importedOrderRaw.filter(t => typeof t === 'string')
    : favoriteKeys;

  const keySet = new Set(favoriteKeys);
  const referencedExisting = new Set(order.filter(t => keySet.has(t)));
  const missingTitles = order.filter(t => !keySet.has(t));
  const unusedKeys = favoriteKeys.filter(k => !referencedExisting.has(k));

  if (missingTitles.length > 0 && missingTitles.length === unusedKeys.length) {
    const already = new Set(favoriteKeys);
    for (const mt of missingTitles) {
      if (already.has(mt)) return { favorites, order };
      already.add(mt);
    }
    for (let i = 0; i < missingTitles.length; i++) {
      const oldKey = unusedKeys[i];
      const newKey = missingTitles[i];
      favorites[newKey] = favorites[oldKey];
      delete favorites[oldKey];
    }
  }

  order = order.filter(t => Object.prototype.hasOwnProperty.call(favorites, t));
  const missingKeys = Object.keys(favorites).filter(t => !order.includes(t));
  order = [...order, ...missingKeys];

  return { favorites, order };
}

export function parseFavoritesImportJson(text) {
  const parsed = JSON.parse(text);
  const importedFavorites = parsed?.favorites;
  const importedOrder = parsed?.favoriteOrder;

  if (!isRecordOfStrings(importedFavorites)) {
    throw new Error(
      'Invalid JSON format. Expected { "favorites": { "title": "path", ... }, "favoriteOrder": [...] }.'
    );
  }

  return reconcileImportedFavorites(importedFavorites, importedOrder);
}

/**
 * Add a must-gather sub-path to favorites.
 */
export async function addFavoriteFromUrl(url, tabId) {
  const sub_parts = url.split('/');
  const root = sub_parts.find(part => part.includes('quay') || part.includes('registry'));
  if (!root || root === sub_parts[sub_parts.length - 1]) {
    throw new UsageError('Only must-gather sub-paths can be added to favorites!');
  }

  const { favorites = {} } = await chrome.storage.local.get(['favorites']);
  const relative_path_suffix = sub_parts.slice(sub_parts.indexOf(root) + 1).join('/');
  if (Object.values(favorites).includes(relative_path_suffix)) {
    throw new UsageError('Sub-path already in favorites!');
  }

  const cleanUrl = url.replace(/\/+$/, '');
  const defaultTitle = cleanUrl.split('/').pop();
  if (!defaultTitle) throw new Error('Could not determine a title for this favorite.');

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: def => prompt('Enter a name for this favorite:', def),
    args: [defaultTitle],
  });
  const title = results[0]?.result?.trim();
  if (!title) return null;

  favorites[title] = relative_path_suffix;

  const order = await getOrderedFavoriteTitles();
  const nextOrder = order.includes(title) ? order : [...order, title];
  await chrome.storage.local.set({ favorites, favoriteOrder: nextOrder });
  return title;
}
