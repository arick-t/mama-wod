"""
CrossFit Postal & CrossFit Green Beach Scrapers

POSTAL (crossfitpostal.com/dailywod) – today only.
Page structure every day:
  [large header image]            <- removed (img tags)
  "CrossFit - Tue, Feb 10"        <- date line (skip this one line)
  [workout sections]              <- CAPTURE these
  "Intermediate"                  <- STOP here, don't include anything after
  [scaling options / booking]     <- ignored

GREEN BEACH: Wix JS site – cannot scrape static HTML.
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
}

# Matches: "CrossFit - Tue, Feb 10"  or  "CrossFit – Mon, Feb 9"
DATE_HDR = re.compile(
    r'crossfit\s*[–\-—]\s*(mon|tue|wed|thu|fri|sat|sun)',
    re.IGNORECASE,
)

SECTION_HINTS = [
    'warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
    'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
    'accessory', 'cool down', 'power', 'endurance', 'barbell',
]

# Single navigation words to skip
NAV_WORDS = {
    'home', 'about', 'contact', 'schedule', 'membership',
    'coaches', 'crossfit', 'postal', 'shop', 'login', 'register',
    'search', 'wod', 'daily wod', 'blog',
}

# Remove elements with these class/id patterns
JUNK_RE = re.compile(
    r'sidebar|comment|widget|share|social|related|'
    r'breadcrumb|nav|menu|footer|cookie|popup|modal|'
    r'author|tag|cat|advertisement', re.I
)


def parse_sections(lines):
    """Group flat lines into named sections."""
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


# ══════════════════════════════════════════════════════════════════════════
#  POSTAL
# ══════════════════════════════════════════════════════════════════════════

def fetch_postal(date):
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://crossfitpostal.com/dailywod'

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)

        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # ── Strip noise ─────────────────────────────────────────────────────
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

        print(f"    → {len(raw_lines)} raw lines after cleanup")

        # ── Find date-line START marker (skip the date line itself) ──────────
        start_idx = 0
        for i, line in enumerate(raw_lines):
            if DATE_HDR.search(line):
                start_idx = i + 1
                print(f"    → Date marker at line {i}: '{line}'")
                break
        else:
            print(f"    → No date marker – starting from top")

        # ── Collect workout; STOP at "Intermediate" ──────────────────────────
        workout_lines = []
        for line in raw_lines[start_idx:]:
            lo = line.lower().strip()

            # Primary STOP
            if lo == 'intermediate' or lo.startswith('intermediate '):
                print(f"    → Stopped at 'Intermediate'")
                break

            # Secondary STOPs (booking / footer content)
            if any(lo.startswith(s) for s in [
                'book a drop', 'click here to pay', 'sign your waiver',
                'leave a reply', 'leave a comment', 'post comment',
                'subscribe', 'newsletter', 'copyright', 'privacy',
                'follow us',
            ]):
                print(f"    → Stopped at: '{line[:60]}'")
                break

            # Skip nav words
            if lo in NAV_WORDS:
                continue
            # Skip very long prose
            if len(line) > 200:
                continue

            workout_lines.append(line)

        workout_lines = workout_lines[:50]

        if not workout_lines:
            print(f"    → No workout lines found")
            return None

        sections = parse_sections(workout_lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date':        date_str,
            'source':      'postal',
            'source_name': 'CrossFit Postal',
            'url':         url,
            'sections':    sections,
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════
#  GREEN BEACH  (Wix JS – cannot scrape)
# ══════════════════════════════════════════════════════════════════════════

def fetch_greenbeach(date):
    print(f"    → Green Beach: Wix JS site – cannot scrape static HTML")
    return None


if __name__ == '__main__':
    print("Testing Postal...")
    r = fetch_postal(datetime.now())
    if r:
        print(f"✅ {len(r['sections'])} sections")
        for s in r['sections']:
            print(f"  [{s['title']}]: {s['lines'][:3]}")
    else:
        print("❌ Failed")
