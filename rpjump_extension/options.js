// Load saved configuration
document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.local.get(['rpApiKey', 'rpBaseUrl']);

  if (config.rpApiKey) {
    document.getElementById('apiKey').value = config.rpApiKey;
  }
  if (config.rpBaseUrl) {
    document.getElementById('baseUrl').value = config.rpBaseUrl;
  }

  loadFavorites();
});

async function loadFavorites() {
  const { favorites = {} } = await chrome.storage.local.get(['favorites']);
  const list = document.getElementById('favoritesList');
  const noFavorites = document.getElementById('noFavorites');

  list.innerHTML = '';
  const titles = Object.keys(favorites);

  if (titles.length === 0) {
    noFavorites.style.display = 'block';
    return;
  }

  noFavorites.style.display = 'none';

  titles.sort().forEach(title => {
    const li = document.createElement('li');
    li.className = 'favorite-item';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'favorite-info';

    const titleSpan = document.createElement('div');
    titleSpan.className = 'favorite-title';
    titleSpan.textContent = title || '<Untitled>';
    if (!title) {
      titleSpan.style.color = '#999';
      titleSpan.style.fontStyle = 'italic';
    }

    const pathSpan = document.createElement('div');
    pathSpan.className = 'favorite-path';
    pathSpan.textContent = favorites[title];

    infoDiv.appendChild(titleSpan);
    infoDiv.appendChild(pathSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteFavorite(title);

    li.appendChild(infoDiv);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

async function deleteFavorite(title) {
  if (!confirm(`Are you sure you want to delete favorite "${title}"?`)) {
    return;
  }

  const { favorites = {} } = await chrome.storage.local.get(['favorites']);
  delete favorites[title];
  await chrome.storage.local.set({ favorites });

  showStatus(`Deleted favorite "${title}"`, 'success');
  loadFavorites();
}

// Handle form submission
document.getElementById('configForm').addEventListener('submit', async e => {
  e.preventDefault();

  const apiKey = document.getElementById('apiKey').value.trim();
  const baseUrl = document.getElementById('baseUrl').value.trim();

  const statusDiv = document.getElementById('status');

  // Validate inputs
  if (!apiKey || !baseUrl) {
    showStatus('Please fill in all fields', 'error');
    return;
  }

  // Remove trailing slash from base URL
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

  // Save to chrome.storage.local
  await chrome.storage.local.set({
    rpApiKey: apiKey,
    rpBaseUrl: cleanBaseUrl,
  });

  // Configuration is saved and ready to use
  showStatus('Configuration saved successfully!', 'success');
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}
