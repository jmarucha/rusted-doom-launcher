#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
#     "beautifulsoup4",
# ]
# ///
"""
For each Cacoward-winning WAD, scrape DoomWiki infobox + idGames API.

Input: scripts/data/cacowards_raw.json
Output: scripts/data/wads_metadata.json

Usage:
  uv run scripts/scrape_wad_metadata.py                    # All WADs
  uv run scripts/scrape_wad_metadata.py --winners-only     # Only winners (no runners-up)
  uv run scripts/scrape_wad_metadata.py --year 2024        # Single year
  uv run scripts/scrape_wad_metadata.py --limit 10         # First N WADs only
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

# Configuration
INPUT_FILE = Path(__file__).parent / "data" / "cacowards_raw.json"
OUTPUT_FILE = Path(__file__).parent / "data" / "wads_metadata.json"
CACHE_FILE = Path(__file__).parent / "data" / ".metadata_cache.json"
REQUEST_DELAY = 1.0

DOOMWIKI_BASE = "https://doomwiki.org"
IDGAMES_API = "https://www.doomworld.com/idgames/api/api.php"


def load_cache() -> dict:
    """Load the request cache."""
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache: dict) -> None:
    """Save the request cache."""
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


def fetch_url(url: str, cache: dict) -> str | None:
    """Fetch a URL, using cache if available."""
    if url in cache:
        return cache[url]

    try:
        response = requests.get(url, headers={"User-Agent": "CacowardsCollector/1.0"})
        response.raise_for_status()
        cache[url] = response.text
        time.sleep(REQUEST_DELAY)
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"    Error fetching {url}: {e}")
        return None


def fetch_json(url: str, cache: dict) -> dict | None:
    """Fetch JSON from a URL."""
    text = fetch_url(url, cache)
    if text:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None
    return None


def parse_infobox(html: str) -> dict:
    """Parse DoomWiki infobox for WAD metadata."""
    soup = BeautifulSoup(html, "html.parser")
    result = {
        "iwad": None,
        "port": None,
        "authors": [],
        "year": None,
        "wad_type": None,
    }

    # Find the infobox table (class="infobox" or similar)
    infobox = soup.find("table", class_="infobox")
    if not infobox:
        # Try alternative selectors
        infobox = soup.find("table", class_="wikitable")

    if not infobox:
        # Fall back to text parsing
        return parse_infobox_from_text(soup)

    for row in infobox.find_all("tr"):
        cells = row.find_all(["th", "td"])
        if len(cells) >= 2:
            label = cells[0].get_text().strip().lower()
            value = cells[1].get_text().strip()

            if "iwad" in label:
                result["iwad"] = value
            elif "port" in label or "engine" in label:
                result["port"] = value
            elif "author" in label:
                result["authors"] = [a.strip() for a in re.split(r"[,&]|et al\.?", value) if a.strip()]
            elif "year" in label:
                # Extract 4-digit year
                match = re.search(r"\b(19\d{2}|20\d{2})\b", value)
                if match:
                    result["year"] = int(match.group(1))
            elif "type" in label:
                result["wad_type"] = value

    return result


def parse_infobox_from_text(soup) -> dict:
    """Fallback: parse infobox-like data from page text."""
    result = {
        "iwad": None,
        "port": None,
        "authors": [],
        "year": None,
        "wad_type": None,
    }

    text = soup.get_text()

    # IWAD patterns
    iwad_patterns = [
        (r"IWAD[:\s]+([^\n]+)", 1),
        (r"for\s+(Doom\s*(?:II|2)?|Heretic|Hexen|TNT|Plutonia|FreeDoom)", 1),
    ]
    for pattern, group in iwad_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["iwad"] = match.group(group).strip()
            break

    # Port patterns
    port_patterns = [
        (r"(?:Port|Engine|Requires)[:\s]+([^\n]+)", 1),
        (r"(Boom|GZDoom|ZDoom|Vanilla|MBF21|MBF|Limit.removing)[- ]compatible", 1),
    ]
    for pattern, group in port_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["port"] = match.group(group).strip()
            break

    return result


def search_idgames(title: str, cache: dict) -> dict | None:
    """Search idGames for a WAD by title."""
    # Clean title for search
    search_term = re.sub(r"[^\w\s]", "", title).strip()
    url = f"{IDGAMES_API}?action=search&query={quote(search_term)}&type=title&out=json"

    data = fetch_json(url, cache)
    if not data or "content" not in data:
        return None

    content = data["content"]
    if not content or "file" not in content:
        return None

    files = content["file"]
    # Handle both single file and list of files
    if isinstance(files, dict):
        files = [files]

    # Find best match (exact title match preferred)
    title_lower = title.lower()
    for f in files:
        if f.get("title", "").lower() == title_lower:
            return f

    # Fall back to first result
    return files[0] if files else None


def process_wad(wad_entry: dict, year: int, is_winner: bool, cache: dict) -> dict | None:
    """Process a single WAD entry to get full metadata."""
    title = wad_entry.get("title", "")
    wiki_url = wad_entry.get("wiki_url")
    author = wad_entry.get("author")

    print(f"  Processing: {title}")

    result = {
        "title": title,
        "cacoward_year": year,
        "is_winner": is_winner,
        "authors": [author] if author else [],
        "wiki_url": wiki_url,
        "iwad": None,
        "port": None,
        "year": None,
        "wad_type": None,
        "idgames": None,
    }

    # Fetch DoomWiki page if available
    if wiki_url:
        html = fetch_url(wiki_url, cache)
        if html:
            infobox = parse_infobox(html)
            result.update({
                "iwad": infobox.get("iwad"),
                "port": infobox.get("port"),
                "year": infobox.get("year"),
                "wad_type": infobox.get("wad_type"),
            })
            # Merge authors
            if infobox.get("authors"):
                result["authors"] = infobox["authors"]

    # Search idGames
    idgames_result = search_idgames(title, cache)
    if idgames_result:
        result["idgames"] = {
            "id": idgames_result.get("id"),
            "filename": idgames_result.get("filename"),
            "url": idgames_result.get("url"),
            "description": idgames_result.get("description"),
            "author": idgames_result.get("author"),
            "date": idgames_result.get("date"),
            "size": idgames_result.get("size"),
        }
        # Use idGames author if we don't have one
        if not result["authors"] and idgames_result.get("author"):
            result["authors"] = [idgames_result["author"]]

    return result


def main():
    parser = argparse.ArgumentParser(description="Scrape WAD metadata from DoomWiki and idGames")
    parser.add_argument("--winners-only", action="store_true", help="Only process Cacoward winners (skip runners-up)")
    parser.add_argument("--year", type=int, help="Only process a specific year")
    parser.add_argument("--limit", type=int, help="Limit to first N WADs")
    args = parser.parse_args()

    print("WAD Metadata Scraper")
    print("=" * 50)
    if args.winners_only:
        print("Mode: Winners only")
    if args.year:
        print(f"Mode: Year {args.year} only")
    if args.limit:
        print(f"Mode: Limited to {args.limit} WADs")

    # Load input
    if not INPUT_FILE.exists():
        print(f"Error: {INPUT_FILE} not found. Run scrape_cacowards_list.py first.")
        return

    raw_data = json.loads(INPUT_FILE.read_text())
    cache = load_cache()

    # Collect all WADs to process
    wads_to_process = []
    processed_titles = set()

    years_to_process = [args.year] if args.year else sorted(raw_data["years"].keys(), key=int)

    for year_str in years_to_process:
        year = int(year_str)
        year_data = raw_data["years"].get(str(year), {})

        # Winners
        for wad in year_data.get("winners", []):
            title = wad.get("title", "")
            if title and title not in processed_titles:
                processed_titles.add(title)
                wads_to_process.append((wad, year, True))

        # Runners-up (skip if --winners-only)
        if not args.winners_only:
            for wad in year_data.get("runners_up", []):
                title = wad.get("title", "")
                if title and title not in processed_titles:
                    processed_titles.add(title)
                    wads_to_process.append((wad, year, False))

    # Apply limit
    if args.limit:
        wads_to_process = wads_to_process[:args.limit]

    total = len(wads_to_process)
    print(f"\nWADs to process: {total}")
    print("=" * 50)

    all_wads = []
    for i, (wad, year, is_winner) in enumerate(wads_to_process, 1):
        title = wad.get("title", "")
        print(f"\n[{i}/{total}] {title} ({year}, {'winner' if is_winner else 'runner-up'})")
        sys.stdout.flush()

        metadata = process_wad(wad, year, is_winner=is_winner, cache=cache)
        if metadata:
            all_wads.append(metadata)
            # Log key findings
            if metadata.get("idgames"):
                print(f"    ✓ idGames: {metadata['idgames'].get('filename')}")
            else:
                print(f"    ✗ No idGames match")
            if metadata.get("iwad"):
                print(f"    ✓ IWAD: {metadata['iwad']}")
            if metadata.get("port"):
                print(f"    ✓ Port: {metadata['port']}")

        # Save cache every 10 WADs
        if i % 10 == 0:
            save_cache(cache)
            print(f"\n--- Cache saved ({i}/{total}) ---")

    # Final output
    output = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "total_wads": len(all_wads),
        "wads": all_wads,
    }

    OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    save_cache(cache)

    # Summary
    winners = sum(1 for w in all_wads if w["is_winner"])
    with_idgames = sum(1 for w in all_wads if w["idgames"])
    with_iwad = sum(1 for w in all_wads if w["iwad"])

    print("\n" + "=" * 50)
    print(f"Total WADs processed: {len(all_wads)}")
    print(f"  Winners: {winners}")
    print(f"  Runners-up: {len(all_wads) - winners}")
    print(f"  With idGames link: {with_idgames}")
    print(f"  With IWAD info: {with_iwad}")
    print(f"\nSaved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
