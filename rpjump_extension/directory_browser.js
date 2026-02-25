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
    if (window.history.state.isExtractedView) {
      await restoreExtractedDirectoryFromState(window.history.state);
    } else {
      await restoreDirectoryFromState(window.history.state);
    }
    return;
  }

  // Priority 3: Show tarball prompt or auto-load configured directory
  await showTarballPromptOrLoadDirectory();
});

/**
 * Show tarball prompt dialog or load directory directly
 */
async function showTarballPromptOrLoadDirectory() {
  // Show the prompt dialog
  const promptModal = document.getElementById('tarballPrompt');
  const tarballInput = document.getElementById('tarballNameInput');
  const cancelBtn = document.getElementById('cancelPromptBtn');
  const proceedBtn = document.getElementById('proceedPromptBtn');

  promptModal.classList.add('active');
  tarballInput.focus();

  // Handle Enter key in input
  tarballInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      proceedBtn.click();
    }
  });

  // Handle Cancel button
  cancelBtn.addEventListener('click', () => {
    promptModal.classList.remove('active');
    window.close(); // Close the tab
  });

  // Handle Proceed button
  proceedBtn.addEventListener('click', async () => {
    const tarballName = tarballInput.value.trim();
    promptModal.classList.remove('active');

    if (tarballName.startsWith('http://') || tarballName.startsWith('https://')) {
      await downloadAndExtractTarball(tarballName);
    } else if (tarballName) {
      console.log('=== TARBALL EXTRACTION START ===');
      console.log('Tarball name:', tarballName);
      await extractAndDisplayTarball(tarballName);
    } else {
      console.log('=== NORMAL DIRECTORY LOAD ===');
      await autoLoadConfiguredDirectory();
    }
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
    isExtractedView: isExtractedView,
    extractedTarballName: extractedTarballName,
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

    // Restore pathStack
    pathStack = returnData.pathStack;

    if (returnData.isExtractedView) {
      // Restore extracted tarball view via OPFS
      isExtractedView = true;
      extractedTarballName = returnData.extractedTarballName;

      const opfsRoot = await navigator.storage.getDirectory();
      const extractedDir = await opfsRoot.getDirectoryHandle('extracted');
      const sanitizedName = extractedTarballName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const tarballDir = await extractedDir.getDirectoryHandle(sanitizedName);

      let handle = tarballDir;
      for (let i = 1; i < pathStack.length; i++) {
        handle = await handle.getDirectoryHandle(pathStack[i]);
      }

      currentDirectoryHandle = handle;

      document.getElementById('messageContainer').style.display = 'none';
      document.getElementById('directoryListing').classList.add('active');

      document.getElementById('directoryTitle').textContent = `Extracted: ${extractedTarballName}`;

      const changeDirBtn = document.getElementById('changeDirBtn');
      changeDirBtn.textContent = '← Back to Directory';
      changeDirBtn.onclick = async e => {
        e.preventDefault();
        await returnToNormalDirectory();
      };

      await renderOPFSDirectory(handle, false);
    } else {
      // Restore normal filesystem view
      rootDirectoryHandle = await getStoredDirectoryHandle();
      if (!rootDirectoryHandle) {
        throw new Error('Directory handle not found. Please select directory again.');
      }

      const permission = await rootDirectoryHandle.queryPermission({ mode: 'read' });
      if (permission !== 'granted') {
        const requestPermission = await rootDirectoryHandle.requestPermission({ mode: 'read' });
        if (requestPermission !== 'granted') {
          throw new Error('Permission denied. Please select directory again.');
        }
      }

      let handle = rootDirectoryHandle;
      for (let i = 1; i < pathStack.length; i++) {
        handle = await handle.getDirectoryHandle(pathStack[i]);
      }

      currentDirectoryHandle = handle;

      document.getElementById('messageContainer').style.display = 'none';
      document.getElementById('directoryListing').classList.add('active');

      await renderDirectory(handle, false);
    }

    hideLoadingState();
  } catch (error) {
    console.error('Failed to restore from file return:', error);
    hideLoadingState();
    showError(`Failed to restore directory: ${error.message}`);

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
    if (event.state.isExtractedView) {
      await restoreExtractedDirectoryFromState(event.state);
    } else {
      await restoreDirectoryFromState(event.state);
    }
  }
}

/**
 * Restore extracted (OPFS) directory from history state
 */
async function restoreExtractedDirectoryFromState(state) {
  try {
    isExtractedView = true;
    extractedTarballName = state.extractedTarballName;
    pathStack = state.pathStack;

    document.getElementById('messageContainer').style.display = 'none';
    document.getElementById('directoryListing').classList.add('active');
    document.getElementById('directoryTitle').textContent = `Extracted: ${extractedTarballName}`;

    const changeDirBtn = document.getElementById('changeDirBtn');
    changeDirBtn.textContent = '← Back to Directory';
    changeDirBtn.onclick = async e => {
      e.preventDefault();
      await returnToNormalDirectory();
    };

    const tarballRoot = await getExtractedTarballRoot();
    let handle = tarballRoot;
    for (let i = 1; i < pathStack.length; i++) {
      handle = await handle.getDirectoryHandle(pathStack[i]);
    }

    currentDirectoryHandle = handle;
    await renderOPFSDirectory(handle, false);
  } catch (error) {
    console.error('Failed to restore extracted directory:', error);
    showError(`Failed to restore directory: ${error.message}`);
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
 * Get the OPFS root handle for the current extracted tarball
 */
async function getExtractedTarballRoot() {
  const opfsRoot = await navigator.storage.getDirectory();
  const extractedDir = await opfsRoot.getDirectoryHandle('extracted');
  const sanitizedName = extractedTarballName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return extractedDir.getDirectoryHandle(sanitizedName);
}

/**
 * Navigate up to parent directory
 */
async function navigateUp() {
  if (pathStack.length <= 1) return;

  pathStack.pop();

  if (isExtractedView) {
    const tarballRoot = await getExtractedTarballRoot();
    let handle = tarballRoot;
    for (let i = 1; i < pathStack.length; i++) {
      handle = await handle.getDirectoryHandle(pathStack[i]);
    }
    currentDirectoryHandle = handle;
    await renderOPFSDirectory(handle);
  } else {
    let handle = rootDirectoryHandle;
    for (let i = 1; i < pathStack.length; i++) {
      handle = await handle.getDirectoryHandle(pathStack[i]);
    }
    currentDirectoryHandle = handle;
    await renderDirectory(handle);
  }
}

/**
 * Navigate to a specific path in breadcrumb
 */
async function navigateToBreadcrumb(index) {
  if (isExtractedView) {
    const tarballRoot = await getExtractedTarballRoot();
    if (index === 0) {
      currentDirectoryHandle = tarballRoot;
      pathStack = [extractedTarballName];
    } else {
      pathStack = pathStack.slice(0, index + 1);
      let handle = tarballRoot;
      for (let i = 1; i < pathStack.length; i++) {
        handle = await handle.getDirectoryHandle(pathStack[i]);
      }
      currentDirectoryHandle = handle;
    }
    await renderOPFSDirectory(currentDirectoryHandle);
  } else {
    if (index === 0) {
      currentDirectoryHandle = rootDirectoryHandle;
      pathStack = [rootDirectoryHandle.name];
    } else {
      pathStack = pathStack.slice(0, index + 1);
      let handle = rootDirectoryHandle;
      for (let i = 1; i < pathStack.length; i++) {
        handle = await handle.getDirectoryHandle(pathStack[i]);
      }
      currentDirectoryHandle = handle;
    }
    await renderDirectory(currentDirectoryHandle);
  }
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

/**
 * ============================================================================
 * TARBALL EXTRACTION FUNCTIONALITY
 * ============================================================================
 */

// Tarball extraction state
let isExtractedView = false;
let extractedTarballName = '';

/**
 * Parse a PAX extended header data block into a key-value map.
 * Format per IEEE Std 1003.1: each record is "<length> <key>=<value>\n"
 * where <length> includes itself, the space, key=value, and the newline.
 */
function parsePaxData(dataBytes, dataSize) {
  const attrs = {};
  const text = new TextDecoder().decode(dataBytes.slice(0, dataSize));
  let pos = 0;
  while (pos < text.length) {
    const spaceIdx = text.indexOf(' ', pos);
    if (spaceIdx === -1) break;
    const recordLen = parseInt(text.substring(pos, spaceIdx), 10);
    if (isNaN(recordLen) || recordLen <= 0) break;
    const record = text.substring(spaceIdx + 1, pos + recordLen - 1);
    const eqIdx = record.indexOf('=');
    if (eqIdx !== -1) {
      attrs[record.substring(0, eqIdx)] = record.substring(eqIdx + 1);
    }
    pos += recordLen;
  }
  return attrs;
}

/**
 * Custom TAR parser (synchronous, no Web Worker)
 * Handles GNU long-name headers (type L), PAX extended headers (type x/g),
 * and POSIX ustar prefix field.
 */
function parseTar(arrayBuffer) {
  const files = [];
  let offset = 0;
  let gnuLongName = null;
  let paxPath = null;
  let paxSize = null;

  while (offset + 512 <= arrayBuffer.byteLength) {
    const header = new Uint8Array(arrayBuffer, offset, 512);

    // End of archive: two consecutive 512-byte zero blocks (TAR spec)
    if (header.every(b => b === 0)) {
      const nextBlockEnd = offset + 1024;
      if (nextBlockEnd <= arrayBuffer.byteLength) {
        const nextHeader = new Uint8Array(arrayBuffer, offset + 512, 512);
        if (nextHeader.every(b => b === 0)) {
          break;
        }
      }
      offset += 512;
      continue;
    }

    // Read header fields
    const nameBytes = new Uint8Array(arrayBuffer, offset, 100);
    let name = decodeString(nameBytes);

    // POSIX ustar prefix (offset 345, 155 bytes)
    const prefixBytes = new Uint8Array(arrayBuffer, offset + 345, 155);
    const prefix = decodeString(prefixBytes);
    if (prefix) {
      name = prefix + '/' + name;
    }

    const sizeBytes = new Uint8Array(arrayBuffer, offset + 124, 12);
    const sizeStr = decodeString(sizeBytes);
    const size = parseInt(sizeStr, 8) || 0;

    const typeFlag = String.fromCharCode(header[156]);

    // Advance past the 512-byte header
    offset += 512;

    const paddedSize = Math.ceil(size / 512) * 512;

    // GNU long-name extension: data block contains the real filename
    if (typeFlag === 'L') {
      const rawName = new Uint8Array(arrayBuffer, offset, size);
      gnuLongName = decodeString(rawName);
      offset += paddedSize;
      continue;
    }

    // PAX extended headers: parse key-value pairs for path/size overrides
    if (typeFlag === 'x' || typeFlag === 'g') {
      const paxBytes = new Uint8Array(arrayBuffer, offset, size);
      const attrs = parsePaxData(paxBytes, size);
      if (typeFlag === 'x') {
        if (attrs.path) paxPath = attrs.path;
        if (attrs.size) paxSize = parseInt(attrs.size, 10);
      }
      offset += paddedSize;
      continue;
    }

    // Apply overrides from GNU long-name or PAX headers
    if (paxPath !== null) {
      name = paxPath;
      paxPath = null;
    } else if (gnuLongName !== null) {
      name = gnuLongName;
      gnuLongName = null;
    }

    let effectiveSize = size;
    if (paxSize !== null) {
      effectiveSize = paxSize;
      paxSize = null;
    }

    // Regular file
    if (typeFlag === '0' || typeFlag === '\0' || typeFlag === '') {
      const fileData = arrayBuffer.slice(offset, offset + effectiveSize);
      files.push({
        name: name,
        size: effectiveSize,
        buffer: fileData,
        type: typeFlag,
      });
    }

    offset += paddedSize;
  }

  return files;
}

/**
 * Decode null-terminated string from byte array
 */
function decodeString(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) break;
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

/**
 * Shared extraction pipeline: decompress, parse, write to OPFS, and display.
 * Accepts a raw ArrayBuffer (possibly gzipped) and tarball name.
 */
async function extractFromArrayBuffer(arrayBuffer, tarballName) {
  showProgress('Detecting format...', 30);
  const isCompressed = tarballName.endsWith('.gz') || tarballName.endsWith('.tgz');

  let tarData;
  if (isCompressed) {
    showProgress('Decompressing...', 40);
    try {
      const decompressed = pako.ungzip(new Uint8Array(arrayBuffer));
      tarData = decompressed.buffer.slice(
        decompressed.byteOffset,
        decompressed.byteOffset + decompressed.byteLength
      );
    } catch (e) {
      console.error('Decompression error:', e);
      throw new Error(`Failed to decompress: ${e.message}`);
    }
  } else {
    tarData = arrayBuffer;
  }

  showProgress('Extracting files...', 60);
  console.log('Parsing TAR archive...');
  console.log('TAR data size:', tarData.byteLength);

  let extractedFiles;
  try {
    extractedFiles = parseTar(tarData);
    console.log('Extracted files count:', extractedFiles.length);
    if (extractedFiles.length > 0) {
      console.log(
        'Sample files:',
        extractedFiles.slice(0, 5).map(f => ({ name: f.name, size: f.size }))
      );
    }
  } catch (e) {
    console.error('TAR parsing error:', e);
    throw new Error(`Failed to parse TAR: ${e.message || e}`);
  }

  if (extractedFiles.length === 0) {
    throw new Error('No files found in TAR archive');
  }

  showProgress('Writing to storage...', 80);
  await writeExtractedFilesToOPFS(tarballName, extractedFiles);

  showProgress('Loading contents...', 95);
  await displayExtractedContents(tarballName);
}

/**
 * Extract and display tarball contents from local filesystem
 */
async function extractAndDisplayTarball(tarballName) {
  try {
    showProgress('Initializing...', 0);

    rootDirectoryHandle = await getStoredDirectoryHandle();
    if (!rootDirectoryHandle) {
      throw new Error('No directory configured. Please configure in options.');
    }

    showProgress('Searching for tarball...', 10);
    const tarballFileHandle = await findTarballFile(tarballName);

    showProgress('Reading tarball file...', 20);
    const tarballFile = await tarballFileHandle.getFile();
    const arrayBuffer = await tarballFile.arrayBuffer();

    await extractFromArrayBuffer(arrayBuffer, tarballName);

    hideProgress();
  } catch (error) {
    hideProgress();
    console.error('Tarball extraction failed:', error);
    showError(`Failed to extract tarball: ${error.message}`);

    setTimeout(async () => {
      await autoLoadConfiguredDirectory();
    }, 3000);
  }
}

/**
 * Download a tarball from a URL, then extract and display it.
 */
async function downloadAndExtractTarball(url) {
  try {
    showProgress('Connecting...', 0);

    const parsedUrl = new URL(url);
    const tarballName =
      decodeURIComponent(parsedUrl.pathname.split('/').pop()) || 'download.tar.gz';
    console.log('=== URL TARBALL DOWNLOAD START ===');
    console.log('URL:', url);
    console.log('Resolved filename:', tarballName);

    showProgress('Downloading...', 5);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('Content-Length'), 10);
    const totalMB = contentLength ? (contentLength / (1024 * 1024)).toFixed(1) : null;

    let arrayBuffer;
    if (response.body && contentLength) {
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        const receivedMB = (received / (1024 * 1024)).toFixed(1);
        const pct = Math.min(25, 5 + Math.round((received / contentLength) * 20));
        showProgress(`Downloading... ${receivedMB} MB / ${totalMB} MB`, pct);
      }

      const combined = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      arrayBuffer = combined.buffer;
    } else {
      showProgress('Downloading...', 15);
      arrayBuffer = await response.arrayBuffer();
    }

    console.log('Download complete, size:', arrayBuffer.byteLength);

    await extractFromArrayBuffer(arrayBuffer, tarballName);

    hideProgress();
  } catch (error) {
    hideProgress();
    console.error('URL tarball download failed:', error);
    showError(`Failed to download tarball: ${error.message}`);
  }
}

/**
 * Find tarball file in configured directory
 */
async function findTarballFile(filename) {
  const rootHandle = await getStoredDirectoryHandle();
  if (!rootHandle) {
    throw new Error('No directory configured');
  }

  // Try exact match first
  try {
    return await rootHandle.getFileHandle(filename);
  } catch (e) {
    // Try with common extensions
    const extensions = ['', '.tar', '.tar.gz', '.tgz'];
    for (const ext of extensions) {
      try {
        const testName = filename.endsWith(ext.substring(1)) ? filename : filename + ext;
        return await rootHandle.getFileHandle(testName);
      } catch (err) {
        // Continue trying
      }
    }
  }

  throw new Error(`Tarball not found: ${filename}`);
}

/**
 * Write extracted files to OPFS (Origin Private File System)
 */
async function writeExtractedFilesToOPFS(tarballName, files) {
  const opfsRoot = await navigator.storage.getDirectory();

  try {
    await opfsRoot.removeEntry('extracted', { recursive: true });
  } catch (e) {
    // Directory may not exist on first run
  }

  const extractedDir = await opfsRoot.getDirectoryHandle('extracted', { create: true });

  // Create tarball-specific directory
  const sanitizedName = tarballName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const tarballDir = await extractedDir.getDirectoryHandle(sanitizedName, { create: true });

  // Write each file
  for (const file of files) {
    try {
      // Sanitize path to prevent directory traversal
      const safePath = file.name.replace(/\.\./g, '').replace(/^\//, '');
      const pathParts = safePath.split('/');

      // Create nested directories if needed
      let currentDir = tarballDir;
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(pathParts[i], { create: true });
      }

      // Write the file
      const fileName = pathParts[pathParts.length - 1];
      if (fileName && file.buffer.byteLength > 0) {
        const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file.buffer);
        await writable.close();
      }
    } catch (error) {
      console.warn(`Failed to write file ${file.name}:`, error);
    }
  }
}

/**
 * Display extracted contents from OPFS
 */
async function displayExtractedContents(tarballName) {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const extractedDir = await opfsRoot.getDirectoryHandle('extracted');
    const sanitizedName = tarballName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const tarballDir = await extractedDir.getDirectoryHandle(sanitizedName);

    // Set up state for extracted view
    isExtractedView = true;
    extractedTarballName = tarballName;
    currentDirectoryHandle = tarballDir;
    pathStack = [tarballName];

    // Hide message, show listing
    document.getElementById('messageContainer').style.display = 'none';
    document.getElementById('directoryListing').classList.add('active');

    // Update title to show it's extracted content
    document.getElementById('directoryTitle').textContent = `Extracted: ${tarballName}`;

    // Change "Change Directory" button to "Back to Directory"
    const changeDirBtn = document.getElementById('changeDirBtn');
    changeDirBtn.textContent = '← Back to Directory';
    changeDirBtn.onclick = async e => {
      e.preventDefault();
      await returnToNormalDirectory();
    };

    // Push initial history state for the extracted root
    const state = {
      pathStack: [...pathStack],
      isDirectory: true,
      isExtractedView: true,
      extractedTarballName: extractedTarballName,
    };
    window.history.pushState(state, '', `#${pathStack.join('/')}`);

    // Render the extracted contents (don't push again)
    await renderOPFSDirectory(tarballDir, false);
  } catch (error) {
    throw new Error(`Failed to display extracted contents: ${error.message}`);
  }
}

/**
 * Render OPFS directory contents (similar to renderDirectory but for OPFS)
 */
async function renderOPFSDirectory(dirHandle, pushState = true) {
  try {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    // Update breadcrumb
    updateBreadcrumb();

    if (pushState) {
      const state = {
        pathStack: [...pathStack],
        isDirectory: true,
        isExtractedView: true,
        extractedTarballName: extractedTarballName,
      };
      window.history.pushState(state, '', `#${pathStack.join('/')}`);
    }

    const entries = [];

    // Collect all entries
    for await (const entry of dirHandle.values()) {
      entries.push(entry);
    }

    // Sort: directories first, then files
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
      const row = await createOPFSEntryRow(entry);
      fileList.appendChild(row);
    }
  } catch (error) {
    showError(`Failed to read directory: ${error.message}`);
  }
}

/**
 * Create row for OPFS entry
 */
async function createOPFSEntryRow(entry) {
  const row = document.createElement('tr');

  // Name column
  const nameCell = document.createElement('td');
  const link = document.createElement('a');
  link.href = '#';

  if (entry.kind === 'directory') {
    link.innerHTML = `<span class="icon">📁</span>${entry.name}/`;
    link.addEventListener('click', async e => {
      e.preventDefault();
      await navigateIntoOPFS(entry);
    });
  } else {
    link.innerHTML = `<span class="icon">📄</span>${entry.name}`;
    link.addEventListener('click', async e => {
      e.preventDefault();
      await openOPFSFile(entry);
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
  descCell.textContent = 'Extracted file';

  row.appendChild(nameCell);
  row.appendChild(dateCell);
  row.appendChild(sizeCell);
  row.appendChild(descCell);

  return row;
}

/**
 * Navigate into OPFS subdirectory
 */
async function navigateIntoOPFS(dirHandle) {
  currentDirectoryHandle = dirHandle;
  pathStack.push(dirHandle.name);
  await renderOPFSDirectory(dirHandle);
}

/**
 * Open OPFS file
 */
async function openOPFSFile(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);

    // Store current state for back button
    storeReturnData();

    // Navigate to file
    window.location.href = url;
  } catch (error) {
    showError(`Failed to open file: ${error.message}`);
  }
}

/**
 * Return to normal directory view from extracted view
 */
async function returnToNormalDirectory() {
  isExtractedView = false;
  extractedTarballName = '';

  // Restore "Change Directory" button
  const changeDirBtn = document.getElementById('changeDirBtn');
  changeDirBtn.textContent = '⚙️ Change Directory';
  changeDirBtn.onclick = e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  };

  // Load normal directory
  await autoLoadConfiguredDirectory();
}

/**
 * Show progress overlay
 */
function showProgress(message, percent) {
  const overlay = document.getElementById('extractionProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  overlay.classList.add('active');
  progressFill.style.width = `${percent}%`;
  progressText.textContent = message;
}

/**
 * Hide progress overlay
 */
function hideProgress() {
  const overlay = document.getElementById('extractionProgress');
  overlay.classList.remove('active');
}

// Made with Bob
