"""
CrossFit Green Beach & Postal Scrapers - FIXED
Based on actual observed output from each site
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re


HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}


# ==================== POSTAL ====================
# Problem: Page includes popup + contact info at bottom
# Solution: Extract content from TOP of page, STOP at contact/footer patterns

# These keywords indicate we've passed the workout section
POSTAL_STOP_KEYWORDS = [
    'book a drop-in',
    'click here to pay',
    'sign your waiver',
    'drop-in',
    'waiver',
    'pay now',
    'contact',
    'address',
    'phone',
    'email',
    'follow us',
    'copyright',
    '@',
    'facebook',
    'instagram',
]

# Workout-related keywords - these are GOOD lines
WORKOUT_KEYWORDS = [
    # Workout types
    'amrap', 'emom', 'for time', 'rounds', 'reps', 'sets',
    # Movements
    'squat', 'deadlift', 'press', 'clean', 'snatch', 'jerk',
    'pull-up', 'push-up', 'pullup', 'pushup', 'muscle-up',
    'run', 'row', 'bike', 'ski',
    'burpee', 'swing', 'thruster', 'lunge',
    'box jump', 'wall ball', 'double under',
    'handstand', 'rope climb',
    # Numbers patterns
    'x ', ' kg', ' lbs', 'min', 'sec',
    # Section titles
    'warm', 'strength', 'wod', 'metcon', 'conditioning', 'cool'
]


def is_workout_line(line):
    """Returns True if line looks like workout content"""
    lower = line.lower()
    # Has a number followed by common workout terms
    if re.search(r'\d+\s*(x|rounds|reps|min|sec|cal|m\b)', lower):
        return True
    # Contains workout movement keywords
    if any(kw in lower for kw in WORKOUT_KEYWORDS):
        return True
    # Short capitalized line (section header like "METCON", "STRENGTH")
    if line.isupper() and 3 <= len(line) <= 30:
        return True
    # Numbered list item (1. , 2. , etc)
    if re.match(r'^\d+[\.\)]\s+', line):
        return True
    return False


def fetch_postal(date):
    """
    CrossFit Postal
    WOD is at the TOP of the page, before all the footer/booking links.
    Strategy: grab the first content-rich text block, stop at booking keywords.
    """
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://crossfitpostal.com/dailywod'

    try:
        print(f"    → Fetching {url}")
        response = requests.get(url, timeout=15, headers=HEADERS)

        if response.status_code != 200:
            print(f"    → Status {response.status_code}")
            return None

        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove definite noise first
        for tag in soup.find_all(['script', 'style', 'img', 'iframe', 'noscript', 'form']):
            tag.decompose()
        for tag in soup.find_all(class_=re.compile(r'footer|popup|modal|cookie|nav|menu|header', re.I)):
            tag.decompose()
        for tag in soup.find_all(id=re.compile(r'footer|popup|modal|cookie|nav|menu|header', re.I)):
            tag.decompose()

        # Find the main content area (try multiple approaches)
        content = None
        for selector in [
            ('class', 'entry-content'),
            ('class', 'post-content'),
            ('class', 'content'),
            ('class', 'wod'),
            ('class', 'main-content'),
            ('tag', 'article'),
            ('tag', 'main'),
        ]:
            if selector[0] == 'class':
                content = soup.find('div', class_=selector[1])
            else:
                content = soup.find(selector[1])
            if content:
                print(f"    → Found via {selector[1]}")
                break

        # Fallback: use body
        if not content:
            content = soup.find('body') or soup

        raw_lines = [l.strip() for l in content.get_text(separator='\n').split('\n') if l.strip()]

        # Hard stop keywords - booking/footer content
        HARD_STOP = [
            'book a drop', 'click here to pay', 'sign your waiver',
            'drop-in', 'pay now', 'book now', 'join now',
            'follow us', 'copyright', 'all rights reserved',
            'facebook', 'instagram', '@crossfit',
        ]

        # Take lines until we hit footer content
        workout_lines = []
        for line in raw_lines:
            lower = line.lower()
            if any(stop in lower for stop in HARD_STOP):
                print(f"    → Stopped before: '{line[:50]}'")
                break
            # Skip single navigation words
            if len(line.split()) == 1 and line.lower() in ['home','about','contact','menu','search','login','shop']:
                continue
            workout_lines.append(line)

        # Remove generic labels at the top
        SKIP_LINES = ['daily wod', 'wod', 'workout of the day']
        final_lines = [l for l in workout_lines if l.lower() not in SKIP_LINES]

        if not final_lines:
            print(f"    → No workout lines found")
            return None

        # Limit to first 40 lines (the actual workout)
        final_lines = final_lines[:40]
        sections = parse_into_sections(final_lines)

        print(f"    → SUCCESS: {len(sections)} sections, {sum(len(s['lines']) for s in sections)} lines")

        return {
            'date': date_str,
            'source': 'postal',
            'source_name': 'CrossFit Postal',
            'url': url,
            'sections': sections
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        import traceback
        traceback.print_exc()
        return None


# ==================== GREEN BEACH ====================
# Problem: WOD is inside a dynamically-loaded Wix widget (iframe/JS render)
# Static HTML only contains the contact form and footer
# Solution: Try Wix data API endpoint, fall back to structured data in page

def fetch_greenbeach(date):
    """
    CrossFit Green Beach (Wix site)
    WOD loads dynamically - try multiple approaches.
    """
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://www.crossfitgreenbeach.com/en/wod'

    try:
        print(f"    → Fetching {url}")
        response = requests.get(url, timeout=15, headers=HEADERS)

        if response.status_code != 200:
            print(f"    → Status {response.status_code}")
            return None

        soup = BeautifulSoup(response.text, 'html.parser')

        # ---- Approach 1: Look for structured data (JSON-LD) ----
        json_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_scripts:
            try:
                import json
                data = json.loads(script.string or '')
                if isinstance(data, dict):
                    text = data.get('description', '') or data.get('text', '')
                    if text and len(text) > 50 and is_workout_line(text[:100]):
                        lines = [l.strip() for l in text.split('\n') if l.strip()]
                        print(f"    → Found via JSON-LD ({len(lines)} lines)")
                        return {
                            'date': date_str,
                            'source': 'greenbeach',
                            'source_name': 'CrossFit Green Beach',
                            'url': url,
                            'sections': parse_into_sections(lines[:40])
                        }
            except:
                continue

        # ---- Approach 2: Look for pre-rendered content in page ----
        # Wix sometimes embeds content in data attributes or specific divs
        for tag in soup.find_all(['script', 'style', 'img', 'iframe', 'noscript', 'form']):
            tag.decompose()

        # Remove known non-workout sections
        for cls_pattern in ['footer', 'header', 'nav', 'menu', 'contact', 'cookie']:
            for tag in soup.find_all(class_=re.compile(cls_pattern, re.I)):
                tag.decompose()
            for tag in soup.find_all(id=re.compile(cls_pattern, re.I)):
                tag.decompose()

        all_lines = [l.strip() for l in soup.get_text(separator='\n').split('\n') if l.strip()]

        # Filter: keep only workout-looking lines, skip contact info
        GREENBEACH_STOP_KEYWORDS = [
            'join now', 'leave your details', 'שם פרטי', 'שם משפחה',
            'דואר אלקטרוני', 'טלפון', 'שליחה', 'activity time',
            'reception hours', 'be in touch', 'shulamit', 'info@',
            'sunday-thursday', 'friday', 'saturday', '054-',
            'back to the main', 'required', 'claims',
            'the daily workout',  # This is just a label, not content
        ]

        workout_lines = []
        for line in all_lines:
            lower = line.lower()

            # Skip contact/footer content
            if any(stop in lower for stop in GREENBEACH_STOP_KEYWORDS):
                continue

            # Skip very short or very long lines
            if len(line) < 3 or len(line) > 150:
                continue

            # Skip lines that are just numbers (pagination like "1/2")
            if re.match(r'^\d+/\d+$', line):
                continue

            # Keep if it looks like workout content
            if is_workout_line(line):
                workout_lines.append(line)

        if not workout_lines:
            print(f"    → No workout content found (Wix dynamic site - content loads via JS)")
            print(f"    → ⚠️  Green Beach requires JS rendering - cannot scrape static HTML")
            return None

        sections = parse_into_sections(workout_lines[:40])
        print(f"    → SUCCESS: {len(sections)} sections")

        return {
            'date': date_str,
            'source': 'greenbeach',
            'source_name': 'CrossFit Green Beach',
            'url': url,
            'sections': sections
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


# ==================== SHARED UTILS ====================

SECTION_KEYWORDS = [
    'warm', 'strength', 'wod', 'metcon', 'conditioning',
    'skill', 'accessory', 'cool down', 'power', 'endurance',
    'amrap', 'emom', 'for time', 'tabata', 'interval'
]


def parse_into_sections(lines):
    """
    Parse flat lines into sections.
    Lines that are ALL CAPS or contain section keywords become section headers.
    """
    sections = []
    current = {'title': 'WORKOUT', 'lines': []}

    for line in lines:
        # Is this a section header?
        is_header = False
        lower = line.lower()

        # ALL CAPS short line
        if line.isupper() and 3 <= len(line) <= 40:
            is_header = True
        # Contains section keyword and is short
        elif any(kw in lower for kw in SECTION_KEYWORDS) and len(line) < 40:
            is_header = True

        if is_header:
            if current['lines']:
                sections.append(current)
            current = {'title': line.upper(), 'lines': []}
        else:
            current['lines'].append(line)

    if current['lines']:
        sections.append(current)

    return sections if sections else [{'title': 'WORKOUT', 'lines': lines}]


if __name__ == '__main__':
    from datetime import datetime

    print("Testing CrossFit Postal...")
    result = fetch_postal(datetime.now())
    if result:
        print(f"✅ Postal: {len(result['sections'])} sections")
        for s in result['sections']:
            print(f"  [{s['title']}]")
            for line in s['lines'][:5]:
                print(f"    • {line}")
    else:
        print("❌ Postal failed")

    print("\nTesting CrossFit Green Beach...")
    result = fetch_greenbeach(datetime.now())
    if result:
        print(f"✅ Green Beach: {len(result['sections'])} sections")
        for s in result['sections']:
            print(f"  [{s['title']}]")
            for line in s['lines'][:5]:
                print(f"    • {line}")
    else:
        print("❌ Green Beach failed (Wix dynamic site - expected)")
