"""
CrossFit.com Scraper - FIXED for current site structure (2026)
The site now uses React/Next.js - content may be in different selectors
"""
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

# Lines to stop at
STOP_WORDS = ['stimulus', 'scaling', 'intermediate option', 'beginner option',
              'resources', 'comments', 'find a gym', 'subscribe']

# Lines to skip (navigation etc)
SKIP_WORDS = ['crossfit games', 'sign up', 'shop', 'register', 'login',
              'follow us', 'copyright', 'privacy']


def parse_sections(lines):
    """Parse flat lines into sections."""
    SECTION_HINTS = ['warm', 'strength', 'skill', 'wod', 'metcon',
                     'conditioning', 'amrap', 'emom', 'for time', 'tabata',
                     'power', 'accessory', 'cool']
    sections = []
    current = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        is_header = (line.isupper() and 3 <= len(line) <= 50) or \
                    (any(kw in lo for kw in SECTION_HINTS) and len(line) < 50 and ':' in line)
        if is_header:
            if current['lines']:
                sections.append(current)
            current = {'title': line.upper().strip(':'), 'lines': []}
        else:
            current['lines'].append(line)
    if current['lines']:
        sections.append(current)
    return sections or [{'title': 'WORKOUT', 'lines': lines}]


def fetch_workout(date):
    """Fetch from CrossFit.com - tries multiple URL formats."""
    date_str = date.strftime('%Y-%m-%d')

    # CrossFit.com uses YYMMDD format
    date_code = date.strftime('%y%m%d')
    url = f'https://www.crossfit.com/{date_code}'

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)

        if r.status_code != 200:
            print(f"    → Status {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Remove noise
        for tag in soup.find_all(['script', 'style', 'img', 'nav',
                                   'footer', 'header', 'iframe', 'noscript']):
            tag.decompose()

        # Try multiple content selectors (site has changed structure)
        content = None
        tried = []

        # 1. article tag
        art = soup.find('article')
        if art:
            content = art
            tried.append('article')

        # 2. main tag
        if not content:
            main = soup.find('main')
            if main:
                content = main
                tried.append('main')

        # 3. div with class containing 'post' or 'content'
        if not content:
            for cls in ['post-content', 'entry-content', 'wod-content',
                        'article-content', 'content']:
                div = soup.find('div', class_=lambda c: c and cls in ' '.join(c).lower())
                if div:
                    content = div
                    tried.append(cls)
                    break

        # 4. Any large text block
        if not content:
            divs = soup.find_all('div')
            best = None
            best_len = 0
            for div in divs:
                t = div.get_text(strip=True)
                if len(t) > best_len and len(t) < 5000:
                    best_len = len(t)
                    best = div
            if best:
                content = best
                tried.append('largest-div')

        if not content:
            print(f"    → No content found")
            return None

        print(f"    → Found via {tried[-1]}")

        # Extract lines
        raw = content.get_text(separator='\n', strip=True)
        lines = []
        for line in raw.split('\n'):
            line = line.strip()
            if not line or len(line) < 2:
                continue
            
            # Fix common encoding issues
            line = line.replace('â\x80\x93', '–')  # en-dash
            line = line.replace('â\x80\x94', '—')  # em-dash
            line = line.replace('â\x80\x99', "'")  # right single quote
            line = line.replace('â\x80\x9c', '"')  # left double quote
            line = line.replace('â\x80\x9d', '"')  # right double quote
            line = line.replace('â\x80¢', '•')     # bullet
            line = line.replace('â ', '• ')        # bullet as seen in user's example
            
            lo = line.lower()
            if any(stop in lo for stop in STOP_WORDS):
                break
            if any(skip in lo for skip in SKIP_WORDS):
                continue
            lines.append(line)

        # Limit to first 60 lines
        lines = lines[:60]

        if not lines:
            print(f"    → No lines after filtering")
            return None

        sections = parse_sections(lines)
        print(f"    → SUCCESS: {len(sections)} sections")

        return {
            'date': date_str,
            'source': 'crossfit_com',
            'source_name': 'CrossFit.com',
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
    result = fetch_workout(datetime.now())
    if result:
        print(f"\n✅ Sections: {len(result['sections'])}")
        for s in result['sections'][:3]:
            print(f"  [{s['title']}]: {s['lines'][:2]}")
    else:
        print("❌ Failed")
