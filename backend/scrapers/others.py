"""
CrossFit Green Beach & CrossFit Postal Scrapers
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
                 'amrap', 'emom', 'for time', 'tabata', 'power', 'accessory']


def parse_sections(lines):
    sections = []
    current = {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        is_hdr = (line.isupper() and 3 <= len(line) <= 50) or \
                 (any(kw in lo for kw in SECTION_HINTS) and len(line) < 50)
        if is_hdr:
            if current['lines']:
                sections.append(current)
            current = {'title': line.upper(), 'lines': []}
        else:
            current['lines'].append(line)
    if current['lines']:
        sections.append(current)
    return sections or [{'title': 'WORKOUT', 'lines': lines}]


# ==================== POSTAL ====================

def fetch_postal(date):
    """
    CrossFit Postal - crossfitpostal.com/dailywod
    WOD is at the TOP of the page before all booking/contact links.
    Strategy: find main content container, stop at first booking keyword.
    """
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://crossfitpostal.com/dailywod'

    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            print(f"    → Status {r.status_code}")
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Remove definite noise
        for tag in soup.find_all(['script', 'style', 'img', 'iframe', 'noscript', 'form']):
            tag.decompose()
        for tag in soup.find_all(class_=re.compile(r'footer|popup|modal|cookie|nav|sidebar', re.I)):
            tag.decompose()
        for tag in soup.find_all(id=re.compile(r'footer|popup|modal|cookie|nav|sidebar', re.I)):
            tag.decompose()

        # Find main content - try multiple selectors
        content = None
        for sel in [('class', 'entry-content'), ('class', 'post-content'),
                    ('class', 'content-area'), ('tag', 'article'), ('tag', 'main')]:
            if sel[0] == 'class':
                content = soup.find(class_=sel[1])
            else:
                content = soup.find(sel[1])
            if content:
                print(f"    → Found via {sel[1]}")
                break

        if not content:
            content = soup.find('body') or soup

        # STOP keywords - these appear AFTER the workout
        STOP = ['book a drop', 'click here to pay', 'sign your waiver',
                'drop-in', 'pay now', 'book now', 'join now',
                'follow us', 'copyright', 'all rights reserved',
                'facebook.com', 'instagram.com', 'twitter.com',
                'address:', 'phone:', 'email:', '@crossfit']

        # Skip-only (don't stop, just skip these lines)
        SKIP = ['daily wod', 'workout of the day', 'crossfit postal']

        all_lines = [l.strip() for l in content.get_text(separator='\n').split('\n')
                     if l.strip() and len(l.strip()) > 2]

        workout_lines = []
        for line in all_lines:
            lo = line.lower()
            # Hard stop - we've hit footer/booking
            if any(s in lo for s in STOP):
                print(f"    → Stopped at: '{line[:50]}'")
                break
            # Skip nav words
            if len(line.split()) <= 1 and lo in ['home','about','contact','menu','search','login','shop','wod']:
                continue
            # Skip generic labels
            if lo in SKIP:
                continue
            workout_lines.append(line)

        # Keep first 40 lines only (the actual workout is short)
        workout_lines = workout_lines[:40]

        if not workout_lines:
            print(f"    → No workout lines found")
            return None

        sections = parse_sections(workout_lines)
        total_lines = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total_lines} lines")

        return {
            'date': date_str,
            'source': 'postal',
            'source_name': 'CrossFit Postal',
            'url': url,
            'sections': sections
        }

    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


# ==================== GREEN BEACH ====================

def fetch_greenbeach(date):
    """
    CrossFit Green Beach - Wix site, WOD loads via JavaScript.
    Cannot scrape static HTML - returns None.
    This is a known limitation until Selenium/Playwright is added.
    """
    print(f"    → Green Beach: Wix JS site - cannot scrape static HTML")
    return None


if __name__ == '__main__':
    print("Testing Postal...")
    r = fetch_postal(datetime.now())
    if r:
        print(f"✅ {len(r['sections'])} sections")
        for s in r['sections']:
            print(f"  [{s['title']}]: {s['lines'][:2]}")
    else:
        print("❌ Failed")
