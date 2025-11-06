// Load saved configuration
document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.local.get(['rpApiKey', 'rpBaseUrl', 'rpProject']);
  
  if (config.rpApiKey) {
    document.getElementById('apiKey').value = config.rpApiKey;
  }
  if (config.rpBaseUrl) {
    document.getElementById('baseUrl').value = config.rpBaseUrl;
  }
  if (config.rpProject) {
    document.getElementById('project').value = config.rpProject;
  }
});

// Handle form submission
document.getElementById('configForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const apiKey = document.getElementById('apiKey').value.trim();
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const project = document.getElementById('project').value.trim();
  
  const statusDiv = document.getElementById('status');
  
  // Validate inputs
  if (!apiKey || !baseUrl || !project) {
    showStatus('Please fill in all fields', 'error');
    return;
  }
  
  // Remove trailing slash from base URL
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  
  // Save to chrome.storage.local
  await chrome.storage.local.set({
    rpApiKey: apiKey,
    rpBaseUrl: cleanBaseUrl,
    rpProject: project
  });
  
  // Send configuration to server
  try {
    const response = await fetch('http://127.0.0.1:9999/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey,
        baseUrl: cleanBaseUrl,
        project: project
      })
    });
    
    if (response.ok) {
      showStatus('Configuration saved successfully!', 'success');
    } else {
      const errorText = await response.text();
      showStatus(`Failed to send config to server: ${errorText}`, 'error');
    }
  } catch (error) {
    // Server might not be running, but config is saved locally
    showStatus('Configuration saved locally. Make sure the RP Jump server is running.', 'success');
  }
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

