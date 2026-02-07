#!/usr/bin/env python3
"""
<<<<<<< HEAD
DUCK-WOD Phase 1 - Main Fetch Script
Fetches from 5 hard-coded sources, maintains 14-day history
"""

import json
=======
DUCK-WOD Phase 1 - Main Fetch Script - FIXED
Fetches from all 5 sources and writes to workouts.json
"""

import json
import sys
>>>>>>> 1d69df1 (Initial commit from new folder)
from datetime import datetime, timedelta
from pathlib import Path

# Import all scrapers
<<<<<<< HEAD
from scrapers.myleo import fetch_workout as fetch_myleo
from scrapers.greenbeach import fetch_workout as fetch_greenbeach
from scrapers.others import fetch_linchpin, fetch_postal, fetch_crossfit_com
=======
sys.path.insert(0, str(Path(__file__).parent))

from scrapers.myleo import fetch_workout as fetch_myleo
from scrapers.crossfit_com import fetch_workout as fetch_crossfit_com
from scrapers.others import fetch_greenbeach, fetch_linchpin, fetch_postal
>>>>>>> 1d69df1 (Initial commit from new folder)


# Config
DATA_DIR = Path(__file__).parent.parent / 'data'
DATA_FILE = DATA_DIR / 'workouts.json'
DAYS_TO_KEEP = 14

<<<<<<< HEAD
# 5 fixed sources
SOURCES = {
    'myleo': {
        'name': 'myleo CrossFit',
        'fetch': fetch_myleo,
        'enabled': True,
=======
# 5 fixed sources (hardcoded)
SCRAPERS = {
    'myleo': {
        'name': 'myleo CrossFit',
        'fetch': fetch_myleo,
>>>>>>> 1d69df1 (Initial commit from new folder)
        'has_archive': True
    },
    'greenbeach': {
        'name': 'CrossFit Green Beach',
        'fetch': fetch_greenbeach,
<<<<<<< HEAD
        'enabled': True,
=======
>>>>>>> 1d69df1 (Initial commit from new folder)
        'has_archive': False
    },
    'linchpin': {
        'name': 'CrossFit Linchpin',
        'fetch': fetch_linchpin,
<<<<<<< HEAD
        'enabled': True,
=======
>>>>>>> 1d69df1 (Initial commit from new folder)
        'has_archive': False
    },
    'postal': {
        'name': 'CrossFit Postal',
        'fetch': fetch_postal,
<<<<<<< HEAD
        'enabled': True,
=======
>>>>>>> 1d69df1 (Initial commit from new folder)
        'has_archive': False
    },
    'crossfit_com': {
        'name': 'CrossFit.com',
        'fetch': fetch_crossfit_com,
<<<<<<< HEAD
        'enabled': True,
=======
>>>>>>> 1d69df1 (Initial commit from new folder)
        'has_archive': True
    }
}


def load_data():
    """Load existing workouts"""
    if DATA_FILE.exists():
<<<<<<< HEAD
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
=======
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {'workouts': {}}
>>>>>>> 1d69df1 (Initial commit from new folder)
    return {'workouts': {}}


def save_data(data):
    """Save workouts"""
<<<<<<< HEAD
    DATA_DIR.mkdir(exist_ok=True)
    data['last_updated'] = datetime.now().isoformat()
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
=======
    DATA_DIR.mkdir(exist_ok=True, parents=True)
    data['last_updated'] = datetime.now().isoformat()
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Saved to {DATA_FILE}")
>>>>>>> 1d69df1 (Initial commit from new folder)


def clean_old_workouts(data):
    """Keep only last 14 days"""
    cutoff = (datetime.now() - timedelta(days=DAYS_TO_KEEP)).strftime('%Y-%m-%d')
    
    for date_str in list(data['workouts'].keys()):
        if date_str < cutoff:
            del data['workouts'][date_str]
<<<<<<< HEAD
=======
            print(f"  🗑️  Removed old date: {date_str}")
>>>>>>> 1d69df1 (Initial commit from new folder)


def fetch_all():
    """Main fetch function"""
<<<<<<< HEAD
    print("🦆 DUCK-WOD Phase 1 Fetcher\n")
=======
    print("🦆 DUCK-WOD Phase 1 Fetcher")
    print("=" * 50)
>>>>>>> 1d69df1 (Initial commit from new folder)
    
    data = load_data()
    
    # Fetch last 14 days
    for i in range(DAYS_TO_KEEP):
        date = datetime.now() - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        
<<<<<<< HEAD
        print(f"📅 {date_str}")
=======
        print(f"\n📅 {date_str}")
>>>>>>> 1d69df1 (Initial commit from new folder)
        
        if date_str not in data['workouts']:
            data['workouts'][date_str] = []
        
<<<<<<< HEAD
        # Fetch from each enabled source
        for source_id, source_info in SOURCES.items():
            if not source_info['enabled']:
                continue
            
            # Check if already have this workout
            existing = any(w['source'] == source_id for w in data['workouts'][date_str])
            if existing:
                print(f"  ✓ {source_info['name']} (cached)")
                continue
            
            # Fetch
            print(f"  ⬇ {source_info['name']}...", end=' ')
            workout = source_info['fetch'](date)
            
            if workout:
                data['workouts'][date_str].append(workout)
                print("✅")
            else:
                print("❌")
        
        print()
    
    # Clean old
=======
        # Fetch from each source
        for source_id, scraper_info in SCRAPERS.items():
            # Check if already have this workout
            existing = any(w['source'] == source_id for w in data['workouts'][date_str])
            if existing:
                print(f"  ✓ {scraper_info['name']} (cached)")
                continue
            
            # Fetch
            print(f"  ⬇ {scraper_info['name']}...", end=' ', flush=True)
            
            try:
                workout = scraper_info['fetch'](date)
                
                if workout:
                    # Ensure it has the right structure
                    if 'sections' not in workout or not workout['sections']:
                        print("❌ (no sections)")
                        continue
                    
                    data['workouts'][date_str].append(workout)
                    print("✅")
                else:
                    print("❌")
            except Exception as e:
                print(f"❌ ({str(e)})")
    
    # Clean old
    print("\n🧹 Cleaning old workouts...")
>>>>>>> 1d69df1 (Initial commit from new folder)
    clean_old_workouts(data)
    
    # Save
    save_data(data)
    
    # Summary
<<<<<<< HEAD
    total = sum(len(wods) for wods in data['workouts'].values())
    print(f"📊 Total: {total} workouts across {len(data['workouts'])} days")
    print(f"💾 Saved to {DATA_FILE}")


if __name__ == '__main__':
    fetch_all()
=======
    print("\n" + "=" * 50)
    total = sum(len(wods) for wods in data['workouts'].values())
    print(f"📊 Total workouts: {total}")
    print(f"📆 Days with data: {len(data['workouts'])}")
    
    # Per-source summary
    print("\n📦 Per source:")
    source_counts = {}
    for date_wods in data['workouts'].values():
        for wod in date_wods:
            source_counts[wod['source']] = source_counts.get(wod['source'], 0) + 1
    
    for source_id, count in sorted(source_counts.items()):
        print(f"  {SCRAPERS.get(source_id, {}).get('name', source_id)}: {count}")
    
    print("=" * 50)


if __name__ == '__main__':
    try:
        fetch_all()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
>>>>>>> 1d69df1 (Initial commit from new folder)
