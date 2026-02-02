# Quick Test Guide - Options-Based Directory Configuration

## Prerequisites

1. Reload the extension: `chrome://extensions/` → Find "RP Jump" → Click Reload
2. Have a directory ready to test with (e.g., `/tmp`, Downloads folder, etc.)

---

## Test 1: Initial Configuration (3 minutes)

### Steps:

1. Right-click the **RP Jump extension icon** in Chrome toolbar
2. Click **"Options"**
3. Scroll down to **"Local Directory Browser"** section
4. Note: "Current Directory" shows **"Not configured"**
5. Click **"📁 Select Browse Directory"** button
6. Browser's directory picker opens
7. Select a directory (e.g., `/tmp` or Downloads)
8. Click "Select Folder" or "Open"

### Expected Results:

- ✅ Success message appears: "Directory configured successfully: /your-directory"
- ✅ "Current Directory" field updates to show: "/your-directory"
- ✅ Message is green with checkmark

---

## Test 2: Instant Directory Access (1 minute)

### Steps:

1. Right-click anywhere on any webpage
2. Hover over **"RP Jump 🔗"**
3. Click **"Browse Local Directory 📁"**

### Expected Results:

- ✅ New tab opens immediately
- ✅ **NO picker dialog appears** (this is the key improvement!)
- ✅ Directory listing displays instantly
- ✅ Shows files and folders from configured directory
- ✅ "⚙️ Change Directory" button visible in top right

---

## Test 3: Not Configured State (2 minutes)

### Steps:

1. Open Chrome DevTools (F12)
2. Go to **Application** tab → **Storage** → **IndexedDB**
3. Find and delete **"DirectoryBrowserDB"** database
4. Close DevTools
5. Right-click → **"Browse Local Directory"**

### Expected Results:

- ✅ Page shows: "⚙️ Configuration Required"
- ✅ Message: "Please configure a browse directory in the extension options."
- ✅ **"Open Options"** button is visible
- ✅ Clicking button opens options page
- ✅ Can configure directory and return

---

## Test 4: Change Directory (2 minutes)

### Steps:

1. Open directory browser (should show configured directory)
2. Click **"⚙️ Change Directory"** button (top right corner)
3. Options page opens
4. Click **"📁 Select Browse Directory"** again
5. Select a **different** directory
6. See success message
7. Return to browser tab
8. **Refresh the page** (F5 or Cmd+R)

### Expected Results:

- ✅ Options page opens when clicking "Change Directory"
- ✅ Can select new directory
- ✅ Success message shows new directory
- ✅ After refresh, new directory loads
- ✅ Old directory is replaced

---

## Test 5: Permission Persistence (2 minutes)

### Steps:

1. Configure a directory in options
2. Open directory browser (should work)
3. **Close Chrome completely**
4. Reopen Chrome
5. Right-click → **"Browse Local Directory"**

### Expected Results:

- ✅ Directory loads immediately (no picker)
- ✅ OR: Permission prompt appears → Grant it → Directory loads
- ✅ Configuration persists across browser restarts

---

## Test 6: Back/Forward Still Works (1 minute)

### Steps:

1. Open directory browser
2. Navigate into a subfolder
3. Click browser **back button** ⬅️
4. Click browser **forward button** ➡️

### Expected Results:

- ✅ Back button returns to parent directory
- ✅ Forward button returns to subfolder
- ✅ Navigation history works perfectly

---

## Common Issues and Solutions

### Issue: "Configuration Required" message appears

**Solution**: This is expected if you haven't configured a directory yet. Click "Open Options" and configure one.

### Issue: Directory picker still appears

**Solution**: Make sure you configured the directory in **Options**, not just picked it in the browser. The configuration must be done through the extension options page.

### Issue: "Permission denied" error

**Solution**: Click "Allow" when browser asks for permission. If problem persists, reconfigure the directory in options.

### Issue: Old directory still loads after changing

**Solution**: Make sure to **refresh the browser tab** after changing the directory in options.

### Issue: Configuration lost after browser restart

**Solution**: This shouldn't happen. Check if IndexedDB is enabled in your browser settings. Try reconfiguring.

---

## Success Indicators

You'll know it's working when:

1. ✅ Options page shows configured directory path
2. ✅ Context menu opens directory **instantly** (no picker)
3. ✅ "Change Directory" button works
4. ✅ Configuration persists across browser restarts
5. ✅ Clear error message if not configured

---

## Comparison: Before vs After

### Before (Old Way)

```
1. Right-click → "Browse Local Directory"
2. Picker dialog appears
3. Select directory
4. Directory opens
```

**Every single time!** 😫

### After (New Way)

```
Setup (once):
1. Options → Select directory

Usage (every time):
1. Right-click → "Browse Local Directory"
2. Directory opens instantly! 🎉
```

**Much better!** 😊

---

## Report Results

After testing, please report:

- ✅ Which tests passed
- ❌ Which tests failed (if any)
- 📝 Any unexpected behavior
- 💡 Any suggestions for improvement

---

## Next Steps

If all tests pass:

1. ✅ Feature is working correctly!
2. ✅ You can use it for daily work
3. ✅ Configure your most-used directory
4. ✅ Enjoy instant access!

If tests fail:

1. Check browser console for errors (F12 → Console)
2. Verify you're using Chrome/Edge (not Firefox/Safari)
3. Try reloading the extension
4. Check the detailed documentation in `OPTIONS_BASED_DIRECTORY_CONFIGURATION.md`
