"""
CrossFit 1013 Scraper - Minimal cleanup approach
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
}

SECTION_HINTS = [
    'warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
    'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
    'accessory', 'cool down', 'power', 'endurance', 'barbell',
]

DATE_RE = re.compile(
    r'^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|'
    r'mon|tue|wed|thu|fri|sat|sun)'
    r'[\s,]+(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})',
    re.IGNORECASE
)


def parse_date_line(line):
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

        # MINIMAL cleanup
        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript', 'form', 'video']):
            tag.decompose()
        for img in soup.find_all(['img', 'picture', 'figure']):
            tag.decompose()
        
        # Remove ONLY page-level nav/footer
        NAV_FOOTER_RE = re.compile(
            r'site-header|page-header|main-header|site-navigation|'
            r'primary-navigation|site-footer|page-footer|main-footer', re.I
        )
        for tag in soup.find_all(class_=NAV_FOOTER_RE):
            tag.decompose()
        for tag in soup.find_all(id=NAV_FOOTER_RE):
            tag.decompose()

        body = soup.find('body') or soup
        raw_lines = [
            l.strip()
            for l in body.get_text(separator='\n').split('\n')
            if l.strip() and len(l.strip()) > 1
        ]

        # DEBUG: find date lines
        date_lines_found = []
        for line in raw_lines:
            if DATE_RE.match(line.strip()):
                date_lines_found.append(line)
            if len(date_lines_found) >= 6:
                break

        if date_lines_found:
            print(f"    → Date lines found: {date_lines_found[:3]}")
        else:
            year_lines = [l for l in raw_lines if '2026' in l or '2025' in l][:5]
            if year_lines:
                print(f"    → Year-containing lines: {year_lines}")
            else:
                print(f"    → No dates found. Page has {len(raw_lines)} lines.")
                print(f"    → Sample lines: {raw_lines[:10]}")
            return None

        # Find target date
        target_start = None
        next_date_idx = None

        for i, line in enumerate(raw_lines):
            if date_matches_line(line, date):
                target_start = i + 1
                print(f"    → Matched: '{line}'")
                for j in range(i + 1, len(raw_lines)):
                    if DATE_RE.match(raw_lines[j].strip()):
                        next_date_idx = j
                        break
                break

        if target_start is None:
            print(f"    → Date {date_str} not found. Available: {date_lines_found[:3]}")
            return None

        end_idx = next_date_idx if next_date_idx else target_start + 60
        block = raw_lines[target_start:end_idx]

        SKIP = {
            'home', 'about', 'contact', 'schedule', 'membership',
            'coaches', 'crossfit 1013', 'crossfit1013', 'wod',
            'login', 'register', 'shop', 'skip to content',
        }
        STOP = {'comment', 'norberto olalde', 'comments off', 'read more'}
        
        workout_lines = []
        for line in block:
            lo = line.lower().strip()
            
            # Stop at footer/comment markers
            if lo in STOP or 'comment' in lo:
                print(f"    → Stopped at: '{line[:40]}'")
                break
            
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
