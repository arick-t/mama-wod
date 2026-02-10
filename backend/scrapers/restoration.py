"""
CrossFit Restoration Scraper
URL pattern: crossfitrestoration.com/wod-{month}-{day}-{year}/
Example:
  2026-02-10 → /wod-february-10-2026/
  2026-02-07 → /wod-february-7-2026/   (no leading zero on day)

Page structure:
  - Big header image (skip)
  - Date header: "CrossFit – Fri, Feb 6" (our start marker)
  - Workout sections (capture these)
  - Comments section (stop here)
"""
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

MONTHS = {
    1:'january', 2:'february', 3:'march',    4:'april',
    5:'may',     6:'june',     7:'july',      8:'august',
    9:'september',10:'october',11:'november', 12:'december'
}

SECTION_HINTS = ['warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
                 'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
                 'accessory', 'cool', 'power', 'endurance']

STOP_WORDS = ['leave a reply', 'leave a comment', 'comments', 'your email',
              'post comment', 'logged in', 'subscribe', 'newsletter',
              'related posts', 'you may also like', 'share this', 'copyright',
              'privacy policy', 'filed under', 'tagged']


def make_url(date):
    month = MONTHS[date.month]
    day   = date.day        # No leading zero – matches site pattern
    year  = date.year
    return f"https://crossfitrestoration.com/wod-{month}-{day}-{year}/"


def parse_sections(lines):
    sections = []
    cur = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        # A section header is: ALL-CAPS short text, OR contains a section keyword
        # and is short (not a workout line with numbers)
        is_hdr = False
        if line.isupper() and 3 <= len(line) <= 60 and not re.search(r'\d', line):
            is_hdr = True
        elif any(kw in lo for kw in SECTION_HINTS) and len(line) < 60:
            # Make sure it's not something like "15 min AMRAP" (has numbers)
            if not re.search(r'\d+\s*(min|rep|round|x\b)', lo):
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
    """Fetch CrossFit Restoration WOD for the given date."""
    date_str = date.strftime('%Y-%m-%d')
    url = make_url(date)

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)

        if r.status_code == 404:
            print(f"    → 404 – no WOD posted for {date_str}")
            return None
        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # ── Step 1: remove absolute noise ────────────────────────────────────
        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript',
                                   'form', 'nav', 'header']):
            tag.decompose()
        # Remove sidebars, comments, footers, sharing buttons
        for tag in soup.find_all(class_=re.compile(
                r'sidebar|comment|widget|share|social|related|footer|nav|'
                r'breadcrumb|advertisement|cookie', re.I)):
            tag.decompose()
        for tag in soup.find_all(id=re.compile(
                r'sidebar|comment|footer|nav|respond', re.I)):
            tag.decompose()

        # ── Step 2: remove all <img> tags (header image + any others) ────────
        for img in soup.find_all('img'):
            img.decompose()

        # ── Step 3: find main content container ──────────────────────────────
        content = None
        for sel in [('class','entry-content'), ('class','post-content'),
                    ('class','wod-content'),   ('tag','article'),
                    ('tag','main')]:
            if sel[0] == 'class':
                content = soup.find(class_=sel[1])
            else:
                content = soup.find(sel[1])
            if content:
                print(f"    → Content found via {sel[1]}")
                break

        if not content:
            print(f"    → No content container found")
            return None

        # ── Step 4: extract lines ─────────────────────────────────────────────
        raw_lines = [l.strip() for l in
                     content.get_text(separator='\n').split('\n')
                     if l.strip() and len(l.strip()) > 1]

        # The page starts with the date header line like:
        # "CrossFit – Fri, Feb 6" or "CrossFit – Tuesday, February 10"
        # We use this as our START marker.
        # Everything before it is the page title / nav / image alt text.

        DATE_PATTERN = re.compile(
            r'crossfit\s*[–\-—]\s*(mon|tue|wed|thu|fri|sat|sun)',
            re.IGNORECASE
        )

        start_idx = 0
        for i, line in enumerate(raw_lines):
            if DATE_PATTERN.search(line):
                start_idx = i + 1   # skip the date line itself, start after it
                print(f"    → Found date header at line {i}: '{line}'")
                break

        # Collect workout lines, stop at comments/footer
        workout_lines = []
        for line in raw_lines[start_idx:]:
            lo = line.lower()
            if any(s in lo for s in STOP_WORDS):
                print(f"    → Stopped at: '{line[:60]}'")
                break
            # Skip very long prose lines (not workout content)
            if len(line) > 200:
                continue
            # Skip page navigation artifacts
            if lo in ['home','about','contact','wod','schedule','membership',
                       'coaches','crossfit restoration']:
                continue
            workout_lines.append(line)

        # Limit to 60 lines
        workout_lines = workout_lines[:60]

        if not workout_lines:
            print(f"    → No workout content after date header")
            return None

        sections = parse_sections(workout_lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date':        date_str,
            'source':      'restoration',
            'source_name': 'CrossFit Restoration',
            'url':         url,
            'sections':    sections
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        import traceback; traceback.print_exc()
        return None


if __name__ == '__main__':
    from datetime import timedelta
    print("URL pattern test:")
    for i in [0, 1, 3]:
        d = datetime.now() - timedelta(days=i)
        print(f"  {d.strftime('%Y-%m-%d')} → {make_url(d)}")

    print("\nFetching today...")
    r = fetch_workout(datetime.now())
    if r:
        print(f"✅ {len(r['sections'])} sections")
        for s in r['sections']:
            print(f"  [{s['title']}]: {s['lines'][:2]}")
    else:
        print("❌ Failed")
