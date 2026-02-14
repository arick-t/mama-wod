"""
CrossFit Open Workouts Scraper
Fetches from https://wodwell.com/wods/tag/crossfit-games-all-stages-workouts/
"""
import re
import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

_OPEN_CACHE = None


def fetch_all_open():
    """Fetch all Open workouts once and cache them."""
    global _OPEN_CACHE
    if _OPEN_CACHE:
        return _OPEN_CACHE
    
    url = 'https://wodwell.com/wods/tag/crossfit-games-all-stages-workouts/?sort=newest'
    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return []
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Find all workout cards
        workouts = []
        
        # WodWell uses article tags or divs with workout content
        cards = soup.find_all(['article', 'div'], class_=re.compile(r'wod|workout', re.I))
        
        if not cards:
            # Fallback: find by structure
            cards = soup.find_all('div', class_=re.compile(r'card|item|post', re.I))
        
        for card in cards[:50]:  # Limit to first 50
            # Remove images, videos
            for tag in card.find_all(['img', 'picture', 'video', 'iframe']):
                tag.decompose()
            
            text = card.get_text(separator='\n')
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            
            if len(lines) < 3:
                continue
            
            # Detect Open workout by title pattern (e.g., "Open 24.3", "23.2 A")
            title = None
            workout_lines = []
            
            for i, line in enumerate(lines):
                # Title pattern: "Open XX.X" or "XX.X" or "XX.X A/B"
                if re.search(r'\b(open\s+)?\d{2}[.\s]\d\b', line, re.I):
                    title = line
                    # Collect next 15 lines as workout
                    workout_lines = lines[i+1:i+16]
                    break
            
            if not title or len(workout_lines) < 2:
                continue
            
            # Clean workout lines - remove explanations/standards
            clean_lines = []
            for line in workout_lines:
                # Stop at explanations
                if any(stop in line.lower() for stop in [
                    'movement standards', 'time cap explanation', 'learn more',
                    'video', 'watch', 'athlete', 'score', 'leaderboard'
                ]):
                    break
                
                # Skip very long lines (likely descriptions)
                if len(line) > 100:
                    continue
                
                clean_lines.append(line)
                
                # Stop if we have enough
                if len(clean_lines) >= 15:
                    break
            
            if len(clean_lines) >= 2:
                workouts.append({
                    'name': title.strip(),
                    'lines': clean_lines
                })
        
        print(f"    → Parsed {len(workouts)} Open workouts")
        _OPEN_CACHE = workouts
        return workouts
        
    except Exception as e:
        print(f"    → Error: {e}")
        return []


def fetch_open(date):
    """
    Get an Open workout for a specific date.
    Uses deterministic hashing to ensure same workout for same date.
    Avoids repeating within 14 days.
    """
    date_str = date.strftime('%Y-%m-%d')
    print(f"  ⬇ CrossFit Open Workouts...")
    
    opens = fetch_all_open()
    if not opens:
        print(f"    → No Open workouts available")
        return None
    
    # Use date hash to pick workout deterministically
    date_hash = int(hashlib.md5(date_str.encode()).hexdigest(), 16)
    
    # Create exclusion window (past 14 days)
    excluded_indices = set()
    for days_ago in range(1, 15):
        from datetime import timedelta
        past_date = date - timedelta(days=days_ago)
        past_str = past_date.strftime('%Y-%m-%d')
        past_hash = int(hashlib.md5(past_str.encode()).hexdigest(), 16)
        excluded_idx = past_hash % len(opens)
        excluded_indices.add(excluded_idx)
    
    # Find first non-excluded index
    base_idx = date_hash % len(opens)
    chosen_idx = base_idx
    attempts = 0
    while chosen_idx in excluded_indices and attempts < len(opens):
        chosen_idx = (chosen_idx + 1) % len(opens)
        attempts += 1
    
    openwod = opens[chosen_idx]
    print(f"    → Selected: {openwod['name']} (#{chosen_idx + 1}/{len(opens)})")
    
    return {
        'date': date_str,
        'source': 'open',
        'source_name': 'CrossFit Open Workouts',
        'sections': [{
            'title': openwod['name'],
            'lines': openwod['lines']
        }]
    }
