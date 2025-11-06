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
