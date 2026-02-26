/**
 * Core business logic for processing ReportPortal URLs and finding Magna logs
 */

import { extractIds, fetchJson, fetchUrlLines, customQuote } from '../shared/utils.js';
import { UsageError, UnexpectedStructureError } from '../shared/errors.js';

/**
 * Resolve the test log directory on Magna from a ReportPortal URL.
 * Shared logic used by both main() and findMustGatherTarballUrl().
 *
 * @returns {{ logsUrlRoot: string, clusterName: string, testName: string, targetFailedDirSuffix: string, safeTestName: string }}
 */
async function resolveTestLogDirectory(url, apiKey, baseUrl) {
  if (!apiKey || !baseUrl) {
    throw new UsageError('Missing configuration. Please set RP_API_KEY and RP_BASE_URL');
  }

  const cleanBaseUrl = baseUrl.trim().replace(/^["']|["']$/g, '');
  const { launchId, testItemId } = extractIds(url);

  const project = 'ocs';
  const rpProjectUrl = `${cleanBaseUrl}/api/v1/${project}`;
  const launchApi = `${rpProjectUrl}/launch?filter.eq.id=${launchId}`;
  const itemApi = `${rpProjectUrl}/item/${testItemId}`;

  const [launchJson, itemJson] = await Promise.all([
    fetchJson(launchApi, apiKey),
    fetchJson(itemApi, apiKey),
  ]);

  let logsUrlRoot, clusterName, testName;
  try {
    const description = launchJson.content[0].description;
    logsUrlRoot = description.split('Logs URL:')[1].trim();
    clusterName = logsUrlRoot.split('openshift-clusters/')[1].split('/')[0];
    testName = itemJson.name;
  } catch (error) {
    throw new UnexpectedStructureError(
      'Could not extract Magna logs location from RP. (missing description or name).'
    );
  }

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

  const safeTestName = customQuote(`${testName}_ocs_logs`, '/[]-_.~');

  return { logsUrlRoot, clusterName, testName, targetFailedDirSuffix, safeTestName };
}

/**
 * Process a ReportPortal URL and return the corresponding Magna logs URL.
 * @param {string} url - The ReportPortal UI URL to process.
 * @param {string} apiKey - ReportPortal API key.
 * @param {string} baseUrl - ReportPortal base URL.
 * @returns {Promise<string>} The URL to the Magna logs directory.
 */
async function main(url, apiKey, baseUrl) {
  const { logsUrlRoot, clusterName, targetFailedDirSuffix, safeTestName } =
    await resolveTestLogDirectory(url, apiKey, baseUrl);

  const targetDir = [
    logsUrlRoot.replace(/\/+$/, ''),
    targetFailedDirSuffix.replace(/\/+$/, ''),
    safeTestName,
    clusterName,
    'ocs_must_gather',
  ].join('/');

  const targetDirLines = await fetchUrlLines(targetDir);
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

/**
 * Find the URL of the must-gather tarball on Magna for a given ReportPortal test.
 * The tarball lives in the cluster directory alongside (or replacing) ocs_must_gather.
 *
 * @param {string} url - The ReportPortal UI URL to process.
 * @param {string} apiKey - ReportPortal API key.
 * @param {string} baseUrl - ReportPortal base URL.
 * @returns {Promise<string>} The full URL of the must-gather tarball.
 */
async function findMustGatherTarballUrl(url, apiKey, baseUrl) {
  const { logsUrlRoot, clusterName, targetFailedDirSuffix, safeTestName } =
    await resolveTestLogDirectory(url, apiKey, baseUrl);

  const clusterDir = [
    logsUrlRoot.replace(/\/+$/, ''),
    targetFailedDirSuffix.replace(/\/+$/, ''),
    safeTestName,
    clusterName,
  ].join('/');

  const dirLines = await fetchUrlLines(clusterDir);
  const tarballHrefs = dirLines
    .map(line => {
      const match = line.match(/href="([^"]+)"/);
      return match ? match[1] : null;
    })
    .filter(
      href => href && (href.endsWith('.tar.gz') || href.endsWith('.tgz') || href.endsWith('.tar'))
    );

  if (tarballHrefs.length === 0) {
    throw new UnexpectedStructureError(
      'No must-gather tarball found in the expected location on Magna.'
    );
  }

  const preferred = tarballHrefs.find(h => h.includes('must_gather') || h.includes('must-gather'));
  const tarballSuffix = preferred || tarballHrefs[0];

  return [clusterDir.replace(/\/+$/, ''), tarballSuffix.replace(/^\/+/, '')].join('/');
}

export { main, findMustGatherTarballUrl };
