// Load saved configuration
document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.local.get(['rpApiKey', 'rpBaseUrl']);

  if (config.rpApiKey) {
    document.getElementById('apiKey').value = config.rpApiKey;
  }
  if (config.rpBaseUrl) {
    document.getElementById('baseUrl').value = config.rpBaseUrl;
  }
});

// Handle form submission
document.getElementById('configForm').addEventListener('submit', async e => {
  e.preventDefault();

  const apiKey = document.getElementById('apiKey').value.trim();
  const baseUrl = document.getElementById('baseUrl').value.trim();

  const statusDiv = document.getElementById('status');

  // Validate inputs
  if (!apiKey || !baseUrl) {
    showStatus('Please fill in all fields', 'error');
    return;
  }

  // Remove trailing slash from base URL
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

  // Save to chrome.storage.local
  await chrome.storage.local.set({
    rpApiKey: apiKey,
    rpBaseUrl: cleanBaseUrl,
  });

  // Configuration is saved and ready to use
  showStatus('Configuration saved successfully!', 'success');
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}
