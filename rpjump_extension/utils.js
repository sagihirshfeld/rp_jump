/**
 * Utility functions for RP Jump extension
 */

import { UsageError, UnexpectedStructureError } from './errors.js';
/**
 * Custom URL encoding that matches Python's urllib.parse.quote with safe characters
 * @param {string} str - String to encode
 * @param {string} safe - Characters to keep unencoded
 * @returns {string} Encoded string with safe characters preserved
 */
export function customQuote(str, safe = '') {
  // Encode the string but keep safe characters unencoded
  let encoded = encodeURIComponent(str);
  // Replace safe characters back to their original form
  for (const char of safe) {
    const encodedChar = encodeURIComponent(char);
    // Escape special regex characters
    const regexPattern = encodedChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    encoded = encoded.replace(new RegExp(regexPattern, 'g'), char);
  }
  return encoded;
}

/**
 * Extract launch ID and test item ID from a ReportPortal UI URL.
 * @param {string} uiUrl - The ReportPortal UI URL containing launch and test item IDs.
 * @returns {Object} Object containing launchId and testItemId.
 * @throws {Error} If the URL format is invalid or missing required components.
 */
export function extractIds(uiUrl) {
  if (!['launches/', 'log'].every(p => uiUrl.includes(p))) {
    throw new UsageError(
      'Invalid ReportPortal URL format.\n' +
        'RP Jump only works on failed test pages of ReportPortal.\n'
    );
  }
  const parts = uiUrl.split('launches/')[1].split('/');
  const launchId = parts[1];
  const testItemId = parts[3];
  console.log(`Launch ID: ${launchId}, Test Item ID: ${testItemId}`);
  return { launchId, testItemId };
}

/**
 * Fetch JSON data from a URL using Bearer token authentication.
 * @param {string} url - The URL to fetch JSON data from.
 * @param {string} apiKey - The API bearer token.
 * @returns {Promise<Object>} The JSON response parsed as an object.
 * @throws {Error} If the HTTP request returns an error status.
 */
export async function fetchJson(url, apiKey) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Fetch and parse lines from a URL (for HTML directory listings).
 * @param {string} url - The URL to fetch content from.
 * @param {string} apiKey - The API bearer token (may not be needed for Magna).
 * @returns {Promise<string[]>} Array of lines from the response.
 * @throws {Error} If the HTTP request returns an error status.
 */
export async function fetchUrlLines(url, apiKey = '') {
  const headers = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  // Only add auth header if apiKey is provided (Magna might not need it)
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const text = await response.text();
  // Split by newlines and filter out empty lines
  return text.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Get the must-gather root URL of a must-gather sub-path.
 * @param {string} url - The URL of the must-gather sub-path.
 * @returns {string} The root URL of the must-gather sub-path.
 */
export function getMustGatherRootUrl(url) {
  const sub_parts = url.split('/');
  const root = sub_parts.find(part => part.includes('quay') || part.includes('registry'));
  if (!root) {
    throw new UnexpectedStructureError(
      'No quay*/registry* directory found in must-gather sub-path!'
    );
  }
  const index = sub_parts.indexOf(root);
  return sub_parts.slice(0, index + 1).join('/');
}
