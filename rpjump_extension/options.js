import {
  deleteFavorite,
  exportFavoritesPayload,
  getFavorites,
  getOrderedFavoriteTitles,
  parseFavoritesImportJson,
  renameFavorite,
  reorderFavoriteOrder,
  setFavoritesAndOrder,
} from './favorites.js';

// IndexedDB for storing directory handle
const DB_NAME = 'DirectoryBrowserDB';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

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
  await loadBrowseDirectoryConfig();

  // Import / Export
  const exportBtn = document.getElementById('exportFavoritesBtn');
  const importBtn = document.getElementById('importFavoritesBtn');
  const importFile = document.getElementById('importFavoritesFile');

  if (exportBtn) exportBtn.addEventListener('click', onExportFavorites);
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => onImportFavorites(importFile));
  }

  // Browse Directory Configuration
  const selectBrowseDirBtn = document.getElementById('selectBrowseDirBtn');
  if (selectBrowseDirBtn) {
    selectBrowseDirBtn.addEventListener('click', onSelectBrowseDirectory);
  }
});

async function loadFavorites() {
  const favorites = await getFavorites();
  const list = document.getElementById('favoritesList');
  const noFavorites = document.getElementById('noFavorites');

  list.innerHTML = '';
  const titles = await getOrderedFavoriteTitles();

  if (titles.length === 0) {
    noFavorites.style.display = 'block';
    return;
  }

  noFavorites.style.display = 'none';

  titles.forEach((title, index) => {
    const li = document.createElement('li');
    li.className = 'favorite-item';

    // Drag handle + DnD reordering
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '☰';
    dragHandle.draggable = true;
    dragHandle.addEventListener('dragstart', e => handleDragStart(e, index));
    dragHandle.addEventListener('dragend', handleDragEnd);

    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', e => handleDrop(e, index));
    li.addEventListener('dragenter', handleDragEnter);
    li.addEventListener('dragleave', handleDragLeave);

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

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'favorite-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'action-btn edit-btn';
    renameBtn.textContent = 'Rename';
    renameBtn.onclick = () => onRenameFavorite(title);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => onDeleteFavorite(title);

    actionsDiv.appendChild(renameBtn);
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(dragHandle);
    li.appendChild(infoDiv);
    li.appendChild(actionsDiv);
    list.appendChild(li);
  });
}

let dragSrcIndex = null;

function handleDragStart(e, index) {
  dragSrcIndex = index;
  const row = e.target.closest('li');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  if (row) {
    e.dataTransfer.setDragImage(row, 10, 10);
    row.classList.add('dragging');
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDragEnd(e) {
  const row = e.currentTarget.closest('li');
  if (row) row.classList.remove('dragging');
  document.querySelectorAll('.favorite-item').forEach(item => item.classList.remove('drag-over'));
  dragSrcIndex = null;
}

async function handleDrop(e, targetIndex) {
  e.preventDefault();
  e.stopPropagation();

  const srcIndex = dragSrcIndex ?? Number.parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (Number.isNaN(srcIndex) || srcIndex === null) return;

  const moved = await reorderFavoriteOrder(srcIndex, targetIndex);
  if (moved) loadFavorites();
}

async function onDeleteFavorite(title) {
  if (!confirm(`Are you sure you want to delete favorite "${title}"?`)) {
    return;
  }

  const removed = await deleteFavorite(title);
  if (!removed) {
    showStatus(`Favorite "${title}" no longer exists.`, 'error');
    loadFavorites();
    return;
  }

  showStatus(`Deleted favorite "${title}"`, 'success');
  loadFavorites();
}

async function onRenameFavorite(oldTitle) {
  const displayOld = oldTitle || '<Untitled>';
  const input = prompt(`Rename favorite "${displayOld}" to:`, oldTitle || '');
  if (input === null) return;

  try {
    const newTitle = await renameFavorite(oldTitle, input);
    showStatus(`Renamed "${displayOld}" → "${newTitle}"`, 'success');
    loadFavorites();
  } catch (err) {
    showStatus(err.message || 'Rename failed.', 'error');
  }
}

function downloadJson(filename, data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function onExportFavorites() {
  const favorites = await getFavorites();
  const favoriteOrder = await getOrderedFavoriteTitles();
  const payload = exportFavoritesPayload({ favorites, favoriteOrder });
  const filename = `rpjump-favorites-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  downloadJson(filename, payload);
  showStatus('Exported favorites JSON.', 'success');
}

async function onImportFavorites(fileInput) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const { favorites: importedFavorites, order: importedOrder } = parseFavoritesImportJson(text);

    const replaceAll = confirm(
      'Import favorites:\n\nOK = Replace all existing favorites\nCancel = Merge into existing favorites'
    );

    if (replaceAll) {
      await setFavoritesAndOrder(importedFavorites, importedOrder);
      showStatus(
        `Imported ${Object.keys(importedFavorites).length} favorites (replaced existing).`,
        'success'
      );
      loadFavorites();
      return;
    }

    // Merge
    const existingFavorites = await getFavorites();
    const existingOrder = await getOrderedFavoriteTitles();

    const conflictingTitles = Object.keys(importedFavorites).filter(t =>
      Object.prototype.hasOwnProperty.call(existingFavorites, t)
    );
    const overwriteConflicts =
      conflictingTitles.length > 0
        ? confirm(
            `Found ${conflictingTitles.length} favorite name conflict(s).\n\nOK = Overwrite those titles\nCancel = Keep existing for those titles`
          )
        : false;

    const mergedFavorites = { ...existingFavorites };
    let added = 0;
    let overwritten = 0;

    for (const [title, path] of Object.entries(importedFavorites)) {
      if (Object.prototype.hasOwnProperty.call(existingFavorites, title)) {
        if (overwriteConflicts && existingFavorites[title] !== path) {
          mergedFavorites[title] = path;
          overwritten++;
        }
      } else {
        mergedFavorites[title] = path;
        added++;
      }
    }

    const mergedOrder = existingOrder.filter(t =>
      Object.prototype.hasOwnProperty.call(mergedFavorites, t)
    );
    for (const t of importedOrder) {
      if (!mergedOrder.includes(t) && Object.prototype.hasOwnProperty.call(mergedFavorites, t)) {
        mergedOrder.push(t);
      }
    }
    // Append any remaining keys
    for (const t of Object.keys(mergedFavorites)) {
      if (!mergedOrder.includes(t)) mergedOrder.push(t);
    }

    await setFavoritesAndOrder(mergedFavorites, mergedOrder);
    showStatus(
      `Imported favorites (added ${added}${overwritten ? `, overwritten ${overwritten}` : ''}).`,
      'success'
    );
    loadFavorites();
  } catch (err) {
    showStatus(`Import failed: ${err.message}`, 'error');
  } finally {
    fileInput.value = '';
  }
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

function showBrowseDirStatus(message, type) {
  const statusDiv = document.getElementById('browseDirStatus');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

/**
 * Open IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Store directory handle in IndexedDB
 */
async function storeDirectoryHandle(handle) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Wrap the put request in a promise
    await new Promise((resolve, reject) => {
      const request = store.put(handle, 'rootDirectory');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Wait for transaction to complete
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Failed to store directory handle:', error);
    throw error;
  }
}

/**
 * Retrieve directory handle from IndexedDB
 */
async function getStoredDirectoryHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    // Wrap the get request in a promise
    const handle = await new Promise((resolve, reject) => {
      const request = store.get('rootDirectory');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (handle) {
      // Verify we still have permission
      const permission = await handle.queryPermission({ mode: 'read' });
      if (permission === 'granted') {
        return handle;
      }
    }
  } catch (error) {
    console.warn('Could not retrieve stored handle:', error);
  }
  return null;
}

/**
 * Load and display current browse directory configuration
 */
async function loadBrowseDirectoryConfig() {
  const pathSpan = document.getElementById('browseDirPath');

  try {
    const handle = await getStoredDirectoryHandle();
    if (handle) {
      pathSpan.textContent = `/${handle.name}`;
      pathSpan.style.color = '#155724';
      pathSpan.style.fontWeight = '500';
    } else {
      pathSpan.textContent = 'Not configured';
      pathSpan.style.color = '#856404';
      pathSpan.style.fontStyle = 'italic';
    }
  } catch (error) {
    pathSpan.textContent = 'Error loading configuration';
    pathSpan.style.color = '#721c24';
    console.error('Failed to load browse directory config:', error);
  }
}

/**
 * Handle browse directory selection
 */
async function onSelectBrowseDirectory() {
  try {
    // Check if File System Access API is supported
    if (!window.showDirectoryPicker) {
      showBrowseDirStatus(
        'File System Access API not supported in this browser. Please use Chrome or Edge.',
        'error'
      );
      return;
    }

    // Request directory access
    const dirHandle = await window.showDirectoryPicker({
      mode: 'read',
    });

    // Store the handle in IndexedDB
    await storeDirectoryHandle(dirHandle);

    // Update the display
    await loadBrowseDirectoryConfig();

    showBrowseDirStatus(`Directory configured successfully: /${dirHandle.name}`, 'success');
  } catch (error) {
    if (error.name === 'AbortError') {
      // User cancelled the picker
      return;
    }
    showBrowseDirStatus(`Failed to configure directory: ${error.message}`, 'error');
    console.error('Failed to select browse directory:', error);
  }
}
