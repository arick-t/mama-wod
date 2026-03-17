"""
CrossFit 1013 Scraper – article-based parsing + pagination (2 weeks history).

Structure on site:
- Each day = one <article> with <h1 class="entry-title"> (e.g. "Wednesday 03/04/2026")
- Weekdays: <p> with <strong>Strength</strong> then <br/> and lines; <p> with <strong>WOD</strong>, then first line = sub-subheading (e.g. "Keepy Uppy"), rest = body
- Saturday: single <p> with no strong – first line = title, rest = body
- Pagination: next page = /wod?offset=... or /wod?offset=...&reversePaginate=true
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
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

BASE_URL = 'https://www.crossfit1013.com'
WOD_URL = BASE_URL + '/wod'

# h1 format: "Wednesday 03/04/2026" -> MM/DD/YYYY
H1_DATE_RE = re.compile(r'\d{1,2}/\d{1,2}/\d{2,4}')

SKIP_LINES = {
    'norberto olalde', 'comment', 'leave a comment', 'crossfit 1013', 'crossfit1013',
}


def _h1_to_date_str(h1_text):
    """Parse 'Wednesday 03/04/2026' -> '2026-03-04'."""
    m = H1_DATE_RE.search(h1_text or '')
    if not m:
        return None
    part = m.group(0)
    parts = part.replace('-', '/').split('/')
    if len(parts) != 3:
        return None
    try:
        mo, day, year = int(parts[0]), int(parts[1]), int(parts[2])
        if year < 100:
            year += 2000
        return f'{year}-{mo:02d}-{day:02d}'
    except (ValueError, IndexError):
        return None


def _parens_as_note(line):
    """Content entirely in parentheses → note (* line)."""
    s = (line or '').strip()
    if len(s) >= 2 and s.startswith('(') and s.endswith(')'):
        return '* ' + s
    return line


def _dash_wrapped_as_note(line):
    """Line wrapped in two dashes -xxx- → note. Applies to whole source."""
    s = (line or '').strip()
    if len(s) >= 2 and s.startswith('-') and s.endswith('-'):
        return '* ' + s
    return line


def _time_cap_as_note(line):
    """Line starting with 'Time cap:' → note."""
    s = (line or '').strip()
    if s.lower().startswith('time cap:'):
        return '* ' + s
    return line


def _convert_lbs_hash(line):
    """In this source, # means pounds: 55#/35# → 25kg/16kg."""
    if not line or '#' not in line:
        return line

    def repl(m):
        lbs = float(m.group(1))
        kg = round(lbs * 0.453592)
        return str(kg) + 'kg'

    return re.sub(r'(\d+(?:\.\d+)?)\s*#', repl, line)


def _is_format_line(line):
    """First line after theme that describes format (For Time:, AMRAP, EMOM, etc.)."""
    s = (line or '').strip().lower()
    if not s:
        return False
    if 'for time' in s or 'for time:' in s:
        return True
    if s.startswith('amrap') or ' amrap' in s:
        return True
    if s.startswith('emom') or ' emom' in s:
        return True
    if 'sets' in s and 'for time' in s:
        return True
    if s.startswith('rounds') or ' rounds ' in s:
        return True
    return False


def _normalize_wod_line(line):
    """Apply note rules and lbs#→kg to a single WOD line. Note detection uses original line."""
    raw = (line or '').strip()
    if not raw:
        return raw
    converted = _convert_lbs_hash(raw)
    if len(raw) >= 2 and raw.startswith('(') and raw.endswith(')'):
        return '* ' + converted
    if len(raw) >= 2 and raw.startswith('-') and raw.endswith('-'):
        return '* ' + converted
    if raw.lower().startswith('time cap:'):
        return '* ' + converted
    return converted


def _lines_from_paragraph(p):
    """Get text lines from a <p> (separator \\n from <br/>)."""
    text = (p.get_text(separator='\n') or '').strip()
    return [ln.strip() for ln in text.split('\n') if ln.strip()]


def _parse_paragraph_with_strong(p, strong_text):
    """If <p> contains <strong>strong_text</strong>, return lines after that heading. Else None."""
    strong = p.find('strong')
    if not strong or (strong.get_text(strip=True) or '').lower() != strong_text.lower():
        return None
    lines = _lines_from_paragraph(p)
    if lines and lines[0].lower() == strong_text.lower():
        return lines[1:]
    return lines


def parse_article(article):
    """
    Parse one <article>: date from h1.entry-title, sections from <p>.
    Returns (date_str, sections) or (None, None) if no date.
    """
    h1 = article.find('h1', class_='entry-title')
    if not h1:
        return None, None
    date_str = _h1_to_date_str(h1.get_text())
    if not date_str:
        return None, None

    # Detect weekday (has Strength/WOD) vs Saturday (single block)
    all_ps = article.find_all('p')
    has_strength_or_wod = False
    for p in all_ps:
        strong = p.find('strong')
        if strong:
            t = (strong.get_text(strip=True) or '').lower()
            if t in ('strength', 'wod'):
                has_strength_or_wod = True
                break

    sections = []
    if has_strength_or_wod:
        for p in all_ps:
            lines_raw = _lines_from_paragraph(p)
            if not lines_raw:
                continue
            first_lower = lines_raw[0].lower()
            if any(skip in first_lower for skip in SKIP_LINES):
                continue
            strength_lines = _parse_paragraph_with_strong(p, 'Strength')
            if strength_lines is not None:
                lines = [_time_cap_as_note(_dash_wrapped_as_note(_parens_as_note(ln))) for ln in strength_lines]
                sections.append({'title': 'Strength', 'lines': lines})
                continue
            wod_strong = p.find('strong')
            if wod_strong and (wod_strong.get_text(strip=True) or '').lower() == 'wod':
                after_wod = _lines_from_paragraph(p)
                if after_wod and after_wod[0].lower() == 'wod':
                    after_wod = after_wod[1:]
                sub_title = (after_wod[0].strip().strip('"') if after_wod else '') or None
                body_lines = after_wod[1:] if len(after_wod) > 1 else []
                sub_title2 = None
                if len(body_lines) >= 1 and _is_format_line(body_lines[0]):
                    sub_title2 = body_lines[0].strip()
                    body_lines = body_lines[1:]
                lines = [_normalize_wod_line(ln) for ln in body_lines]
                section = {'title': 'WOD', 'sub_title': sub_title, 'lines': lines}
                if sub_title2 is not None:
                    section['sub_title2'] = sub_title2
                sections.append(section)
                continue
    else:
        # Saturday: one section – first line = title, rest = body (from all p's)
        all_lines = []
        for p in all_ps:
            lines_raw = _lines_from_paragraph(p)
            for ln in lines_raw:
                if any(skip in ln.lower() for skip in SKIP_LINES):
                    continue
                all_lines.append(ln)
        if all_lines:
            title = all_lines[0].strip().strip('"')
            rest = [_time_cap_as_note(_dash_wrapped_as_note(_parens_as_note(ln))) for ln in all_lines[1:]]
            sections.append({'title': title, 'lines': rest})

    if not sections:
        return date_str, [{'title': 'WOD', 'lines': []}]
    return date_str, sections


def _get_next_page_url(soup):
    """Find <a href="/wod?offset=..."> in soup. Returns full URL or None."""
    for a in soup.find_all('a', href=True):
        href = (a.get('href') or '').strip()
        if 'offset=' not in href:
            continue
        if href.startswith('http'):
            return href
        if href.startswith('/'):
            return BASE_URL + href
        if href.startswith('?'):
            return WOD_URL + href
        return WOD_URL + '?' + href.split('?', 1)[-1] if '?' in href else WOD_URL
    return None


def _fetch_page(url):
    """Fetch one WOD page; return (soup, next_page_url or None)."""
    r = requests.get(url, timeout=15, headers=HEADERS)
    if r.status_code != 200:
        return None, None
    soup = BeautifulSoup(r.text, 'html.parser')
    for tag in soup.find_all(['script', 'style', 'iframe', 'noscript', 'form', 'video']):
        tag.decompose()
    for tag in soup.find_all(['img', 'picture', 'figure']):
        tag.decompose()
    # Do not remove by class – it can remove the main content container (e.g. navigation wraps content)
    next_url = _get_next_page_url(soup)
    return soup, next_url


# Cache: date_str -> workout dict. Filled by ensure_cache().
_cf1013_cache = {}
_cf1013_pages_fetched = 0
MAX_PAGES = 5  # enough for 2 weeks (4 workouts per page)


def ensure_cache_for_date(target_date):
    """Fetch WOD pages until we have target_date in cache or we've done MAX_PAGES."""
    global _cf1013_cache, _cf1013_pages_fetched
    date_str = target_date.strftime('%Y-%m-%d')
    if date_str in _cf1013_cache:
        return
    url = WOD_URL
    pages_done = 0
    while pages_done < MAX_PAGES:
        print(f"    -> Fetching {url}")
        soup, next_url = _fetch_page(url)
        if not soup:
            break
        pages_done += 1
        _cf1013_pages_fetched += 1
        for article in soup.find_all('article'):
            d, sections = parse_article(article)
            if not d:
                continue
            if d not in _cf1013_cache:
                _cf1013_cache[d] = {
                    'date': d,
                    'source': 'cf1013',
                    'source_name': 'CrossFit 1013',
                    'url': WOD_URL,
                    'sections': sections,
                }
        if date_str in _cf1013_cache:
            return
        if not next_url or next_url == url:
            break
        url = next_url
    return


def fetch_workout(date):
    """Return one workout for the given date. Uses article parsing + pagination (2 weeks)."""
    ensure_cache_for_date(date)
    date_str = date.strftime('%Y-%m-%d')
    w = _cf1013_cache.get(date_str)
    if w:
        total = sum(len(s.get('lines', [])) for s in w.get('sections', []))
        print(f"    -> SUCCESS: {len(w['sections'])} sections, {total} lines")
    else:
        print(f"    -> Date {date_str} not found (checked {_cf1013_pages_fetched} pages)")
    return w
