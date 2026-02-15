"""
CrossFit Ton Bridge - v19.1
FIX: Excludes separator line (By NAME|DATE)
"""
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

SECTION_HINTS = ['warm', 'strength', 'skill', 'wod', 'metcon', 'conditioning',
                 'amrap', 'emom', 'for time', 'tabata']

def parse_sections(lines):
    sections, cur = [], {'title': 'WORKOUT', 'lines': []}
    for line in lines:
        lo = line.lower()
        is_hdr = (line.isupper() and 3 <= len(line) <= 60 and not re.search(r'\d', line)) or \
                 (any(kw in lo for kw in SECTION_HINTS) and len(line) < 60 and 
                  not re.search(r'\d+\s*(min|rep|round|x\b)', lo))
        if is_hdr:
            if cur['lines']:
                sections.append(cur)
            # Normalize section titles
            title = line.upper().strip()
            if 'MET CON' in title or 'METCON' in title:
                title = 'METCON'
            elif 'STRENGTH' in title:
                title = 'STRENGTH'
            cur = {'title': title, 'lines': []}
        else:
            cur['lines'].append(line)
    if cur['lines']:
        sections.append(cur)
    return sections or [{'title': 'WORKOUT', 'lines': lines}]

def fetch_workout(date):
    date_str = date.strftime('%Y-%m-%d')
    url = "https://crossfittonbridge.co.uk/wod/"
    
    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            return None
        
        soup = BeautifulSoup(r.text, 'html.parser')
        for tag in soup.find_all(['script', 'style', 'iframe', 'noscript', 'form', 'img', 'picture', 'figure']):
            tag.decompose()
        
        raw_lines = [l.strip() for l in soup.get_text(separator='\n').split('\n') 
                     if l.strip() and len(l.strip()) > 1]
        
        # Build date patterns
        target_day = date.day
        target_month = date.strftime('%B')
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(target_day % 10 if target_day % 100 not in [11,12,13] else 0, 'th')
        target_pattern = f"{target_day}{suffix} {target_month}"
        day_name = date.strftime('%A')
        full_pattern = f"{day_name} {target_pattern}"
        
        print(f"    → Looking for: '{target_pattern}'")
        
        # Find workout title
        start_idx = None
        for i, line in enumerate(raw_lines):
            if target_pattern.lower() in line.lower() or full_pattern.lower() in line.lower():
                start_idx = i + 1
                print(f"    → Found at line {i}: '{line}'")
                break
        
        if start_idx is None:
            print(f"    → Date not found")
            return None
        
        # Calculate next date for separator
        next_date = date + timedelta(days=1)
        next_day = next_date.day
        next_month = next_date.strftime('%B')
        next_suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(next_day % 10 if next_day % 100 not in [11,12,13] else 0, 'th')
        next_pattern = f"{next_month} {next_day}{next_suffix}"
        
        # Collect workout lines
        workout_lines = []
        for line in raw_lines[start_idx:]:
            lo = line.lower().strip()
            
            # STOP at separator line (By NAME|NEXT_DATE)
            if '|' in line and next_pattern.lower() in lo:
                print(f"    → Stopped at separator: '{line[:50]}'")
                break
            
            # STOP at next date header
            date_header_pattern = r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+\d{1,2}(st|nd|rd|th)\s+(january|february|march|april|may|june|july|august|september|october|november|december)'
            if re.search(date_header_pattern, lo):
                print(f"    → Stopped at next workout")
                break
            
            # Skip navigation
            if any(skip in lo for skip in ['home', 'about', 'contact', 'schedule', 'coaches', 
                                            'blog', 'shop', 'login', 'register']):
                continue
            
            if len(line) > 200:
                continue
            
            workout_lines.append(line)
            if len(workout_lines) >= 60:
                break
        
        if not workout_lines:
            return None
        
        sections = parse_sections(workout_lines)
        total = sum(len(s['lines']) for s in sections)
        print(f"    → SUCCESS: {len(sections)} sections, {total} lines")
        
        return {
            'date': date_str,
            'source': 'tonbridge',
            'source_name': 'CrossFit Ton Bridge',
            'url': url,
            'sections': sections
        }
    except Exception as e:
        print(f"    → Error: {e}")
        return None

if __name__ == '__main__':
    result = fetch_workout(datetime.now())
    if result:
        print("\n✅ Success!")
        for s in result['sections']:
            print(f"[{s['title']}]: {len(s['lines'])} lines")
