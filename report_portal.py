#!/usr/bin/env python3

import logging
import os
import sys
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
    if "launches/" not in ui_url:
        fail("Not a ReportPortal test log URL (missing 'launches/').")

    try:
        parts = ui_url.split("launches/")[-1].split("/")
        launch_id = parts[1]
        test_item_id = parts[3]
        return launch_id, test_item_id
    except Exception:
        fail(
            "Invalid ReportPortal URL format. Expected .../launches/<launch>/<item>/log"
        )


def fetch_json(url, session):
    resp = session.get(url, verify=False)
    resp.raise_for_status()
    return resp.json()


def magna_list(url, session):
    resp = session.get(url, verify=False, stream=True)
    resp.raise_for_status()
    for line in resp.iter_lines():
        yield line.decode(errors="ignore")


def main():
    if len(sys.argv) < 2:
        fail("Missing <url> argument.")

    ui_url = sys.argv[1]
    launch_id, test_item_id = extract_ids(ui_url)

    try:
        API_KEY = os.environ["RP_API_KEY"]
        RP_BASE_URL = os.environ["RP_BASE_URL"].strip().strip('"')
    except KeyError as e:
        fail(f"Missing env var: {e.args[0]} (export RP_API_KEY / RP_BASE_URL)")

    session = requests.Session()
    session.headers.update(
        {"Accept": "application/json", "Authorization": f"Bearer {API_KEY}"}
    )

    project = "ocs"
    launch_api = f"{RP_BASE_URL}/api/v1/{project}/launch?filter.eq.id={launch_id}"
    item_api = f"{RP_BASE_URL}/api/v1/{project}/item/{test_item_id}"

    with ThreadPoolExecutor() as pool:
        launch_json = pool.submit(fetch_json, launch_api, session).result()
        item_json = pool.submit(fetch_json, item_api, session).result()

    try:
        description = launch_json["content"][0]["description"]
        logs_root = description.split("Logs URL:")[1].strip()
        cluster = logs_root.split("openshift-clusters/")[-1].split("/")[0]
        test_name = item_json["name"]
    except Exception:
        fail(
            "Could not extract Magna logs location from RP (missing description or name)."
        )

    failed_dirs = [
        line.split("href=")[1].split('"')[1]
        for line in magna_list(logs_root, session)
        if "failed_testcase" in line
    ]

    if not failed_dirs:
        fail("No failed_testcase directories found on Magna.")

    target = next(
        (
            suffix
            for suffix in failed_dirs
            if any(
                test_name in line
                for line in magna_list(f"{logs_root}/{suffix}", session)
            )
        ),
        None,
    )

    if not target:
        fail("Test exists in RP but not in Magna failed_testcase logs.")

    # build path safely without accidental double slashes
    ocs_root = "/".join(
        [logs_root.rstrip("/"), target.rstrip("/"), f"{test_name}_ocs_logs"]
    )

    # encode test name only, leave slashes and brackets unencoded (Magna expects them)
    safe_test_name = quote(f"{test_name}_ocs_logs", safe="/[]-_.~")

    target_dir = "/".join(
        [
            logs_root.rstrip("/"),
            target.rstrip("/"),
            safe_test_name,
            cluster,
            "ocs_must_gather",
        ]
    )

    # find quay*/registry*
    prefix = next(
        (
            line.split("href=")[1].split('"')[1]
            for line in magna_list(target_dir, session)
            if any(p in line for p in ("quay", "registry"))
        ),
        None,
    )

    if not prefix:
        fail("Magna logs found, but no quay*/registry* directory exists.")

    final_url = "/".join([target_dir.rstrip("/"), prefix.lstrip("/")])
    print(final_url, end="")


if __name__ == "__main__":
    try:
        main()
    except RPError as e:
        print(str(e))  # clean output → Chrome alert
        sys.exit(1)  # no stack trace
