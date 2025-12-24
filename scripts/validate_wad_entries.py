#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Validate all WAD JSON files against the schema.

Input: content/wads/*.json
Output: Validation report

Usage:
  uv run scripts/validate_wad_entries.py          # Validate all
  uv run scripts/validate_wad_entries.py --fix    # Fix common issues
"""

import argparse
import json
import re
from pathlib import Path

WADS_DIR = Path(__file__).parent.parent / "content" / "wads"

# Valid enum values (must match src/lib/schema.ts)
VALID_IWADS = {"doom", "doom2", "plutonia", "tnt", "heretic", "hexen", "freedoom1", "freedoom2"}
VALID_PORTS = {"vanilla", "limit_removing", "boom", "mbf21", "gzdoom"}
VALID_TYPES = {"single-level", "episode", "megawad", "gameplay-mod", "total-conversion", "resource-pack"}
VALID_DOWNLOAD_TYPES = {"idgames", "moddb", "github", "direct"}
VALID_AWARD_TYPES = {"cacoward", "runner-up", "mention"}
VALID_DIFFICULTIES = {"easy", "medium", "hard", "slaughter", "unknown"}
VALID_SOURCES = {"manual", "idgames-scraper", "cacowards-scraper"}


def validate_slug(slug: str) -> list[str]:
    """Validate slug format."""
    errors = []
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", slug):
        errors.append(f"Invalid slug format: {slug}")
    return errors


def validate_entry(data: dict, filename: str) -> list[str]:
    """Validate a single WAD entry."""
    errors = []

    # Required fields
    required = ["slug", "title", "authors", "year", "description", "iwad", "type",
                "sourcePort", "requires", "downloads", "thumbnail", "screenshots",
                "youtubeVideos", "awards", "tags", "difficulty", "notes",
                "_schemaVersion", "_source"]

    for field in required:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    # Slug
    if "slug" in data:
        errors.extend(validate_slug(data["slug"]))
        # Check filename matches slug
        expected_filename = f"{data['slug']}.json"
        if filename != expected_filename:
            errors.append(f"Filename '{filename}' doesn't match slug '{data['slug']}'")

    # Title
    if "title" in data:
        if not data["title"] or len(data["title"]) > 200:
            errors.append(f"Invalid title length: {len(data.get('title', ''))}")

    # Authors
    if "authors" in data:
        if not isinstance(data["authors"], list) or len(data["authors"]) < 1:
            errors.append("Authors must be a non-empty list")
        else:
            for i, author in enumerate(data["authors"]):
                if not isinstance(author, dict) or "name" not in author:
                    errors.append(f"Author {i} missing 'name' field")
                elif not author["name"]:
                    errors.append(f"Author {i} has empty name")

    # Year
    if "year" in data:
        year = data["year"]
        if not isinstance(year, int) or year < 1993 or year > 2026:
            errors.append(f"Invalid year: {year}")

    # IWAD
    if "iwad" in data and data["iwad"] not in VALID_IWADS:
        errors.append(f"Invalid IWAD: {data['iwad']} (valid: {VALID_IWADS})")

    # Type
    if "type" in data and data["type"] not in VALID_TYPES:
        errors.append(f"Invalid type: {data['type']} (valid: {VALID_TYPES})")

    # Source Port
    if "sourcePort" in data and data["sourcePort"] not in VALID_PORTS:
        errors.append(f"Invalid sourcePort: {data['sourcePort']} (valid: {VALID_PORTS})")

    # Downloads
    if "downloads" in data:
        if not isinstance(data["downloads"], list) or len(data["downloads"]) < 1:
            errors.append("Downloads must be a non-empty list")
        else:
            for i, dl in enumerate(data["downloads"]):
                if not isinstance(dl, dict):
                    errors.append(f"Download {i} is not an object")
                    continue
                if dl.get("type") not in VALID_DOWNLOAD_TYPES:
                    errors.append(f"Download {i} has invalid type: {dl.get('type')}")
                if not dl.get("url"):
                    errors.append(f"Download {i} missing URL")
                elif "example.com" in dl.get("url", ""):
                    errors.append(f"Download {i} has placeholder URL")
                if not dl.get("filename"):
                    errors.append(f"Download {i} missing filename")

    # Awards
    if "awards" in data:
        for i, award in enumerate(data.get("awards", [])):
            if not isinstance(award, dict):
                errors.append(f"Award {i} is not an object")
                continue
            if award.get("type") not in VALID_AWARD_TYPES:
                errors.append(f"Award {i} has invalid type: {award.get('type')}")
            year = award.get("year")
            if not isinstance(year, int) or year < 1994 or year > 2026:
                errors.append(f"Award {i} has invalid year: {year}")

    # Difficulty
    if "difficulty" in data and data["difficulty"] not in VALID_DIFFICULTIES:
        errors.append(f"Invalid difficulty: {data['difficulty']}")

    # Source
    if "_source" in data and data["_source"] not in VALID_SOURCES:
        errors.append(f"Invalid _source: {data['_source']}")

    # Schema version
    if "_schemaVersion" in data and data["_schemaVersion"] != 1:
        errors.append(f"Invalid _schemaVersion: {data['_schemaVersion']}")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Validate WAD entry JSON files")
    parser.add_argument("--fix", action="store_true", help="Attempt to fix common issues")
    args = parser.parse_args()

    print("WAD Entry Validator")
    print("=" * 50)

    if not WADS_DIR.exists():
        print(f"Error: {WADS_DIR} not found")
        return

    files = sorted(WADS_DIR.glob("*.json"))
    print(f"Found {len(files)} JSON files\n")

    valid = 0
    invalid = 0
    all_errors = []

    for filepath in files:
        try:
            data = json.loads(filepath.read_text())
            errors = validate_entry(data, filepath.name)

            if errors:
                invalid += 1
                all_errors.append((filepath.name, errors))
                print(f"✗ {filepath.name}")
                for error in errors[:3]:  # Show first 3 errors
                    print(f"    - {error}")
                if len(errors) > 3:
                    print(f"    ... and {len(errors) - 3} more")
            else:
                valid += 1
                # Only print valid files in verbose mode
                # print(f"✓ {filepath.name}")

        except json.JSONDecodeError as e:
            invalid += 1
            all_errors.append((filepath.name, [f"JSON parse error: {e}"]))
            print(f"✗ {filepath.name}: JSON parse error")

    print("\n" + "=" * 50)
    print(f"Valid:   {valid}")
    print(f"Invalid: {invalid}")
    print(f"Total:   {len(files)}")

    if all_errors:
        print(f"\n{len(all_errors)} files have errors")

    return 0 if invalid == 0 else 1


if __name__ == "__main__":
    exit(main())
