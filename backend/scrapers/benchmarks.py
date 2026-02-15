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
            
            # Find all H2 headers (each workout is under an H2)
            h2_headers = soup.find_all('h2')
            
            for h2 in h2_headers:
                # Extract workout name from H2 - GET PLAIN TEXT ONLY
                h2_text = h2.get_text(strip=True)
                
                # Skip non-workout headers
                if 'workout' not in h2_text.lower() and 'benchmark' not in h2_text.lower():
                    continue
                
                # Extract clean name: remove quotes, "Benchmark", "Workout", links, markdown
                name = h2_text
                name = re.sub(r'\[([^\]]+)\]', r'\1', name)  # Remove markdown links [text]
                name = re.sub(r'\([^)]+\)', '', name)        # Remove (parentheses)
                name = re.sub(r'\s*-\s*benchmark.*', '', name, flags=re.I)  # Remove "- Benchmark"
                name = re.sub(r'\s*workout.*', '', name, flags=re.I)        # Remove "Workout"
                name = name.strip(' "')
                
                if len(name) < 2:
                    continue
                
                # Collect all content AFTER this H2 until next H2 or H3 (Resources)
                workout_lines = []
                current = h2.find_next_sibling()
                
                while current:
                    # Stop at next H2 (next workout) or H3 (Resources)
                    if current.name in ['h2', 'h3']:
                        break
                    
                    # Get PLAIN TEXT - no formatting
                    # Use get_text() with separator to handle line breaks
                    text = current.get_text(separator='\n', strip=True)
                    
                    if text:
                        # Split into lines
                        for line in text.split('\n'):
                            line = line.strip()
                            
                            # Fix encoding issues
                            line = line.replace('â\x80\x93', '–')
                            line = line.replace('â\x80\x94', '—')
                            line = line.replace('â\x80\x99', "'")
                            line = line.replace('â\x80\x9c', '"')
                            line = line.replace('â\x80\x9d', '"')
                            line = line.replace('â\x80¢', '•')
                            line = line.replace('â\x99\x80', '♀')
                            line = line.replace('â\x99\x82', '♂')
                            line = line.replace('â', '')
                            
                            # Skip empty or very short lines
                            if len(line) < 3:
                                continue
                            
                            # Skip navigation/footer
                            if any(skip in line.lower() for skip in [
                                'resources', 'speal does', 'annie does', 'crossfit tampere',
                                'mikko salo', 'froning does', 'josh everet', 'classic helen',
                                'power elizabeth', 'opt crushes', 'watch', 'video'
                            ]):
                                break
                            
                            workout_lines.append(line)
                            
                            # Limit to 30 lines
                            if len(workout_lines) >= 30:
                                break
                    
                    current = current.find_next_sibling()
                    
                    if len(workout_lines) >= 30:
                        break
                
                # Only add if we have actual workout content (at least 3 lines)
                if len(workout_lines) >= 3:
                    benchmarks.append({
                        'name': name,
                        'lines': workout_lines[:30]
                    })
                    print(f"    → Parsed '{name}': {len(workout_lines)} lines")
            
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
    
    # Process lines: convert gender weights to notes
    processed_lines = []
    for line in selected['lines']:
        # Check if line contains gender weight specification
        # Patterns: "♀ 55 lb", "♂ 75 lb", or both
        if re.search(r'[♀♂].*\d+\s*(lb|kg)', line):
            # Format as note (green text)
            processed_lines.append(f"*{line}*")
        else:
            processed_lines.append(line)
    
    # Build sections - TITLE IS THE WORKOUT NAME
    sections = [{
        'title': selected['name'],
        'lines': processed_lines  # ← Use processed lines
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
