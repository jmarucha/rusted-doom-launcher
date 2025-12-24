#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///
"""
Fix idGames download URLs to use proper mirror URLs.

The idGames API returns info page URLs like:
  https://www.doomworld.com/idgames/levels/doom2/megawads/av

But the actual download URL should be:
  https://youfailit.net/pub/idgames/levels/doom2/megawads/av.zip

This script fixes all WAD entries that have broken idGames URLs.
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

WADS_DIR = Path(__file__).parent.parent / "content" / "wads"

# Reliable HTTPS mirrors for idGames archive
MIRRORS = [
    "https://youfailit.net/pub/idgames/",      # New York
    "https://www.quaddicted.com/files/idgames/",  # Germany
    "https://www.gamers.org/pub/idgames/",     # Virginia
]

# Pattern to extract path from doomworld idgames URL
IDGAMES_URL_PATTERN = re.compile(r"https?://www\.doomworld\.com/idgames/(.+)")


def extract_path_from_url(url: str) -> str | None:
    """Extract the path from a doomworld idgames URL."""
    match = IDGAMES_URL_PATTERN.match(url)
    if match:
        return match.group(1)
    return None


def construct_download_url(path: str, mirror: str = MIRRORS[0]) -> str:
    """Construct direct download URL from path and mirror."""
    # Add .zip extension if not present
    if not path.endswith(".zip"):
        path = path + ".zip"
    return mirror + path


def verify_download_url(url: str) -> tuple[bool, str]:
    """Verify that a URL returns a valid ZIP file."""
    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            if "zip" in content_type or "octet-stream" in content_type:
                return True, f"OK ({response.headers.get('Content-Length', '?')} bytes)"
            else:
                return False, f"Wrong Content-Type: {content_type}"
        else:
            return False, f"HTTP {response.status_code}"
    except requests.RequestException as e:
        return False, f"Request failed: {e}"


def fix_wad_entry(filepath: Path, dry_run: bool = False, verify: bool = True) -> tuple[str, bool, str]:
    """Fix a single WAD entry's download URL.

    Returns: (slug, was_fixed, message)
    """
    data = json.loads(filepath.read_text())
    slug = data.get("slug", filepath.stem)

    downloads = data.get("downloads", [])
    if not downloads:
        return slug, False, "No downloads"

    fixed = False
    messages = []

    for i, dl in enumerate(downloads):
        url = dl.get("url", "")

        # Check if it's a broken doomworld URL
        if "doomworld.com/idgames/" not in url:
            continue

        # Extract path
        path = extract_path_from_url(url)
        if not path:
            messages.append(f"Could not extract path from: {url}")
            continue

        # Try mirrors until one works
        new_url = None
        for mirror in MIRRORS:
            candidate_url = construct_download_url(path, mirror)
            if verify:
                ok, msg = verify_download_url(candidate_url)
                if ok:
                    new_url = candidate_url
                    messages.append(f"Mirror OK: {mirror.split('/')[2]}")
                    break
                else:
                    messages.append(f"Mirror failed ({mirror.split('/')[2]}): {msg}")
            else:
                # No verification, just use first mirror
                new_url = candidate_url
                break

        if new_url:
            dl["url"] = new_url
            fixed = True
        else:
            messages.append("All mirrors failed!")

    if fixed and not dry_run:
        filepath.write_text(json.dumps(data, indent=2))

    return slug, fixed, "; ".join(messages) if messages else "OK"


def main():
    parser = argparse.ArgumentParser(description="Fix idGames download URLs")
    parser.add_argument("--dry-run", action="store_true", help="Don't write changes")
    parser.add_argument("--no-verify", action="store_true", help="Skip URL verification")
    parser.add_argument("--limit", type=int, help="Process only first N files")
    args = parser.parse_args()

    print("idGames URL Fixer")
    print("=" * 60)
    if args.dry_run:
        print("Mode: DRY RUN (no changes will be saved)")
    if args.no_verify:
        print("Mode: NO VERIFY (skipping HEAD requests)")
    print()

    files = sorted(WADS_DIR.glob("*.json"))
    if args.limit:
        files = files[:args.limit]

    # First pass: identify files that need fixing
    needs_fixing = []
    for filepath in files:
        data = json.loads(filepath.read_text())
        for dl in data.get("downloads", []):
            if "doomworld.com/idgames/" in dl.get("url", ""):
                needs_fixing.append(filepath)
                break

    print(f"Total WAD entries: {len(files)}")
    print(f"Need URL fixing: {len(needs_fixing)}")
    print("=" * 60)

    fixed_count = 0
    failed_count = 0

    for i, filepath in enumerate(needs_fixing, 1):
        slug, was_fixed, message = fix_wad_entry(
            filepath,
            dry_run=args.dry_run,
            verify=not args.no_verify
        )

        status = "✓" if was_fixed else "✗"
        print(f"[{i}/{len(needs_fixing)}] {status} {slug}: {message}")

        if was_fixed:
            fixed_count += 1
        else:
            failed_count += 1

        # Rate limit to avoid hammering mirrors
        if not args.no_verify and i < len(needs_fixing):
            time.sleep(0.5)

    print()
    print("=" * 60)
    print(f"Fixed: {fixed_count}")
    print(f"Failed: {failed_count}")

    if args.dry_run:
        print("\n(Dry run - no files were modified)")


if __name__ == "__main__":
    main()
