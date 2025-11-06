/**
 * Core business logic for processing ReportPortal URLs and finding Magna logs
 */

import { extractIds, fetchJson, fetchUrlLines, customQuote } from './utils.js';
import { UsageError, UnexpectedStructureError } from './errors.js';

/**
 * Process a ReportPortal URL and return the corresponding Magna logs URL.
 * @param {string} url - The ReportPortal UI URL to process.
 * @param {string} apiKey - ReportPortal API key.
 * @param {string} baseUrl - ReportPortal base URL.
 * @returns {Promise<string>} The URL to the Magna logs directory.
 * @throws {Error} If configuration is missing or processing fails.
 */
async function main(url, apiKey, baseUrl) {
  // Validate configuration
  if (!apiKey || !baseUrl) {
    throw new Error('Missing configuration. Please set RP_API_KEY and RP_BASE_URL');
  }

  // Clean base URL
  const cleanBaseUrl = baseUrl.trim().replace(/^["']|["']$/g, '');

  // Extract launch ID and test item ID from the URL
  const { launchId, testItemId } = extractIds(url);

  // Build the URLs for the launch and item API (hardcoded to "ocs" project)
  const project = 'ocs';
  const rpProjectUrl = `${cleanBaseUrl}/api/v1/${project}`;
  const launchApi = `${rpProjectUrl}/launch?filter.eq.id=${launchId}`;
  const itemApi = `${rpProjectUrl}/item/${testItemId}`;

  // Fetch the launch and item JSON data in parallel
  const [launchJson, itemJson] = await Promise.all([
    fetchJson(launchApi, apiKey),
    fetchJson(itemApi, apiKey),
  ]);

  // Extract logs URL root and test name from the JSON data
  let logsUrlRoot, clusterName, testName;
  try {
    const description = launchJson.content[0].description;
    logsUrlRoot = description.split('Logs URL:')[1].trim();
    clusterName = logsUrlRoot.split('openshift-clusters/')[1].split('/')[0];
    testName = itemJson.name;
  } catch (error) {
    throw new UsageError(
      'Could not extract Magna logs location from RP ' + '(missing description or name).'
    );
  }

  // Find the failed_testcase subdirectories
  const lines = await fetchUrlLines(logsUrlRoot, apiKey);
  const failedDirsSuffixes = lines
    .filter(line => line.includes('failed_testcase'))
    .map(line => {
      const match = line.match(/href="([^"]+)"/);
      return match ? match[1] : null;
    })
    .filter(suffix => suffix !== null);

  if (failedDirsSuffixes.length === 0) {
    throw new UnexpectedStructureError('No failed_testcase directories found on Magna.');
  }

  // Find the failed_testcase directory that contains the test name
  let targetFailedDirSuffix = null;
  for (const suffix of failedDirsSuffixes) {
    const dirUrl = `${logsUrlRoot}/${suffix}`;
    const dirLines = await fetchUrlLines(dirUrl, apiKey);
    if (dirLines.some(line => line.includes(testName))) {
      targetFailedDirSuffix = suffix;
      break;
    }
  }
  if (!targetFailedDirSuffix) {
    throw new UnexpectedStructureError(
      'Test exists in RP but not in any failed_testcase directory on Magna.'
    );
  }

  // Encode test name only, leave slashes and brackets unencoded (Magna expects them)
  const safeTestName = customQuote(`${testName}_ocs_logs`, '/[]-_.~');

  const targetDir = [
    logsUrlRoot.replace(/\/+$/, ''),
    targetFailedDirSuffix.replace(/\/+$/, ''),
    safeTestName,
    clusterName,
    'ocs_must_gather',
  ].join('/');

  // Find quay*/registry*
  const targetDirLines = await fetchUrlLines(targetDir, apiKey);
  const prefixMatch = targetDirLines
    .map(line => {
      const match = line.match(/href="([^"]+)"/);
      return match ? match[1] : null;
    })
    .filter(href => href && (href.includes('quay') || href.includes('registry')));

  if (prefixMatch.length === 0) {
    throw new UnexpectedStructureError(
      'Magna logs found, but no quay*/registry* directory exists.'
    );
  }

  const prefix = prefixMatch[0];
  const finalUrl = [targetDir.replace(/\/+$/, ''), prefix.replace(/^\/+/, '')].join('/');
  return finalUrl;
}

// Export main function for use in other modules
export { main };
