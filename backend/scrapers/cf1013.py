"""
CrossFit 1013 Scraper
URL: https://www.crossfit1013.com/wod

Page structure: long page with multiple WODs listed.
Each WOD has a date header like "Saturday 2/7/2026"
followed by workout content, then next date header.

DEBUG: Prints first 10 date-looking lines found on page to aid diagnosis.
"""
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

SECTION_HINTS = [
    'warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
    'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
    'accessory', 'cool down', 'power', 'endurance', 'barbell',
]

# Date header formats the site might use:
# "Saturday 2/7/2026", "Mon 2/9/2026", "Monday, February 9", etc.
DATE_RE = re.compile(
    r'^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|'
    r'mon|tue|wed|thu|fri|sat|sun)'
    r'[\s,]+(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})',
    re.IGNORECASE
)

# Safe junk removal
JUNK_RE = re.compile(
    r'sidebar|comment|widget|share|social|related|'
    r'breadcrumb|menu|footer|cookie|popup|modal|advertisement', re.I
)


def parse_date_line(line):
    """Try to parse M/D/YYYY from a date header line."""
    m = DATE_RE.match(line.strip())
    if not m:
        return None
    try:
        month = int(m.group(2))
        day   = int(m.group(3))
        year  = int(m.group(4))
        if year < 100:
            year += 2000
        return (year, month, day)
    except Exception:
        return None


def date_matches_line(line, target):
    """Return True if line is a date header for target date."""
    parsed = parse_date_line(line)
    if not parsed:
        return False
    y, mo, d = parsed
    return y == target.year and mo == target.month and d == target.day


def parse_sections(lines):
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
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://www.crossfit1013.com/wod'

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript',
                                   'form', 'video']):
            tag.decompose()
        for img in soup.find_all(['img', 'picture', 'figure']):
            img.decompose()
        for tag in soup.find_all(['nav', 'footer', 'header']):
            tag.decompose()
        for tag in soup.find_all(class_=JUNK_RE):
            tag.decompose()
        for tag in soup.find_all(id=JUNK_RE):
            tag.decompose()

        body = soup.find('body') or soup
        raw_lines = [
            l.strip()
            for l in body.get_text(separator='\n').split('\n')
            if l.strip() and len(l.strip()) > 1
        ]

        # DEBUG: print first few date-matching lines to see what format the page uses
        date_lines_found = []
        for line in raw_lines:
            if DATE_RE.match(line.strip()):
                date_lines_found.append(line)
            if len(date_lines_found) >= 6:
                break

        if date_lines_found:
            print(f"    → Date lines found on page: {date_lines_found[:3]}")
        else:
            # Try to find ANY line with a year to understand the format
            year_lines = [l for l in raw_lines if '2026' in l or '2025' in l][:3]
            if year_lines:
                print(f"    → Year lines (no date header match): {year_lines}")
            else:
                print(f"    → No date lines found. Page has {len(raw_lines)} lines total.")
                print(f"    → First 5 lines: {raw_lines[:5]}")
            return None

        # Find our target date
        target_start = None
        next_date_idx = None

        for i, line in enumerate(raw_lines):
            if date_matches_line(line, date):
                target_start = i + 1
                print(f"    → Matched target date: '{line}'")
                for j in range(i + 1, len(raw_lines)):
                    if DATE_RE.match(raw_lines[j].strip()):
                        next_date_idx = j
                        break
                break

        if target_start is None:
            print(f"    → Date {date_str} not found. Available: {[l for l in date_lines_found[:3]]}")
            return None

        end_idx = next_date_idx if next_date_idx else target_start + 60
        block = raw_lines[target_start:end_idx]

        SKIP = {
            'home', 'about', 'contact', 'schedule', 'membership',
            'coaches', 'crossfit 1013', 'crossfit1013', 'wod',
            'login', 'register', 'shop', 'skip to content',
        }
        workout_lines = []
        for line in block:
            lo = line.lower().strip()
            if lo in SKIP:
                continue
            if len(line) > 200:
                continue
            if line.startswith('http') and ('youtube' in line or 'vimeo' in line):
                continue
            workout_lines.append(line)

        workout_lines = workout_lines[:60]

        if not workout_lines:
            print(f"    → No content for {date_str}")
            return None

        sections = parse_sections(workout_lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date':        date_str,
            'source':      'cf1013',
            'source_name': 'CrossFit 1013',
            'url':         url,
            'sections':    sections,
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None
