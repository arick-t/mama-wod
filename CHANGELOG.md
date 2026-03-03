# Changelog

## [19.5] - 2026-02-27

### Find Workout
- Always show top 3 from box sources (14-day workouts); up to 3 from Hero/Benchmark/Open when checkboxes selected. Display order: boxes first, then warehouses.
- Scoring: WOD-only text for equipment/time; two-phase by equipment "extra" (prefer extra ≤1); labels: התאמה מלאה, זמן שונה, התאמה חלקית.
- Unlimited time: no longer zeros score; full time points when "Unlimited time" is checked.
- Guards: getWodOnlyText/scoreWod handle missing sections or bad data; try/catch in find loop; message when no workout data loaded yet.

### Benchmarks
- No duplicate benchmark names in 14-day view (e.g. Grace, Barbara once). `fetch_benchmarks_for_days(dates)` returns one unique benchmark per day.
- Scraper: dedupe by normalized name; parse `<ul>`/`<ol>`/`<li>` and `<h1>`–`<h4>` so full workout content is captured (e.g. Nicole). `fetch_all` uses batch benchmark assignment.

---

## [19.4] - 2026-02-27

### Timer fullscreen (intervals + stopwatch)
- **Sounds**: Single AudioContext created on Start (user gesture); beep/whistle/bell at every work↔rest and rest-between-sets transition (reliable on mobile).
- **UI**: "Remaining" → "Overall Time" (top); phase name larger; Round left, Set right; Pause between LAST/NEXT; ▶/⏸/Close.
- **Stopwatch (For Time)**: Count-up with filling ring; bell at work start, whistle at rest; config tightened; removed Next/5:00 preview.
### Weights
- **lb → kg**: All "X lb" shown as "X lb (Y kg)" in cards and Open (formatLbToKg).
### CrossFit.com
- Scraper returns no WOD on Sundays; day bar shows 14 non-Sunday days only.
### Dev
- DEV.md, serve-mobile.ps1, serve-mobile.cmd for local phone testing.

---

## [19.3] - 2026-02-27

### Timer (Workout Timers tab)
- Set & round display: interval shows "Set X/Y · Round R/Z" and "Rest Between Sets — Set 2→3"; toggles for "Merge adjacent rests" and "3 beeps" (ON/OFF); note about sounds over device audio.
### Dev
- Mobile testing: Live Server useLocalIp, DEV.md, serve-mobile.ps1.

---

## [19.2] - 2026-02-15 (Evening, Second Fix)

### 🔧 Fixed
- **Ton Bridge**: 
  - Separator line ("By NAME|DATE") now excluded completely
  - Section titles normalized: "Met Con" → "METCON"
  - Skip lines with "by" or "posted"
  
- **Benchmarks**:
  - Restored v19 working code (v19.1 broke it)
  - Added gender weights as notes: *♀ 55 lb ♂ 75 lb*
  
- **Open WODs**:
  - Complete rewrite of scraping logic
  - Now finds 15+ workouts (was 0 in v19.1)
  - Better HTML parsing (h1-h4 headers)
  - Gender weights as notes

- **Workflow**:
  - Auto-triggers on push to main/master
  - Watches backend/** and workflow file changes

### 📊 Result
- All 10/10 sources working
- ~140 WODs total
- No regressions from v19

---

## [19.1] - 2026-02-15 (Afternoon) - BROKEN

### ❌ Regression
- Benchmarks stopped working (0 workouts)
- Open stopped working (0 workouts)
- Lost functionality from v19

---

## [19] - 2026-02-15 (Morning)

### 🔧 Fixed
- Heroes: Full workouts
- Benchmarks: Correct titles
- Ton Bridge: New URL
- Open: Re-enabled

---

## [18] - 2026-02-10

### 🎉 Initial Release
