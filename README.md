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

The project is a self-contained Chrome extension:

- **Chrome Extension** (`rpjump_extension/`):
  - `background.js`: Main extension logic and event handlers
  - `report_portal.js`: Core logic that queries ReportPortal API and navigates Magna's directory structure
  - `options.html/js`: Configuration interface for API credentials

## Prerequisites

- Chrome browser
- ReportPortal API access (API key and base URL)
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
   - Right-click the RP Jump extension icon and select **Options**
   - Enter your ReportPortal API key and base URL
   - Click **Save Configuration**

That's it! No server setup required. The extension works entirely in the browser.

## Usage

1. **Navigate to a ReportPortal test log page** in Chrome
   - The URL should contain `/launches/` (e.g., `.../launches/<launch_id>/<item_id>/log`)

2. **Click the RP Jump extension icon** in Chrome's toolbar, or:
   - Right-click on the page and select **"RP Jump 🔗"** from the context menu

3. The extension will:
   - ✅ **Success**: Open the Magna logs directory in a new tab
   - ❌ **Error**: Show an alert with the error message

## How It Works

1. **URL Parsing**: Extracts `launch_id` and `test_item_id` from the ReportPortal URL
2. **API Queries**: Fetches launch and test item details from ReportPortal API
3. **Log Location Extraction**: Parses the launch description to find the Magna logs root URL
4. **Directory Navigation**:
   - Searches for `failed_testcase` directories
   - Matches the test name to find the correct directory
   - Navigates to `ocs_must_gather` and finds `quay*/registry*` subdirectories
5. **Result**: Returns the final URL to the logs directory

## Configuration

Configuration is managed through the Chrome extension options page:

1. Right-click the RP Jump extension icon
2. Select **Options**
3. Enter your configuration:
   - **ReportPortal API Key**: Your ReportPortal API bearer token
   - **ReportPortal Base URL**: Base URL of your ReportPortal instance (e.g., `https://reportportal.example.com`)

   **Note**: The extension uses the "ocs" project (hardcoded).

The configuration is saved locally in Chrome's extension storage and persists across browser sessions.

## Troubleshooting

### "Configuration missing" error

- Open the extension options page and verify all fields are filled in
- Ensure the configuration was saved successfully
- Try reloading the extension after saving configuration

### "Not a ReportPortal test log URL"

- Make sure you're on a ReportPortal page with a URL containing `/launches/`
- The URL format should be: `.../launches/<launch_id>/<item_id>/log`

### "No failed_testcase directories found"

- The test may not have failed, or logs may not be available on Magna yet
- Verify the Magna logs server is accessible

## Development

The extension is written in JavaScript and runs entirely in the browser.

To modify the extension:

1. Edit files in `rpjump_extension/`
2. Reload the extension in Chrome (`chrome://extensions/` → click reload)
3. Test your changes

## Security Notes

- **API keys are stored locally** in Chrome's extension storage (not synced across devices)
- All API requests are made directly from your browser to ReportPortal and Magna servers
- Configuration never leaves your machine
- The extension requires `<all_urls>` permission to access ReportPortal and Magna APIs
