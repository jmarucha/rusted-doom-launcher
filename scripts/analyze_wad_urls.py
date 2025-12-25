#!/usr/bin/env python3
"""Analyze WAD files to find those with missing/placeholder URLs."""

import json
from pathlib import Path
from collections import Counter

WADS_DIR = Path(__file__).parent.parent / "content" / "wads"
PLACEHOLDER_PATTERNS = ["example.com", "placeholder"]


def is_placeholder_url(url: str) -> bool:
    """Check if URL is a placeholder."""
    return any(p in url.lower() for p in PLACEHOLDER_PATTERNS)


def analyze_wads():
    """Analyze all WAD files and report URL status."""
    results = {
        "valid": [],
        "placeholder": [],
        "missing": [],
    }

    sources = Counter()
    placeholder_sources = Counter()

    for wad_file in sorted(WADS_DIR.glob("*.json")):
        try:
            data = json.loads(wad_file.read_text())
        except json.JSONDecodeError as e:
            print(f"ERROR parsing {wad_file.name}: {e}")
            continue

        slug = data.get("slug", wad_file.stem)
        title = data.get("title", slug)
        source = data.get("_source", "unknown")
        downloads = data.get("downloads", [])

        sources[source] += 1

        if not downloads:
            results["missing"].append({
                "slug": slug,
                "title": title,
                "source": source,
                "file": wad_file.name,
            })
        elif is_placeholder_url(downloads[0].get("url", "")):
            results["placeholder"].append({
                "slug": slug,
                "title": title,
                "source": source,
                "url": downloads[0].get("url", ""),
                "file": wad_file.name,
            })
            placeholder_sources[source] += 1
        else:
            results["valid"].append({
                "slug": slug,
                "title": title,
                "source": source,
            })

    # Print report
    total = len(results["valid"]) + len(results["placeholder"]) + len(results["missing"])

    print("=" * 60)
    print("WAD URL ANALYSIS")
    print("=" * 60)
    print(f"\nTotal WADs: {total}")
    print(f"  Valid URLs:      {len(results['valid']):3d}")
    print(f"  Placeholder:     {len(results['placeholder']):3d}")
    print(f"  Missing:         {len(results['missing']):3d}")

    print(f"\nBy source:")
    for source, count in sources.most_common():
        placeholder_count = placeholder_sources.get(source, 0)
        print(f"  {source:20s}: {count:3d} total, {placeholder_count:3d} placeholder")

    if results["placeholder"]:
        print(f"\n{'=' * 60}")
        print("WADS WITH PLACEHOLDER URLs:")
        print("=" * 60)
        for wad in results["placeholder"]:
            print(f"  {wad['slug']:40s} [{wad['source']}]")

    if results["missing"]:
        print(f"\n{'=' * 60}")
        print("WADS WITH MISSING URLs:")
        print("=" * 60)
        for wad in results["missing"]:
            print(f"  {wad['slug']:40s} [{wad['source']}]")

    return results


if __name__ == "__main__":
    analyze_wads()
