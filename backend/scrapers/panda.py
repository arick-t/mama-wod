"""
CrossFit Panda Scraper
Index page: https://crossfitpanda-ghost.fly.dev/page/2/
            https://crossfitpanda-ghost.fly.dev/ (page 1)

Strategy:
  1. Fetch the index page(s)
  2. Find all post links (Ghost blog = /YYYY/MM/DD/slug/ pattern usually)
  3. Match by date or by finding today's post title
  4. Fetch that post and extract the workout

Ghost blog URL pattern is typically:
  https://crossfitpanda-ghost.fly.dev/YYYY/MM/DD/post-slug/
  OR just /post-slug/
"""
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

BASE_URL = 'https://crossfitpanda-ghost.fly.dev'

SECTION_HINTS = ['warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
                 'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
                 'accessory', 'cool', 'power', 'endurance', 'barbell']

STOP_WORDS = ['leave a comment', 'leave a reply', 'post comment', 'subscribe',
              'newsletter', 'copyright', 'privacy', 'share this', 'you may also like']


def parse_sections(lines):
    sections = []
    cur = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        is_hdr = False
        if line.isupper() and 3 <= len(line) <= 60 and not re.search(r'\d', line):
            is_hdr = True
        elif (any(kw in lo for kw in SECTION_HINTS) and len(line) < 60
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


def get_post_links(page_url):
    """Fetch an index page and return (post_url, post_title, post_date_str) tuples."""
    try:
        r = requests.get(page_url, timeout=12, headers=HEADERS)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, 'html.parser')

        posts = []

        # Ghost blog: articles/posts are typically in article tags or .post elements
        # Links to posts are in <a href="/slug/">
        for a in soup.find_all('a', href=True):
            href = a['href']
            # Skip external, nav, and non-post links
            if not href or href in ['/', '#', '']:
                continue
            if href.startswith('http') and BASE_URL not in href:
                continue

            # Normalize URL
            if href.startswith('/'):
                full_url = BASE_URL + href
            else:
                full_url = href

            # Skip pagination, tag, author pages
            if any(s in full_url for s in ['/page/', '/tag/', '/author/', '/rss/', '#']):
                continue

            # Get the link text as potential title
            title = a.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Avoid duplicates
            if (full_url, title) not in [(p[0], p[1]) for p in posts]:
                posts.append((full_url, title))

        return posts
    except Exception as e:
        return []


def date_in_title(title, date):
    """Check if a post title contains the target date."""
    # Common patterns:
    # "WOD 2/10/2026", "February 10", "Feb 10", "10/2/2026", "2026-02-10"
    t = title.lower()

    # Numeric: M/D/YYYY or M/D/YY
    pat1 = re.search(r'\b' + str(date.month) + r'/' + str(date.day) + r'/', t)
    if pat1:
        return True

    # Month name
    month_names = ['january','february','march','april','may','june','july',
                   'august','september','october','november','december']
    month_abbr  = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    month_name = month_names[date.month - 1]
    month_ab   = month_abbr[date.month - 1]

    if (month_name in t or month_ab in t) and str(date.day) in t:
        return True

    # ISO date
    if date.strftime('%Y-%m-%d') in t:
        return True

    return False


def fetch_post(post_url, date_str):
    """Fetch a single post page and extract the workout."""
    try:
        r = requests.get(post_url, timeout=12, headers=HEADERS)
        if r.status_code != 200:
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript', 'form', 'nav', 'footer']):
            tag.decompose()
        for img in soup.find_all('img'):
            img.decompose()
        for tag in soup.find_all(class_=re.compile(
                r'sidebar|comment|widget|share|social|related|footer|nav|cookie', re.I)):
            tag.decompose()

        # Ghost content div
        content = (soup.find(class_='gh-content') or
                   soup.find(class_='post-content') or
                   soup.find(class_='entry-content') or
                   soup.find('article') or
                   soup.find('main'))

        if not content:
            return None

        raw_lines = [l.strip() for l in content.get_text(separator='\n').split('\n')
                     if l.strip() and len(l.strip()) > 1]

        workout_lines = []
        for line in raw_lines:
            lo = line.lower()
            if any(s in lo for s in STOP_WORDS):
                break
            if len(line) > 200:
                continue
            workout_lines.append(line)

        workout_lines = workout_lines[:60]
        if not workout_lines:
            return None

        return parse_sections(workout_lines)

    except Exception:
        return None


def fetch_workout(date):
    date_str = date.strftime('%Y-%m-%d')

    # Check pages 1 and 2
    pages = [BASE_URL + '/', BASE_URL + '/page/2/']

    for page_url in pages:
        print(f"    → Scanning {page_url}")
        posts = get_post_links(page_url)

        for post_url, title in posts:
            if date_in_title(title, date):
                print(f"    → Matched: '{title}' → {post_url}")
                sections = fetch_post(post_url, date_str)
                if sections:
                    total = sum(len(s['lines']) for s in sections)
                    print(f"    → SUCCESS: {len(sections)} sections, {total} lines")
                    return {
                        'date':        date_str,
                        'source':      'panda',
                        'source_name': 'CrossFit Panda',
                        'url':         post_url,
                        'sections':    sections
                    }

    print(f"    → No post found for {date_str}")
    return None


if __name__ == '__main__':
    from datetime import timedelta
    for i in [0, 1]:
        d = datetime.now() - timedelta(days=i)
        print(f"\n--- {d.strftime('%Y-%m-%d')} ---")
        r = fetch_workout(d)
        if r:
            print(f"✅ URL: {r['url']}")
            for s in r['sections']:
                print(f"  [{s['title']}]: {s['lines'][:2]}")
        else:
            print("❌ Not found")
