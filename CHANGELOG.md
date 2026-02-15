# Changelog

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
