"""
CrossFit Open Workouts Scraper - warehouse version
Source: https://games.crossfit.com/workouts/open/YEAR
2011–2016: כל האימונים כתובים באותו URL של השנה.
2017–2025: לכל אימון URL נפרד /YEAR/N.
אנחנו שואבים את כל אימוני האופן למחסן `data/special_cache.json` → מגרילים כל יום אימון חדש
עם חלון אי־חזרה של 14 יום, וב־Find Workout נחפש במחסן כולו.
"""
import json
import re
import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from pathlib import Path

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

_OPEN_CACHE = None

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


def _extract_workout_block_from_text(text, name_hint=None):
    """
    קבלת טקסט מלא של עמוד → ניסיון לחלץ ממנו בלוק קצר של האימון עצמו,
    בלי Movement Standards / Notes / Video Submission Standards וכו'.

    בגלל שהמבנה משתנה בין שנים ודיביזיות, נעבוד ברמת טקסט:
    - נחפש שורה שמכילה את מספר האימון (למשל '17.1', '16.2' וכו').
    - משם נגלול קדימה ונעצור כשאנחנו נתקלים בכותרות הסבר ארוכות.
    """
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return []

    # אם יש רמז לשם (למשל "Open 17.1"), ננסה למצוא שורה דומה
    start_idx = 0
    if name_hint:
        pattern = re.escape(name_hint.split()[-1])  # למשל 17.1
        for i, l in enumerate(lines):
            if re.search(pattern, l):
                start_idx = i
                break

    # fallback: חפש 'For time', 'AMRAP', 'Complete as many', 'For total time' וכו'
    keywords = ['for time', 'amrap', 'complete as many', 'for total', 'rounds for time']
    for i in range(start_idx, len(lines)):
        low = lines[i].lower()
        if any(k in low for k in keywords):
            start_idx = i
            break

    # אוספים עד 25 שורות קדימה, ועוצרים כשמתחילים הסברים
    stop_keywords = [
        'movement standards',
        'video submission standards',
        'notes',
        'tiebreak',
        'equipment',
        'download the workout description',
        'workout description & scorecard',
    ]
    block = []
    for l in lines[start_idx:start_idx + 40]:
        low = l.lower()
        if any(k in low for k in stop_keywords):
            break
        block.append(l)
        if len(block) >= 25:
            break

    # מסנן שורות סופר-ארוכות / טקסט רציף
    clean = []
    for l in block:
        if len(l) > 160:
            continue
        clean.append(l)
    return clean


def _scrape_year_2011_2016(year):
    """
    שנים 2011–2016: כל האימונים מופיעים בדף השנה.
    נחלץ את כל הבלוקים שמתחילים ב'Workout XX.X' או 'XX.X'.
    """
    url = f'https://games.crossfit.com/workouts/open/{year}'
    print(f"    → Fetching Open year page {year}: {url}")
    r = requests.get(url, timeout=20, headers=HEADERS)
    if r.status_code != 200:
        print(f"    → HTTP {r.status_code} for year {year}")
        return []

    soup = BeautifulSoup(r.text, 'html.parser')
    # מסירים רעש
    for tag in soup.find_all(['script', 'style', 'img', 'picture', 'video', 'iframe']):
        tag.decompose()

    text = soup.get_text(separator='\n')
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    workouts = []
    # עבור כל אימון שנהוג שיהיו 5 אימונים בשנים אלה
    for n in range(1, 6):
        code = f"{str(year)[-2:]}.{n}"  # למשל '16.1'
        title = f"Open {code}"

        # חפש אינדקס של בלוק האימון לפי הקוד
        joined = "\n".join(lines)
        if code not in joined:
            continue

        block = _extract_workout_block_from_text(text, name_hint=code)
        if len(block) < 2:
            continue

        workouts.append({
            'name': title,
            'lines': block,
            'year': year,
            'code': code,
        })
        print(f"      ↳ Parsed {title} ({len(block)} lines)")

    return workouts


def _scrape_year_2017_plus(year, count):
    """
    שנים 2017–2025: לכל אימון URL נפרד: /YEAR/1, /YEAR/2...
    count = כמה אימונים היו באותה שנה.
    """
    workouts = []
    for n in range(1, count + 1):
        url = f'https://games.crossfit.com/workouts/open/{year}/{n}'
        code = f"{str(year)[-2:]}.{n}"  # למשל '17.1'
        title = f"Open {code}"

        print(f"    → Fetching Open {code}: {url}")
        r = requests.get(url, timeout=20, headers=HEADERS)
        if r.status_code != 200:
            print(f"      → HTTP {r.status_code} for {code}")
            continue

        soup = BeautifulSoup(r.text, 'html.parser')
        # מסירים רעש
        for tag in soup.find_all(['script', 'style', 'img', 'picture', 'video', 'iframe']):
            tag.decompose()

        text = soup.get_text(separator='\n')
        block = _extract_workout_block_from_text(text, name_hint=code)
        if len(block) < 2:
            print(f"      → No workout block found for {code}")
            continue

        workouts.append({
            'name': title,
            'lines': block,
            'year': year,
            'code': code,
        })
        print(f"      ↳ Parsed {title} ({len(block)} lines)")

    return workouts


def _scrape_all_open():
    """
    שואב את כל אימוני האופן מכל השנים 2011–2025 למחסן.
    """
    all_workouts = []
    try:
        # 2011–2016: 5 אימונים לכל שנה
        for year in range(2011, 2017):
            all_workouts.extend(_scrape_year_2011_2016(year))

        # 2017–2020: 5 אימונים
        for year in range(2017, 2021):
            all_workouts.extend(_scrape_year_2017_plus(year, count=5))

        # 2021: 4 אימונים
        all_workouts.extend(_scrape_year_2017_plus(2021, count=4))

        # 2022–2025: 3 אימונים
        for year in range(2022, 2026):
            all_workouts.extend(_scrape_year_2017_plus(year, count=3))

        print(f"    → Total parsed Open workouts: {len(all_workouts)}")
        return all_workouts

    except Exception as e:
        print(f"    → Error while scraping Open workouts: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_all_open():
    """
    מחזיר את כל אימוני האופן מהמחסן.
    אם המחסן ריק – שואב מהמקור, שומר ב-special_cache.json.
    חידוש מחסן: פעם בחודש (בריצה הראשונה של אותו חודש).
    """
    global _OPEN_CACHE
    if _OPEN_CACHE is not None:
        return _OPEN_CACHE

    data = _load_cache()
    workouts = data.get('open') or []

    # בדיקה אם צריך לרענן (תחילת חודש חדש לעומת last_open_update)
    today = datetime.now().date()
    last_str = data.get('last_open_update')
    needs_refresh = False
    if not workouts:
        needs_refresh = True
    elif last_str:
        try:
            last_dt = datetime.strptime(last_str, '%Y-%m-%d').date()
            if last_dt.year != today.year or last_dt.month != today.month:
                needs_refresh = True
        except Exception:
            needs_refresh = True

    if not needs_refresh:
        _OPEN_CACHE = workouts
        return _OPEN_CACHE

    workouts = _scrape_all_open()
    if workouts:
        data['open'] = workouts
        data['last_open_update'] = datetime.now().strftime('%Y-%m-%d')
        _save_cache(data)
        _OPEN_CACHE = workouts
    else:
        _OPEN_CACHE = []
    return _OPEN_CACHE


def fetch_open(date):
    """
    בוחר אימון Open יומי מהמחסן, עם רנדומציה דטרמיניסטית וחלון אי-חזרה של 14 יום.
    (עדכון מקור ל-games.crossfit.com יהיה בשלב הבא.)
    """
    workouts = fetch_all_open()
    if not workouts:
        print("    → No Open workouts available")
        return None

    date_str = date.strftime('%Y-%m-%d')
    print(f"  ⬇ CrossFit Open Workouts...")

    date_hash = int(hashlib.md5(date_str.encode()).hexdigest(), 16)

    excluded_indices = set()
    for days_ago in range(1, 15):
        past_date = date - timedelta(days=days_ago)
        past_str = past_date.strftime('%Y-%m-%d')
        past_hash = int(hashlib.md5(past_str.encode()).hexdigest(), 16)
        excluded_idx = past_hash % len(workouts)
        excluded_indices.add(excluded_idx)

    base_idx = date_hash % len(workouts)
    chosen_idx = base_idx
    attempts = 0
    while chosen_idx in excluded_indices and attempts < len(workouts):
        chosen_idx = (chosen_idx + 1) % len(workouts)
        attempts += 1

    workout = workouts[chosen_idx]
    print(f"    → Selected: {workout['name']} (#{chosen_idx + 1}/{len(workouts)})")

    processed_lines = []
    for line in workout['lines']:
        low = line.lower()
        if re.search(r'[♀♂].*\d+\s*(lb|kg)', line) or any(x in low for x in ['male', 'female', 'men', 'women']):
            processed_lines.append(f"*{line}*")
        else:
            processed_lines.append(line)

    return {
        'date': date_str,
        'source': 'open',
        'source_name': 'CrossFit Open Workouts',
        'url': 'https://games.crossfit.com/workouts/open',
        'sections': [{
            'title': workout['name'],
            'lines': processed_lines
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
