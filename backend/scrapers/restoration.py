"""
CrossFit Restoration Scraper - crossfitrestoration.com
URL pattern: /wod-{month-name}-{day}-{year}/
Example: /wod-february-10-2026/

Has 14-day archive via date-based URLs!
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
                 'amrap', 'emom', 'for time', 'tabata', 'power', 'accessory',
                 'cool', 'gymnastics', 'olympic']

STOP_WORDS = ['comments', 'leave a reply', 'subscribe', 'newsletter',
              'you may also like', 'related posts', 'share this',
              'copyright', 'privacy', 'terms']

SKIP_WORDS = ['crossfit restoration', 'home', 'about', 'contact',
              'schedule', 'membership', 'login', 'register']


def date_to_url_slug(date):
    """
    Converts date to URL slug.
    Examples:
      2026-02-10 → wod-february-10-2026
      2026-02-07 → wod-february-7-2026  (no leading zero)
    """
    month_names = {
        1: 'january', 2: 'february', 3: 'march', 4: 'april',
        5: 'may', 6: 'june', 7: 'july', 8: 'august',
        9: 'september', 10: 'october', 11: 'november', 12: 'december'
    }
    month = month_names[date.month]
    day = date.day  # No leading zero
    year = date.year
    return f'wod-{month}-{day}-{year}'


def parse_sections(lines):
    sections = []
    current = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        is_hdr = (line.isupper() and 3 <= len(line) <= 50) or \
                 (any(kw in lo for kw in SECTION_HINTS) and len(line) < 60 and
                  not re.search(r'\d+\s*(reps?|rounds?|min|x)', lo))
        if is_hdr:
            if current['lines']:
                sections.append(current)
            current = {'title': line.upper(), 'lines': []}
        else:
            current['lines'].append(line)
    if current['lines']:
        sections.append(current)
    return sections or [{'title': 'WORKOUT', 'lines': lines}]


def fetch_workout(date):
    """
    CrossFit Restoration - has archive via predictable URL pattern.
    URL: https://crossfitrestoration.com/wod-{month}-{day}-{year}/
    """
    date_str = date.strftime('%Y-%m-%d')
    slug = date_to_url_slug(date)
    url = f'https://crossfitrestoration.com/{slug}/'

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)

        if r.status_code == 404:
            print(f"    → 404 - no workout for {date_str}")
            return None

        if r.status_code != 200:
            print(f"    → Status {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Remove noise
        for tag in soup.find_all(['script', 'style', 'img', 'iframe',
                                   'noscript', 'form', 'nav']):
            tag.decompose()
        for tag in soup.find_all(class_=re.compile(
                r'footer|sidebar|comment|widget|share|social|related|nav|menu', re.I)):
            tag.decompose()

        # Find content
        content = None
        for sel in [('class', 'entry-content'), ('class', 'post-content'),
                    ('class', 'wod-content'), ('tag', 'article'), ('tag', 'main')]:
            if sel[0] == 'class':
                content = soup.find(class_=sel[1])
            else:
                content = soup.find(sel[1])
            if content:
                print(f"    → Found via {sel[1]}")
                break

        if not content:
            print(f"    → No content container found")
            return None

        raw = content.get_text(separator='\n', strip=True)
        lines = []
        for line in raw.split('\n'):
            line = line.strip()
            if not line or len(line) < 2:
                continue
            lo = line.lower()
            # Stop at comments/footer
            if any(stop in lo for stop in STOP_WORDS):
                print(f"    → Stopped at: '{line[:50]}'")
                break
            # Skip nav/header labels
            if lo in [s.lower() for s in SKIP_WORDS]:
                continue
            # Skip the page title if it's just the date slug
            if 'wod' in lo and date.strftime('%B').lower() in lo:
                continue
            if len(line) > 200:
                continue
            lines.append(line)

        lines = lines[:50]
        if not lines:
            print(f"    → No content after filtering")
            return None

        sections = parse_sections(lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date': date_str,
            'source': 'restoration',
            'source_name': 'CrossFit Restoration',
            'url': url,
            'sections': sections
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


if __name__ == '__main__':
    from datetime import timedelta
    print("Testing CrossFit Restoration...")

    # Test URL generation
    test_dates = [
        datetime(2026, 2, 10),
        datetime(2026, 2, 9),
        datetime(2026, 2, 7),
    ]
    print("\nURL pattern test:")
    for d in test_dates:
        slug = date_to_url_slug(d)
        print(f"  {d.strftime('%Y-%m-%d')} → /{slug}/")

    print("\nFetching today...")
    r = fetch_workout(datetime.now())
    if r:
        print(f"✅ {len(r['sections'])} sections")
        for s in r['sections']:
            print(f"  [{s['title']}]: {s['lines'][:2]}")
    else:
        print("❌ Failed")
