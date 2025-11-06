# RP Jump 🔗

A Chrome extension that instantly jumps from ReportPortal test failure pages to the corresponding Magna logs directory. No more manual navigation through nested directories!

## Overview

When debugging test failures in ReportPortal, finding the corresponding logs in Magna can be tedious. RP Jump automates this process:

1. **Click the extension icon** (or use the right-click menu) while viewing a ReportPortal test log page
2. The extension sends the URL to a local Python server
3. The server extracts test information from ReportPortal API
4. It navigates through Magna's directory structure to find the matching logs
5. **Opens the logs directory in a new tab** - done! 🎉

## Architecture

The project consists of three components:

- **Chrome Extension** (`rpjump_extension/`): Captures the current page URL and communicates with the local server
- **Python Server** (`rpjump_server.py`): HTTP server that receives URLs from the extension and processes them
- **ReportPortal Handler** (`report_portal.py`): Core logic that queries ReportPortal API and navigates Magna's directory structure

## Prerequisites

- Chrome browser
- ReportPortal API access (API key, base URL, and project name)
- Access to Magna logs server
- macOS or Linux (for standalone executable)

## Installation

### Option 1: Using Standalone Executable (Recommended)

1. **Download the executable** for your platform:
   - macOS: `rpjump-server-macos-*`
   - Linux: `rpjump-server-linux-*`

   Or build it yourself (see [Building from Source](#building-from-source) below).

2. **Make the executable runnable** (if needed):
   ```bash
   chmod +x rpjump-server-*
   ```

3. **Start the server**:
   ```bash
   ./rpjump-server-*
   ```

   The server will start on `http://localhost:9999/jump`

4. **Install the Chrome Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in the top-right)
   - Click **Load unpacked**
   - Select the `rpjump_extension/` directory

5. **Configure RP Jump**:
   - Right-click the RP Jump extension icon and select **Options**
   - Enter your ReportPortal API key, base URL, and project name
   - Click **Save Configuration**

### Option 2: Using Python (For Development)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd rp_jump
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Install the Chrome Extension** (same as Option 1, step 4)

4. **Configure RP Jump** (same as Option 1, step 5)

5. **Start the Python server**:
   ```bash
   python3 rpjump_server.py
   ```

## Usage

1. **Ensure the RP Jump server is running** (see installation steps above)

2. **Navigate to a ReportPortal test log page** in Chrome
   - The URL should contain `/launches/` (e.g., `.../launches/<launch_id>/<item_id>/log`)

3. **Click the RP Jump extension icon** in Chrome's toolbar, or:
   - Right-click on the page and select **"RP Jump 🔗"** from the context menu

4. The extension will:
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
   - **ReportPortal Project**: The project name in ReportPortal (e.g., `ocs`)

The configuration is automatically sent to the server when saved. You can also configure it via environment variables (for development):

- `RP_API_KEY`: Your ReportPortal API bearer token
- `RP_BASE_URL`: Base URL of your ReportPortal instance
- `RP_PROJECT`: The project name in ReportPortal

## Troubleshooting

### Extension shows "Could not reach RP Jump server"

- Ensure `rpjump_server.py` is running
- Check that the server is listening on `localhost:9999`
- Verify Chrome extension permissions allow access to `http://127.0.0.1:9999/*`

### "Configuration missing" error

- Open the extension options page and verify all fields are filled in
- Ensure the configuration was saved successfully
- Check that the server received the configuration (look for log messages)
- If using Python directly, you can also set environment variables as a fallback

### "Not a ReportPortal test log URL"

- Make sure you're on a ReportPortal page with a URL containing `/launches/`
- The URL format should be: `.../launches/<launch_id>/<item_id>/log`

### "No failed_testcase directories found"

- The test may not have failed, or logs may not be available on Magna yet
- Verify the Magna logs server is accessible


## Building from Source

To build standalone executables for macOS and Linux:

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the build script**:
   ```bash
   ./build.sh
   ```

3. **Find your executable** in the `dist/` directory:
   - macOS: `dist/rpjump-server-macos-*`
   - Linux: `dist/rpjump-server-linux-*`

**Note**: To build for a specific platform, run the build script on that platform. Cross-compilation is not supported.

## Security Notes

- **API keys are stored locally** in Chrome's extension storage (not synced)
- The server only accepts connections from `localhost` for security
- Configuration is sent over localhost only (never leaves your machine)
- For development, you can still use environment variables as a fallback
