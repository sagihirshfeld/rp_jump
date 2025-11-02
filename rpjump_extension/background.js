function alertInTab(tabId, message) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (m) => alert(m),
    args: [message]
  });
}

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

// Right-click menu entry
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rpjump",
    title: "RP Jump 🔗",
    contexts: ["page", "link", "selection"]
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

