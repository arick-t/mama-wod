"""
myleo.de Scraper - VERIFIED WORKING
Tested against actual site structure
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re


def fetch_workout(date):
    """Fetch workout for specific date from myleo.de"""
    date_str = date.strftime('%Y-%m-%d')
    url = f'https://myleo.de/en/wods/{date_str}/'
    
    try:
        print(f"    → Fetching {url}")
        response = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        if response.status_code == 404:
            print(f"    → 404 Not Found (no workout for this date)")
            return None
        
        if response.status_code != 200:
            print(f"    → Status {response.status_code}")
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove noise
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'img', 'figure', 'iframe']):
            tag.decompose()
        
        # Try multiple selectors
        content = None
        
        # Method 1: entry-content div
        entry = soup.find('div', class_='entry-content')
        if entry:
            content = entry
            print(f"    → Found via .entry-content")
        
        # Method 2: article tag
        if not content:
            article = soup.find('article')
            if article:
                # Remove sidebars, meta
                for unwanted in article.find_all(class_=['sidebar', 'meta', 'post-navigation', 'comments']):
                    unwanted.decompose()
                content = article
                print(f"    → Found via article")
        
        # Method 3: main tag
        if not content:
            main = soup.find('main')
            if main:
                content = main
                print(f"    → Found via main")
        
        if not content:
            print(f"    → No content container found")
            return None
        
        # Extract text
        raw_text = content.get_text(separator='\n', strip=True)
        
        if len(raw_text) < 50:
            print(f"    → Content too short ({len(raw_text)} chars)")
            return None
        
        # Block header: after such a line we inject a blank for spacing (site often has no \n\n)
        def is_block_header(txt):
            if not txt or len(txt) < 2:
                return False
            t = txt.strip().lower()
            if t.endswith(':'):
                return True
            if t in ('for time', 'amrap', 'emom', 'buy-in', 'cash-out'):
                return True
            if re.match(r'^\d+\s*(rounds?|min(?:ute)?s?)', t):
                return True
            return False

        def is_sub_title_line(txt):
            """תת כותרת: שורה שמתחילה ב־amrap/AMRAP, או מכילה rounds, או מתחילה ב־for time."""
            if not txt or len(txt) < 2:
                return False
            t = txt.strip()
            lo = t.lower()
            if lo.startswith('amrap') or lo.startswith('for time'):
                return True
            if 'rounds' in lo:
                return True
            return False

        def is_note_line(txt):
            """הערה: barbell, rx+, remaining time, pick up where, rest between, score, aerobic/muscular."""
            if not txt or len(txt) > 200:
                return False
            lo = txt.strip().lower()
            if 'score:' in lo or 'aerobic power' in lo or 'vo2 max' in lo or 'muscular endurance' in lo:
                return True
            if re.search(r'barbell\s*:', lo) or 'rx+' in lo or 'rx:' in lo:
                return True
            if 'remaining time' in lo or 'pick up where' in lo or re.search(r'rest\s+\d+.*between', lo):
                return True
            return False

        # From "score:" onwards, all lines are scoring/description → show as notes (whole source)
        score_zone = False

        # Parse into sections; preserve blank lines so layout matches the site (spacing between blocks)
        sections = []
        current_section = None
        skip_keywords = ['weekly overview', 'post your score', 'compare to', 'skill class',
                         'cookie', 'privacy', 'login', 'register', 'subscribe']

        for line in raw_text.split('\n'):
            stripped = line.strip()
            # Blank line: keep as empty string for visual spacing
            if not stripped or len(stripped) < 2:
                if current_section is not None:
                    current_section['lines'].append('')
                continue

            # Skip junk
            lower = stripped.lower()
            if any(skip in lower for skip in skip_keywords):
                continue

            # From "score:" onward → notes (scoring method + stimulus type)
            if 'score:' in lower:
                score_zone = True
            is_note = score_zone or is_note_line(stripped)
            line_to_append = ('* ' + stripped) if is_note else stripped

            # Section header pattern: a), b), c), d)...
            match = re.match(r'^([a-z])\)\s*(.+)', stripped, re.IGNORECASE)
            if match:
                if current_section and (current_section['lines'] or current_section.get('sub_title')):
                    sections.append(current_section)
                title = match.group(2).strip()
                current_section = {'title': title.upper(), 'lines': []}
            elif current_section is not None:
                # תת כותרת: שורה ראשונה שמתאימה → sub_title, לא מוסיפים ל־lines
                if is_sub_title_line(stripped) and current_section.get('sub_title') is None:
                    current_section['sub_title'] = stripped
                    continue
                lines_list = current_section['lines']
                # Inject spacer after block headers when the page has no blank lines
                if lines_list and is_block_header(lines_list[-1]):
                    lines_list.append('')
                current_section['lines'].append(line_to_append)
            else:
                current_section = {'title': 'WORKOUT', 'lines': []}
                if is_sub_title_line(stripped):
                    current_section['sub_title'] = stripped
                else:
                    current_section['lines'].append(line_to_append)

        if current_section and current_section['lines']:
            sections.append(current_section)
        
        if not sections:
            print(f"    → No sections parsed")
            return None
        
        print(f"    → SUCCESS: {len(sections)} sections found")
        
        return {
            'date': date_str,
            'source': 'myleo',
            'source_name': 'myleo CrossFit',
            'url': url,
            'sections': sections
        }
        
    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except requests.RequestException as e:
        print(f"    → Network error: {e}")
        return None
    except Exception as e:
        print(f"    → Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    # Test
    print("Testing myleo scraper...")
    result = fetch_workout(datetime.now())
    if result:
        print(f"✅ Success! {len(result['sections'])} sections")
        for s in result['sections'][:2]:
            print(f"  [{s['title']}] {len(s['lines'])} lines")
    else:
        print("❌ Failed")
