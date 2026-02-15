"""
CrossFit Open Workouts - v19.1
FIXED: Better scraping from WodWell, 14-day rotation
"""
import re
import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
_OPEN_CACHE = None

def fetch_all_open():
    global _OPEN_CACHE
    if _OPEN_CACHE:
        return _OPEN_CACHE
    
    url = 'https://wodwell.com/wods/tag/crossfit-games-open-workouts/?sort=newest'
    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            return []
        
        soup = BeautifulSoup(r.text, 'html.parser')
        workouts = []
        
        # Remove scripts/styles
        for tag in soup.find_all(['script', 'style', 'img', 'picture', 'video', 'iframe']):
            tag.decompose()
        
        # Find workout containers - try multiple approaches
        containers = []
        
        # Try 1: h2/h3 headers with "Open" or "XX.X"
        for header in soup.find_all(['h2', 'h3', 'h4']):
            text = header.get_text(strip=True)
            if re.search(r'(open\s+)?\d{2}[.\s]\d', text, re.I):
                containers.append(header.parent)
        
        # Try 2: divs/articles with workout content
        if not containers:
            for elem in soup.find_all(['div', 'article', 'section']):
                text = elem.get_text(strip=True)
                if re.search(r'(open\s+)?\d{2}[.\s]\d', text, re.I) and len(text) > 50:
                    containers.append(elem)
        
        print(f"    → Found {len(containers)} potential workouts")
        
        for container in containers[:50]:
            text = container.get_text(separator='\n', strip=True)
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            
            if len(lines) < 3:
                continue
            
            # Find title line with Open pattern
            title = None
            workout_start = 0
            for i, line in enumerate(lines):
                if re.search(r'(open\s+)?\d{2}[.\s]\d', line, re.I):
                    title = line
                    workout_start = i + 1
                    break
            
            if not title:
                continue
            
            # Collect workout lines
            workout_lines = []
            for line in lines[workout_start:workout_start+25]:
                # Stop at standards/explanations
                if any(stop in line.lower() for stop in [
                    'movement standards', 'time cap', 'explanation', 'learn more',
                    'video', 'athlete performs', 'score by', 'leaderboard'
                ]):
                    break
                
                # Skip very long lines
                if len(line) > 120:
                    continue
                
                # Convert gender weights to notes
                if re.search(r'[♀♂].*\d+\s*(lb|kg)', line):
                    line = f"*{line}*"
                
                workout_lines.append(line)
            
            if len(workout_lines) >= 2:
                workouts.append({'name': title.strip(), 'lines': workout_lines})
        
        # Deduplicate
        seen = set()
        unique = []
        for w in workouts:
            key = w['name'].lower().replace(' ', '')
            if key not in seen:
                seen.add(key)
                unique.append(w)
        
        print(f"    → Parsed {len(unique)} unique Open workouts")
        _OPEN_CACHE = unique
        return unique
    except Exception as e:
        print(f"    → Error: {e}")
        return []

def fetch_open(date):
    date_str = date.strftime('%Y-%m-%d')
    workouts = fetch_all_open()
    if not workouts:
        print(f"    → No Open workouts available")
        return None
    
    # 14-day exclusion with MD5 hash
    date_hash = int(hashlib.md5(date_str.encode()).hexdigest(), 16)
    excluded = set()
    for days_ago in range(1, 15):
        past_date = date - timedelta(days=days_ago)
        past_str = past_date.strftime('%Y-%m-%d')
        past_hash = int(hashlib.md5(past_str.encode()).hexdigest(), 16)
        excluded.add(past_hash % len(workouts))
    
    # Find non-excluded workout
    idx = date_hash % len(workouts)
    attempts = 0
    while idx in excluded and attempts < len(workouts):
        idx = (idx + 1) % len(workouts)
        attempts += 1
    
    workout = workouts[idx]
    print(f"    → Selected: {workout['name']} (#{idx+1}/{len(workouts)})")
    
    return {
        'date': date_str,
        'source': 'open',
        'source_name': 'CrossFit Open Workouts',
        'url': 'https://wodwell.com/wods/tag/crossfit-games-open-workouts/',
        'sections': [{'title': workout['name'], 'lines': workout['lines']}],
        'note': f"Open: {workout['name']}"
    }

if __name__ == '__main__':
    result = fetch_open(datetime.now())
    if result:
        print(f"\n✅ {result['sections'][0]['title']}")
        for line in result['sections'][0]['lines'][:5]:
            print(f"  {line}")
