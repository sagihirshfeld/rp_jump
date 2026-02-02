# Testing the Local Directory Browser Feature

## Overview

The new "Browse Local Directory 📁" feature allows you to browse local filesystem directories in Apache autoindex style, directly within the browser extension.

## What Was Implemented

### 1. New Files Created

- **`rpjump_extension/directory_browser.html`**: The UI for the directory browser
- **`rpjump_extension/directory_browser.js`**: JavaScript logic using File System Access API
- **`TESTING_LOCAL_DIRECTORY_BROWSER.md`**: This testing guide

### 2. Modified Files

- **`rpjump_extension/context_menu.js`**: Added "Browse Local Directory 📁" menu item
- **`rpjump_extension/background.js`**: Added handler to open directory browser page
- **`README.md`**: Added documentation for the new feature

## How to Test

### Step 1: Reload the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Find "RP Jump" extension
3. Click the **Reload** button (circular arrow icon)

### Step 2: Configure Browse Directory (One-Time Setup)

1. Right-click the extension icon in Chrome toolbar
2. Click **"Options"**
3. Scroll to **"Local Directory Browser"** section
4. Click **"📁 Select Browse Directory"** button
5. Select any local directory (e.g., `/tmp`, your Downloads folder, a logs directory, etc.)
6. You should see: "Directory configured successfully: /your-directory-name"
7. The "Current Directory" field should show your selected path

### Step 3: Test the Context Menu

1. Right-click anywhere on any webpage
2. Hover over **"RP Jump 🔗"**
3. Verify you see the menu item: **"Browse Local Directory 📁"**

### Step 4: Test Directory Browsing

1. Click **"Browse Local Directory 📁"**
2. A new tab should open with the directory browser interface
3. **The directory should load immediately** (no picker dialog!) ✅
4. The directory contents should display in Apache autoindex style

### Step 5: Test Navigation

1. **Click a folder** - should navigate into that subdirectory
2. **Click "Parent Directory"** - should go back up one level
3. **Click breadcrumb links** - should jump to that path level
4. **Use browser back button** - should navigate back through directory history ✅ **NOW WORKING**
5. **Use browser forward button** - should navigate forward through directory history ✅ **NOW WORKING**

### Step 6: Verify Display Format

The listing should show:

- ✅ Folders with 📁 icon, files with 📄 icon
- ✅ Directories listed before files
- ✅ Alphabetical sorting within each group
- ✅ File sizes (in B, K, M, G format)
- ✅ Last modified dates (YYYY-MM-DD HH:MM format)
- ✅ "Parent Directory" link when not at root

### Step 7: Test File Opening and Back Button ✅ **ENHANCED**

1. Click on a text file (e.g., .txt, .log, .yaml, .json)
2. File should open in the **same tab** and display its contents
3. **Click browser back button** - should return to the directory listing (NOT the "Pick Directory" screen) ✅
4. You should see a brief "Restoring directory browser..." message
5. Navigate into a subfolder, then click a file
6. **Click browser back button** - should return to the subfolder (NOT the root or picker) ✅
7. Click on an image file (e.g., .png, .jpg)
8. Image should display in the same tab
9. **Click browser back button** - should return to directory listing ✅
10. Click on a binary file (e.g., .zip, .tar.gz)
11. Browser will prompt to download (since it can't display binary files)

### Step 8: Test Deep Navigation with Back/Forward

1. Navigate through multiple levels: root → folder1 → folder2 → folder3
2. Click a file in folder3
3. **Click back button** - should return to folder3 ✅
4. **Click back button again** - should return to folder2 ✅
5. **Click back button again** - should return to folder1 ✅
6. **Click forward button** - should return to folder2 ✅
7. **Click forward button again** - should return to folder3 ✅

## Expected Behavior

### Success Cases

- ✅ Directory picker opens when clicking the menu item
- ✅ Directory contents display in Apache autoindex style
- ✅ Navigation works (into folders, back to parent, breadcrumb jumps)
- ✅ **Browser back/forward buttons work for navigating directory history** ✅ **FIXED**
- ✅ Files open in the same tab (viewable files display, binary files download)
- ✅ **Back button after viewing a file returns to the directory (NOT the picker screen)** ✅ **FIXED**
- ✅ **SessionStorage restoration preserves directory context** ✅ **NEW**
- ✅ **Loading feedback during restoration** ✅ **NEW**
- ✅ Display matches the Apache autoindex style from Magna logs

### Browser Compatibility

- ✅ **Chrome/Edge**: Full support (File System Access API available)
- ⚠️ **Firefox**: Not supported (File System Access API not available)
- ⚠️ **Safari**: Limited support (may require user gesture)

## Known Limitations

1. **Browser Support**: File System Access API is only fully supported in Chromium-based browsers (Chrome, Edge, Opera)
2. **Permissions**: User must grant permission to access each directory
3. **File Content**: Files are downloaded, not displayed inline (for security)
4. **Symlinks**: May not follow symbolic links depending on OS/browser
5. **SessionStorage Expiration**: Directory context expires after 5 minutes of inactivity (when returning from file view)

## Troubleshooting

### "showDirectoryPicker is not defined"

- **Cause**: Browser doesn't support File System Access API
- **Solution**: Use Chrome, Edge, or another Chromium-based browser

### Directory picker doesn't open

- **Cause**: User gesture required (security restriction)
- **Solution**: Ensure you're clicking the menu item directly (not via automation)

### Permission denied errors

- **Cause**: Browser security restrictions
- **Solution**: Try a different directory, or check browser permissions

### Files don't display

- **Cause**: JavaScript error or API issue
- **Solution**: Open browser console (F12) and check for errors

## Future Enhancements (Optional)

Potential improvements for future versions:

- [ ] Remember last accessed directory
- [ ] Support for viewing text files inline
- [ ] Search/filter functionality
- [ ] Keyboard shortcuts for navigation
- [ ] Support for opening multiple directories in tabs
- [ ] Integration with favorites (save local directory paths)

## Success Criteria

The feature is working correctly if:

1. ✅ Menu item appears in context menu
2. ✅ Clicking opens directory browser in new tab
3. ✅ Directory picker allows selecting a folder
4. ✅ Contents display in Apache autoindex style
5. ✅ Navigation works (folders, parent, breadcrumbs)
6. ✅ **Browser back/forward buttons navigate through directory history** ✅ **FIXED**
7. ✅ Files open in the same tab (viewable files display in browser)
8. ✅ **Back button after viewing a file returns to the correct directory (NOT the picker screen)** ✅ **FIXED**
9. ✅ **Deep navigation history works (multiple back/forward operations)** ✅ **NEW**
10. ✅ **Loading feedback shown during restoration** ✅ **NEW**
11. ✅ Display format matches remote Magna logs

### Step 9: Test Change Directory

1. In the directory browser, click **"⚙️ Change Directory"** button (top right)
2. Extension options page should open
3. Click **"📁 Select Browse Directory"** again
4. Select a different directory
5. Return to the browser tab
6. Refresh the page
7. The new directory should load

### Step 10: Test Not Configured State

1. Open Chrome DevTools (F12)
2. Go to Application tab → Storage → IndexedDB
3. Delete "DirectoryBrowserDB" database
4. Refresh the directory browser page
5. Should see message: "⚙️ Configuration Required"
6. Click **"Open Options"** button
7. Options page should open
8. Configure directory again
9. Return and refresh
10. Directory should load

## Recent Updates (2026-02-02)

### Options-Based Directory Configuration ✅ **NEW**

The directory browser now uses an options-based configuration approach:

1. **One-Time Setup**: Configure your browse directory in extension options
2. **Instant Access**: Clicking "Browse Local Directory" immediately opens the configured directory
3. **No More Picker**: No need to select directory every time!
4. **Easy Changes**: "Change Directory" button in browser opens options
5. **Clear Feedback**: Always see what directory is configured

**Setup Flow:**

- Right-click extension icon → Options
- Scroll to "Local Directory Browser"
- Click "Select Browse Directory"
- Pick your directory (e.g., `/tmp`)
- Done! Now instant access from context menu

**Benefits:**

- ✅ Much faster and more convenient
- ✅ Configuration persists across browser sessions
- ✅ Clear error messages if not configured
- ✅ Easy to change directory anytime

For detailed information, see `OPTIONS_BASED_DIRECTORY_CONFIGURATION.md`.

### Back/Forward Navigation Fix

The browser's back and forward buttons now work correctly! Key improvements:

1. **Directory-to-Directory Navigation**: Each directory navigation creates a proper history entry using `pushState`, enabling natural back/forward navigation through your browsing history.

2. **File Viewing with Context Preservation**: When you open a file, the directory context is stored in sessionStorage. When you click back, the directory browser automatically restores to the exact location where you found the file.

3. **Deep Navigation Support**: You can navigate through multiple directory levels, view a file, and use back/forward buttons to traverse the entire history seamlessly.

4. **User Feedback**: A "Restoring directory browser..." message appears briefly when returning from file view, so you know the system is working.

5. **Robust Error Handling**: If permissions are lost or handles expire, the system gracefully falls back to the directory picker with clear error messages.

For detailed technical information, see `BACK_FORWARD_NAVIGATION_FIX.md`.

## Note About Permission Prompt

**The permission prompt shown in your screenshot is a browser security feature that cannot be bypassed.** This is intentional browser behavior to protect user privacy and security. Each time you access a new directory, the browser will ask for permission. This is similar to how websites ask for camera/microphone access.

**Why this happens:**

- File System Access API requires explicit user consent for each directory
- This prevents malicious websites from accessing your files without permission
- The permission is per-directory and per-session

**Workarounds:**

- Once you grant permission, you can navigate freely within that directory tree
- The browser remembers the permission for the current session
- You can bookmark frequently used directories and grant permission once per session

## Questions or Issues?

If you encounter any issues during testing:

1. Check the browser console (F12 → Console tab) for errors
2. Verify you're using a Chromium-based browser
3. Try reloading the extension
4. Try a different directory (some system directories may be restricted)
