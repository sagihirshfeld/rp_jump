// Import report_portal functions
import { findMustGatherTarballUrl } from './report_portal.js';
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
 * Resolve the must-gather tarball URL from a ReportPortal page URL.
 */
async function processMustGatherTarball(url) {
  const config = await chrome.storage.local.get(['rpApiKey', 'rpBaseUrl']);

  if (!config.rpApiKey || !config.rpBaseUrl) {
    throw new UsageError(
      'Configuration missing. Please configure RP Jump in the extension options.'
    );
  }

  return await findMustGatherTarballUrl(url, config.rpApiKey, config.rpBaseUrl);
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
  if (tab.url?.startsWith('blob:')) {
    return;
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

    const browserPageUrl = chrome.runtime.getURL('directory_browser.html');
    const isDirectoryBrowser = tab.url?.startsWith(browserPageUrl);
    const extensionOrigin = new URL(browserPageUrl).origin;
    const isExtensionBlob = tab.url?.startsWith(`blob:${extensionOrigin}`);

    if (info.menuItemId === 'rpjump-add-favorite') {
      if (isExtensionBlob) {
        await chrome.storage.session.set({ pendingAddFavorite: true });
        await chrome.tabs.update(tab.id, { url: browserPageUrl });
      } else if (isDirectoryBrowser) {
        chrome.tabs.sendMessage(tab.id, { action: 'addFavorite' });
      } else {
        await addFavoriteFromUrl(pageUrl, tab.id);
      }
      return;
    }

    const isMustGatherSubPath = pageUrl?.includes('must-gather');

    // Open favorite
    if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('rpjump-favorite-')) {
      const favTitle = info.menuItemId.replace('rpjump-favorite-', '');
      const relativePathSuffix = await getFavoritePath(favTitle);
      if (!relativePathSuffix) {
        console.warn('Favorite not found:', favTitle);
        return;
      }
      if (isExtensionBlob) {
        await chrome.storage.session.set({
          pendingNavigate: { type: 'favorite', favoritePath: relativePathSuffix },
        });
        await chrome.tabs.update(tab.id, { url: browserPageUrl });
        return;
      }
      if (isDirectoryBrowser) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'navigateToFavorite',
          favoritePath: relativePathSuffix,
        });
        return;
      }
      if (isMustGatherSubPath) {
        targetUrl = getMustGatherRootUrl(pageUrl) + '/' + relativePathSuffix;
      } else {
        const tarballUrl = await processMustGatherTarball(pageUrl);
        const params = new URLSearchParams({
          tarballUrl,
          mustGatherRoot: 'true',
          favoritePath: relativePathSuffix,
        });
        chrome.tabs.create({ url: `${browserPageUrl}?${params}` });
        return;
      }
    }

    // Open must-gather root
    if (info.menuItemId === 'rpjump-root') {
      if (isExtensionBlob) {
        await chrome.storage.session.set({
          pendingNavigate: { type: 'mustGatherRoot' },
        });
        await chrome.tabs.update(tab.id, { url: browserPageUrl });
        return;
      }
      if (isDirectoryBrowser) {
        chrome.tabs.sendMessage(tab.id, { action: 'navigateToMustGatherRoot' });
        return;
      }
      if (isMustGatherSubPath) {
        targetUrl = getMustGatherRootUrl(pageUrl);
      } else {
        const tarballUrl = await processMustGatherTarball(pageUrl);
        const params = new URLSearchParams({
          tarballUrl,
          mustGatherRoot: 'true',
        });
        chrome.tabs.create({ url: `${browserPageUrl}?${params}` });
        return;
      }
    }

    if (isMustGatherSubPath) {
      chrome.tabs.update(tab.id, { url: targetUrl });
    } else {
      chrome.tabs.create({ url: targetUrl });
    }
  } catch (error) {
    handleError(error, tab);
  }
});
