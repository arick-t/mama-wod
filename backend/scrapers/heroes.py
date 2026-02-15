"""
CrossFit Hero Workouts Scraper - FIXED
Fetches from https://www.crossfit.com/heroes
Better parsing to avoid cutting workouts short
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
        lines = []
        for l in text.split('\n'):
            l = l.strip()
            if not l:
                continue
            # Fix encoding issues
            l = l.replace('â\x80\x93', '–')
            l = l.replace('â\x80\x94', '—')
            l = l.replace('â\x80\x99', "'")
            l = l.replace('â\x80\x9c', '"')
            l = l.replace('â\x80\x9d', '"')
            l = l.replace('â\x80¢', '•')
            l = l.replace('â\x99\x80', '♀')
            l = l.replace('â\x99\x82', '♂')
            l = l.replace('â', '')
            lines.append(l)
        
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
            
            # Detect workout name: short (< 30 chars), ALL CAPS or Title Case, no colons
            is_title = (
                len(line) < 30 and 
                len(line) > 2 and 
                ':' not in line and
                not line.islower() and
                (line.isupper() or line.istitle()) and
                not any(c.isdigit() for c in line[:3])  # First 3 chars shouldn't have numbers
            )
            
            if is_title:
                name = line
                workout_lines = []
                
                # Collect workout lines until next name or memorial text
                i += 1
                while i < len(lines):
                    next_line = lines[i]
                    
                    # Stop at memorial/biographical text
                    memorial_keywords = [
                        'killed in action', 'died', 'fallen', 'survived by', 'is survived',
                        'afghanistan', 'iraq', 'operation', 'combat', 'enemy', 'explosive device',
                        'was a member of', 'graduate of', 'air force', 'navy seal', 'marine',
                        'u.s. army', 'special forces', 'year-old', 'years old', 'born in',
                        'native of', 'deployed to', 'assigned to'
                    ]
                    if any(keyword in next_line.lower() for keyword in memorial_keywords):
                        print(f"    → Stopped at memorial text: {next_line[:50]}")
                        break
                    
                    # Stop at next workout name (same criteria as title detection)
                    next_is_title = (
                        len(next_line) < 30 and 
                        len(next_line) > 2 and 
                        ':' not in next_line and
                        not next_line.islower() and
                        (next_line.isupper() or next_line.istitle()) and
                        not any(c.isdigit() for c in next_line[:3])
                    )
                    if next_is_title:
                        break
                    
                    # Stop at footer
                    if any(stop in next_line.lower() for stop in ['share this', 'posted by', 'learn more about']):
                        break
                    
                    # Add line to workout
                    workout_lines.append(next_line)
                    i += 1
                    
                    # Limit to 25 lines per workout (more generous)
                    if len(workout_lines) >= 25:
                        break
                
                # Valid workout: has at least 3 lines (more strict)
                if len(workout_lines) >= 3:
                    heroes.append({
                        'name': name,
                        'lines': workout_lines[:25]
                    })
                    print(f"    → Parsed '{name}': {len(workout_lines)} lines")
            else:
                i += 1
        
        print(f"    → Total parsed: {len(heroes)} hero workouts")
        _HERO_CACHE = heroes
        return heroes
        
    except Exception as e:
        print(f"    → Error: {e}")
        import traceback
        traceback.print_exc()
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


if __name__ == '__main__':
    # Test
    result = fetch_hero(datetime.now())
    if result:
        print(f"\n✅ Success!")
        print(f"Title: {result['sections'][0]['title']}")
        print(f"Lines: {len(result['sections'][0]['lines'])}")
        for line in result['sections'][0]['lines'][:5]:
            print(f"  {line}")
    else:
        print("❌ Failed")
