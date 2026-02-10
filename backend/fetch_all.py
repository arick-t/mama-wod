#!/usr/bin/env python3
"""
DUCK-WOD Phase 1 - Main Fetch Script
7 sources, each with dedicated scraper
"""
import json, sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from scrapers.myleo import fetch_workout as fetch_myleo
from scrapers.crossfit_com import fetch_workout as fetch_crossfit_com
from scrapers.linchpin import fetch_workout as fetch_linchpin
from scrapers.others import fetch_postal, fetch_greenbeach
from scrapers.virtus import fetch_workout as fetch_virtus
from scrapers.restoration import fetch_workout as fetch_restoration

DATA_DIR  = Path(__file__).parent.parent / 'data'
DATA_FILE = DATA_DIR / 'workouts.json'
DAYS_TO_KEEP = 14

SCRAPERS = {
    'myleo':        {'name': 'myleo CrossFit',         'fetch': fetch_myleo,        'archive': True},
    'crossfit_com': {'name': 'CrossFit.com',            'fetch': fetch_crossfit_com, 'archive': True},
    'linchpin':     {'name': 'CrossFit Linchpin',       'fetch': fetch_linchpin,     'archive': False},
    'postal':       {'name': 'CrossFit Postal',         'fetch': fetch_postal,       'archive': False},
    'greenbeach':   {'name': 'CrossFit Green Beach',    'fetch': fetch_greenbeach,   'archive': False},
    'virtus':       {'name': 'CrossFit Virtus',         'fetch': fetch_virtus,       'archive': True},
    'restoration':  {'name': 'CrossFit Restoration',   'fetch': fetch_restoration,  'archive': True},
}


def load_data():
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  Load error: {e}")
    return {'workouts': {}}


def save_data(data):
    DATA_DIR.mkdir(exist_ok=True, parents=True)
    data['last_updated'] = datetime.now().isoformat()
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Saved to {DATA_FILE}")


def fetch_all():
    print("🦆 DUCK-WOD Phase 1 Fetcher")
    print("=" * 50)

    data = load_data()
    stats = {'ok': 0, 'fail': 0, 'cached': 0}

    for i in range(DAYS_TO_KEEP):
        date    = datetime.now() - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        print(f"\n📅 {date_str}")

        if date_str not in data['workouts']:
            data['workouts'][date_str] = []

        for src_id, info in SCRAPERS.items():
            already = any(w['source'] == src_id for w in data['workouts'][date_str])
            if already:
                print(f"  ✓ {info['name']} (cached)")
                stats['cached'] += 1
                continue

            print(f"  ⬇ {info['name']}...")
            try:
                wod = info['fetch'](date)
                if wod and wod.get('sections') and any(s.get('lines') for s in wod['sections']):
                    data['workouts'][date_str].append(wod)
                    print(f"    ✅ Success!")
                    stats['ok'] += 1
                else:
                    print(f"    ❌ No workout returned")
                    stats['fail'] += 1
            except Exception as e:
                print(f"    ❌ Exception: {e}")
                stats['fail'] += 1

    # Clean old days
    cutoff = (datetime.now() - timedelta(days=DAYS_TO_KEEP)).strftime('%Y-%m-%d')
    for ds in [k for k in list(data['workouts']) if k < cutoff]:
        del data['workouts'][ds]

    save_data(data)

    print("\n" + "=" * 50)
    total = sum(len(v) for v in data['workouts'].values())
    print(f"📊 Total workouts: {total}")
    print(f"📆 Days with data: {len(data['workouts'])}")
    print(f"✅ Newly fetched: {stats['ok']}")
    print(f"❌ Failed: {stats['fail']}")
    print(f"💾 Cached: {stats['cached']}")
    print("\n📦 Per source:")
    counts = {}
    for wods in data['workouts'].values():
        for w in wods:
            counts[w['source']] = counts.get(w['source'], 0) + 1
    for sid, cnt in sorted(counts.items()):
        print(f"  {SCRAPERS.get(sid, {}).get('name', sid)}: {cnt}")
    print("=" * 50)


if __name__ == '__main__':
    try:
        fetch_all()
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted")
    except Exception as e:
        print(f"\n❌ Fatal: {e}")
        import traceback; traceback.print_exc()
