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

SECTION_HINTS = [
    'warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
    'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
    'accessory', 'cool down', 'power', 'endurance', 'barbell',
]


def parse_sections(lines):
    """Parse flat lines into sections."""
    sections = []
    cur = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        is_hdr = False
        if line.isupper() and 3 <= len(line) <= 60 and not re.search(r'\d', line):
            is_hdr = True
        elif (any(kw in lo for kw in SECTION_HINTS)
              and len(line) < 60
              and not re.search(r'\d+\s*(min|rep|round|x\b)', lo)):
            is_hdr = True
        if is_hdr:
            if cur['lines']:
                sections.append(cur)
            cur = {'title': line.upper(), 'lines': []}
        else:
            cur['lines'].append(line)
    if cur['lines']:
        sections.append(cur)
    return sections or [{'title': 'WORKOUT', 'lines': lines}]


def fetch_workout(date):
    """
    Fetch workout from centralized WOD page.
    NEW URL: https://crossfittonbridge.co.uk/wod/
    """
    date_str = date.strftime('%Y-%m-%d')
    url = "https://crossfittonbridge.co.uk/wod/"

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)

        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Remove noise
        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript', 'form']):
            tag.decompose()
        for img in soup.find_all(['img', 'picture', 'figure']):
            img.decompose()

        # Get all text
        body = soup.find('body') or soup
        raw_lines = [l.strip() for l in body.get_text(separator='\n').split('\n')
                     if l.strip() and len(l.strip()) > 1]

        print(f"    → {len(raw_lines)} raw lines")

        # Build date patterns for matching
        # Target patterns: "Saturday 15th February", "Sunday 16th February", etc.
        target_day = date.day
        target_month_name = date.strftime('%B')  # "February"
        
        # Ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
        if 10 <= target_day % 100 <= 20:
            suffix = 'th'
        else:
            suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(target_day % 10, 'th')
        
        # Pattern: "Saturday 15th February" (any day name is OK)
        target_pattern = f"{target_day}{suffix} {target_month_name}"
        
        # Also check day name
        day_name = date.strftime('%A')  # "Sunday"
        full_pattern = f"{day_name} {target_day}{suffix} {target_month_name}"
        
        print(f"    → Looking for: '{target_pattern}' or '{full_pattern}'")

        # Find the workout title (date header)
        start_idx = None
        for i, line in enumerate(raw_lines):
            line_lower = line.lower()
            # Match date pattern (case-insensitive)
            if target_pattern.lower() in line_lower or full_pattern.lower() in line_lower:
                start_idx = i + 1  # Start AFTER the title line
                print(f"    → Found title at line {i}: '{line}'")
                break

        if start_idx is None:
            print(f"    → Date {date_str} not found")
            return None

        # Collect workout lines until separator
        # Separator format: "By NAME|NEXT_DATE" or just contains next day's date
        workout_lines = []
        
        # Calculate next day's date (to detect separator)
        next_date = date + timedelta(days=1)
        next_day = next_date.day
        next_month = next_date.strftime('%B')
        if 10 <= next_day % 100 <= 20:
            next_suffix = 'th'
        else:
            next_suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(next_day % 10, 'th')
        next_pattern = f"{next_month} {next_day}{next_suffix}"  # "February 13th"
        
        # Also check for previous day (workouts sometimes posted day before)
        prev_date = date - timedelta(days=1)
        prev_day = prev_date.day
        prev_month = prev_date.strftime('%B')
        if 10 <= prev_day % 100 <= 20:
            prev_suffix = 'th'
        else:
            prev_suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(prev_day % 10, 'th')
        prev_pattern = f"{prev_month} {prev_day}{prev_suffix}"
        
        print(f"    → Separator pattern: '{next_pattern}' or 'By ... | {next_pattern}'")

        for line in raw_lines[start_idx:]:
            lo = line.lower().strip()
            
            # STOP at separator line (contains next day's date)
            # Format: "By Liv Phillips|February 13th, 2026" or similar
            if next_pattern.lower() in lo or ('by ' in lo and '|' in lo):
                print(f"    → Stopped at separator: '{line[:60]}'")
                break
            
            # STOP at another date header (next workout title)
            # Check if line matches date pattern format
            date_header_pattern = r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+\d{1,2}(st|nd|rd|th)\s+(january|february|march|april|may|june|july|august|september|october|november|december)'
            if re.search(date_header_pattern, lo):
                print(f"    → Stopped at next workout: '{line[:60]}'")
                break
            
            # Skip navigation/footer
            if any(skip in lo for skip in [
                'home', 'about', 'contact', 'schedule', 'membership',
                'coaches', 'crossfit', 'ton bridge', 'tonbridge',
                'blog', 'shop', 'login', 'skip to content', 'register'
            ]):
                continue
            
            # Skip very long lines (probably prose)
            if len(line) > 200:
                continue
            
            workout_lines.append(line)
            
            # Safety limit
            if len(workout_lines) >= 60:
                break

        if not workout_lines:
            print(f"    → No workout content")
            return None

        sections = parse_sections(workout_lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date':        date_str,
            'source':      'tonbridge',
            'source_name': 'CrossFit Ton Bridge',
            'url':         url,
            'sections':    sections,
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    # Test with today
    print("Testing Ton Bridge scraper...")
    result = fetch_workout(datetime.now())
    if result:
        print(f"\n✅ Success!")
        for s in result['sections']:
            print(f"[{s['title']}]: {len(s['lines'])} lines")
            for line in s['lines'][:3]:
                print(f"  {line}")
    else:
        print("❌ Failed")
