"""
CrossFit Benchmark Workouts scraper - FIXED
Fetches from: https://www.wodconnect.com/workout_lists/benchmarks
FIXES:
- Title is now the workout name (not "BENCHMARK")
- Plain text only (no underlines/links)
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
            
            # Find all workout boxes (each is <li class="box">)
            boxes = soup.find_all('li', class_='box')
            print(f"    -> Found {len(boxes)} boxes on page {page}")
            
            for box in boxes:
                # Get name from <h2 class="name"> → <a>
                h2 = box.find('h2', class_='name')
                if not h2:
                    continue
                
                a_tag = h2.find('a')
                if not a_tag:
                    continue
                
                name = a_tag.get_text(strip=True).strip(' "')
                
                if len(name) < 2:
                    continue
                
                # Find workout_description → markdown_content
                workout_desc = box.find('div', class_='workout_description')
                if not workout_desc:
                    continue
                
                markdown_div = workout_desc.find('div', class_='markdown_content')
                if not markdown_div:
                    continue
                
                workout_lines = []
                
                # Process all paragraphs
                for p in markdown_div.find_all('p'):
                    # Replace <br> with newlines
                    for br in p.find_all('br'):
                        br.replace_with('\n')
                    
                    # Get text - links inline!
                    text = p.get_text()
                    
                    # Split by newlines
                    for line in text.split('\n'):
                        line = line.strip()
                        
                        # Skip empty
                        if len(line) < 2:
                            continue
                        
                        workout_lines.append(line)
                
                # Only add if we have content
                if len(workout_lines) >= 3:
                    benchmarks.append({
                        'name': name,
                        'lines': workout_lines[:30]
                    })
                    print(f"    -> Parsed '{name}': {len(workout_lines)} lines")
            
        print(f"    → Total parsed: {len(benchmarks)} benchmark workouts")
        _BENCHMARK_CACHE = benchmarks
        return benchmarks
        
    except Exception as e:
        print(f"    → Error: {e}")
        import traceback
        traceback.print_exc()
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
    
    # Convert gender weights to notes
    processed_lines = []
    for line in selected['lines']:
        # Check for gender weight pattern: ♀ 55 lb or ♂ 75 lb
        if re.search(r'[♀♂].*\d+\s*(lb|kg)', line):
            processed_lines.append(f"*{line}*")
        else:
            processed_lines.append(line)
    
    # Build sections - TITLE IS THE WORKOUT NAME
    sections = [{
        'title': selected['name'],
        'lines': processed_lines
    }]
    
    return {
        'date':        date_str,
        'source':      'benchmark',
        'source_name': 'CrossFit Benchmark Workouts',
        'url':         'https://www.wodconnect.com/workout_lists/benchmarks',
        'sections':    sections,
        'note':        f"Benchmark: {selected['name']}"
    }


if __name__ == '__main__':
    # Test
    result = fetch_benchmark(datetime.now())
    if result:
        print(f"\n✅ Success!")
        print(f"Title: {result['sections'][0]['title']}")
        print(f"Lines: {len(result['sections'][0]['lines'])}")
        for line in result['sections'][0]['lines'][:5]:
            print(f"  {line}")
    else:
        print("❌ Failed")
