#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///
"""
Verify that all WAD download URLs actually work.

Checks:
- HTTP 200 response
- Content-Type is application/zip or application/octet-stream
"""

import argparse
import json
import time
from pathlib import Path

import requests

WADS_DIR = Path(__file__).parent.parent / "content" / "wads"


def verify_url(url: str) -> tuple[bool, str]:
    """Verify a download URL works."""
    if "example.com" in url:
        return False, "Placeholder URL"

    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            size = response.headers.get("Content-Length", "?")
            if "zip" in content_type or "octet-stream" in content_type:
                return True, f"OK ({size} bytes)"
            else:
                return False, f"Wrong Content-Type: {content_type}"
        else:
            return False, f"HTTP {response.status_code}"
    except requests.RequestException as e:
        return False, f"Error: {e}"


def main():
    parser = argparse.ArgumentParser(description="Verify WAD download URLs")
    parser.add_argument("--limit", type=int, help="Limit to first N files")
    parser.add_argument("--quiet", action="store_true", help="Only show failures")
    args = parser.parse_args()

    print("WAD Download Verifier")
    print("=" * 60)

    files = sorted(WADS_DIR.glob("*.json"))
    if args.limit:
        files = files[:args.limit]

    ok_count = 0
    fail_count = 0
    failures = []

    for i, filepath in enumerate(files, 1):
        data = json.loads(filepath.read_text())
        slug = data.get("slug", filepath.stem)
        downloads = data.get("downloads", [])

        if not downloads:
            if not args.quiet:
                print(f"[{i}/{len(files)}] ⚠ {slug}: No downloads")
            fail_count += 1
            failures.append((slug, "No downloads"))
            continue

        url = downloads[0].get("url", "")
        ok, message = verify_url(url)

        if ok:
            ok_count += 1
            if not args.quiet:
                print(f"[{i}/{len(files)}] ✓ {slug}")
        else:
            fail_count += 1
            failures.append((slug, message))
            print(f"[{i}/{len(files)}] ✗ {slug}: {message}")

        time.sleep(0.3)

    print()
    print("=" * 60)
    print(f"Verified OK: {ok_count}")
    print(f"Failed: {fail_count}")

    if failures:
        print(f"\nFailures ({len(failures)}):")
        for slug, reason in failures:
            print(f"  - {slug}: {reason}")


if __name__ == "__main__":
    main()
