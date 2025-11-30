// Import report_portal functions
import { main } from './report_portal.js';
import { UsageError, UnexpectedStructureError } from './errors.js';

function alertInTab(tabId, message) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: m => alert(m),
    args: [message],
  });
}

/**
 * Process a ReportPortal URL using embedded JavaScript logic.
 */
async function processRpJump(url) {
  // Load configuration from storage
  const config = await chrome.storage.local.get(['rpApiKey', 'rpBaseUrl']);

  if (!config.rpApiKey || !config.rpBaseUrl) {
    throw new UsageError(
      'Configuration missing. Please configure RP Jump in the extension options.'
    );
  }

  // Call the embedded main function
  return await main(url, config.rpApiKey, config.rpBaseUrl);
}

/**
 * Add a must-gather sub-path to the list of favorites in the context menu.
 * @param {string} url - The URL of the must-gather sub-path to add to favorites.
 * @param {number} tabId - The ID of the tab to add the favorite to.
 * @returns {Promise<void>} - A promise that resolves when the favorite is added.
 */
async function addFavorite(url, tabId) {
  // Validate URL structure first
  const sub_parts = url.split('/');
  const root = sub_parts.find(part => part.includes('quay') || part.includes('registry'));

  if (!root || root === sub_parts[sub_parts.length - 1]) {
    throw new UsageError('Only must-gather sub-paths can be added to favorites!');
  }

  const { favorites = {} } = await chrome.storage.local.get(['favorites']);
  const relative_path_suffix = sub_parts.slice(sub_parts.indexOf(root) + 1).join('/');

  if (Object.values(favorites).includes(relative_path_suffix)) {
    throw new UsageError(`Sub-path already in favorites!`);
  }

  // Get the default title from the last part of the URL, handling trailing slashes
  const cleanUrl = url.replace(/\/+$/, '');
  const defaultTitle = cleanUrl.split('/').pop();

  if (!defaultTitle) {
    throw new Error('Could not determine a title for this favorite.');
  }

  // Ask user for title
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: def => prompt('Enter a name for this favorite:', def),
    args: [defaultTitle],
  });

  const title = results[0]?.result;
  if (!title) {
    console.log('User cancelled add favorite.');
    return;
  }

  console.log('Adding URL to favorites:', title);
  favorites[title] = relative_path_suffix;
  await chrome.storage.local.set({ favorites });
}

/**
 * Handle an error by logging it and alerting the user in the tab.
 * @param {Error} error - The error to handle.
 * @param {Object} tab - The tab to alert the user in.
 * @returns {Promise<void>} - A promise that resolves when the error is handled.
 */
async function handleError(error, tab) {
  if (error instanceof UsageError || error instanceof UnexpectedStructureError) {
    console.warn('RP Jump error:', error);
  } else {
    console.error('RP Jump error:', error);
  }
  alertInTab(tab.id, `❌ RP Jump failed:\n${error.message}`);
}

/**
 * Rebuild the context menu.
 * @returns {Promise<void>} - A promise that resolves when the context menu is rebuilt.
 */
async function rebuildContextMenu() {
  chrome.contextMenus.removeAll(async () => {
    // Create context menu
    chrome.contextMenus.create({
      id: 'rpjump',
      title: 'RP Jump 🔗',
      contexts: ['page', 'link', 'selection'],
    });

    // Children (1st level)
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

    // Children (2nd level)
    chrome.contextMenus.create({
      id: 'rpjump-add-favorite',
      parentId: 'rpjump',
      title: 'Add to favorites! 💫',
      contexts: ['page', 'link', 'selection'],
    });

    // Load favorites from storage
    const { favorites = {} } = await chrome.storage.local.get(['favorites']);
    for (const title of Object.keys(favorites)) {
      if (!title) continue;
      chrome.contextMenus.create({
        id: `rpjump-favorite-${title}`,
        parentId: 'rpjump-favorites',
        title: title,
        contexts: ['page', 'selection'],
      });
    }
  });
}

// Add context menu (right-click menu) on installation
chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenu();
});

// Rebuild menu when storage changes (e.g. favorites added/removed)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.favorites) {
    rebuildContextMenu();
  }
});

// Handle click on the RP Jump context menu item
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    // Add to favorites
    if (info.menuItemId === 'rpjump-add-favorite') {
      const pageUrl = info.linkUrl || tab.url;
      await addFavorite(pageUrl, tab.id);
      return;
    }

    // Open favorite
    if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('rpjump-favorite-')) {
      const favTitle = info.menuItemId.replace('rpjump-favorite-', '');
      const { favorites = {} } = await chrome.storage.local.get(['favorites']);
      const relativePathSuffix = favorites[favTitle];
      if (!relativePathSuffix) {
        console.warn('Favorite not found:', favTitle);
        return;
      }
      const baseUrl = info.linkUrl || tab.url;
      const finalUrl = (await processRpJump(baseUrl)) + '/' + relativePathSuffix;
      chrome.tabs.create({ url: finalUrl });
      return;
    }

    // Open must-gather root
    if (info.menuItemId === 'rpjump-root') {
      const url = info.linkUrl || tab.url;
      const finalUrl = await processRpJump(url);
      chrome.tabs.create({ url: finalUrl });
      return;
    }
  } catch (error) {
    handleError(error, tab);
  }
});
