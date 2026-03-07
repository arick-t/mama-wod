"""
CrossFit Ton Bridge Scraper - FIXED
NEW: Uses centralized WOD page: https://crossfittonbridge.co.uk/wod/
All workouts in one long list, easier to scrape.

Logic:
- Workout title = Date in bold (e.g., "Saturday 14th February")
- Workout content = Text below title
- Separator = "By Liv Phillips|February 13th, 2026" (or any name + next date)
  → STOP at this line, it marks the start of next workout
"""
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
}

# Only these start a new top-level section (כותרת משנה). Do NOT use generic hints
# like 'power' or 'barbell' so lines like "6 Power Snatch @ 60/42.5kg" stay content.
FIRST_LEVEL_HEADERS = [
    'strength', 'met con', 'metcon', 'wod', 'warm', 'warm up', 'conditioning',
    'skill', 'gymnastics', 'cool down', 'accessory', 'olympic', 'endurance',
]
# First line under Met Con that matches this → sub_title (תת כותרת משנה), like 1013.
SUB_TITLE_PATTERN = re.compile(
    r'^\d+\s*Rounds?\s+(?:For\s+Time|for\s+time)',
    re.IGNORECASE
)
# Also treat as sub_title: "X Min EMOM", "X Min AMRAP", "For Time:", etc.
SUB_TITLE_ALSO = re.compile(
    r'^(\d+\s*Min\s+(?:EMOM|AMRAP|Amrap|Emom)|For\s+Time\s*:|AMRAP|EMOM\b)',
    re.IGNORECASE
)


def _is_first_level_header(line):
    """True only if line is exactly or starts with a known section title (e.g. Strength:, Met Con:)."""
    s = (line or '').strip()
    if not s or len(s) > 70:
        return False
    lo = s.lower()
    for h in FIRST_LEVEL_HEADERS:
        if lo == h or lo.startswith(h + ':') or lo.startswith(h + ' '):
            return True
    return False


def _normalize_section_title(raw):
    """Display title: Strength, Met Con (like 1013)."""
    lo = (raw or '').strip().lower()
    if 'met con' in lo or 'metcon' in lo:
        return 'Met Con'
    if 'strength' in lo:
        return 'Strength'
    if 'wod' in lo:
        return 'WOD'
    return (raw or '').strip()


def _is_sub_title_line(line):
    """True if this line should be the sub_title (תת כותרת) of the Met Con section."""
    s = (line or '').strip()
    if not s:
        return False
    return bool(SUB_TITLE_PATTERN.match(s) or SUB_TITLE_ALSO.match(s))


def parse_sections(lines):
    """
    Parse flat lines into sections like 1013:
    - First line that looks like "Strength" or "Strength:" = section 1 title; content until next header.
    - "Met Con" or "Met Con:" = section 2 title. If the first content line is "X Rounds For Time:" etc.
      → that line is sub_title (תת כותרת משנה), rest are lines.
    - Never treat exercise lines (e.g. "6 Power Snatch @ 60/42.5kg") as section headers.
    """
    sections = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not _is_first_level_header(line):
            if not sections:
                # First block with no header (e.g. Open workout day) → one section
                section_lines = []
                while i < len(lines) and not _is_first_level_header(lines[i]):
                    section_lines.append(lines[i])
                    i += 1
                if section_lines:
                    sections.append({'title': 'WORKOUT', 'lines': section_lines})
                continue
            i += 1
            continue
        title = _normalize_section_title(line)
        i += 1
        section_lines = []
        sub_title = None
        while i < len(lines) and not _is_first_level_header(lines[i]):
            section_lines.append(lines[i])
            i += 1
        # For Met Con / WOD: if first line is "X Rounds For Time:" etc. → sub_title
        if title in ('Met Con', 'WOD') and section_lines and _is_sub_title_line(section_lines[0]):
            sub_title = section_lines[0].strip()
            section_lines = section_lines[1:]
        if sub_title is not None:
            sections.append({'title': title, 'sub_title': sub_title, 'lines': section_lines})
        else:
            sections.append({'title': title, 'lines': section_lines})
    if not sections:
        return [{'title': 'WORKOUT', 'lines': lines}]
    return sections


def fetch_workout(date):
    """
    Fetch workout from centralized WOD page.
    Strategy: Find the article with matching date, then extract ONLY post-content div
    """
    date_str = date.strftime('%Y-%m-%d')
    url = "https://crossfittonbridge.co.uk/wod/"

    try:
        print(f"    -> Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)

        if r.status_code != 200:
            print(f"    -> HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.content, 'lxml')
        
        # Build target date pattern
        day_name = date.strftime('%A')  # Monday, Tuesday, etc.
        day_num = date.day
        month_name = date.strftime('%B')  # February, March, etc.
        
        # Ordinal suffix
        if 10 <= day_num % 100 <= 20:
            suffix = 'th'
        else:
            suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(day_num % 10, 'th')
        
        # Target: "Monday 16th February 2026"
        target_pattern = f"{day_name} {day_num}{suffix} {month_name}"
        print(f"    -> Looking for: '{target_pattern}'")
        
        # Find all articles
        articles = soup.find_all('article', class_='fusion-post-medium')
        print(f"    -> Found {len(articles)} articles")
        
        for article in articles:
            # Check title - EXACT class
            h2 = article.find('h2', class_='blog-shortcode-post-title')
            if not h2:
                continue
            
            title_text = h2.get_text(strip=True)
            
            # Match date
            if target_pattern.lower() in title_text.lower():
                print(f"    -> Matched article: {title_text}")
                
                # Extract ONLY fusion-post-content-container div
                content_div = article.find('div', class_='fusion-post-content-container')
                if not content_div:
                    print(f"    -> No fusion-post-content-container div found")
                    continue
                
                # Get all <p> tags
                workout_lines = []
                for p in content_div.find_all('p'):
                    text = p.get_text(strip=True)
                    # Skip empty or &nbsp;
                    if text and text != '\xa0' and text != ' ':
                        workout_lines.append(text)
                
                if not workout_lines:
                    print(f"    -> No workout content")
                    return None
                
                print(f"    -> Extracted {len(workout_lines)} lines")
                
                # Parse into sections
                sections = parse_sections(workout_lines)
                total = sum(len(s['lines']) for s in sections)
                print(f"    -> SUCCESS: {len(sections)} sections, {total} lines")
                
                return {
                    'date':        date_str,
                    'source':      'tonbridge',
                    'source_name': 'CrossFit TonBridge',
                    'url':         url,
                    'sections':    sections,
                }
        
        print(f"    -> Date {date_str} not found")
        return None

    except requests.Timeout:
        print(f"    -> Timeout")
        return None
    except Exception as e:
        print(f"    -> Error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    print("Testing Tonbridge scraper...")
    result = fetch_workout(datetime.now())
    if result:
        print(f"\n✅ Success!")
        for s in result['sections']:
            sub = f" (sub_title: {s.get('sub_title')})" if s.get('sub_title') else ""
            print(f"[{s['title']}]{sub}: {len(s['lines'])} lines")
            for line in s['lines'][:3]:
                print(f"  {line}")
    else:
        print("❌ Failed")

