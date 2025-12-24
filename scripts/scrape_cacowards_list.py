#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
#     "beautifulsoup4",
# ]
# ///
"""
Scrape DoomWiki for list of all Cacoward winners by year.

Output: scripts/data/cacowards_raw.json
"""

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Configuration
START_YEAR = 2004
END_YEAR = 2024
OUTPUT_FILE = Path(__file__).parent / "data" / "cacowards_raw.json"
CACHE_FILE = Path(__file__).parent / "data" / ".cacowards_cache.json"
REQUEST_DELAY = 1.0  # seconds between requests

# DoomWiki base URL
DOOMWIKI_BASE = "https://doomwiki.org"


def fetch_page(url: str, cache: dict) -> str:
    """Fetch a page, using cache if available."""
    if url in cache:
        print(f"  [cache hit] {url}")
        return cache[url]

    print(f"  [fetching] {url}")
    response = requests.get(url, headers={"User-Agent": "CacowardsCollector/1.0"})
    response.raise_for_status()
    cache[url] = response.text
    time.sleep(REQUEST_DELAY)
    return response.text


def load_cache() -> dict:
    """Load the request cache."""
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache: dict) -> None:
    """Save the request cache."""
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


def extract_winners_from_page(html: str, year: int) -> dict:
    """Extract winner information from a Cacowards page."""
    soup = BeautifulSoup(html, "html.parser")

    result = {
        "winners": [],
        "runners_up": [],
        "special": {},
    }

    # Find the main content area
    content = soup.find("div", {"id": "mw-content-text"})
    if not content:
        print(f"  Warning: Could not find content for {year}")
        return result

    # Find all headers and their following content
    current_section = None

    for element in content.find_all(["h2", "h3", "ul", "ol"]):
        # Check for section headers
        if element.name in ["h2", "h3"]:
            header_text = element.get_text().strip().lower()
            # Remove [edit] suffix
            header_text = re.sub(r"\[edit\]", "", header_text).strip()

            if "winner" in header_text and "runner" not in header_text:
                current_section = "winners"
            elif "runner" in header_text:
                current_section = "runners_up"
            elif "mention" in header_text or "honorable" in header_text:
                current_section = "mentions"
            elif "mordeth" in header_text:
                current_section = "mordeth"
            elif "creator" in header_text:
                current_section = "creator"
            elif "mapper" in header_text:
                current_section = "mapper"
            else:
                current_section = None

        # Process list items in winner sections
        elif element.name in ["ul", "ol"] and current_section in [
            "winners",
            "runners_up",
        ]:
            for li in element.find_all("li", recursive=False):
                wad_info = extract_wad_from_li(li)
                if wad_info:
                    result[current_section].append(wad_info)

    return result


def extract_wad_from_li(li) -> dict | None:
    """Extract WAD information from a list item."""
    # Look for the first link, which is typically the WAD title
    first_link = li.find("a")
    if not first_link:
        return None

    title = first_link.get_text().strip()
    if not title:
        return None

    # Skip navigation/meta links
    if title.lower() in ["edit", "doomworld", "idgames", "github", "moddb"]:
        return None

    wiki_url = first_link.get("href", "")
    if wiki_url.startswith("/"):
        wiki_url = DOOMWIKI_BASE + wiki_url

    # Try to extract author (typically after " - ")
    full_text = li.get_text()
    author = None
    if " - " in full_text:
        parts = full_text.split(" - ")
        if len(parts) >= 2:
            # Author is usually the second part
            author_part = parts[1].strip()
            # Clean up: remove anything in parentheses
            author_part = re.sub(r"\([^)]*\)", "", author_part).strip()
            # Remove trailing punctuation
            author_part = re.sub(r"[,;:]$", "", author_part).strip()
            if author_part and len(author_part) < 100:  # sanity check
                author = author_part

    return {
        "title": title,
        "wiki_url": wiki_url if "/wiki/" in wiki_url else None,
        "author": author,
    }


def scrape_year(year: int, cache: dict) -> dict:
    """Scrape a single year's Cacowards page."""
    url = f"{DOOMWIKI_BASE}/wiki/Cacowards_{year}"
    html = fetch_page(url, cache)
    return extract_winners_from_page(html, year)


def main():
    print("Cacowards List Scraper")
    print("=" * 50)

    cache = load_cache()
    years_data = {}

    for year in range(START_YEAR, END_YEAR + 1):
        print(f"\nProcessing {year}...")
        try:
            year_data = scrape_year(year, cache)
            years_data[str(year)] = year_data
            print(
                f"  Found {len(year_data['winners'])} winners, {len(year_data['runners_up'])} runners-up"
            )
        except Exception as e:
            print(f"  Error: {e}")
            years_data[str(year)] = {"winners": [], "runners_up": [], "special": {}}

    # Save cache
    save_cache(cache)

    # Build output
    output = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "years": years_data,
    }

    # Summary stats
    total_winners = sum(len(y["winners"]) for y in years_data.values())
    total_runners_up = sum(len(y["runners_up"]) for y in years_data.values())

    print("\n" + "=" * 50)
    print(f"Total winners: {total_winners}")
    print(f"Total runners-up: {total_runners_up}")

    # Save output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"\nSaved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
