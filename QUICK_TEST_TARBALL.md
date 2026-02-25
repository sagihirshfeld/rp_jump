# Quick Test Guide - Tarball Extraction Feature

## Prerequisites

1. **Reload the extension**: `chrome://extensions/` → Find "RP Jump" → Click Reload
2. **Have a test tarball ready** in your configured directory

## Creating Test Tarballs (if needed)

### Option 1: Create a simple test tarball

```bash
# Create test directory with files
mkdir test-archive
cd test-archive
echo "Hello World" > file1.txt
echo "Test content" > file2.log
mkdir subdir
echo "Nested file" > subdir/file3.txt

# Create .tar
cd ..
tar -cf test-archive.tar test-archive/

# Create .tar.gz
tar -czf test-archive.tar.gz test-archive/

# Create .tgz
tar -czf test-archive.tgz test-archive/
```

### Option 2: Use existing tarball

If you already have tarballs (logs, backups, etc.), use those!

---

## Test 1: Extract .tar.gz File (3 minutes)

### Steps:

1. Make sure you have a `.tar.gz` file in your configured directory
2. Right-click anywhere → "Browse Local Directory"
3. **Prompt appears**
4. Enter tarball name: `test-archive.tar.gz` (or your tarball name)
5. Click "Browse"

### Expected Results:

- ✅ Progress overlay appears
- ✅ Progress bar moves through stages:
  - Initializing...
  - Searching for tarball...
  - Reading tarball file...
  - Detecting format...
  - Decompressing...
  - Extracting files...
  - Writing to storage...
  - Loading contents...
- ✅ Progress completes and disappears
- ✅ Directory listing shows extracted contents
- ✅ Title shows: "Extracted: test-archive.tar.gz"
- ✅ Button shows: "← Back to Directory"

---

## Test 2: Navigate Extracted Contents (2 minutes)

### Steps:

1. After extraction (from Test 1)
2. Click on a folder (if any)
3. Navigate into it
4. Click on a file
5. File opens in browser
6. Click browser back button

### Expected Results:

- ✅ Can navigate into folders
- ✅ Breadcrumb updates
- ✅ Files open when clicked
- ✅ Back button returns to extracted directory
- ✅ All navigation works smoothly

---

## Test 3: Back to Directory (1 minute)

### Steps:

1. While viewing extracted contents
2. Click "← Back to Directory" button (top right)

### Expected Results:

- ✅ Returns to normal directory view
- ✅ Shows configured directory contents
- ✅ Button changes back to "⚙️ Change Directory"
- ✅ Can browse normally

---

## Test 4: Extract .tar File (2 minutes)

### Steps:

1. Create or use a `.tar` file (uncompressed)
2. Right-click → "Browse Local Directory"
3. Enter: `test-archive.tar`
4. Click "Browse"

### Expected Results:

- ✅ Progress shows (skips "Decompressing..." stage)
- ✅ Extraction completes
- ✅ Contents display correctly
- ✅ No errors

---

## Test 5: Extract .tgz File (2 minutes)

### Steps:

1. Create or use a `.tgz` file
2. Right-click → "Browse Local Directory"
3. Enter: `test-archive.tgz`
4. Click "Browse"

### Expected Results:

- ✅ Progress shows with decompression
- ✅ Extraction completes
- ✅ Contents display correctly
- ✅ Works same as .tar.gz

---

## Test 6: Filename Without Extension (1 minute)

### Steps:

1. Right-click → "Browse Local Directory"
2. Enter just the base name: `test-archive` (no extension)
3. Click "Browse"

### Expected Results:

- ✅ System tries multiple extensions
- ✅ Finds and extracts the tarball
- ✅ Works without specifying extension

---

## Test 7: Empty Input (Normal Browse) (1 minute)

### Steps:

1. Right-click → "Browse Local Directory"
2. **Leave input empty**
3. Click "Browse"

### Expected Results:

- ✅ No extraction happens
- ✅ Directory opens normally
- ✅ Shows configured directory contents
- ✅ Works like before (backward compatible)

---

## Test 8: Non-Existent Tarball (1 minute)

### Steps:

1. Right-click → "Browse Local Directory"
2. Enter: `nonexistent-file.tar.gz`
3. Click "Browse"

### Expected Results:

- ✅ Error message appears: "Tarball not found: nonexistent-file.tar.gz"
- ✅ After 3 seconds, falls back to normal directory view
- ✅ Can browse directory normally

---

## Test 9: Cancel Prompt (30 seconds)

### Steps:

1. Right-click → "Browse Local Directory"
2. Prompt appears
3. Click "Cancel"

### Expected Results:

- ✅ Prompt closes
- ✅ Tab closes (or nothing happens)
- ✅ No errors

---

## Test 10: Large Tarball (if available) (5 minutes)

### Steps:

1. Use a larger tarball (10-50MB)
2. Right-click → "Browse Local Directory"
3. Enter tarball name
4. Click "Browse"
5. **Watch progress carefully**

### Expected Results:

- ✅ Progress bar moves smoothly
- ✅ Each stage shows appropriate time
- ✅ Eventually completes
- ✅ Contents display correctly
- ✅ No timeout or errors

---

## Common Issues and Solutions

### Issue: "fflate is not defined" or "untar is not defined"

**Cause:** External libraries not loaded

**Solution:**

1. Check internet connection (libraries load from CDN)
2. Reload the extension
3. Check browser console for errors

### Issue: Progress stuck at 60%

**Cause:** Large tarball or many files

**Solution:** Wait patiently - extraction takes time for large archives

### Issue: "Failed to extract tarball: Invalid tar format"

**Cause:** Corrupted or invalid tarball

**Solution:**

1. Verify tarball: `tar -tzf file.tar.gz` in terminal
2. Try a different tarball
3. Re-create the tarball

### Issue: Extracted files don't show

**Cause:** OPFS write failure

**Solution:**

1. Check browser console (F12)
2. Try smaller tarball
3. Clear browser cache
4. Reload extension

### Issue: Can't find tarball even though it exists

**Cause:** Case sensitivity or wrong directory

**Solution:**

1. Check exact filename (case-sensitive!)
2. Verify directory in options
3. Try with full extension
4. Check file is in root of configured directory

---

## Success Indicators

You'll know it's working when:

1. ✅ Prompt dialog appears when clicking "Browse Local Directory"
2. ✅ Progress overlay shows during extraction
3. ✅ Extracted contents display in browser
4. ✅ Can navigate extracted files
5. ✅ "Back to Directory" button works
6. ✅ Empty input still works (normal browse)
7. ✅ Error messages are clear and helpful

---

## Performance Benchmarks

Expected extraction times:

| Tarball Size | Files     | Time   | Status       |
| ------------ | --------- | ------ | ------------ |
| < 1MB        | < 100     | < 1s   | ⚡ Instant   |
| 1-10MB       | 100-1000  | 1-3s   | 🚀 Fast      |
| 10-50MB      | 1000-5000 | 3-10s  | ✅ Good      |
| 50-100MB     | 5000+     | 10-30s | ⏳ Slow      |
| > 100MB      | Many      | 30s+   | ⚠️ Very Slow |

---

## Browser Console Checks

Open browser console (F12) and check for:

**Good signs:**

- No errors in console
- Clean extraction logs
- OPFS operations successful

**Bad signs:**

- Red errors
- "Failed to write file" messages
- Permission errors

---

## Report Results

After testing, please report:

- ✅ Which tests passed
- ❌ Which tests failed (if any)
- 📝 Any unexpected behavior
- ⏱️ Performance observations
- 💡 Suggestions for improvement

---

## Next Steps

If all tests pass:

1. ✅ Feature is working!
2. ✅ Ready for production use
3. ✅ Try with your real tarballs

If tests fail:

1. Check browser console for errors
2. Verify external libraries loaded
3. Try simpler test case
4. Report specific error messages
5. Check detailed documentation in `TARBALL_EXTRACTION_FEATURE.md`

---

## Quick Reference

**Extract tarball:**

```
Right-click → Browse Local Directory
Enter: "filename.tar.gz"
Click: Browse
```

**Normal browse:**

```
Right-click → Browse Local Directory
Leave empty
Click: Browse
```

**Return to directory:**

```
Click: "← Back to Directory" button
```

That's it! Happy testing! 🎉
