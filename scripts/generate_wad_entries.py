#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Convert WAD metadata to schema-compliant JSON files.

Input: scripts/data/wads_metadata.json
Output: content/wads/{slug}.json

Usage:
  uv run scripts/generate_wad_entries.py                  # Generate all
  uv run scripts/generate_wad_entries.py --limit 5        # First N only
  uv run scripts/generate_wad_entries.py --dry-run        # Preview without writing
  uv run scripts/generate_wad_entries.py --overwrite      # Overwrite existing files
"""

import argparse
import json
import re
import sys
from pathlib import Path

# Paths
INPUT_FILE = Path(__file__).parent / "data" / "wads_metadata.json"
OUTPUT_DIR = Path(__file__).parent.parent / "content" / "wads"

# Port mapping (DoomWiki -> schema values)
# Hierarchy: vanilla < limit_removing < boom < mbf21 < gzdoom
PORT_MAP = {
    "vanilla": "vanilla",
    "limit-removing": "limit_removing",
    "limit removing": "limit_removing",
    "boom-compatible": "boom",
    "boom": "boom",
    "mbf-compatible": "boom",
    "mbf": "boom",
    "mbf21-compatible": "mbf21",
    "mbf21": "mbf21",
    "gzdoom": "gzdoom",
    "zdoom": "gzdoom",
    "lzdoom": "gzdoom",
}

# IWAD mapping - ordered by specificity (longer matches first)
IWAD_PATTERNS = [
    ("doom ii", "doom2"),
    ("doom 2", "doom2"),
    ("the ultimate doom", "doom"),
    ("ultimate doom", "doom"),
    ("tnt: evilution", "tnt"),
    ("tnt evilution", "tnt"),
    ("the plutonia experiment", "plutonia"),
    ("plutonia", "plutonia"),
    ("final doom", "doom2"),  # Ambiguous, default to doom2
    ("freedoom phase 1", "freedoom1"),
    ("freedoom phase 2", "freedoom2"),
    ("freedoom", "freedoom2"),
    ("heretic", "heretic"),
    ("hexen", "hexen"),
    ("doom", "doom"),  # Must be last (most generic)
]

# WAD type mapping
TYPE_MAP = {
    "megawad": "megawad",
    "single level": "single-level",
    "single-level": "single-level",
    "episode": "episode",
    "partial conversion": "total-conversion",
    "total conversion": "total-conversion",
    "gameplay mod": "gameplay-mod",
    "weapon mod": "gameplay-mod",
    "standalone": "total-conversion",
}


def slugify(title: str) -> str:
    """Convert title to URL-friendly slug."""
    slug = title.lower()
    # Replace special chars with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    # Remove leading/trailing hyphens
    slug = slug.strip("-")
    # Collapse multiple hyphens
    slug = re.sub(r"-+", "-", slug)
    return slug


def map_port(port_str: str | None) -> str:
    """Map port string to schema value."""
    if not port_str:
        return "boom"  # Safe default

    port_lower = port_str.lower()

    # Check each key
    for key, value in PORT_MAP.items():
        if key in port_lower:
            return value

    # Default to boom (plays most things)
    return "boom"


def map_iwad(iwad_str: str | None) -> str:
    """Map IWAD string to schema value."""
    if not iwad_str:
        return "doom2"  # Most common

    iwad_lower = iwad_str.lower()

    for pattern, value in IWAD_PATTERNS:
        if pattern in iwad_lower:
            return value

    return "doom2"


def map_type(type_str: str | None, title: str) -> str:
    """Map WAD type to schema value."""
    if type_str:
        type_lower = type_str.lower()
        for key, value in TYPE_MAP.items():
            if key in type_lower:
                return value

    # Heuristics based on title
    title_lower = title.lower()
    if "megawad" in title_lower:
        return "megawad"

    return "megawad"  # Default for Cacoward winners


def generate_entry(wad: dict) -> dict:
    """Generate a schema-compliant entry from metadata."""
    title = wad.get("title", "")
    slug = slugify(title)

    # Authors
    authors = wad.get("authors", [])
    if not authors:
        authors = ["Unknown"]
    author_list = [{"name": a.strip()} for a in authors if a.strip()]
    if not author_list:
        author_list = [{"name": "Unknown"}]

    # Year - prefer the WAD's actual year, fall back to Cacoward year
    year = wad.get("year") or wad.get("cacoward_year") or 2000

    # Description from idGames or generate placeholder
    description = ""
    if wad.get("idgames") and wad["idgames"].get("description"):
        # Clean up description (remove HTML, limit length)
        desc = wad["idgames"]["description"]
        desc = re.sub(r"<[^>]+>", " ", desc)  # Remove HTML
        desc = re.sub(r"\s+", " ", desc).strip()  # Normalize whitespace
        if len(desc) > 500:
            desc = desc[:497] + "..."
        description = desc
    else:
        description = f"{title} - Cacoward winner {wad.get('cacoward_year', '')}"

    # Downloads
    downloads = []
    if wad.get("idgames") and wad["idgames"].get("url"):
        idg = wad["idgames"]
        downloads.append({
            "type": "idgames",
            "url": idg["url"],
            "filename": idg.get("filename", f"{slug}.zip"),
        })

    # If no downloads, use a placeholder (will need manual fix)
    if not downloads:
        downloads.append({
            "type": "direct",
            "url": f"https://example.com/{slug}.zip",  # Placeholder
            "filename": f"{slug}.zip",
        })

    # Awards
    awards = []
    if wad.get("is_winner"):
        awards.append({"type": "cacoward", "year": wad.get("cacoward_year", year)})
    else:
        awards.append({"type": "runner-up", "year": wad.get("cacoward_year", year)})

    return {
        "slug": slug,
        "title": title,
        "authors": author_list,
        "year": year,
        "description": description,
        "iwad": map_iwad(wad.get("iwad")),
        "type": map_type(wad.get("wad_type"), title),
        "sourcePort": map_port(wad.get("port")),
        "requires": [],
        "downloads": downloads,
        "thumbnail": "",
        "screenshots": [],
        "youtubeVideos": [],
        "awards": awards,
        "tags": [],
        "difficulty": "unknown",
        "notes": "",
        "_schemaVersion": 1,
        "_source": "cacowards-scraper",
    }


def main():
    parser = argparse.ArgumentParser(description="Generate WAD entry JSON files")
    parser.add_argument("--limit", type=int, help="Limit to first N WADs")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing files")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()

    print("WAD Entry Generator")
    print("=" * 50)

    if not INPUT_FILE.exists():
        print(f"Error: {INPUT_FILE} not found. Run scrape_wad_metadata.py first.")
        return

    metadata = json.loads(INPUT_FILE.read_text())
    wads = metadata.get("wads", [])

    if args.limit:
        wads = wads[:args.limit]
        print(f"Mode: Limited to {args.limit} WADs")

    if args.dry_run:
        print("Mode: Dry run (no files will be written)")

    print(f"\nProcessing {len(wads)} WADs...")
    print("=" * 50)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    created = 0
    skipped = 0
    errors = []

    for i, wad in enumerate(wads, 1):
        title = wad.get("title", "Unknown")
        try:
            entry = generate_entry(wad)
            slug = entry["slug"]
            output_path = OUTPUT_DIR / f"{slug}.json"

            status = ""
            if output_path.exists() and not args.overwrite:
                status = "SKIP (exists)"
                skipped += 1
            elif args.dry_run:
                status = "OK (dry-run)"
                created += 1
            else:
                output_path.write_text(json.dumps(entry, indent=2))
                status = "OK"
                created += 1

            # Show progress
            print(f"[{i}/{len(wads)}] {slug}: {status}")

            # Show some details for first few
            if i <= 3:
                print(f"       IWAD: {entry['iwad']}, Port: {entry['sourcePort']}, Downloads: {len(entry['downloads'])}")

        except Exception as e:
            print(f"[{i}/{len(wads)}] {title}: ERROR - {e}")
            errors.append((title, str(e)))

    print("\n" + "=" * 50)
    print(f"Created: {created}")
    print(f"Skipped: {skipped}")
    print(f"Errors: {len(errors)}")

    if errors:
        print("\nErrors:")
        for title, error in errors:
            print(f"  - {title}: {error}")

    if not args.dry_run:
        print(f"\nOutput directory: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
