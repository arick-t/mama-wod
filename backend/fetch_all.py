#!/usr/bin/env python3
"""
DUCK-WOD - Main Fetch Script (6 sources)
"""
import json, sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from scrapers.myleo       import fetch_workout as fetch_myleo
from scrapers.crossfit_com import fetch_workout as fetch_crossfit_com
from scrapers.linchpin    import fetch_workout as fetch_linchpin
from scrapers.others      import fetch_postal, fetch_greenbeach
from scrapers.restoration import fetch_workout as fetch_restoration

DATA_DIR  = Path(__file__).parent.parent / 'data'
DATA_FILE = DATA_DIR / 'workouts.json'
DAYS      = 14

SCRAPERS = [
    ('myleo',        'myleo CrossFit',         fetch_myleo,         True),
    ('crossfit_com', 'CrossFit.com',            fetch_crossfit_com,  True),
    ('restoration',  'CrossFit Restoration',   fetch_restoration,   True),
    ('linchpin',     'CrossFit Linchpin',       fetch_linchpin,      False),
    ('postal',       'CrossFit Postal',         fetch_postal,        False),
    ('greenbeach',   'CrossFit Green Beach',    fetch_greenbeach,    False),
]

def load():
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  Load error: {e}")
    return {'workouts': {}}

def save(data):
    DATA_DIR.mkdir(exist_ok=True, parents=True)
    data['last_updated'] = datetime.now().isoformat()
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Saved to {DATA_FILE}")

def main():
    print("🦆 DUCK-WOD Phase 1 Fetcher")
    print("=" * 50)
    data = load()
    stats = {'ok':0, 'fail':0, 'cached':0}

    for i in range(DAYS):
        date     = datetime.now() - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        print(f"\n📅 {date_str}")
        if date_str not in data['workouts']:
            data['workouts'][date_str] = []

        for src_id, src_name, fetch_fn, has_archive in SCRAPERS:
            cached = any(w['source'] == src_id for w in data['workouts'][date_str])
            if cached:
                print(f"  ✓ {src_name} (cached)")
                stats['cached'] += 1
                continue
            print(f"  ⬇ {src_name}...")
            try:
                wod = fetch_fn(date)
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

    # Prune old dates
    cutoff = (datetime.now() - timedelta(days=DAYS)).strftime('%Y-%m-%d')
    removed = [k for k in list(data['workouts']) if k < cutoff]
    for k in removed:
        del data['workouts'][k]
    if removed:
        print(f"\n🧹 Removed {len(removed)} old days")

    save(data)

    total = sum(len(v) for v in data['workouts'].values())
    days_with = sum(1 for v in data['workouts'].values() if v)
    counts = {}
    for wods in data['workouts'].values():
        for w in wods:
            counts[w['source']] = counts.get(w['source'], 0) + 1

    print("\n" + "=" * 50)
    print(f"📊 Total workouts: {total}")
    print(f"📆 Days with data: {days_with}")
    print(f"✅ Newly fetched: {stats['ok']}")
    print(f"❌ Failed: {stats['fail']}")
    print(f"💾 Cached: {stats['cached']}")
    print("\n📦 Per source:")
    labels = {s[0]: s[1] for s in SCRAPERS}
    for sid, cnt in sorted(counts.items()):
        print(f"  {labels.get(sid, sid)}: {cnt}")
    print("=" * 50)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted")
    except Exception as e:
        import traceback
        print(f"\n❌ Fatal: {e}")
        traceback.print_exc()
