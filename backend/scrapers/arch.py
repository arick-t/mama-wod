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

        # במקור זה בלבד: סימן גרש אחרי מספר מייצג דקות → נחליף ב-"Min"
        # דוגמאות: 12′ EMOM, 7' amrap, 40’’ on
        # Prime (′) and number+apostrophe = Min (so "7' amrap" -> "7 Min amrap"); don't replace apostrophe in words
        t = t.replace("\u2032", " Min ")
        t = re.sub(r"(\d+)\s*[\u2019']\s*", r"\1 Min ", t)
        t = re.sub(r"(\d+)\s*Min\s*", r"\1 Min ", t)
        t = re.sub(r"(\d+)\s*Sec\s*", r"\1 Sec ", t)
        # Double-quote chars = Sec
        for dq in ["\u201c", "\u201d", "\u201e", '"']:
            t = t.replace(dq, " Sec ")
        t = re.sub(r"\s{2,}", " ", t).strip()

        # ננקה גם את הטקסט "A-Tier" אם נשאר בשורה (הכותרת עצמה כבר נזרקת)
        t = t.replace("„A-Tier“", "").replace("A-Tier", "").replace("„S-Tier“", "").replace("S-Tier", "").strip()
        if not t:
            continue

        cleaned.append(t)
    return cleaned


def _split_sections(lines):
    """
    Create sections only for the sub-headers that interest us:
    strength, strength A/B, metcon (S-Tier only), ENDURANCE, GYMNASTICS,
    HYROX COMPETE, HYROX POWER, POWERLIFTING, skill.
    """
    allowed = {
        "STRENGTH": "strength",
        "STRENGTH A": "strength A",
        "STRENGTH B": "strength B",
        "METCON": "metcon",
        "ENDURANCE": "ENDURANCE",
        "GYMNASTICS": "GYMNASTICS",
        "HYROX COMPETE": "HYROX COMPETE",
        "HYROX POWER": "HYROX POWER",
        "POWERLIFTING": "POWERLIFTING",
        "SKILL": "skill",
    }

    sections = []
    cur = None
    skip_until_s_tier = False  # בתוך METCON: דילוג על כל התוכן מ-A-Tier עד S-Tier (כולל הכותרות)

    for line in lines:
        plain = line.strip()
        if not plain:
            continue
        up = plain.upper()

        # בתוך METCON: התעלם מכל הבלוק A-Tier (כותרת + תוכן) עד S-Tier; את שורת S-Tier עצמה לא מציגים
        if cur and cur["title"].lower() == "metcon":
            if "A-TIER" in up:
                skip_until_s_tier = True
                continue
            if "S-TIER" in up:
                skip_until_s_tier = False
                continue  # לא מוסיפים את שורת „S-Tier“ – התוכן יבוא ישירות מתחת ל-METCON
            if skip_until_s_tier:
                continue

        is_hdr = False
        hdr_key = None

        # Exact matches for allowed headers
        for key in allowed.keys():
            if up == key:
                hdr_key = key
                is_hdr = True
                break

        if is_hdr:
            if cur and cur["lines"]:
                sections.append(cur)
            cur = {"title": allowed[hdr_key], "lines": []}
            skip_until_s_tier = False
            continue

        # All other lines go into current section (if any)
        if not cur:
            continue
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

