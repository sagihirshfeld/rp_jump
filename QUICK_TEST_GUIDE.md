# Quick Test Guide - Back/Forward Navigation Fix

## Prerequisites

1. Reload the extension in Chrome: `chrome://extensions/` → Find "RP Jump" → Click Reload button
2. Open a new tab

## Test 1: Basic Directory Navigation (2 minutes)

### Steps:

1. Right-click anywhere → "RP Jump 🔗" → "Browse Local Directory 📁"
2. Click "📁 Pick Directory" and select any folder with subfolders
3. Click into a subfolder
4. **Click browser BACK button** ⬅️
5. **Click browser FORWARD button** ➡️

### Expected Results:

- ✅ Back button returns to parent directory
- ✅ Forward button returns to subfolder
- ✅ Buttons are NOT grayed out/disabled

---

## Test 2: File Viewing and Back Button (3 minutes)

### Steps:

1. Navigate to a directory with text files (e.g., logs, config files)
2. Click on a `.txt`, `.log`, `.json`, or `.md` file
3. File opens in the same tab
4. **Click browser BACK button** ⬅️

### Expected Results:

- ✅ Brief "Restoring directory browser..." message appears
- ✅ Directory listing reappears (NOT the "Pick Directory" screen)
- ✅ You're back in the same directory where you found the file

---

## Test 3: Deep Navigation + File (5 minutes)

### Steps:

1. Navigate through multiple levels: root → folder1 → folder2 → folder3
2. Click a file in folder3
3. **Click BACK button** ⬅️ (should return to folder3)
4. **Click BACK button** ⬅️ (should return to folder2)
5. **Click BACK button** ⬅️ (should return to folder1)
6. **Click FORWARD button** ➡️ (should return to folder2)
7. **Click FORWARD button** ➡️ (should return to folder3)

### Expected Results:

- ✅ Each back click goes to previous directory
- ✅ Forward buttons work to go forward again
- ✅ Full history is preserved

---

## Test 4: Edge Case - Permission Check (2 minutes)

### Steps:

1. Open a directory and navigate around
2. Click a file to view it
3. Wait 10 seconds
4. **Click BACK button** ⬅️

### Expected Results:

- ✅ Directory browser restores successfully
- ✅ If permission prompt appears, grant it
- ✅ Directory listing appears after granting permission

---

## Common Issues and Solutions

### Issue: Back button still doesn't work

**Solution**: Make sure you reloaded the extension after the code changes

### Issue: "Directory handle not found" error

**Solution**: This is expected if you refresh the page or wait too long. Just pick the directory again.

### Issue: Permission denied error

**Solution**: Click "Allow" when the browser asks for permission to access the directory

### Issue: Back button takes me to picker screen

**Solution**: This might happen if sessionStorage expired (after 5 minutes). This is expected behavior.

---

## Success Indicators

You'll know it's working when:

1. ✅ Browser back/forward buttons are clickable (not grayed out)
2. ✅ Clicking back after viewing a file returns to the directory
3. ✅ You see "Restoring directory browser..." message briefly
4. ✅ You can navigate back through multiple directory levels
5. ✅ Forward button works to go forward again

---

## If Something Doesn't Work

1. **Check browser console** (F12 → Console tab) for errors
2. **Verify you're using Chrome/Edge** (not Firefox or Safari)
3. **Reload the extension** at `chrome://extensions/`
4. **Try a different directory** (some system directories may be restricted)
5. **Check the detailed documentation** in `BACK_FORWARD_NAVIGATION_FIX.md`

---

## Report Results

After testing, please report:

- ✅ Which tests passed
- ❌ Which tests failed (if any)
- 📝 Any unexpected behavior
- 💡 Any suggestions for improvement
