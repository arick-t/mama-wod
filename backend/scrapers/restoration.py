"""
CrossFit Restoration Scraper
URL: crossfitrestoration.com/wod-{month}-{day}-{year}/

CRITICAL FIX: Don't remove ALL <header> tags - only site-header/page-header.
Content is often inside <header class="entry-header"> in WordPress!
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

MONTHS = {
    1:'january',  2:'february', 3:'march',    4:'april',
    5:'may',      6:'june',     7:'july',      8:'august',
    9:'september',10:'october', 11:'november', 12:'december',
}

DATE_HDR = re.compile(
    r'crossfit\s*[–\-—]\s*(mon|tue|wed|thu|fri|sat|sun)',
    re.IGNORECASE,
)

SECTION_HINTS = [
    'warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
    'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
    'accessory', 'cool down', 'power', 'endurance', 'barbell',
]

NAV_WORDS = {
    'home', 'about', 'contact', 'wod', 'schedule', 'membership',
    'coaches', 'crossfit', 'restoration', 'blog', 'gallery',
    'register', 'login', 'shop', 'search', 'skip to content',
}


def make_url(date):
    return (
        f"https://crossfitrestoration.com/"
        f"wod-{MONTHS[date.month]}-{date.day}-{date.year}/"
    )


def parse_sections(lines):
    """
    Restoration uses bold text for section headers.
    Pattern: short lines (usually < 80 chars) containing keywords
    like "Warm-up", "Power Clean", "For time", "Skill", etc.
    """
    sections = []
    cur = {'title': 'WORKOUT', 'lines': []}
    
    for line in lines:
        lo = line.lower()
        is_hdr = False
        
        # Check if this looks like a section header:
        # 1. ALL-CAPS short text (e.g., "STRENGTH")
        if line.isupper() and 3 <= len(line) <= 60 and not re.search(r'\d', line):
            is_hdr = True
        
        # 2. Contains section keywords AND is reasonably short (< 80 chars)
        #    AND doesn't look like a workout line (no "x 10 reps" pattern)
        elif len(line) < 80 and any(kw in lo for kw in SECTION_HINTS):
            # Exclude lines that are clearly workout instructions
            # (e.g., "10 min AMRAP" vs "Power Clean")
            if not re.search(r'\d+\s*(min|rep|round|x\b|second|meter|cal)', lo):
                is_hdr = True
            # BUT: "For time (Time)" or "Power Clean (In 15-20 minutes...)" ARE headers
            # Pattern: starts with keyword, may have parentheses
            elif any(lo.startswith(kw) for kw in ['warm', 'strength', 'skill', 'for time',
                                                     'power clean', 'back squat', 'deadlift',
                                                     'snatch', 'clean and jerk']):
                is_hdr = True
        
        if is_hdr:
            if cur['lines']:
                sections.append(cur)
            cur = {'title': line.strip(), 'lines': []}  # Keep original case
        else:
            cur['lines'].append(line)
    
    if cur['lines']:
        sections.append(cur)
    
    return sections or [{'title': 'WORKOUT', 'lines': lines}]


def fetch_workout(date):
    date_str = date.strftime('%Y-%m-%d')
    url = make_url(date)

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)

        if r.status_code == 404:
            print(f"    → 404 – no WOD for {date_str}")
            return None
        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # ── MINIMAL cleanup - remove ONLY obvious noise ───────────────────────
        # Remove scripts, styles, iframes
        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript', 'form']):
            tag.decompose()
        
        # Remove ALL images
        for img in soup.find_all(['img', 'picture', 'figure']):
            img.decompose()
        
        # Remove ONLY page-level nav/footer (with specific classes)
        # NOT all <nav>/<header> tags (content might be inside them!)
        NAV_FOOTER_RE = re.compile(
            r'site-header|page-header|main-header|site-navigation|'
            r'primary-navigation|site-footer|page-footer|main-footer', re.I
        )
        for tag in soup.find_all(class_=NAV_FOOTER_RE):
            tag.decompose()
        for tag in soup.find_all(id=NAV_FOOTER_RE):
            tag.decompose()
        
        # Remove only OBVIOUS junk divs
        SAFE_JUNK_RE = re.compile(
            r'^(sidebar|comment-|widget-|share-buttons|social-share|'
            r'breadcrumb|cookie-notice|popup-|modal-)', re.I
        )
        for tag in soup.find_all(class_=SAFE_JUNK_RE):
            tag.decompose()

        body = soup.find('body') or soup
        raw_lines = [
            l.strip()
            for l in body.get_text(separator='\n').split('\n')
            if l.strip() and len(l.strip()) > 1
        ]

        print(f"    → {len(raw_lines)} raw lines after cleanup")

        # Find date marker
        start_idx = 0
        for i, line in enumerate(raw_lines):
            if DATE_HDR.search(line):
                start_idx = i + 1
                print(f"    → Date marker at line {i}: '{line}'")
                break
        else:
            print(f"    → No date marker – using full body")

        # Collect; STOP at "Intermediate"
        workout_lines = []
        for line in raw_lines[start_idx:]:
            lo = line.lower().strip()

            if lo == 'intermediate' or lo.startswith('intermediate '):
                print(f"    → Stopped at 'Intermediate'")
                break
            
            # STOP at "Prev" (navigation footer starts here)
            if lo == 'prev' or lo == 'previous':
                print(f"    → Stopped at navigation footer")
                break

            if any(lo.startswith(s) for s in [
                'leave a reply', 'leave a comment', 'post comment',
                'logged in', 'your email', 'required fields',
                'subscribe', 'newsletter', 'copyright', 'privacy',
                'share this', 'filed under', 'tagged',
                'related posts', 'quick links', 'get in touch',
            ]):
                print(f"    → Stopped at: '{line[:60]}'")
                break

            if lo in NAV_WORDS:
                continue
            if re.match(r'^wod[-–]', lo):
                continue
            if len(line) > 200:
                continue

            workout_lines.append(line)

        workout_lines = workout_lines[:60]

        if not workout_lines:
            print(f"    → No workout content after filtering")
            return None

        sections = parse_sections(workout_lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date':        date_str,
            'source':      'restoration',
            'source_name': 'CrossFit Restoration',
            'url':         url,
            'sections':    sections,
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        import traceback; traceback.print_exc()
        return None
