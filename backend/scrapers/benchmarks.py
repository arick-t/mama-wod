"""
CrossFit Benchmark Workouts scraper

Fetches from: https://www.wodconnect.com/workout_lists/benchmarks
Strategy: Same as Heroes - deterministic daily selection, no repeats within 14 days
"""
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
}

_BENCHMARK_CACHE = None


def fetch_all_benchmarks():
    """
    Fetch all benchmark workouts from wodconnect.
    Returns: list of {name, lines}
    """
    global _BENCHMARK_CACHE
    if _BENCHMARK_CACHE is not None:
        return _BENCHMARK_CACHE
    
    try:
        benchmarks = []
        
        # Fetch all pages (1-4 based on site structure)
        for page in range(1, 5):
            url = f'https://www.wodconnect.com/workout_lists/benchmarks'
            if page > 1:
                url += f'?page={page}'
            
            print(f"    → Fetching page {page}: {url}")
            r = requests.get(url, timeout=15, headers=HEADERS)
            if r.status_code != 200:
                print(f"    → Page {page} HTTP {r.status_code}")
                continue
            
            soup = BeautifulSoup(r.text, 'html.parser')
            
            # Remove noise
            for tag in soup.find_all(['script', 'style', 'img', 'picture', 'video', 'iframe']):
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
            
            # Parse: Each workout = name (short, uppercase) + workout description
            i = 0
            while i < len(lines):
                line = lines[i]
                
                # Skip navigation/footer junk
                if any(skip in line.lower() for skip in [
                    'wodconnect', 'sign up', 'log in', 'privacy', 'terms',
                    'download', 'blog', 'athletes', 'coaches', 'gyms',
                    'programs', 'kisko labs', 'crossfit ®', 'resources',
                    'prev', 'next', 'fill in your details'
                ]):
                    i += 1
                    continue
                
                # Detect workout name: quoted uppercase names or specific patterns
                # Examples: "ANNIE", "FRAN", "Grace", "Helen", "Isabel"
                if (len(line) < 30 and 
                    (line.isupper() or line[0].isupper()) and
                    'workout' in line.lower() and
                    len(line.split()) <= 4):
                    
                    # Extract clean name (remove "BENCHMARK", "- Benchmark", etc)
                    name = re.sub(r'\s*[-–]\s*benchmark.*', '', line, flags=re.I)
                    name = re.sub(r'\s*workout.*', '', name, flags=re.I)
                    name = name.strip(' "')
                    
                    workout_lines = []
                    i += 1
                    
                    # Collect workout lines until next workout or footer
                    while i < len(lines):
                        next_line = lines[i]
                        
                        # Stop at next workout name
                        if (len(next_line) < 30 and 
                            next_line[0].isupper() and 
                            'workout' in next_line.lower()):
                            break
                        
                        # Stop at Resources section or other metadata
                        if any(stop in next_line.lower() for stop in [
                            'resources', 'scaling options', 'intermediate:',
                            'beginner:', 'time cap', 'please run the same'
                        ]):
                            break
                        
                        # Skip very short lines (likely navigation)
                        if len(next_line) < 3:
                            i += 1
                            continue
                        
                        workout_lines.append(next_line)
                        i += 1
                        
                        # Limit to 25 lines per workout
                        if len(workout_lines) >= 25:
                            break
                    
                    if len(workout_lines) >= 2 and len(name) >= 3:
                        benchmarks.append({
                            'name': name,
                            'lines': workout_lines[:25]
                        })
                else:
                    i += 1
        
        print(f"    → Parsed {len(benchmarks)} benchmark workouts")
        _BENCHMARK_CACHE = benchmarks
        return benchmarks
        
    except Exception as e:
        print(f"    → Error: {e}")
        return []


def fetch_benchmark(date):
    """
    Get a benchmark workout for a specific date.
    Uses deterministic hashing to ensure same workout for same date.
    Avoids repeating within 14 days.
    """
    date_str = date.strftime('%Y-%m-%d')
    print(f"  ⬇ CrossFit Benchmark Workouts...")
    
    benchmarks = fetch_all_benchmarks()
    if not benchmarks:
        print(f"    → No benchmarks available")
        return None
    
    # Deterministic selection based on date hash
    date_hash = hash(date_str)
    
    # Get dates for the past 14 days to avoid repeats
    past_dates = [(date - timedelta(days=i)).strftime('%Y-%m-%d') 
                  for i in range(1, 14)]
    past_hashes = [hash(d) for d in past_dates]
    
    # Find benchmark that wasn't used in past 14 days
    candidates = []
    for idx, benchmark in enumerate(benchmarks):
        if all(hash(d) % len(benchmarks) != idx for d in past_dates):
            candidates.append((idx, benchmark))
    
    # If all were used recently, just use any
    if not candidates:
        candidates = [(i, b) for i, b in enumerate(benchmarks)]
    
    # Select deterministically
    selected_idx = abs(date_hash) % len(candidates)
    idx, selected = candidates[selected_idx]
    
    print(f"    → Selected: {selected['name']} (#{idx+1}/{len(benchmarks)})")
    
    # Build sections
    sections = [{
        'title': 'BENCHMARK',
        'lines': selected['lines']
    }]
    
    return {
        'date':        date_str,
        'source':      'benchmark',
        'source_name': 'CrossFit Benchmark Workouts',
        'url':         'https://www.wodconnect.com/workout_lists/benchmarks',
        'sections':    sections,
        'note':        f"Benchmark: {selected['name']}"
    }
