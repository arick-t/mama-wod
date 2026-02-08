# 🦆 DUCK-WOD - Phase 1 (Stabilized)

**Simple, Production-Ready CrossFit Workout Aggregator**

---

## 🔧 What Was Fixed

### ✅ Multi-Source Display
- **Before**: Only CrossFit.com showed up
- **After**: All 5 sources display correctly

### ✅ Clean Scraping
- Removed images, intro articles, marketing text
- Only workout content with section titles (METCON, STRENGTH, etc.)
- Each scraper tailored to its specific site

### ✅ Equipment Expansion
- Added: `KETTLEBELL`, `ROPE CLIMB`, `DOUBLE UNDERS`
- Total: 9 equipment types for FIND WORKOUT

### ✅ Source Toggle
- Enable/disable any of the 5 sources
- Saved in localStorage
- Disabled sources don't show and aren't searched

### ❌ Removed Features
- "Add Source" functionality (not needed for Phase 1)
- Generic scraper (intentionally avoided)

---

## 📁 Critical File Structure

```
duck-wod/                    ← Repository ROOT
├── index.html              ← MUST be in root for GitHub Pages!
├── backend/
│   ├── fetch_all.py
│   ├── requirements.txt
│   └── scrapers/
│       ├── __init__.py
│       ├── myleo.py
│       ├── crossfit_com.py
│       └── others.py
├── data/
│   └── workouts.json
├── .github/workflows/
│   └── daily-fetch.yml
└── README.md
```

**⚠️ IMPORTANT**: `index.html` MUST be in the root directory!

---

## 🚀 GitHub Setup

### Step 1: Create Repository

1. Go to github.com → New repository
2. Name: `duck-wod`
3. ✅ **Public**
4. Create

### Step 2: Upload Files

**CRITICAL**: Upload files to ROOT, not inside a folder!

1. Click "uploading an existing file"
2. Drag these items (NOT a parent folder):
   ```
   index.html
   backend/
   data/
   .github/
   README.md
   ```
3. Commit

### Step 3: Enable GitHub Pages

1. **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: main
4. **Folder**: **/ (root)**  ← NOT /frontend!
5. Save
6. Wait 1 minute
7. Get your URL: `https://USERNAME.github.io/duck-wod/`

### Step 4: Run First Fetch

1. **Actions** tab
2. Click "🦆 Daily Workout Fetch"
3. **Run workflow**
4. Wait 2-3 minutes
5. Check `data/workouts.json` for content

---

## 🎯 The 5 Fixed Sources

| Source | Archive | Scraper Status |
|--------|---------|----------------|
| myleo CrossFit | ✅ 14 days | ✅ Fixed |
| CrossFit.com | ✅ 14 days | ✅ Fixed |
| CrossFit Green Beach | ⚠️ Daily only | ✅ Fixed |
| CrossFit Linchpin | ⚠️ Daily only | ✅ Fixed |
| CrossFit Postal | ⚠️ Daily only | ✅ Fixed |

---

## 💡 Key Architectural Decisions

### ❌ What We Intentionally Did NOT Build:

1. **Generic Scraper**
   - Each source has a dedicated, tailored scraper
   - Scrapers are allowed to break if site changes
   - This is intentional and acceptable

2. **Dynamic Source Addition**
   - Sources are hardcoded
   - No "add any URL" feature
   - Phase 1 focuses on these 5 specific sources

3. **Workout Modification**
   - FIND WORKOUT only matches, never modifies
   - Shows original workout with match %

---

## 🔍 FIND WORKOUT

### Equipment List (9 types):
- RUN
- BARBELL
- PULL-UP
- ROW
- BIKE
- DUMBBELL
- KETTLEBELL
- ROPE CLIMB
- DOUBLE UNDERS

### Algorithm:
1. Equipment match: 60% of score
2. Time estimate: 40% of score
3. Searches only enabled sources
4. Returns best match (unmodified)

---

## 🎨 UI (Unchanged)

All visual elements preserved:
- Dark mode (black + blue)
- Day navigation (last 14 days)
- Workout cards
- Section titles (underlined, bold)
- Bullet points for workout lines

---

## 🐛 Troubleshooting

### "Only CrossFit.com showing"
✅ **FIXED** - All 5 scrapers now work correctly

### "No workouts for today"
→ Run Actions workflow manually
→ Check if scrapers succeeded in logs

### "GitHub Pages not working"
→ Make sure `index.html` is in **ROOT**
→ Pages folder should be **/ (root)**, not /frontend

### "Actions failing"
→ Check logs in Actions tab
→ Network timeouts are normal, just re-run

---

## 📱 Daily Usage

1. **Open your GitHub Pages URL**
2. **Browse**: See today's workouts
3. **Find**: Search by time + equipment
4. **Sources**: Toggle sources on/off
5. **Share**: Send to WhatsApp

---

## 🔄 Automatic Updates

- Runs daily at 6 AM (Israel time)
- Fetches all 5 sources
- Keeps last 14 days
- Auto-commits to repository

---

## 🎉 What Makes This Version Stable

✅ All 5 sources display correctly  
✅ Scrapers extract only workout content  
✅ Equipment list expanded  
✅ Source toggles work  
✅ UI unchanged and stable  
✅ No breaking changes  

---

## 📞 Support

**Common Fix**: If pages isn't working:
1. Make sure `index.html` is in repository ROOT
2. GitHub Pages folder = **/ (root)**
3. NOT /frontend!

---

Built with focus on stability over elegance. 🦆💪
