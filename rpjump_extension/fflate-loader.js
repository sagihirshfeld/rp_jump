// Import fflate ES module and expose it globally
import * as fflate from './fflate.min.js';
window.fflate = fflate;

console.log('fflate loaded:', window.fflate);

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadScripts);
} else {
  loadScripts();
}

function loadScripts() {
  console.log('Loading scripts...');

  // Load untar library
  const untarScript = document.createElement('script');
  untarScript.src = 'untar.min.js';
  untarScript.onerror = e => console.error('Failed to load untar:', e);
  untarScript.onload = () => {
    console.log('untar loaded');

    // Load main script after libraries are ready
    const mainScript = document.createElement('script');
    mainScript.src = 'directory_browser.js';
    mainScript.onerror = e => console.error('Failed to load directory_browser:', e);
    mainScript.onload = () => console.log('directory_browser loaded');
    document.body.appendChild(mainScript);
  };
  document.head.appendChild(untarScript);
}

// Made with Bob
