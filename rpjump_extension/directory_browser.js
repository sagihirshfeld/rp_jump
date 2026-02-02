/**
 * Directory Browser - Apache autoindex style file browser using File System Access API
 */

let rootDirectoryHandle = null;
let currentDirectoryHandle = null;
let pathStack = [];

// IndexedDB for storing directory handle
const DB_NAME = 'DirectoryBrowserDB';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

// SessionStorage key for file return restoration
const SESSION_KEY = 'directoryBrowserReturn';

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  // Handle browser back/forward buttons
  window.addEventListener('popstate', handlePopState);

  // Handle "Change Directory" button
  const changeDirBtn = document.getElementById('changeDirBtn');
  if (changeDirBtn) {
    changeDirBtn.addEventListener('click', e => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  // Handle "Open Options" button
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', e => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  // Priority 1: Check if returning from file view
  const returnData = getReturnData();
  if (returnData) {
    await restoreFromFileReturn(returnData);
    return;
  }

  // Priority 2: Try to restore from history state on page load
  if (window.history.state && window.history.state.isDirectory) {
    await restoreDirectoryFromState(window.history.state);
    return;
  }

  // Priority 3: Try to auto-load configured directory
  await autoLoadConfiguredDirectory();
});

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
  }
}

/**
 * Store return data in sessionStorage before navigating to file
 */
function storeReturnData() {
  const returnData = {
    isFileReturn: true,
    pathStack: [...pathStack],
    timestamp: Date.now(),
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(returnData));
  } catch (error) {
    console.warn('Failed to store return data:', error);
  }
}

/**
 * Get return data from sessionStorage
 */
function getReturnData() {
  try {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (!data) return null;

    const returnData = JSON.parse(data);

    // Check if data is recent (within 5 minutes)
    const age = Date.now() - returnData.timestamp;
    if (age > 5 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return returnData;
  } catch (error) {
    console.warn('Failed to get return data:', error);
    return null;
  }
}

/**
 * Clear return data from sessionStorage
 */
function clearReturnData() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn('Failed to clear return data:', error);
  }
}

/**
 * Restore directory browser after returning from file view
 */
async function restoreFromFileReturn(returnData) {
  try {
    // Clear the return data immediately
    clearReturnData();

    // Show loading state
    showLoadingState('Restoring directory browser...');

    // Get the stored root handle
    rootDirectoryHandle = await getStoredDirectoryHandle();
    if (!rootDirectoryHandle) {
      throw new Error('Directory handle not found. Please select directory again.');
    }

    // Verify we still have permission
    const permission = await rootDirectoryHandle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') {
      const requestPermission = await rootDirectoryHandle.requestPermission({ mode: 'read' });
      if (requestPermission !== 'granted') {
        throw new Error('Permission denied. Please select directory again.');
      }
    }

    // Restore pathStack
    pathStack = returnData.pathStack;

    // Navigate to the directory
    let handle = rootDirectoryHandle;
    for (let i = 1; i < pathStack.length; i++) {
      handle = await handle.getDirectoryHandle(pathStack[i]);
    }

    currentDirectoryHandle = handle;

    // Show the directory listing UI
    document.getElementById('messageContainer').style.display = 'none';
    document.getElementById('directoryListing').classList.add('active');

    // Render the directory (don't push to history - we're restoring)
    await renderDirectory(handle, false);

    hideLoadingState();
  } catch (error) {
    console.error('Failed to restore from file return:', error);
    hideLoadingState();
    showError(`Failed to restore directory: ${error.message}`);

    // Fall back to showing configuration required message
    showConfigurationRequired(`Failed to restore directory: ${error.message}`);
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
 * Restore directory from history state
 */
async function restoreDirectoryFromState(state) {
  try {
    // Get the stored root handle
    rootDirectoryHandle = await getStoredDirectoryHandle();
    if (!rootDirectoryHandle) {
      return; // Can't restore without root handle
    }

    pathStack = state.pathStack;

    // Show the directory listing UI
    document.getElementById('messageContainer').style.display = 'none';
    document.getElementById('directoryListing').classList.add('active');

    // Navigate to the directory specified in the state
    let handle = rootDirectoryHandle;
    for (let i = 1; i < pathStack.length; i++) {
      handle = await handle.getDirectoryHandle(pathStack[i]);
    }

    currentDirectoryHandle = handle;
    await renderDirectory(handle, false); // false = don't push to history
  } catch (error) {
    console.error('Failed to restore directory:', error);
    // Show configuration required message if restoration fails
    showConfigurationRequired(`Failed to restore directory: ${error.message}`);
  }
}

/**
 * Handle browser back/forward button navigation
 */
async function handlePopState(event) {
  if (event.state && event.state.pathStack && event.state.isDirectory) {
    await restoreDirectoryFromState(event.state);
  }
}

/**
 * Auto-load configured directory from IndexedDB
 */
async function autoLoadConfiguredDirectory() {
  try {
    // Try to get stored directory handle
    rootDirectoryHandle = await getStoredDirectoryHandle();

    if (!rootDirectoryHandle) {
      // No directory configured - show message
      showConfigurationRequired();
      return;
    }

    // Verify we still have permission
    const permission = await rootDirectoryHandle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') {
      const requestPermission = await rootDirectoryHandle.requestPermission({ mode: 'read' });
      if (requestPermission !== 'granted') {
        showConfigurationRequired(
          'Permission denied. Please reconfigure the directory in options.'
        );
        return;
      }
    }

    // Successfully got handle with permission
    currentDirectoryHandle = rootDirectoryHandle;
    pathStack = [rootDirectoryHandle.name];

    // Hide message, show listing
    document.getElementById('messageContainer').style.display = 'none';
    document.getElementById('directoryListing').classList.add('active');

    // Set initial history state
    const state = {
      pathStack: [...pathStack],
      isDirectory: true,
    };
    const url = `#${pathStack.join('/')}`;
    window.history.pushState(state, '', url);

    // Render the directory
    await renderDirectory(rootDirectoryHandle, false);
  } catch (error) {
    console.error('Failed to auto-load directory:', error);
    showConfigurationRequired(`Failed to load directory: ${error.message}`);
  }
}

/**
 * Show configuration required message
 */
function showConfigurationRequired(customMessage = null) {
  const messageContainer = document.getElementById('messageContainer');
  const messageTitle = document.getElementById('messageTitle');
  const messageText = document.getElementById('messageText');

  messageContainer.style.display = 'block';
  document.getElementById('directoryListing').classList.remove('active');

  if (customMessage) {
    messageTitle.textContent = '⚠️ Configuration Issue';
    messageText.textContent = customMessage;
  } else {
    messageTitle.textContent = '⚙️ Configuration Required';
    messageText.textContent = 'Please configure a browse directory in the extension options.';
  }
}

/**
 * Render directory contents in Apache autoindex style
 * @param {FileSystemDirectoryHandle} dirHandle - Directory to render
 * @param {boolean} pushState - Whether to push state to browser history (default: true)
 */
async function renderDirectory(dirHandle, pushState = true) {
  try {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    // Update title and breadcrumb
    const path = pathStack.join('/');
    document.getElementById('directoryTitle').textContent = `Index of /${path}`;
    updateBreadcrumb();

    // Push state to browser history for back button support
    if (pushState) {
      const state = {
        pathStack: [...pathStack],
        isDirectory: true,
      };
      const url = `#${pathStack.join('/')}`;
      window.history.pushState(state, '', url);
    }

    const entries = [];

    // Collect all entries
    for await (const entry of dirHandle.values()) {
      entries.push(entry);
    }

    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    // Add parent directory link if not at root
    if (pathStack.length > 1) {
      const row = createParentDirectoryRow();
      fileList.appendChild(row);
    }

    // Add entries
    for (const entry of entries) {
      const row = await createEntryRow(entry);
      fileList.appendChild(row);
    }
  } catch (error) {
    showError(`Failed to read directory: ${error.message}`);
  }
}

/**
 * Create parent directory row
 */
function createParentDirectoryRow() {
  const row = document.createElement('tr');
  row.className = 'parent-dir';

  const nameCell = document.createElement('td');
  const link = document.createElement('a');
  link.href = '#';
  link.innerHTML = '<span class="icon">📁</span>Parent Directory';
  link.addEventListener('click', async e => {
    e.preventDefault();
    await navigateUp();
  });
  nameCell.appendChild(link);

  const dateCell = document.createElement('td');
  dateCell.className = 'date';
  dateCell.textContent = '-';

  const sizeCell = document.createElement('td');
  sizeCell.className = 'size';
  sizeCell.textContent = '-';

  const descCell = document.createElement('td');
  descCell.textContent = '-';

  row.appendChild(nameCell);
  row.appendChild(dateCell);
  row.appendChild(sizeCell);
  row.appendChild(descCell);

  return row;
}

/**
 * Create a row for a file or directory entry
 */
async function createEntryRow(entry) {
  const row = document.createElement('tr');

  // Name column
  const nameCell = document.createElement('td');
  const link = document.createElement('a');
  link.href = '#';

  if (entry.kind === 'directory') {
    link.innerHTML = `<span class="icon">📁</span>${entry.name}/`;
    link.addEventListener('click', async e => {
      e.preventDefault();
      await navigateInto(entry);
    });
  } else {
    link.innerHTML = `<span class="icon">📄</span>${entry.name}`;
    link.addEventListener('click', async e => {
      e.preventDefault();
      await openFile(entry);
    });
  }
  nameCell.appendChild(link);

  // Date column
  const dateCell = document.createElement('td');
  dateCell.className = 'date';
  let dateStr = '-';
  try {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      dateStr = formatDate(file.lastModified);
    }
  } catch (error) {
    console.warn('Could not get file metadata:', error);
  }
  dateCell.textContent = dateStr;

  // Size column
  const sizeCell = document.createElement('td');
  sizeCell.className = 'size';
  let sizeStr = '-';
  try {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      sizeStr = formatSize(file.size);
    }
  } catch (error) {
    console.warn('Could not get file size:', error);
  }
  sizeCell.textContent = sizeStr;

  // Description column
  const descCell = document.createElement('td');
  descCell.textContent = '-';

  row.appendChild(nameCell);
  row.appendChild(dateCell);
  row.appendChild(sizeCell);
  row.appendChild(descCell);

  return row;
}

/**
 * Navigate into a subdirectory
 */
async function navigateInto(dirHandle) {
  currentDirectoryHandle = dirHandle;
  pathStack.push(dirHandle.name);
  await renderDirectory(dirHandle);
}

/**
 * Navigate up to parent directory
 */
async function navigateUp() {
  if (pathStack.length <= 1) return;

  pathStack.pop();

  // Navigate back to parent
  let handle = rootDirectoryHandle;
  for (let i = 1; i < pathStack.length; i++) {
    handle = await handle.getDirectoryHandle(pathStack[i]);
  }

  currentDirectoryHandle = handle;
  await renderDirectory(handle);
}

/**
 * Navigate to a specific path in breadcrumb
 */
async function navigateToBreadcrumb(index) {
  if (index === 0) {
    // Navigate to root
    currentDirectoryHandle = rootDirectoryHandle;
    pathStack = [rootDirectoryHandle.name];
  } else {
    // Navigate to specific level
    pathStack = pathStack.slice(0, index + 1);
    let handle = rootDirectoryHandle;
    for (let i = 1; i < pathStack.length; i++) {
      handle = await handle.getDirectoryHandle(pathStack[i]);
    }
    currentDirectoryHandle = handle;
  }
  await renderDirectory(currentDirectoryHandle);
}

/**
 * Update breadcrumb navigation
 */
function updateBreadcrumb() {
  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = '';

  pathStack.forEach((name, index) => {
    if (index > 0) {
      const separator = document.createElement('span');
      separator.textContent = '/';
      breadcrumb.appendChild(separator);
    }

    const link = document.createElement('a');
    link.textContent = name;
    link.addEventListener('click', async e => {
      e.preventDefault();
      await navigateToBreadcrumb(index);
    });
    breadcrumb.appendChild(link);
  });
}

/**
 * Open a file in the same tab (back button will return to directory)
 */
async function openFile(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);

    // Store current directory context in sessionStorage
    // This allows restoration when user clicks back button
    storeReturnData();

    // Store directory handle in IndexedDB for restoration
    await storeDirectoryHandle(rootDirectoryHandle);

    // Navigate to the file in the same tab
    window.location.href = url;
  } catch (error) {
    showError(`Failed to open file: ${error.message}`);
  }
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes) {
  if (bytes === 0) return '0';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'K';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'M';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'G';
}

/**
 * Format date in Apache autoindex style
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Show error message
 */
function showError(message) {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.innerHTML = `<div class="error">${message}</div>`;
  setTimeout(() => {
    errorContainer.innerHTML = '';
  }, 5000);
}

/**
 * Show loading state
 */
function showLoadingState(message) {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">${message}</div>`;
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.innerHTML = '';
}

// Made with Bob
