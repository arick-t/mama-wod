"""
CrossFit Hero Workouts Scraper
Fetches from https://www.crossfit.com/heroes
"""
import re
import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

_HERO_CACHE = None


def fetch_all_heroes():
    """Fetch all hero workouts once and cache them."""
    global _HERO_CACHE
    if _HERO_CACHE:
        return _HERO_CACHE
    
    url = 'https://www.crossfit.com/heroes'
    try:
        print(f"    → Fetching {url}")
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code != 200:
            print(f"    → HTTP {r.status_code}")
            return []
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Remove scripts, styles, images
        for tag in soup.find_all(['script', 'style', 'img', 'picture']):
            tag.decompose()
        
        text = soup.get_text(separator='\n')
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        
        # Parse: Each workout = short title + workout description
        heroes = []
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Skip navigation/footer junk
            if any(skip in line.lower() for skip in [
                'newsletter', 'facebook', 'instagram', 'find a gym',
                'privacy', 'copyright', 'crossfit games', 'skip to'
            ]):
                i += 1
                continue
            
            # Detect workout name: short (< 25 chars), no colons, not all lowercase
            if len(line) < 25 and ':' not in line and not line.islower() and len(line) > 2:
                name = line
                workout_lines = []
                
                # Collect workout lines until next name or end
                i += 1
                while i < len(lines):
                    next_line = lines[i]
                    
                    # Stop at next workout name or footer
                    if len(next_line) < 25 and ':' not in next_line and not next_line.islower():
                        break
                    if any(stop in next_line.lower() for stop in ['share this', 'posted by', 'learn more about']):
                        break
                    
                    # Stop at image captions or memorial text
                    if 'fallen' in next_line.lower() or 'killed in action' in next_line.lower():
                        break
                    
                    workout_lines.append(next_line)
                    i += 1
                    
                    # Limit to 15 lines per workout
                    if len(workout_lines) >= 15:
                        break
                
                if len(workout_lines) >= 2:  # Valid workout has at least 2 lines
                    heroes.append({
                        'name': name,
                        'lines': workout_lines[:15]
                    })
            else:
                i += 1
        
        print(f"    → Parsed {len(heroes)} hero workouts")
        _HERO_CACHE = heroes
        return heroes
        
    except Exception as e:
        print(f"    → Error: {e}")
        return []


def fetch_hero(date):
    """
    Get a hero workout for a specific date.
    Uses deterministic hashing to ensure same workout for same date.
    Avoids repeating within 14 days.
    """
    date_str = date.strftime('%Y-%m-%d')
    print(f"  ⬇ CrossFit Hero Workouts...")
    
    heroes = fetch_all_heroes()
    if not heroes:
        print(f"    → No heroes available")
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
        excluded_idx = past_hash % len(heroes)
        excluded_indices.add(excluded_idx)
    
    # Find first non-excluded index
    base_idx = date_hash % len(heroes)
    chosen_idx = base_idx
    attempts = 0
    while chosen_idx in excluded_indices and attempts < len(heroes):
        chosen_idx = (chosen_idx + 1) % len(heroes)
        attempts += 1
    
    hero = heroes[chosen_idx]
    print(f"    → Selected: {hero['name']} (#{chosen_idx + 1}/{len(heroes)})")
    
    return {
        'date': date_str,
        'source': 'hero',
        'source_name': 'CrossFit Hero Workouts',
        'sections': [{
            'title': hero['name'],
            'lines': hero['lines']
        }]
    }
