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
# Standalone date line (e.g. "February 27, 2026" or "02/25/2026") to strip
DATE_LINE_RE = re.compile(
    r'^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{2,4}$',
    re.IGNORECASE
)
DATE_MMDD_RE = re.compile(r'^\d{1,2}/\d{1,2}/\d{2,4}$')
# Link with date is redundant – never show (Saturday 02/28/2026 etc.)
WOD_LINK_RE = re.compile(r'^/wod/')


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


def _is_date_line(line):
    """True if line is a redundant date (e.g. Saturday 02/28/2026, February 27, 2026, 02/25/2026)."""
    t = (line or '').strip()
    return bool(DATE_RE.match(t) or DATE_LINE_RE.match(t) or DATE_MMDD_RE.match(t))


def _extract_sections_from_p(p_tag):
    """
    From a <p> with content (e.g. white-space:pre-wrap): first line = section title, rest = lines.
    Strip surrounding quotes from title (e.g. "Mulligatawny" -> Mulligatawny).
    """
    for br in p_tag.find_all('br'):
        br.replace_with('\n')
    text = p_tag.get_text(separator='\n', strip=False)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return None
    # First line = section title; if it's "WOD" or author name, use second line as title (e.g. "Clam Chowder")
    skip_first = ('norberto olalde', 'crossfit 1013', 'wod', 'home', 'about')
    first = lines[0].strip().strip('"').strip('"')
    for q in ['\u201c', '\u201d', '\u201e', '"']:
        first = first.strip(q)
    rest_candidates = [l for l in lines[1:] if not _is_date_line(l)]
    # <strong>WOD</strong> then next line = workout name (e.g. "Clam Chowder")
    if first.lower() == 'wod' and rest_candidates:
        first = rest_candidates[0].strip().strip('"').strip('"')
        for q in ['\u201c', '\u201d', '\u201e', '"']:
            first = first.strip(q)
        rest_candidates = rest_candidates[1:]
    elif first.lower() in skip_first:
        if not rest_candidates:
            return None
        first = rest_candidates[0].strip().strip('"').strip('"')
        for q in ['\u201c', '\u201d', '\u201e', '"']:
            first = first.strip(q)
        rest_candidates = rest_candidates[1:]
    # Stop rest before next author line or next quoted workout title
    rest = []
    for l in rest_candidates:
        if l.strip().lower() in skip_first:
            break
        if len(rest) > 0 and l.strip().startswith('"') and len(l.strip()) > 4:
            break  # next workout block
        rest.append(l)
    if not first:
        return None
    return {'title': 'WORKOUT – ' + first, 'lines': rest}


def _extract_sections_from_p_fallback(lines):
    """When no <p> structure: first line = title (or second if first is WOD/author), rest = lines."""
    if not lines:
        return None
    skip_first = ('norberto olalde', 'crossfit 1013', 'wod', 'home', 'about')
    first = lines[0].strip().strip('"').strip('"')
    for q in ['\u201c', '\u201d', '\u201e', '"']:
        first = first.strip(q)
    rest_candidates = [l for l in lines[1:] if not _is_date_line(l)]
    if first.lower() == 'wod' and rest_candidates:
        first = rest_candidates[0].strip().strip('"').strip('"')
        for q in ['\u201c', '\u201d', '\u201e', '"']:
            first = first.strip(q)
        rest_candidates = rest_candidates[1:]
    elif first.lower() in skip_first:
        if not rest_candidates:
            return None
        first = rest_candidates[0].strip().strip('"').strip('"')
        for q in ['\u201c', '\u201d', '\u201e', '"']:
            first = first.strip(q)
        rest_candidates = rest_candidates[1:]
    rest = []
    for l in rest_candidates:
        if l.strip().lower() in skip_first:
            break
        if len(rest) > 0 and l.strip().startswith('"') and len(l.strip()) > 4:
            break
        rest.append(l)
    if not first:
        return None
    return {'title': 'WORKOUT – ' + first, 'lines': rest}


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
            img.decompose()
        
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

        # Structural parse: <a href="/wod/...">Saturday 02/28/2026</a> = date link (never show).
        # Right after it, <p> blocks: first line = section title, rest = content.
        sections = []
        for a in body.find_all('a', href=WOD_LINK_RE):
            link_text = a.get_text(strip=True)
            if not date_matches_line(link_text, date):
                continue
            print(f"    → Matched date link: '{link_text}'")
            # Next WOD link (so we stop before the next day's content)
            next_wod_links = [x for x in a.find_all_next('a', href=WOD_LINK_RE) if x != a]
            next_a = next_wod_links[0] if next_wod_links else None
            for p in a.find_all_next('p'):
                if next_a and next_a in p.find_all_previous():
                    break  # past the next date link
                sec = _extract_sections_from_p(p)
                if sec and sec.get('lines'):
                    sections.append(sec)
            break  # only first matching date

        if not sections:
            # Fallback: text-based extraction, strip date lines
            raw_lines = [
                l.strip() for l in body.get_text(separator='\n').split('\n')
                if l.strip() and len(l.strip()) > 1
            ]
            for i, line in enumerate(raw_lines):
                if date_matches_line(line, date):
                    block = raw_lines[i + 1:i + 60]
                    block = [l for l in block if not _is_date_line(l) and 'comment' not in l.lower()]
                    if block:
                        sec = _extract_sections_from_p_fallback(block)
                        if sec:
                            sections = [sec]
                    break

        if not sections:
            print(f"    → No content for {date_str}")
            return None

        # Remove redundant sections: "WORKOUT" (+ optional date line only) or "WORKOUT – WOD" with no content
        def _is_redundant(s):
            t = (s.get('title') or '').strip()
            ln = s.get('lines') or []
            if t == 'WORKOUT' and (len(ln) == 0 or (len(ln) == 1 and _is_date_line((ln[0] or '').strip()))):
                return True
            if t == 'WORKOUT – WOD' and len(ln) == 0:
                return True
            return False
        sections = [s for s in sections if not _is_redundant(s)]

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
