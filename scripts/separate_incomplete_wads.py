#!/usr/bin/env python3
"""
Move WADs with placeholder URLs to a pending directory.

Only WADs with valid download URLs should be in content/wads/.
Incomplete WADs go to content/wads-pending/ until fixed.

Usage:
  uv run scripts/separate_incomplete_wads.py           # Dry run
  uv run scripts/separate_incomplete_wads.py --move    # Actually move files
"""

import argparse
import json
import shutil
from pathlib import Path

WADS_DIR = Path(__file__).parent.parent / "content" / "wads"
PENDING_DIR = Path(__file__).parent.parent / "content" / "wads-pending"
PLACEHOLDER_PATTERNS = ["example.com", "placeholder"]


def is_placeholder_url(url: str) -> bool:
    """Check if URL is a placeholder."""
    return any(p in url.lower() for p in PLACEHOLDER_PATTERNS)


def has_valid_url(wad_file: Path) -> bool:
    """Check if WAD has a valid download URL."""
    try:
        data = json.loads(wad_file.read_text())
        downloads = data.get("downloads", [])
        if not downloads:
            return False
        return not is_placeholder_url(downloads[0].get("url", ""))
    except (json.JSONDecodeError, KeyError):
        return False


def main():
    parser = argparse.ArgumentParser(description="Separate incomplete WADs")
    parser.add_argument("--move", action="store_true", help="Actually move files")
    args = parser.parse_args()

    print("WAD Separator")
    print("=" * 60)
    print(f"Mode: {'MOVE' if args.move else 'DRY RUN'}")
    print("=" * 60)

    # Ensure pending directory exists
    if args.move:
        PENDING_DIR.mkdir(parents=True, exist_ok=True)

    valid = []
    invalid = []

    for wad_file in sorted(WADS_DIR.glob("*.json")):
        if has_valid_url(wad_file):
            valid.append(wad_file)
        else:
            invalid.append(wad_file)

    print(f"\nValid WADs (staying in wads/):     {len(valid)}")
    print(f"Invalid WADs (moving to pending/): {len(invalid)}")

    if invalid:
        print(f"\nWADs to move:")
        for wad_file in invalid:
            print(f"  {wad_file.name}")
            if args.move:
                shutil.move(str(wad_file), str(PENDING_DIR / wad_file.name))

    if args.move and invalid:
        print(f"\n Moved {len(invalid)} files to {PENDING_DIR}")
    elif not args.move and invalid:
        print(f"\nRun with --move to actually move files")


if __name__ == "__main__":
    main()
