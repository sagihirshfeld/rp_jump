# Options-Based Directory Configuration - Implementation Guide

## Overview

The directory browser now uses an **options-based configuration** approach instead of requiring users to pick a directory every time. This provides a much smoother user experience.

## What Changed

### Before (Old Approach)

1. User clicks "Browse Local Directory" in context menu
2. Directory picker dialog appears
3. User selects directory
4. Directory browser opens

**Problem**: Had to pick directory every time, which was tedious.

### After (New Approach)

1. **One-time setup**: User configures directory in extension options
2. **Instant access**: Clicking "Browse Local Directory" immediately opens the configured directory
3. **Easy changes**: "Change Directory" button opens options page

**Benefit**: Much faster and more convenient!

## User Guide

### Initial Setup (One-Time)

1. **Open Extension Options**
   - Right-click the extension icon in Chrome toolbar
   - Click "Options"
   - OR: Go to `chrome://extensions/` → Find "RP Jump" → Click "Details" → Click "Extension options"

2. **Configure Browse Directory**
   - Scroll to "Local Directory Browser" section
   - Click "📁 Select Browse Directory" button
   - Browser's directory picker will open
   - Select your desired directory (e.g., `/tmp`, `/var/log`, etc.)
   - Click "Select Folder" or "Open"

3. **Confirmation**
   - You'll see: "Directory configured successfully: /your-directory-name"
   - The "Current Directory" field will show your selected path

### Daily Usage

1. **Browse Directory**
   - Right-click anywhere on any webpage
   - Hover over "RP Jump 🔗"
   - Click "Browse Local Directory 📁"
   - **Directory opens immediately!** No picker needed!

2. **Navigate Files**
   - Browse folders and files as before
   - Back/forward buttons work
   - Click files to view them
   - Back button returns to directory

3. **Change Directory**
   - Click "⚙️ Change Directory" button in the browser
   - Opens extension options
   - Select a new directory
   - Return to browser and refresh

## Technical Details

### Architecture

```
┌─────────────────────────────────────────┐
│         Extension Options Page          │
│  ┌───────────────────────────────────┐  │
│  │ Local Directory Browser Config    │  │
│  │                                   │  │
│  │ [📁 Select Browse Directory]      │  │
│  │                                   │  │
│  │ Stores handle in IndexedDB        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    │ Directory Handle
                    │ (stored in IndexedDB)
                    ↓
┌─────────────────────────────────────────┐
│       Directory Browser Page            │
│  ┌───────────────────────────────────┐  │
│  │ Auto-loads from IndexedDB         │  │
│  │                                   │  │
│  │ If configured:                    │  │
│  │   → Show directory listing        │  │
│  │   → Enable navigation             │  │
│  │                                   │  │
│  │ If NOT configured:                │  │
│  │   → Show "Configure in Options"   │  │
│  │   → [Open Options] button         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Files Modified

1. **`rpjump_extension/options.html`**
   - Added "Local Directory Browser" section
   - Added "Select Browse Directory" button
   - Added current directory display

2. **`rpjump_extension/options.js`**
   - Added IndexedDB functions (openDB, storeDirectoryHandle, getStoredDirectoryHandle)
   - Added loadBrowseDirectoryConfig() to display current config
   - Added onSelectBrowseDirectory() to handle directory selection
   - Added showBrowseDirStatus() for user feedback

3. **`rpjump_extension/directory_browser.html`**
   - Removed picker UI
   - Added message container for "not configured" state
   - Added "Change Directory" button in header
   - Added "Open Options" button in message

4. **`rpjump_extension/directory_browser.js`**
   - Removed pickDirectory() function
   - Added autoLoadConfiguredDirectory() function
   - Added showConfigurationRequired() function
   - Modified DOMContentLoaded to auto-load directory
   - Added event handlers for "Change Directory" and "Open Options" buttons

### Data Storage

**IndexedDB Database:**

- Database Name: `DirectoryBrowserDB`
- Version: 1
- Object Store: `handles`
- Key: `'rootDirectory'`
- Value: FileSystemDirectoryHandle object

**Why IndexedDB?**

- Can store FileSystemDirectoryHandle objects
- Persists across browser sessions
- Handles are automatically verified for permissions

### Permission Handling

The implementation handles several permission scenarios:

1. **First Time Setup**
   - User picks directory → Browser asks for permission
   - User grants permission → Handle stored in IndexedDB

2. **Subsequent Access**
   - Handle retrieved from IndexedDB
   - Permission automatically verified
   - If granted → Directory loads immediately
   - If denied → User prompted to grant permission

3. **Permission Lost**
   - If permission revoked → Shows error message
   - User must reconfigure in options

4. **Handle Expired**
   - If handle no longer valid → Shows error message
   - User must reconfigure in options

## User Experience Flow

### Scenario 1: First-Time User

```
1. Install extension
2. Right-click → "Browse Local Directory"
3. See message: "Configuration Required"
4. Click "Open Options"
5. Click "Select Browse Directory"
6. Pick directory (e.g., /tmp)
7. See success message
8. Return to browser tab
9. Refresh page
10. Directory loads automatically! ✅
```

### Scenario 2: Configured User

```
1. Right-click → "Browse Local Directory"
2. Directory opens immediately! ✅
3. Browse files and folders
4. Use back/forward buttons
5. Click files to view
6. Everything works seamlessly!
```

### Scenario 3: Changing Directory

```
1. In directory browser, click "⚙️ Change Directory"
2. Options page opens
3. Click "Select Browse Directory"
4. Pick new directory
5. See success message
6. Return to browser tab
7. Refresh page
8. New directory loads! ✅
```

## Error Handling

### Error: "Configuration Required"

**Cause**: No directory configured yet
**Solution**: Click "Open Options" and configure a directory

### Error: "Permission denied"

**Cause**: Browser permission revoked or expired
**Solution**: Reconfigure directory in options (will re-request permission)

### Error: "Failed to load directory"

**Cause**: Directory no longer exists or handle invalid
**Solution**: Reconfigure directory in options

### Error: "File System Access API not supported"

**Cause**: Using unsupported browser (Firefox, Safari)
**Solution**: Use Chrome, Edge, or another Chromium-based browser

## Benefits of This Approach

1. ✅ **One-Time Setup**: Configure once, use forever
2. ✅ **Instant Access**: No picker dialog every time
3. ✅ **Persistent**: Configuration survives browser restarts
4. ✅ **Flexible**: Easy to change directory anytime
5. ✅ **Clear Feedback**: Always know what's configured
6. ✅ **Graceful Errors**: Clear messages when something goes wrong
7. ✅ **Secure**: Still uses browser's permission system

## Comparison with Alternatives

### Why Not Path-Based Input?

- ❌ File System Access API doesn't support path strings
- ❌ Browser security prevents arbitrary path access
- ✅ Our approach works within browser security model

### Why Not Native Messaging?

- ❌ Requires separate native application installation
- ❌ Much more complex setup
- ❌ Platform-specific code needed
- ✅ Our approach is pure web technology

### Why Not Keep the Picker?

- ❌ Tedious to pick every time
- ❌ Poor user experience
- ✅ Our approach is much more convenient

## Testing Checklist

### Test 1: Initial Configuration

- [ ] Open extension options
- [ ] See "Local Directory Browser" section
- [ ] Current directory shows "Not configured"
- [ ] Click "Select Browse Directory"
- [ ] Directory picker opens
- [ ] Select a directory
- [ ] See success message
- [ ] Current directory shows selected path

### Test 2: Auto-Load Directory

- [ ] Configure directory in options
- [ ] Right-click → "Browse Local Directory"
- [ ] Directory loads immediately (no picker)
- [ ] Directory listing displays correctly
- [ ] Can navigate folders
- [ ] Back/forward buttons work

### Test 3: Not Configured State

- [ ] Clear IndexedDB (or use incognito)
- [ ] Right-click → "Browse Local Directory"
- [ ] See "Configuration Required" message
- [ ] Click "Open Options"
- [ ] Options page opens
- [ ] Configure directory
- [ ] Return and refresh
- [ ] Directory loads

### Test 4: Change Directory

- [ ] Open directory browser
- [ ] Click "⚙️ Change Directory"
- [ ] Options page opens
- [ ] Select different directory
- [ ] Return to browser tab
- [ ] Refresh page
- [ ] New directory loads

### Test 5: Permission Handling

- [ ] Configure directory
- [ ] Close browser completely
- [ ] Reopen browser
- [ ] Open directory browser
- [ ] If permission prompt appears, grant it
- [ ] Directory loads successfully

## Future Enhancements

Potential improvements for future versions:

- [ ] Support multiple configured directories (dropdown selector)
- [ ] Remember last N accessed directories
- [ ] Quick switch between favorite directories
- [ ] Import/export directory configuration
- [ ] Keyboard shortcut to open configured directory
- [ ] Show directory path in browser title
- [ ] Add directory access statistics

## Conclusion

The options-based configuration provides a much better user experience compared to the picker-based approach. Users configure their directory once and enjoy instant access thereafter, while still maintaining browser security through the File System Access API's permission system.
