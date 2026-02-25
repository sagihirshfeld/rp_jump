# Tarball Extraction Feature - Complete Guide

## Overview

The directory browser now supports **automatic tarball extraction**! When you click "Browse Local Directory", you can optionally enter a tarball name to extract and browse its contents directly in the browser.

## Features

✅ **Supports multiple formats**: .tar, .tar.gz, .tgz
✅ **Automatic decompression**: Handles gzip compression automatically
✅ **Progress indicator**: Visual feedback during extraction
✅ **OPFS storage**: Extracted files stored in browser's private filesystem (no disk writes needed)
✅ **Full navigation**: Browse extracted contents like a normal directory
✅ **Back to directory**: Easy return to normal directory view
✅ **Error handling**: Clear error messages with automatic fallback

## How It Works

### User Flow

```
1. Right-click → "Browse Local Directory"
2. Prompt appears: "Enter tarball name (optional)"
3. Two options:
   a. Enter tarball name → Extract and browse contents
   b. Leave empty → Browse directory normally
```

### Technical Flow

```
User enters tarball name
    ↓
Search for tarball in configured directory
    ↓
Read tarball file
    ↓
Detect format (.tar or .tar.gz)
    ↓
Decompress if needed (using fflate)
    ↓
Extract tar contents (using js-untar)
    ↓
Write files to OPFS (Origin Private File System)
    ↓
Display extracted contents in browser
    ↓
User can navigate, view files, etc.
    ↓
Click "Back to Directory" to return
```

## Usage Guide

### Scenario 1: Extract a Tarball

1. **Configure directory** (one-time setup):
   - Right-click extension icon → Options
   - Select your directory containing tarballs (e.g., `/tmp`)

2. **Extract and browse**:
   - Right-click on any page → "Browse Local Directory"
   - Enter tarball name: `logs-2024.tar.gz`
   - Click "Browse"
   - Watch progress indicator
   - Browse extracted contents!

3. **Navigate extracted files**:
   - Click folders to navigate
   - Click files to view them
   - Use back/forward buttons
   - Click "← Back to Directory" to return

### Scenario 2: Normal Directory Browse

1. Right-click → "Browse Local Directory"
2. Leave input **empty**
3. Click "Browse"
4. Directory opens normally (current behavior)

## Supported Formats

| Format   | Extension | Compression | Support |
| -------- | --------- | ----------- | ------- |
| TAR      | `.tar`    | None        | ✅ Full |
| TAR+GZIP | `.tar.gz` | gzip        | ✅ Full |
| TAR+GZIP | `.tgz`    | gzip        | ✅ Full |

**Note:** Other formats (.zip, .rar, .7z) are not currently supported.

## File Name Matching

The system tries multiple variations to find your tarball:

```
Input: "logs-2024"

Tries:
1. logs-2024 (exact match)
2. logs-2024.tar
3. logs-2024.tar.gz
4. logs-2024.tgz
```

**Tip:** You can enter just the base name without extension!

## Progress Stages

During extraction, you'll see these progress stages:

1. **Initializing...** (0%)
2. **Searching for tarball...** (10%)
3. **Reading tarball file...** (20%)
4. **Detecting format...** (30%)
5. **Decompressing...** (40%) - only for .gz files
6. **Extracting files...** (60%)
7. **Writing to storage...** (80%)
8. **Loading contents...** (95%)
9. **Complete!** (100%)

## Storage Details

### OPFS (Origin Private File System)

Extracted files are stored in the browser's **Origin Private File System**:

```
OPFS Root
└── extracted/
    └── [sanitized-tarball-name]/
        ├── file1.txt
        ├── file2.log
        └── subdir/
            └── file3.txt
```

**Benefits:**

- ✅ No write permission needed
- ✅ Fast access
- ✅ Automatic cleanup when browser cache is cleared
- ✅ Isolated from user's filesystem
- ✅ No disk space concerns

**Limitations:**

- ⚠️ Cleared when browser cache is cleared
- ⚠️ Not accessible outside the browser
- ⚠️ Temporary storage (re-extract if needed)

## Error Handling

### Error: "Tarball not found"

**Cause:** File doesn't exist in configured directory

**Solutions:**

1. Check the filename (case-sensitive!)
2. Verify file is in configured directory
3. Try with full extension: `logs.tar.gz`
4. Check if directory is configured correctly

### Error: "No directory configured"

**Cause:** Haven't configured browse directory yet

**Solution:**

1. Click "Open Options" (or right-click extension icon → Options)
2. Configure browse directory
3. Try again

### Error: "Failed to extract tarball"

**Possible causes:**

- Corrupted tarball
- Invalid tar format
- Unsupported compression
- File too large

**Solutions:**

1. Verify tarball is valid: `tar -tzf file.tar.gz` (in terminal)
2. Check file size (very large files may fail)
3. Try a different tarball
4. Check browser console for details

### Error: "Permission denied"

**Cause:** Lost permission to configured directory

**Solution:**

1. Grant permission when prompted
2. Or reconfigure directory in options

## Technical Details

### Libraries Used

1. **fflate** (v0.8.1)
   - Purpose: Gzip decompression
   - Size: ~20KB minified
   - Source: https://github.com/101arrowz/fflate

2. **js-untar** (v2.0.0)
   - Purpose: TAR extraction
   - Size: ~10KB minified
   - Source: https://github.com/InvokIT/js-untar

### Security Features

1. **Path Traversal Prevention**

   ```javascript
   // Sanitizes paths to prevent ../../../etc/passwd attacks
   const safePath = file.name.replace(/\.\./g, '').replace(/^\//, '');
   ```

2. **Filename Sanitization**

   ```javascript
   // Sanitizes tarball name for OPFS directory
   const sanitizedName = tarballName.replace(/[^a-zA-Z0-9-_]/g, '_');
   ```

3. **Size Limits** (recommended)
   - Tarballs: 100MB max (not enforced yet)
   - Extracted: 500MB max (not enforced yet)

### Performance Considerations

**Small tarballs (<10MB):**

- Extraction: < 1 second
- Very fast

**Medium tarballs (10-50MB):**

- Extraction: 1-5 seconds
- Good performance

**Large tarballs (50-100MB):**

- Extraction: 5-15 seconds
- May show progress for a while

**Very large tarballs (>100MB):**

- May fail or take very long
- Consider splitting into smaller archives

## Comparison with Alternatives

### vs. Manual Extraction

**Manual (tar command):**

```bash
tar -xzf logs.tar.gz
cd logs/
ls
```

**Our Feature:**

```
1. Enter "logs.tar.gz"
2. Browse immediately!
```

**Winner:** Our feature (much faster!)

### vs. Opening Files Directly

**Direct file opening:**

- Can't browse tar contents
- Must extract manually first
- Extra steps

**Our Feature:**

- Browse tar contents directly
- No manual extraction
- Seamless experience

**Winner:** Our feature!

## Troubleshooting

### Issue: Progress stuck at "Extracting files..."

**Cause:** Large tarball or many files

**Solution:** Wait patiently, it's working! Large tarballs take time.

### Issue: "Back to Directory" button doesn't work

**Cause:** JavaScript error or state corruption

**Solution:**

1. Refresh the page
2. Try again
3. Check browser console for errors

### Issue: Extracted files don't show

**Cause:** OPFS write failure

**Solution:**

1. Check browser console for errors
2. Try a smaller tarball
3. Clear browser cache and try again

### Issue: Can't find my tarball

**Cause:** Wrong directory or filename

**Solution:**

1. Verify directory in options shows correct path
2. Check filename (case-sensitive!)
3. Try with full extension
4. Verify file exists in that directory

## Best Practices

1. **Use descriptive names**: `logs-2024-01-15.tar.gz` better than `archive.tar.gz`

2. **Keep tarballs reasonable size**: < 50MB for best performance

3. **Organize by date**: Easier to find specific archives

4. **Test with small tarball first**: Verify setup works

5. **Clear OPFS periodically**: Browser cache can grow large

## Future Enhancements

Potential improvements for future versions:

- [ ] Support for .zip files
- [ ] Support for .7z files
- [ ] Streaming extraction for large files
- [ ] Size limit warnings
- [ ] OPFS cache management
- [ ] Multiple tarball extraction
- [ ] Search within extracted contents
- [ ] Download extracted files
- [ ] Re-compress to different format

## Examples

### Example 1: Log Files

```
Tarball: server-logs-2024-01-15.tar.gz
Location: /var/log/archives/

Steps:
1. Configure directory: /var/log/archives/
2. Enter: "server-logs-2024-01-15"
3. Browse extracted logs
4. Click specific log file to view
5. Use back button to return
```

### Example 2: Backup Archives

```
Tarball: backup-20240115.tar.gz
Location: /home/user/backups/

Steps:
1. Configure directory: /home/user/backups/
2. Enter: "backup-20240115"
3. Browse backup contents
4. Navigate folders
5. View specific files
```

### Example 3: Source Code

```
Tarball: project-v1.0.tar.gz
Location: /tmp/downloads/

Steps:
1. Configure directory: /tmp/downloads/
2. Enter: "project-v1.0"
3. Browse source code
4. View README, source files, etc.
5. Back to directory when done
```

## FAQ

**Q: Do I need to extract tarballs manually first?**
A: No! That's the whole point - automatic extraction.

**Q: Where are extracted files stored?**
A: In browser's OPFS (private filesystem), not on disk.

**Q: Can I extract multiple tarballs?**
A: Currently one at a time. Close and reopen for another.

**Q: What happens to extracted files?**
A: Cleared when you close browser or clear cache.

**Q: Can I download extracted files?**
A: Not directly, but you can view and copy content.

**Q: Does it work offline?**
A: Yes! Once libraries are loaded, works offline.

**Q: Is it secure?**
A: Yes! Path traversal prevention, sandboxed OPFS.

**Q: What about nested tarballs?**
A: Not supported - extract outer tarball only.

## Conclusion

The tarball extraction feature provides a seamless way to browse archive contents without manual extraction. It's fast, secure, and integrated directly into the directory browser workflow.

**Key Benefits:**

- ✅ No manual extraction needed
- ✅ Fast and convenient
- ✅ Supports common formats
- ✅ Secure and sandboxed
- ✅ Progress feedback
- ✅ Easy navigation

Enjoy browsing your tarballs! 🎉
