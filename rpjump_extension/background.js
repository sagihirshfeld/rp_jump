function alertInTab(tabId, message) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (m) => alert(m),
    args: [message]
  });
}

// Send configuration to server when available
async function sendConfigToServer() {
  const config = await chrome.storage.local.get(['rpApiKey', 'rpBaseUrl', 'rpProject']);

  if (config.rpApiKey && config.rpBaseUrl && config.rpProject) {
    try {
      await fetch('http://127.0.0.1:9999/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: config.rpApiKey,
          baseUrl: config.rpBaseUrl,
          project: config.rpProject
        })
      });
      console.log('RP Jump: Configuration sent to server');
    } catch (error) {
      // Server might not be running yet, that's okay
      console.log('RP Jump: Could not send config to server (server may not be running)');
    }
  }
}

// Send config on startup and when storage changes
chrome.runtime.onStartup.addListener(() => {
  sendConfigToServer();
});

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: "rpjump",
    title: "RP Jump 🔗",
    contexts: ["page", "link", "selection"]
  });
  // Send config to server
  sendConfigToServer();
});

chrome.storage.onChanged.addListener(() => {
  sendConfigToServer();
});

chrome.action.onClicked.addListener((tab) => {
  const endpoint = "http://127.0.0.1:9999/jump?url=" + encodeURIComponent(tab.url);

  fetch(endpoint)
    .then(async (response) => {
      const text = await response.text();

      if (response.ok) {
        const finalUrl = text.trim();
        console.log("RP Jump → Opening:", finalUrl);
        chrome.tabs.create({ url: finalUrl });
      } else {
        // ❌ Failure: show alert inside current tab
        alertInTab(tab.id, "❌ RP Jump failed:\n" + text);
      }
    })
    .catch((err) => {
      alertInTab(tab.id, "💥 Could not reach RP Jump server:\n" + err.toString());
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const endpoint = "http://127.0.0.1:9999/jump?url=" +
      encodeURIComponent(info.linkUrl || tab.url);

  fetch(endpoint)
    .then(async (response) => {
      const text = await response.text();

      if (response.ok) {
        chrome.tabs.create({ url: text.trim() });
      } else {
        alertInTab(tab.id, "❌ RP Jump failed:\n" + text);
      }
    })
    .catch((err) => {
      alertInTab(tab.id, "💥 Could not reach RP Jump server:\n" + err.toString());
    });
});
