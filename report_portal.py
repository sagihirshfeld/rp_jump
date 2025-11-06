#!/usr/bin/env python3

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("rp-jump")


class RPError(Exception):
    """Intentional errors that print just the message."""

    pass


def fail(msg: str):
    raise RPError(msg)


def extract_ids(ui_url: str):
    """Extract launch ID and test item ID from a ReportPortal UI URL.

    Args:
        ui_url: The ReportPortal UI URL containing launch and test item IDs.

    Returns:
        tuple: A tuple containing (launch_id, test_item_id).

    Raises:
        RPError: If the URL format is invalid or missing required components.
    """
    if "launches/" not in ui_url:
        fail("Not a ReportPortal test log URL (missing 'launches/').")

    try:
        parts = ui_url.split("launches/")[-1].split("/")
        launch_id = parts[1]
        test_item_id = parts[3]
        log.info(f"Launch ID: {launch_id}, Test Item ID: {test_item_id}")
        return launch_id, test_item_id
    except Exception:
        fail(
            "Invalid ReportPortal URL format. "
            "Expected .../launches/<launch>/<item>/log"
        )


def fetch_json(url, session):
    """Fetch JSON data from a URL using an authenticated session.

    Args:
        url: The URL to fetch JSON data from.
        session: A requests.Session object with authentication headers.

    Returns:
        dict: The JSON response parsed as a dictionary.

    Raises:
        requests.HTTPError: If the HTTP request returns an error status.
    """
    resp = session.get(url, verify=False)
    resp.raise_for_status()
    return resp.json()


def fetch_url_lines(url, session):
    """Fetch and yield lines from a URL as a generator.

    Args:
        url: The URL to fetch content from.
        session: A requests.Session object with authentication headers.

    Yields:
        str: Decoded lines from the response, with decoding errors ignored.
    """
    resp = session.get(url, verify=False, stream=True)
    resp.raise_for_status()
    for line in resp.iter_lines():
        yield line.decode(errors="ignore")


def main(url: str, api_key: str = None, base_url: str = None, project: str = None):
    """Process a ReportPortal URL and return the corresponding Magna logs URL.

    Args:
        url: The ReportPortal UI URL to process.
        api_key: ReportPortal API key (optional, falls back to RP_API_KEY env var).
        base_url: ReportPortal base URL (optional, falls back to RP_BASE_URL env var).
        project: ReportPortal project name (optional, falls back to RP_PROJECT env var).

    Returns:
        str: The URL to the Magna logs directory.

    Raises:
        RPError: If configuration is missing or processing fails.
    """
    # Load configuration from parameters or environment variables
    API_KEY = api_key or os.environ.get("RP_API_KEY", "")
    RP_BASE_URL = (base_url or os.environ.get("RP_BASE_URL", "")).strip().strip('"')
    project = project or os.environ.get("RP_PROJECT", "")

    if not API_KEY or not RP_BASE_URL or not project:
        fail(
            "Missing configuration. Please set RP_API_KEY, RP_BASE_URL, and RP_PROJECT"
        )

    # Extract launch ID and test item ID from the URL
    launch_id, test_item_id = extract_ids(url)

    # Create a requests session with authentication headers
    session = requests.Session()
    session.headers.update(
        {"Accept": "application/json", "Authorization": f"Bearer {API_KEY}"}
    )

    # Build the URLs for the launch and item API
    rp_project_url = f"{RP_BASE_URL}/api/v1/{project}"
    launch_api = f"{rp_project_url}/launch?filter.eq.id={launch_id}"
    item_api = f"{rp_project_url}/item/{test_item_id}"

    # Fetch the launch and item JSON data using the RP API (in parallel)
    with ThreadPoolExecutor() as pool:
        launch_json = pool.submit(fetch_json, launch_api, session).result()
        item_json = pool.submit(fetch_json, item_api, session).result()

    try:
        description = launch_json["content"][0]["description"]
        logs_url_root = description.split("Logs URL:")[1].strip()
        cluster_name = logs_url_root.split("openshift-clusters/")[-1].split("/")[0]
        test_name = item_json["name"]

    except Exception:
        fail(
            "Could not extract Magna logs location from RP "
            "(missing description or name)."
        )

    # Find the failed_testcase subdirectories
    failed_dirs_suffixes = [
        line.split("href=")[1].split('"')[1]
        for line in fetch_url_lines(logs_url_root, session)
        if "failed_testcase" in line
    ]
    if not failed_dirs_suffixes:
        fail("No failed_testcase directories found on Magna.")

    # Find the failed_testcase directory that contains the test name
    target_failed_dir_suffix = None
    for suffix in failed_dirs_suffixes:
        url = f"{logs_url_root}/{suffix}"
        for line in fetch_url_lines(url, session):
            if test_name in line:
                target_failed_dir_suffix = suffix
                break
        if target_failed_dir_suffix:
            break

    if not target_failed_dir_suffix:
        fail("Test exists in RP but not in Magna failed_testcase logs.")

    # encode test name only, leave slashes and brackets unencoded
    # (Magna expects them)
    safe_test_name = quote(f"{test_name}_ocs_logs", safe="/[]-_.~")

    target_dir = "/".join(
        [
            logs_url_root.rstrip("/"),
            target_failed_dir_suffix.rstrip("/"),
            safe_test_name,
            cluster_name,
            "ocs_must_gather",
        ]
    )

    # find quay*/registry*
    prefix = next(
        (
            line.split("href=")[1].split('"')[1]
            for line in fetch_url_lines(target_dir, session)
            if any(p in line for p in ("quay", "registry"))
        ),
        None,
    )

    if not prefix:
        fail("Magna logs found, but no quay*/registry* directory exists.")

    final_url = "/".join([target_dir.rstrip("/"), prefix.lstrip("/")])
    return final_url
