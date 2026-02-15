"""
CrossFit Benchmark Workouts scraper - v19.1
FIXES: Better text extraction, gender weights as notes, 14-day rotation
"""
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
_BENCHMARK_CACHE = None

def fetch_all_benchmarks():
    global _BENCHMARK_CACHE
    if _BENCHMARK_CACHE is not None:
        return _BENCHMARK_CACHE
    
    try:
        benchmarks = []
        for page in range(1, 5):
            url = f'https://www.wodconnect.com/workout_lists/benchmarks'
            if page > 1:
                url += f'?page={page}'
            
            print(f"    → Fetching page {page}")
            r = requests.get(url, timeout=15, headers=HEADERS)
            if r.status_code != 200:
                continue
            
            soup = BeautifulSoup(r.text, 'html.parser')
            for tag in soup.find_all(['script', 'style', 'img', 'picture', 'video', 'iframe']):
                tag.decompose()
            
            for h2 in soup.find_all('h2'):
                h2_text = h2.get_text(strip=True)
                if 'workout' not in h2_text.lower() and 'benchmark' not in h2_text.lower():
                    continue
                
                name = re.sub(r'\[.*?\]|\(.*?\)|benchmark|workout', '', h2_text, flags=re.I).strip(' "')
                if len(name) < 2:
                    continue
                
                lines = []
                current = h2.find_next_sibling()
                while current and current.name not in ['h2', 'h3']:
                    text = current.get_text(separator=' ', strip=True)
                    if text and len(text) > 2:
                        # Split by common delimiters
                        for line in re.split(r'[\n\r]+', text):
                            line = line.strip()
                            if len(line) < 3:
                                continue
                            if any(s in line.lower() for s in ['resources', 'video', 'watch']):
                                break
                            lines.append(line)
                    current = current.find_next_sibling()
                    if len(lines) >= 25:
                        break
                
                if len(lines) >= 3:
                    benchmarks.append({'name': name, 'lines': lines[:25]})
        
        print(f"    → Parsed {len(benchmarks)} benchmarks")
        _BENCHMARK_CACHE = benchmarks
        return benchmarks
    except Exception as e:
        print(f"    → Error: {e}")
        return []

def fetch_benchmark(date):
    date_str = date.strftime('%Y-%m-%d')
    benchmarks = fetch_all_benchmarks()
    if not benchmarks:
        return None
    
    # 14-day exclusion
    excluded = set()
    for days_ago in range(1, 15):
        past_date = date - timedelta(days=days_ago)
        past_hash = hash(past_date.strftime('%Y-%m-%d'))
        excluded.add(abs(past_hash) % len(benchmarks))
    
    date_hash = hash(date_str)
    idx = abs(date_hash) % len(benchmarks)
    attempts = 0
    while idx in excluded and attempts < len(benchmarks):
        idx = (idx + 1) % len(benchmarks)
        attempts += 1
    
    selected = benchmarks[idx]
    print(f"    → Selected: {selected['name']} (#{idx+1}/{len(benchmarks)})")
    
    # Convert gender weights to notes
    processed = []
    for line in selected['lines']:
        if re.search(r'[♀♂].*\d+\s*(lb|kg)', line):
            processed.append(f"*{line}*")
        else:
            processed.append(line)
    
    return {
        'date': date_str,
        'source': 'benchmark',
        'source_name': 'CrossFit Benchmark Workouts',
        'url': 'https://www.wodconnect.com/workout_lists/benchmarks',
        'sections': [{'title': selected['name'], 'lines': processed}],
        'note': f"Benchmark: {selected['name']}"
    }

if __name__ == '__main__':
    result = fetch_benchmark(datetime.now())
    if result:
        print(f"\n✅ {result['sections'][0]['title']}")
        for line in result['sections'][0]['lines'][:10]:
            print(f"  {line}")
