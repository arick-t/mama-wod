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
        
        # WodWell uses article/div cards for workouts
        # Try multiple selectors
        cards = []
        
        # Method 1: Find articles
        articles = soup.find_all('article')
        if articles:
            cards.extend(articles)
            print(f"    → Found {len(articles)} article tags")
        
        # Method 2: Find divs with workout-related classes
        if not cards:
            divs = soup.find_all('div', class_=re.compile(r'wod|workout|card|item', re.I))
            if divs:
                cards.extend(divs)
                print(f"    → Found {len(divs)} workout divs")
        
        for card in cards[:100]:  # Limit to first 100
            # Get text from card
            text = card.get_text(separator='\n', strip=True)
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            
            if len(lines) < 3:
                continue
            
            # Detect Open workout by title pattern
            # Patterns: "Open 24.3", "23.2", "23.2 A", "Open 24.3 Rx"
            title = None
            workout_lines = []
            
            for i, line in enumerate(lines):
                # Title pattern: starts with "Open" or just "XX.X"
                if re.search(r'\b(open\s+)?\d{2}[.\s]\d\b', line, re.I):
                    title = line
                    # Collect next 20 lines as workout
                    workout_lines = lines[i+1:i+21]
                    break
            
            if not title or len(workout_lines) < 2:
                continue
            
            # Clean workout lines
            clean_lines = []
            for line in workout_lines:
                # Stop at explanations/standards
                if any(stop in line.lower() for stop in [
                    'movement standards', 'time cap', 'explanation', 'learn more',
                    'video demonstration', 'watch', 'athlete performs',
                    'score by', 'leaderboard', 'submit score'
                ]):
                    break
                
                # Skip very long lines (descriptions)
                if len(line) > 120:
                    continue
                
                # Skip lines with lots of lowercase prose
                if len(line) > 50 and line[0].islower():
                    continue
                
                clean_lines.append(line)
                
                # Limit to 20 lines
                if len(clean_lines) >= 20:
                    break
            
            if len(clean_lines) >= 2:
                workouts.append({
                    'name': title.strip(),
                    'lines': clean_lines
                })
        
        # Remove duplicates (same name)
        seen = set()
        unique = []
        for w in workouts:
            name_key = w['name'].lower().replace(' ', '')
            if name_key not in seen:
                seen.add(name_key)
                unique.append(w)
        
        print(f"    → Parsed {len(unique)} unique Open workouts")
        _OPEN_CACHE = unique
        return unique
        
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
