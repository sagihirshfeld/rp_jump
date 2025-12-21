// Import report_portal functions
import { main } from './report_portal.js';
import { UsageError, UnexpectedStructureError } from './errors.js';
import { getMustGatherRootUrl } from './utils.js';
import { addFavoriteFromUrl, getFavoritePath } from './favorites.js';
import { rebuildContextMenu } from './context_menu.js';

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

// Add context menu (right-click menu) on installation
chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenu();
});

// Rebuild menu when storage changes (e.g. favorites added/removed)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.favorites || changes.favoriteOrder)) {
    rebuildContextMenu();
  }
});

// Handle click on the RP Jump context menu item
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const pageUrl = info.linkUrl || tab.url;
    let targetUrl;

    if (info.menuItemId === 'rpjump-add-favorite') {
      await addFavoriteFromUrl(pageUrl, tab.id);
      return;
    }

    // Are we in a must-gather sub-path?
    const isMustGatherSubPath = pageUrl?.includes('must-gather');

    // Open favorite
    if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('rpjump-favorite-')) {
      const favTitle = info.menuItemId.replace('rpjump-favorite-', '');
      const relativePathSuffix = await getFavoritePath(favTitle);
      if (!relativePathSuffix) {
        console.warn('Favorite not found:', favTitle);
        return;
      }
      if (isMustGatherSubPath) {
        targetUrl = getMustGatherRootUrl(pageUrl) + '/' + relativePathSuffix;
      } else {
        targetUrl = (await processRpJump(pageUrl)) + '/' + relativePathSuffix;
      }
    }

    // Open must-gather root
    if (info.menuItemId === 'rpjump-root') {
      if (isMustGatherSubPath) {
        targetUrl = getMustGatherRootUrl(pageUrl);
      } else {
        targetUrl = await processRpJump(pageUrl);
      }
    }

    if (isMustGatherSubPath) {
      // Change the current tab to the target URL
      chrome.tabs.update(tab.id, { url: targetUrl });
    } else {
      chrome.tabs.create({ url: targetUrl });
    }
  } catch (error) {
    handleError(error, tab);
  }
});
