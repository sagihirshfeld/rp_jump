import { getOrderedFavoriteTitles } from './favorites.js';

/**
 * Rebuild the extension context menu.
 */
export async function rebuildContextMenu() {
  chrome.contextMenus.removeAll(async () => {
    chrome.contextMenus.create({
      id: 'rpjump',
      title: 'RP Jump 🔗',
      contexts: ['page', 'link', 'selection'],
    });

    chrome.contextMenus.create({
      id: 'rpjump-root',
      parentId: 'rpjump',
      title: 'must-gather root 📂',
      contexts: ['page', 'selection'],
    });

    chrome.contextMenus.create({
      id: 'rpjump-favorites',
      parentId: 'rpjump',
      title: 'Favorites ⭐',
      contexts: ['page', 'link', 'selection'],
    });

    chrome.contextMenus.create({
      id: 'rpjump-add-favorite',
      parentId: 'rpjump',
      title: 'Add to favorites! 💫',
      contexts: ['page', 'link', 'selection'],
    });

    const titles = await getOrderedFavoriteTitles();
    for (const title of titles) {
      if (!title) continue;
      chrome.contextMenus.create({
        id: `rpjump-favorite-${title}`,
        parentId: 'rpjump-favorites',
        title,
        contexts: ['page', 'selection'],
      });
    }
  });
}
