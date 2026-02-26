# RP Jump 🔗

A Chrome extension that instantly jumps from ReportPortal test failure pages to the corresponding Magna logs directory. No more manual navigation through nested directories!

## Overview

When debugging test failures in ReportPortal, finding the corresponding logs in Magna can be tedious. RP Jump automates this process:

1. **Click the extension icon** (or use the right-click menu) while viewing a ReportPortal test log page
2. The extension extracts test information from ReportPortal API directly
3. It navigates through Magna's directory structure to find the matching logs
4. **Opens the logs directory in a new tab** - done! 🎉

**No server required!** Everything runs directly in the browser extension.

## Architecture

The project is a self-contained Chrome extension (`rpjump_extension/`):

- `background/` -- Service worker, context menu, and ReportPortal API logic
- `directory-browser/` -- Local filesystem browser UI
- `options/` -- Settings and configuration page
- `shared/` -- Common utilities (favorites, errors, helpers)
- `vendor/` -- Bundled third-party libraries (see [Third-Party Open Source](#third-party-open-source))

## Prerequisites

- Chrome browser
- ReportPortal API access (API key and base URL)
  - In ReportPortal: click your avatar/profile (bottom‑left) → Profile → API Keys
  - The base URL is the root of your instance, e.g. `https://reportportal.example.com`
- Access to Magna logs server
- ReportPortal project must be "ocs" (hardcoded)

## Installation

1. **Clone the repository** (or download the extension folder):

   ```bash
   git clone <repository-url>
   cd rp_jump
   ```

2. **Install the Chrome Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in the top-right)
   - Click **Load unpacked**
   - Select the `rpjump_extension/` directory

3. **Configure RP Jump**:
   - Click the ellipsis icon next to the RP Jump extension and select **Options**
   - Enter your ReportPortal API key and base URL
   - Click **Save Configuration**

That's it! No server setup required. The extension works entirely in the browser.

## Usage

1. **Navigate to a ReportPortal test log page** in Chrome
   - The URL should contain `/launches/` (e.g., `.../launches/<launch_id>/<item_id>/log`)

2. **Right-click on the page** (or on a specific link) and open the **"RP Jump 🔗"** menu:
   - **RP Jump 🔗**: The main item. Clicks here will perform the standard jump to the logs root.
   - **must-gather root 📂**: Jump specifically to the root of the `must-gather` logs directory.
   - **Favorites ⭐**: A submenu for your saved log locations.
     - **<Your Saved Favorites>**: Click any saved favorite to jump directly to that sub-path within the current logs.
   - **Add to favorites! 💫**: Save the current sub-path (relative to the must-gather root) as a favorite. You will be prompted to name it.
   - **Browse Local Directory 📁**: Browse local filesystem directories in Apache autoindex style (see below).

3. The extension will:
   - ✅ **Success**: Open the corresponding Magna logs directory (in a new tab, or update current tab if already in logs)
   - ❌ **Error**: Show an alert with the error message

### Favorites Feature

RP Jump allows you to save frequently accessed log sub-directories (e.g., specific pod logs, namespace events) as "Favorites".

- **Adding**: Navigate to a sub-directory in the logs (e.g., inside `must-gather`), right-click, and select **Add to favorites!**. You can give it a custom name.
- **Using**: On any future test failure page (or while browsing other logs), select your favorite from the menu. RP Jump will find the logs root for the _current_ test run and append your favorite's sub-path.
- **Managing**: Open the extension's **Options** page to rename, reorder (drag and drop), export/import, or delete favorites.

### Local Directory Browser

RP Jump includes a built-in local directory browser. Right-click and select **Browse Local Directory 📁** to pick a folder from your machine and browse it in Apache autoindex style -- no server needed. Supports full folder/file navigation, breadcrumbs, file viewing, and browser back/forward. Useful for browsing extracted tarballs or local log archives in the same familiar interface as remote Magna logs.

## Third-Party Open Source

RP Jump bundles the following open-source libraries (all MIT-licensed):

| Library            | Description                                      | Repository                                              |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------- |
| **pako** 2.1.0     | JavaScript zlib port (deflate/inflate/gzip)      | [nodeca/pako](https://github.com/nodeca/pako)           |
| **js-untar** 2.0.0 | Tar file extraction in the browser               | [InvokIT/js-untar](https://github.com/InvokIT/js-untar) |
| **fflate**         | High-performance compression (deflate/gzip/zlib) | [101arrowz/fflate](https://github.com/101arrowz/fflate) |

Full license texts are in [`vendor/THIRD_PARTY_NOTICES.md`](rpjump_extension/vendor/THIRD_PARTY_NOTICES.md).

## Security Notes

- **API keys are stored locally** in Chrome's extension storage (not synced across devices)
- All API requests are made directly from your browser to ReportPortal and Magna servers
- Configuration never leaves your machine
- The extension requires `<all_urls>` permission to access ReportPortal and Magna APIs
