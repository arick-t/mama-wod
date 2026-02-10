"""
CrossFit Virtus Scraper - crossfitvirtus.com/wods/
Has a WOD archive page with daily workouts.
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
                 'amrap', 'emom', 'for time', 'tabata', 'power', 'accessory', 'cool']

STOP_WORDS = ['comments', 'leave a reply', 'subscribe', 'newsletter',
              'follow us', 'copyright', 'privacy policy', 'related posts',
              'you may also like', 'share this', 'facebook', 'instagram']

SKIP_WORDS = ['home', 'about', 'contact', 'schedule', 'coaches',
              'membership', 'login', 'register', 'search']


def parse_sections(lines):
    sections = []
    current = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        is_hdr = (line.isupper() and 3 <= len(line) <= 50) or \
                 (any(kw in lo for kw in SECTION_HINTS) and len(line) < 50 and
                  not re.search(r'\d+\s*(reps?|rounds?|min)', lo))
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
    CrossFit Virtus - crossfitvirtus.com/wods/
    Has a wods archive. Try date-based URL first, then scrape archive.
    """
    date_str = date.strftime('%Y-%m-%d')

    # Common URL patterns for CrossFit sites using WordPress
    urls_to_try = [
        f'https://crossfitvirtus.com/wods/{date_str}/',
        f'https://crossfitvirtus.com/wod/{date_str}/',
        f'https://crossfitvirtus.com/wods/',
    ]

    for url in urls_to_try:
        result = _try_fetch(url, date_str, date)
        if result:
            return result

    return None


def _try_fetch(url, date_str, date):
    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            print(f"    → Status {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Remove noise
        for tag in soup.find_all(['script', 'style', 'img', 'iframe',
                                   'noscript', 'form', 'nav']):
            tag.decompose()
        for tag in soup.find_all(class_=re.compile(r'footer|sidebar|comment|widget|share|social', re.I)):
            tag.decompose()

        # Find workout content
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
            return None

        # If this is the archive page, try to find today's post
        if url.endswith('/wods/') or url.endswith('/wod/'):
            # Look for a post matching today's date
            date_formatted = date.strftime('%B %-d, %Y')  # "February 10, 2026"
            date_alt = date.strftime('%B %d, %Y')

            for post in soup.find_all(['article', 'div'],
                                       class_=re.compile(r'post|entry', re.I)):
                post_text = post.get_text()
                if date_formatted in post_text or date_alt in post_text:
                    content = post
                    print(f"    → Found today's post in archive")
                    break
            else:
                # Take the first/most recent post
                first_post = soup.find('article') or soup.find('div', class_=re.compile(r'post-\d+', re.I))
                if first_post:
                    content = first_post
                    print(f"    → Using most recent post")

        raw = content.get_text(separator='\n', strip=True)
        lines = []
        for line in raw.split('\n'):
            line = line.strip()
            if not line or len(line) < 2:
                continue
            lo = line.lower()
            if any(stop in lo for stop in STOP_WORDS):
                break
            if any(skip == lo for skip in SKIP_WORDS):
                continue
            if len(line) > 200:  # Skip very long lines (probably prose)
                continue
            lines.append(line)

        lines = lines[:50]
        if not lines:
            return None

        sections = parse_sections(lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date': date_str,
            'source': 'virtus',
            'source_name': 'CrossFit Virtus',
            'url': url,
            'sections': sections
        }

    except requests.Timeout:
        print(f"    → Timeout on {url}")
        return None
    except Exception as e:
        print(f"    → Error on {url}: {e}")
        return None


if __name__ == '__main__':
    print("Testing CrossFit Virtus...")
    r = fetch_workout(datetime.now())
    if r:
        print(f"✅ {len(r['sections'])} sections")
        for s in r['sections']:
            print(f"  [{s['title']}]: {s['lines'][:2]}")
    else:
        print("❌ Failed")
