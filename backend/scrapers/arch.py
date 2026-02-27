"""
CrossFit Arch (Vienna) - WOD Scraper
Source: https://crossfitarch.com/workout-of-the-day/

This source publishes the *current week* (KW) on a single page.
We treat it as TODAY-ONLY (no archive): for a given date, we:
- Map weekday to the corresponding German section heading (MONTAG, DIENSTAG, ...)
- Extract the block between that heading and the next heading
- Split into sub-sections like WOD, strength, metcon, ENDURANCE, HYROX, etc.
"""

import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

DAY_MAP = {
    0: ("MONTAG", "Monday"),
    1: ("DIENSTAG", "Tuesday"),
    2: ("MITTWOCH", "Wednesday"),
    3: ("DONNERSTAG", "Thursday"),
    4: ("FREITAG", "Friday"),
    5: ("SAMSTAG", "Saturday"),
    6: ("SONNTAG", "Sunday"),
}


def _clean_lines(lines):
    cleaned = []
    for line in lines:
        t = line.strip()
        if not t or len(t) < 2:
            continue
        # Drop contact/footer/navigation noise
        low = t.lower()
        if any(
            k in low
            for k in [
                "heiligenstädterstraße",
                "1190 wien",
                "facebook",
                "instagram",
                "datenschutz",
                "impressum",
                "hyrox",
                "stund",
                "preise",
                "kontakt",
                "gratis probetraining",
            ]
        ):
            continue
        cleaned.append(t)
    return cleaned


def _split_sections(lines):
    """
    Create sections based on strong keywords like:
    WOD, strength, skill, metcon, ENDURANCE, HYROX ENGINE, HYROX COMPETE, etc.
    """
    section_titles = [
        "WOD",
        "strength",
        "strength A",
        "strength B",
        "skill",
        "metcon",
        "ENDURANCE",
        "GYMNASTICS",
        "HYROX ENGINE",
        "HYROX COMPETE",
        "HYROX POWER",
        "HYROX",
        "POWERLIFTING",
        "TEAM WOD",
        "Saturday Madness",
    ]

    sections = []
    cur = None

    for line in lines:
        plain = line.strip()
        low = plain.lower()

        is_hdr = False
        for title in section_titles:
            if plain == title or low == title.lower():
                hdr = title.upper()
                is_hdr = True
                break
        if not is_hdr:
            # Patterns like "WODstrength" or "WOD strength" → treat as WOD
            if low.startswith("wod"):
                hdr = "WOD"
                is_hdr = True

        if is_hdr:
            if cur and cur["lines"]:
                sections.append(cur)
            cur = {"title": hdr, "lines": []}
        else:
            if not cur:
                cur = {"title": "WORKOUT", "lines": []}
            cur["lines"].append(plain)

    if cur and cur["lines"]:
        sections.append(cur)

    return sections or [{"title": "WORKOUT", "lines": lines}]


def fetch_workout(date):
    """
    Fetch workout for a specific date from CrossFit Arch.
    Treat as TODAY-ONLY source (no archive).
    """
    date_str = date.strftime("%Y-%m-%d")
    url = "https://crossfitarch.com/workout-of-the-day/"

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, "html.parser")

        body = soup.find("body") or soup

        # All day blocks appear in plain text with headings like "MONTAG", "DIENSTAG", etc.
        # We'll work on the flattened text, then slice between the current day's heading
        # and the next day's heading.
        today_idx = date.weekday()
        de_name, en_name = DAY_MAP.get(today_idx, ("", ""))
        if not de_name:
            print("    → Unknown weekday mapping")
            return None
        full_text = body.get_text("\n", strip=True)
        raw_lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        # Find start index for this day
        start_idx = None
        for i, l in enumerate(raw_lines):
            if l.upper().startswith(de_name):
                start_idx = i + 1
                break

        if start_idx is None:
            print(f"    → Day header '{de_name}' not found in text")
            return None

        # Collect until next day heading or end
        day_names = [name for name, _ in DAY_MAP.values()]
        lines = []
        for l in raw_lines[start_idx:]:
            up = l.upper()
            if any(up.startswith(name) for name in day_names):
                break
            lines.append(l)

        lines = _clean_lines(lines)
        if not lines:
            print("    → No workout lines after cleanup")
            return None

        sections = _split_sections(lines)
        total = sum(len(s["lines"]) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            "date": date_str,
            "source": "arch",
            "source_name": "CrossFit Arch",
            "url": url,
            "sections": sections,
        }

    except requests.Timeout:
        print("    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


if __name__ == "__main__":
    # Simple manual test
    today = datetime.now()
    res = fetch_workout(today)
    if res:
        print("✅ Test OK")
        for s in res["sections"]:
            print("==", s["title"], "==")
            for ln in s["lines"][:5]:
                print(" ", ln)
    else:
        print("❌ No workout parsed")

