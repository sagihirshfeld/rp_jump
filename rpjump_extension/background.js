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
    throw new Error('Configuration missing. Please configure RP Jump in the extension options.');
  }

  // Call the embedded main function
  return await main(url, config.rpApiKey, config.rpBaseUrl);
}

async function addFavorite(title, url) {
  const { favorites = {} } = await chrome.storage.local.get(['favorites']);

  if (favorites[title]) {
    console.log('URL already in favorites.');
    return;
  }
  console.log('Adding URL to favorites:', title);

  // Get the path after the must-gather logs root
  // The must-gather logs root has either quay or registry in the URL
  const sub_parts = url.split('/');
  const root = sub_parts.find(part => part.includes('quay') || part.includes('registry'));
  if (!root) {
    console.warn('Could not determine logs root for URL:', url);
    return;
  }
  const relative_path_suffix = sub_parts.slice(sub_parts.indexOf(root) + 1).join('/');

  favorites[title] = relative_path_suffix;
  await chrome.storage.local.set({ favorites });

  // Add new context menu item for the favorite
  chrome.contextMenus.create({
    id: `rpjump-favorite-${title}`,
    parentId: 'rpjump',
    title: title,
    contexts: ['page'],
  });
}

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
  // Create context menu
  chrome.contextMenus.create({
    id: 'rpjump',
    title: 'RP Jump 🔗',
    contexts: ['page', 'link', 'selection'],
  });

  chrome.contextMenus.create({
    id: 'rpjump-add-favorite',
    parentId: 'rpjump',
    title: 'Add logs location to favorites',
    contexts: ['page'],
  });

  // Children (1st level)
  chrome.contextMenus.create({
    id: 'rpjump-root',
    parentId: 'rpjump',
    title: 'Jump to must-gather logs root',
    contexts: ['page'],
  });
});

// Handle click on the RP Jump context menu item
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const url = info.linkUrl || tab.url;
    const finalUrl = await processRpJump(url);
    chrome.tabs.create({ url: finalUrl });
  } catch (error) {
    handleError(error, tab);
  }
});

// Handle click on the RP Jump context menu item
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'rpjump-add-favorite') {
      const pageUrl = info.linkUrl || tab.url;
      const title = tab.title || 'Favorite';
      await addFavorite(title, pageUrl);
      return;
    }

    if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('rpjump-favorite-')) {
      const favTitle = info.menuItemId.replace('rpjump-favorite-', '');
      const { favorites = {} } = await chrome.storage.local.get(['favorites']);
      const relativePathSuffix = favorites[favTitle];
      if (!relativePathSuffix) {
        console.warn('Favorite not found:', favTitle);
        return;
      }
      const baseUrl = info.linkUrl || tab.url;
      const newUrl = (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + relativePathSuffix;
      const finalUrl = await processRpJump(newUrl);
      chrome.tabs.create({ url: finalUrl });
      return;
    }

    if (info.menuItemId === 'rpjump-root') {
      const url = info.linkUrl || tab.url;
      const finalUrl = await processRpJump(url);
      chrome.tabs.create({ url: finalUrl });
      return;
    }

    // Default: top-level menu click
    {
      const url = info.linkUrl || tab.url;
      const finalUrl = await processRpJump(url);
      chrome.tabs.create({ url: finalUrl });
    }
  } catch (error) {
    handleError(error, tab);
  }
});

// Handle click on the RP Jump extension icon click
chrome.action.onClicked.addListener(async tab => {
  try {
    const finalUrl = await processRpJump(tab.url);
    console.log('RP Jump → Opening:', finalUrl);
    chrome.tabs.create({ url: finalUrl });
  } catch (error) {
    handleError(error, tab);
  }
});
