"""
CrossFit Benchmark Workouts scraper - FIXED
Fetches from: https://www.wodconnect.com/workout_lists/benchmarks
FIXES:
- Title is now the workout name (not "BENCHMARK")
- Plain text only (no underlines/links)
Now also uses a local warehouse in data/special_cache.json
"""
import json
import re
import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from pathlib import Path

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
}

_BENCHMARK_CACHE = None

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR.parent / 'data'
SPECIAL_CACHE = DATA_DIR / 'special_cache.json'


def _load_cache():
    if SPECIAL_CACHE.exists():
        try:
            with open(SPECIAL_CACHE, encoding='utf-8') as f:
                data = json.load(f)
                data.setdefault('heroes', [])
                data.setdefault('benchmarks', [])
                data.setdefault('open', [])
                return data
        except Exception:
            pass
    return {'heroes': [], 'benchmarks': [], 'open': []}


def _save_cache(data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(SPECIAL_CACHE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _scrape_all_benchmarks():
    """שואב את כל אימוני ה-Benchmark מאתר wodconnect (מחסן מלא)."""
    benchmarks = []
    try:
        for page in range(1, 5):
            url = 'https://www.wodconnect.com/workout_lists/benchmarks'
            if page > 1:
                url += f'?page={page}'

            print(f"    → Fetching page {page}: {url}")
            r = requests.get(url, timeout=15, headers=HEADERS)
            if r.status_code != 200:
                print(f"    → Page {page} HTTP {r.status_code}")
                continue

            soup = BeautifulSoup(r.text, 'html.parser')

            for tag in soup.find_all(['script', 'style', 'img', 'picture', 'video', 'iframe']):
                tag.decompose()

            boxes = soup.find_all('li', class_='box')
            print(f"    -> Found {len(boxes)} boxes on page {page}")

            for box in boxes:
                h2 = box.find('h2', class_='name')
                if not h2:
                    continue

                a_tag = h2.find('a')
                if not a_tag:
                    continue

                name = a_tag.get_text(strip=True).strip(' "')
                if len(name) < 2:
                    continue

                workout_desc = box.find('div', class_='workout_description')
                if not workout_desc:
                    continue

                markdown_div = workout_desc.find('div', class_='markdown_content')
                if not markdown_div:
                    continue

                workout_lines = []

                for p in markdown_div.find_all('p'):
                    for br in p.find_all('br'):
                        br.replace_with('\n')
                    text = p.get_text()
                    for line in text.split('\n'):
                        line = line.strip()
                        if len(line) >= 2:
                            workout_lines.append(line)

                for lst in markdown_div.find_all(['ul', 'ol']):
                    for li in lst.find_all('li', recursive=False):
                        line = li.get_text(separator=' ').strip()
                        if len(line) >= 2:
                            workout_lines.append(line)

                for h in markdown_div.find_all(['h1', 'h2', 'h3', 'h4']):
                    line = h.get_text(strip=True)
                    if len(line) >= 2 and line not in [wl for wl in workout_lines]:
                        workout_lines.append(line)

                if not workout_lines:
                    continue

                name_key = re.sub(r'[\s\-"\']', '', name.lower())
                name_key = re.sub(r'benchmark|workout', '', name_key)
                if not name_key:
                    name_key = name.lower()
                if any(b.get('_name_key') == name_key for b in benchmarks):
                    continue
                entry = {'name': name, 'lines': workout_lines[:35], '_name_key': name_key}
                benchmarks.append(entry)
        for b in benchmarks:
            b.pop('_name_key', None)
        print(f"    → Total parsed: {len(benchmarks)} benchmark workouts (deduped by name)")
        return benchmarks

    except Exception as e:
        print(f"    → Error: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_all_benchmarks():
    """
    מחזיר את כל אימוני ה-Benchmark מהמחסן.
    אם המחסן ריק – שואב מהאתר, שומר ב-special_cache.json.
    חידוש מחסן: פעם בחודש (בריצה הראשונה של אותו חודש).
    """
    global _BENCHMARK_CACHE
    if _BENCHMARK_CACHE is not None:
        return _BENCHMARK_CACHE

    data = _load_cache()
    benchmarks = data.get('benchmarks') or []

    # בדיקה אם צריך לרענן (תחילת חודש חדש לעומת last_benchmarks_update)
    today = datetime.now().date()
    last_str = data.get('last_benchmarks_update')
    needs_refresh = False
    if not benchmarks:
        needs_refresh = True
    elif last_str:
        try:
            last_dt = datetime.strptime(last_str, '%Y-%m-%d').date()
            if last_dt.year != today.year or last_dt.month != today.month:
                needs_refresh = True
        except Exception:
            needs_refresh = True

    if not needs_refresh:
        _BENCHMARK_CACHE = benchmarks
        return _BENCHMARK_CACHE

    benchmarks = _scrape_all_benchmarks()
    if benchmarks:
        data['benchmarks'] = benchmarks
        data['last_benchmarks_update'] = datetime.now().strftime('%Y-%m-%d')
        _save_cache(data)
        _BENCHMARK_CACHE = benchmarks
    else:
        _BENCHMARK_CACHE = []
    return _BENCHMARK_CACHE


def _make_benchmark_wod(selected, date_str):
    """Build one benchmark workout dict for a given selected entry and date."""
    name_upper = (selected['name'] or '').strip().upper()
    lines_in = list(selected['lines']) if selected.get('lines') else []
    # If first line duplicates the workout name (e.g. "JACKIE" under title "Jackie"), omit it
    if lines_in and (lines_in[0] or '').strip().upper() == name_upper:
        lines_in = lines_in[1:]
    processed_lines = []
    for line in lines_in:
        low = (line or '').lower()
        if re.search(r'[♀♂].*\d+\s*(lb|kg)', line or '') or any(x in low for x in ['male', 'female', 'men', 'women']):
            processed_lines.append(f"*{line}*")
        else:
            processed_lines.append(line)
    return {
        'date':        date_str,
        'source':      'benchmark',
        'source_name': 'CrossFit Benchmark Workouts',
        'url':         'https://www.wodconnect.com/workout_lists/benchmarks',
        'sections':    [{'title': selected['name'], 'lines': processed_lines}],
        'note':        f"Benchmark: {selected['name']}"
    }


def fetch_benchmarks_for_days(dates):
    """
    Returns one benchmark workout per date, with no duplicate workout names
    across the given days (e.g. 15 days for 15-day window; use first 14 for display).
    """
    benchmarks = fetch_all_benchmarks()
    if not benchmarks:
        return []
    n = len(benchmarks)
    used_names = set()
    result = []
    for date in dates:
        date_str = date.strftime('%Y-%m-%d') if hasattr(date, 'strftime') else str(date)[:10]
        date_hash = int(hashlib.md5(date_str.encode()).hexdigest(), 16)
        base_idx = date_hash % n
        chosen_idx = base_idx
        attempts = 0
        while attempts < n:
            name = benchmarks[chosen_idx]['name']
            if name not in used_names:
                break
            chosen_idx = (chosen_idx + 1) % n
            attempts += 1
        selected = benchmarks[chosen_idx]
        used_names.add(selected['name'])
        result.append(_make_benchmark_wod(selected, date_str))
    return result


def fetch_benchmark(date):
    """
    בוחר אימון Benchmark יומי מהמחסן, עם רנדומציה דטרמיניסטית וחלון אי-חזרה של 14 יום.
    (לשימוש בודד; ל־14 ימים עדיף fetch_benchmarks_for_days כדי למנוע כפילויות.)
    """
    benchmarks = fetch_all_benchmarks()
    if not benchmarks:
        print("    → No benchmarks available")
        return None

    date_str = date.strftime('%Y-%m-%d')
    print(f"  ⬇ CrossFit Benchmark Workouts...")

    date_hash = int(hashlib.md5(date_str.encode()).hexdigest(), 16)
    chosen_idx = date_hash % len(benchmarks)
    selected = benchmarks[chosen_idx]
    print(f"    → Selected: {selected['name']} (#{chosen_idx + 1}/{len(benchmarks)})")

    return _make_benchmark_wod(selected, date_str)


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
