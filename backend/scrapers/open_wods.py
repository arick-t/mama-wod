"""
CrossFit Open Workouts Scraper - RE-ENABLED
Fetches from https://wodwell.com/wods/tag/crossfit-games-open-workouts/?sort=newest
Uses deterministic selection like Heroes/Benchmarks
"""
import re
import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

_OPEN_CACHE = None


def fetch_all_open():
    """Fetch all Open workouts once and cache them."""
    global _OPEN_CACHE
    if _OPEN_CACHE:
        return _OPEN_CACHE
    
    url = 'https://wodwell.com/wods/tag/crossfit-games-open-workouts/?sort=newest'
    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return []
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Remove noise
        for tag in soup.find_all(['script', 'style', 'img', 'picture', 'video', 'iframe']):
            tag.decompose()
        
        workouts = []
        seen_titles = set()
        
        # Find all headers (h1-h4) that might contain Open workout titles
        for header in soup.find_all(['h1', 'h2', 'h3', 'h4']):
            text = header.get_text(strip=True)
            
            # Check if title matches Open pattern: "24.3", "Open 23.2", etc.
            if not re.search(r'(open\s+)?\d{2}[.\s]\d', text, re.I):
                continue
            
            title = text.strip()
            title_key = title.lower().replace(' ', '')
            
            if title_key in seen_titles or len(title) < 3:
                continue
            seen_titles.add(title_key)
            
            # Find parent container (article, div, section)
            container = header.find_parent(['article', 'div', 'section'])
            if not container:
                container = header
            
            # Collect workout lines from container text
            full_text = container.get_text(separator='\n', strip=True)
            lines = [l.strip() for l in full_text.split('\n') if l.strip()]
            
            # Find title position and get lines after it
            workout_lines = []
            found_title = False
            for line in lines:
                if title.lower() in line.lower():
                    found_title = True
                    continue
                
                if not found_title:
                    continue
                
                # Stop at explanations
                if any(stop in line.lower() for stop in [
                    'movement standards', 'time cap', 'how do you', 'score by',
                    'leaderboard', 'video', 'athlete performs', 'learn more'
                ]):
                    break
                
                # Skip very long lines or prose
                if len(line) > 150 or (len(line) > 50 and line[0].islower()):
                    continue
                
                # Convert gender weights to notes
                if re.search(r'[♀♂].*\d+\s*(lb|kg)', line):
                    line = f"*{line}*"
                
                workout_lines.append(line)
                
                if len(workout_lines) >= 20:
                    break
            
            if len(workout_lines) >= 2:
                workouts.append({
                    'name': title,
                    'lines': workout_lines
                })
        
        print(f"    → Parsed {len(workouts)} unique Open workouts")
        _OPEN_CACHE = workouts
        return workouts
        
    except Exception as e:
        print(f"    → Error: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_open(date):
    """
    Get an Open workout for a specific date.
    Uses deterministic hashing like Heroes/Benchmarks.
    """
    date_str = date.strftime('%Y-%m-%d')
    print(f"  ⬇ CrossFit Open Workouts...")
    
    workouts = fetch_all_open()
    if not workouts:
        print(f"    → No Open workouts available")
        return None
    
    # Use date hash for deterministic selection
    date_hash = int(hashlib.md5(date_str.encode()).hexdigest(), 16)
    
    # Create exclusion window (past 14 days)
    excluded_indices = set()
    for days_ago in range(1, 15):
        past_date = date - timedelta(days=days_ago)
        past_str = past_date.strftime('%Y-%m-%d')
        past_hash = int(hashlib.md5(past_str.encode()).hexdigest(), 16)
        excluded_idx = past_hash % len(workouts)
        excluded_indices.add(excluded_idx)
    
    # Find first non-excluded index
    base_idx = date_hash % len(workouts)
    chosen_idx = base_idx
    attempts = 0
    while chosen_idx in excluded_indices and attempts < len(workouts):
        chosen_idx = (chosen_idx + 1) % len(workouts)
        attempts += 1
    
    workout = workouts[chosen_idx]
    print(f"    → Selected: {workout['name']} (#{chosen_idx + 1}/{len(workouts)})")
    
    return {
        'date': date_str,
        'source': 'open',
        'source_name': 'CrossFit Open Workouts',
        'url': 'https://wodwell.com/wods/tag/crossfit-games-open-workouts/',
        'sections': [{
            'title': workout['name'],
            'lines': workout['lines']
        }],
        'note': f"Open: {workout['name']}"
    }


if __name__ == '__main__':
    # Test
    result = fetch_open(datetime.now())
    if result:
        print(f"\n✅ Success!")
        print(f"Title: {result['sections'][0]['title']}")
        print(f"Lines: {len(result['sections'][0]['lines'])}")
        for line in result['sections'][0]['lines'][:5]:
            print(f"  {line}")
    else:
        print("❌ Failed")
