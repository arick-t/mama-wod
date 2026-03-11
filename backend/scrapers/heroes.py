"""
CrossFit Hero Workouts Scraper - FIXED
Fetches from https://www.crossfit.com/heroes
Better parsing to avoid cutting workouts short
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

_HERO_CACHE = None

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


def _scrape_all_heroes():
    """שואב את כל אימוני הגיבורים מאתר CrossFit.com (מחסן מלא)."""
    url = 'https://www.crossfit.com/heroes'
    heroes = []
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
                not any(c.isdigit() for c in line[:3])
            )

            if is_title:
                name = line
                workout_lines = []
                hero_story = None

                # Collect workout lines until next name or memorial text
                i += 1
                while i < len(lines):
                    next_line = lines[i]

                    # Stop at memorial/biographical text – collect as hero_story
                    memorial_keywords = [
                        'in honor', 'killed in action', 'died', 'fallen', 'survived by', 'is survived',
                        'afghanistan', 'iraq', 'operation', 'combat', 'enemy', 'explosive device',
                        'was a member of', 'graduate of', 'air force', 'navy seal', 'marine',
                        'u.s. army', 'special forces', 'year-old', 'years old', 'born in',
                        'native of', 'deployed to', 'assigned to'
                    ]
                    if any(keyword in next_line.lower() for keyword in memorial_keywords):
                        hero_story_lines = [next_line]
                        i += 1
                        while i < len(lines):
                            stop_line = lines[i]
                            if any(stop in stop_line.lower() for stop in ['share this', 'posted by', 'learn more about']):
                                i += 1
                                break
                            next_is_title = (
                                len(stop_line) < 30 and len(stop_line) > 2 and ':' not in stop_line
                                and not stop_line.islower() and (stop_line.isupper() or stop_line.istitle())
                                and not any(c.isdigit() for c in stop_line[:3])
                            )
                            if next_is_title:
                                break
                            hero_story_lines.append(stop_line)
                            i += 1
                            if len(hero_story_lines) >= 30:
                                break
                        hero_story = '\n'.join(hero_story_lines).strip()
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

                    workout_lines.append(next_line)
                    i += 1

                    if len(workout_lines) >= 25:
                        break

                if len(workout_lines) >= 3:
                    entry = {'name': name, 'lines': workout_lines[:25]}
                    if hero_story:
                        entry['hero_story'] = hero_story
                    heroes.append(entry)
            else:
                i += 1

        print(f"    → Total parsed: {len(heroes)} hero workouts")
        return heroes

    except Exception as e:
        print(f"    → Error: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_all_heroes():
    """
    מחזיר את כל אימוני הגיבורים ממחסן מקומי.
    אם המחסן ריק – שואב מהאתר, שומר ב-special_cache.json.
    חידוש מחסן: פעם בחודש (בריצה הראשונה של אותו חודש).
    """
    global _HERO_CACHE
    if _HERO_CACHE is not None:
        return _HERO_CACHE

    data = _load_cache()
    heroes = data.get('heroes') or []

    # בדיקה אם צריך לרענן (תחילת חודש חדש לעומת last_heroes_update)
    today = datetime.now().date()
    last_str = data.get('last_heroes_update')
    needs_refresh = False
    if not heroes:
        needs_refresh = True
    elif last_str:
        try:
            last_dt = datetime.strptime(last_str, '%Y-%m-%d').date()
            if last_dt.year != today.year or last_dt.month != today.month:
                needs_refresh = True
        except Exception:
            needs_refresh = True

    if not needs_refresh:
        _HERO_CACHE = heroes
        return _HERO_CACHE

    heroes = _scrape_all_heroes()
    if heroes:
        data['heroes'] = heroes
        data['last_heroes_update'] = datetime.now().strftime('%Y-%m-%d')
        _save_cache(data)
        _HERO_CACHE = heroes
    else:
        _HERO_CACHE = []
    return _HERO_CACHE


def fetch_hero(date):
    """
    בוחר אימון גיבור יומי מהמחסן, עם רנדומציה דטרמיניסטית וחלון אי-חזרה של 14 יום.
    """
    heroes = fetch_all_heroes()
    if not heroes:
        print("    → No heroes available")
        return None

    date_str = date.strftime('%Y-%m-%d')
    print(f"  ⬇ CrossFit Hero Workouts...")

    date_hash = int(hashlib.md5(date_str.encode()).hexdigest(), 16)

    excluded_indices = set()
    for days_ago in range(1, 15):
        past_date = date - timedelta(days=days_ago)
        past_str = past_date.strftime('%Y-%m-%d')
        past_hash = int(hashlib.md5(past_str.encode()).hexdigest(), 16)
        excluded_idx = past_hash % len(heroes)
        excluded_indices.add(excluded_idx)

    base_idx = date_hash % len(heroes)
    chosen_idx = base_idx
    attempts = 0
    while chosen_idx in excluded_indices and attempts < len(heroes):
        chosen_idx = (chosen_idx + 1) % len(heroes)
        attempts += 1

    hero = heroes[chosen_idx]
    print(f"    → Selected: {hero['name']} (#{chosen_idx + 1}/{len(heroes)})")

    processed_lines = []
    for line in hero['lines']:
        if re.search(r'[♀♂].*\d+\s*(lb|kg)', line):
            processed_lines.append(f"*{line}*")
        else:
            processed_lines.append(line)

    # First line = workout format (sub_title), rest = exercise lines
    sub_title = processed_lines[0] if processed_lines else ''
    section_lines = processed_lines[1:] if len(processed_lines) > 1 else []

    return {
        'date': date_str,
        'source': 'hero',
        'source_name': 'CrossFit Hero Workouts',
        'hero_story': hero.get('hero_story') or '',
        'sections': [{
            'title': hero['name'],
            'sub_title': sub_title,
            'lines': section_lines
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
