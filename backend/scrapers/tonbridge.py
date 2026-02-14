"""
CrossFit Ton Bridge Scraper
Archive URL: https://crossfittonbridge.co.uk/YYYY/MM/
Example: https://crossfittonbridge.co.uk/2026/02/

Page shows all workouts for the month.
Each workout has a date heading and content below.
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

SECTION_HINTS = [
    'warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
    'amrap', 'emom', 'for time', 'tabata', 'gymnastics', 'olympic',
    'accessory', 'cool down', 'power', 'endurance', 'barbell',
]


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
    """
    Fetch workout from archive page for the given month.
    Archive URL format: /YYYY/MM/
    """
    date_str = date.strftime('%Y-%m-%d')
    year = date.year
    month = str(date.month).zfill(2)
    url = f"https://crossfittonbridge.co.uk/{year}/{month}/"

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)

        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Remove noise
        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript', 'form']):
            tag.decompose()
        for img in soup.find_all(['img', 'picture', 'figure']):
            tag.decompose()

        # The page is an archive - find all post articles
        # Each post likely has a date/title and content
        articles = soup.find_all('article') or soup.find_all(class_=re.compile(r'post|entry', re.I))

        if not articles:
            # Fallback: get all text and try to find date markers
            print(f"    → No articles found, using full page text")
            body = soup.find('body') or soup
            raw_lines = [l.strip() for l in body.get_text(separator='\n').split('\n')
                         if l.strip() and len(l.strip()) > 1]
        else:
            print(f"    → Found {len(articles)} articles on page")
            # Find the article matching our date
            # Date patterns: "11 February 2026", "February 11", "11/02/2026", etc.
            target_day = str(date.day)
            target_month_name = date.strftime('%B').lower()  # "february"
            target_month_short = date.strftime('%b').lower() # "feb"

            matched_article = None
            for article in articles:
                article_text = article.get_text(separator=' ', strip=True).lower()
                # Check if this article is for our target date
                if (target_day in article_text
                    and (target_month_name in article_text or target_month_short in article_text)):
                    matched_article = article
                    print(f"    → Matched article containing date")
                    break

            if not matched_article:
                print(f"    → Date {date_str} not found in articles")
                return None

            raw_lines = [l.strip() for l in matched_article.get_text(separator='\n').split('\n')
                         if l.strip() and len(l.strip()) > 1]

        # Filter lines
        STOP = ['leave a reply', 'leave a comment', 'post comment',
                'subscribe', 'newsletter', 'copyright', 'privacy',
                'related posts', 'you may also like',
                'read more', 'comments off']
        SKIP = {'home', 'about', 'contact', 'schedule', 'membership',
                'coaches', 'crossfit', 'ton bridge', 'tonbridge',
                'blog', 'shop', 'login', 'skip to content'}

        workout_lines = []
        for line in raw_lines:
            lo = line.lower().strip()
            if any(s in lo for s in STOP):
                print(f"    → Stopped at: '{line[:60]}'")
                break
            if lo in SKIP:
                continue
            if len(line) > 200:
                continue
            workout_lines.append(line)

        workout_lines = workout_lines[:60]

        if not workout_lines:
            print(f"    → No workout content")
            return None

        sections = parse_sections(workout_lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")

        return {
            'date':        date_str,
            'source':      'tonbridge',
            'source_name': 'CrossFit Ton Bridge',
            'url':         url,
            'sections':    sections,
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None
