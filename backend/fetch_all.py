#!/usr/bin/env python3
"""
DUCK-WOD Phase 1 - Main Fetch Script
Fetches from 5 hard-coded sources, maintains 14-day history
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

# Import all scrapers
from scrapers.myleo import fetch_workout as fetch_myleo
from scrapers.greenbeach import fetch_workout as fetch_greenbeach
from scrapers.others import fetch_linchpin, fetch_postal, fetch_crossfit_com


# Config
DATA_DIR = Path(__file__).parent.parent / 'data'
DATA_FILE = DATA_DIR / 'workouts.json'
DAYS_TO_KEEP = 14

# 5 fixed sources
SOURCES = {
    'myleo': {
        'name': 'myleo CrossFit',
        'fetch': fetch_myleo,
        'enabled': True,
        'has_archive': True
    },
    'greenbeach': {
        'name': 'CrossFit Green Beach',
        'fetch': fetch_greenbeach,
        'enabled': True,
        'has_archive': False
    },
    'linchpin': {
        'name': 'CrossFit Linchpin',
        'fetch': fetch_linchpin,
        'enabled': True,
        'has_archive': False
    },
    'postal': {
        'name': 'CrossFit Postal',
        'fetch': fetch_postal,
        'enabled': True,
        'has_archive': False
    },
    'crossfit_com': {
        'name': 'CrossFit.com',
        'fetch': fetch_crossfit_com,
        'enabled': True,
        'has_archive': True
    }
}


def load_data():
    """Load existing workouts"""
    if DATA_FILE.exists():
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {'workouts': {}}


def save_data(data):
    """Save workouts"""
    DATA_DIR.mkdir(exist_ok=True)
    data['last_updated'] = datetime.now().isoformat()
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def clean_old_workouts(data):
    """Keep only last 14 days"""
    cutoff = (datetime.now() - timedelta(days=DAYS_TO_KEEP)).strftime('%Y-%m-%d')
    
    for date_str in list(data['workouts'].keys()):
        if date_str < cutoff:
            del data['workouts'][date_str]


def fetch_all():
    """Main fetch function"""
    print("🦆 DUCK-WOD Phase 1 Fetcher\n")
    
    data = load_data()
    
    # Fetch last 14 days
    for i in range(DAYS_TO_KEEP):
        date = datetime.now() - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        
        print(f"📅 {date_str}")
        
        if date_str not in data['workouts']:
            data['workouts'][date_str] = []
        
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
    clean_old_workouts(data)
    
    # Save
    save_data(data)
    
    # Summary
    total = sum(len(wods) for wods in data['workouts'].values())
    print(f"📊 Total: {total} workouts across {len(data['workouts'])} days")
    print(f"💾 Saved to {DATA_FILE}")


if __name__ == '__main__':
    fetch_all()
