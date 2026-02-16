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
    'warm', 'strength', 'skill', 'wod', 'metcon', 'met con', 'conditioning',
    'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
    'accessory', 'cool down', 'power', 'endurance', 'barbell',
]


def parse_sections(lines):
    """Parse flat lines into sections."""
    sections = []
    cur = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower().strip()
        is_hdr = False
        
        # Check if it's a header
        if line.isupper() and 3 <= len(line) <= 60 and not re.search(r'\d', line):
            is_hdr = True
        elif (any(kw in lo for kw in SECTION_HINTS)
              and len(line) < 60
              and not re.search(r'\d+\s*(min|rep|round|x\b)', lo)):
            is_hdr = True
        
        if is_hdr:
            if cur['lines']:
                sections.append(cur)
            # Normalize title
            title = line.upper().strip()
            if 'MET CON' in title or 'METCON' in title:
                title = 'METCON'
            elif 'STRENGTH' in title:
                title = 'STRENGTH'
            cur = {'title': title, 'lines': []}
        else:
            cur['lines'].append(line)
    
    if cur['lines']:
        sections.append(cur)
    return sections or [{'title': 'WORKOUT', 'lines': lines}]


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
    # Test with today
    print("Testing Tonbridge scraper...")
    result = fetch_workout(datetime.now())
    if result:
        print(f"\n✅ Success!")
        for s in result['sections']:
            print(f"[{s['title']}]: {len(s['lines'])} lines")
            for line in s['lines'][:3]:
                print(f"  {line}")
    else:
        print("❌ Failed")


if __name__ == '__main__':
    # Test with today
    print("Testing Tonbridge scraper...")
    result = fetch_workout(datetime.now())
    if result:
        print(f"\n✅ Success!")
        for s in result['sections']:
            print(f"[{s['title']}]: {len(s['lines'])} lines")
            for line in s['lines'][:3]:
                print(f"  {line}")
    else:
        print("❌ Failed")

