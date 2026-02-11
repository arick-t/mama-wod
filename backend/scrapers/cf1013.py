"""
CrossFit 1013 Scraper
URL: https://www.crossfit1013.com/wod

Page structure: One long page with all recent WODs.
Each WOD has a date header like "Saturday 2/7/2026"
followed by workout content, then the next date header.
Videos/embeds should be ignored.

Strategy:
  1. Fetch the full /wod page
  2. Find all date headers matching the target date
  3. Extract content between that header and the next header
"""
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

SECTION_HINTS = ['warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
                 'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
                 'accessory', 'cool', 'power', 'endurance', 'barbell']

# Date header pattern: "Saturday 2/7/2026" or "Monday 2/10/2026"
# Also handles short days: "Sat 2/7/2026"
DATE_HEADER_RE = re.compile(
    r'^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|'
    r'mon|tue|wed|thu|fri|sat|sun)'
    r'\s+(\d{1,2})/(\d{1,2})/(\d{4})',
    re.IGNORECASE
)


def date_matches(line, target_date):
    """Check if a date-header line matches the target date."""
    m = DATE_HEADER_RE.match(line.strip())
    if not m:
        return False
    month = int(m.group(2))
    day   = int(m.group(3))
    year  = int(m.group(4))
    return month == target_date.month and day == target_date.day and year == target_date.year


def parse_sections(lines):
    sections = []
    cur = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        is_hdr = False
        if line.isupper() and 3 <= len(line) <= 60 and not re.search(r'\d', line):
            is_hdr = True
        elif (any(kw in lo for kw in SECTION_HINTS) and len(line) < 60
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
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://www.crossfit1013.com/wod'

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Remove all noise
        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript',
                                   'form', 'nav', 'footer', 'header', 'video']):
            tag.decompose()
        for img in soup.find_all('img'):
            img.decompose()
        # Remove video embeds (YouTube, Vimeo, etc.)
        for tag in soup.find_all(class_=re.compile(
                r'video|embed|youtube|vimeo|sidebar|comment|widget|nav|footer|share|social', re.I)):
            tag.decompose()

        body = soup.find('body') or soup
        raw_lines = [l.strip() for l in body.get_text(separator='\n').split('\n')
                     if l.strip() and len(l.strip()) > 1]

        # Find our target date header
        target_start = None
        next_date_idx = None

        for i, line in enumerate(raw_lines):
            if date_matches(line, date):
                target_start = i + 1
                print(f"    → Found date header: '{line}'")
                # Find the NEXT date header (end of this WOD)
                for j in range(i + 1, len(raw_lines)):
                    if DATE_HEADER_RE.match(raw_lines[j].strip()):
                        next_date_idx = j
                        break
                break

        if target_start is None:
            print(f"    → Date {date_str} not found on page")
            return None

        # Extract lines between this date and the next
        end_idx = next_date_idx if next_date_idx else target_start + 60
        block = raw_lines[target_start:end_idx]

        # Filter junk
        workout_lines = []
        SKIP = ['home','about','contact','schedule','membership','coaches',
                'crossfit 1013','crossfit1013','wod','login','register','shop']
        for line in block:
            lo = line.lower().strip()
            if lo in SKIP:
                continue
            if len(line) > 200:
                continue
            # Skip lines that are just the video embed URL
            if line.startswith('http') and ('youtube' in line or 'vimeo' in line):
                continue
            workout_lines.append(line)

        workout_lines = workout_lines[:60]

        if not workout_lines:
            print(f"    → No workout content for {date_str}")
            return None

        sections = parse_sections(workout_lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date':        date_str,
            'source':      'cf1013',
            'source_name': 'CrossFit 1013',
            'url':         url,
            'sections':    sections
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


if __name__ == '__main__':
    from datetime import timedelta
    for i in [0, 1, 2]:
        d = datetime.now() - timedelta(days=i)
        print(f"\n--- {d.strftime('%Y-%m-%d')} ---")
        r = fetch_workout(d)
        if r:
            print(f"✅ {len(r['sections'])} sections")
            for s in r['sections']:
                print(f"  [{s['title']}]: {s['lines'][:2]}")
        else:
            print("❌ Not found")
