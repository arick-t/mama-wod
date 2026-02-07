<<<<<<< HEAD
# 🦆 DUCK-WOD - Phase 1
=======
# 🦆 DUCK-WOD - Phase 1 (Stabilized)
>>>>>>> 1d69df1 (Initial commit from new folder)

**Simple, Production-Ready CrossFit Workout Aggregator**

---

<<<<<<< HEAD
## 📋 What is This?

A **no-frills daily workout app** that:
- Fetches from **5 fixed CrossFit sources**
- Shows **14 days of history**
- Has a **smart workout finder**
- Lets you **share via WhatsApp**
- **Works automatically** every morning

---

## 🎯 The 5 Sources (Hard-Coded)

| Source | Archive? | Status |
|--------|----------|--------|
| myleo CrossFit | ✅ Yes | Active |
| CrossFit Green Beach | ⚠️ Daily only | Active |
| CrossFit Linchpin | ⚠️ Daily only | Active |
| CrossFit Postal | ⚠️ Daily only | Active |
| CrossFit.com | ✅ Yes | Active |

---

## 🚀 Complete GitHub Upload Guide

### Prerequisites
- GitHub account ([signup here](https://github.com/signup))
- The `duck-wod-phase1` folder you downloaded

---

### Step 1: Create Repository on GitHub

1. **Go to GitHub** and log in
2. **Click the "+" icon** (top right) → "New repository"
3. **Fill in:**
   - Repository name: `duck-wod`
   - Description: "🦆 Daily CrossFit Workouts"
   - ✅ **Public** (required for GitHub Pages)
   - ❌ **Do NOT** check "Add a README" (we have one)
4. **Click "Create repository"**

---

### Step 2: Upload Files

#### Option A: Via Web (Easiest for Beginners)

1. On your new repository page, you'll see:
   ```
   Quick setup — if you've done this kind of thing before
   ...or create a new repository on the command line
   ```

2. **Scroll down** to: **"uploading an existing file"** (it's a link)

3. **Drag and drop** these folders/files:
   ```
   frontend/
=======
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
>>>>>>> 1d69df1 (Initial commit from new folder)
   backend/
   data/
   .github/
   README.md
   ```
<<<<<<< HEAD

4. **Add commit message:** "Initial commit"

5. **Click "Commit changes"**

#### Option B: Via Command Line (For Developers)

```bash
cd duck-wod-phase1
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/duck-wod.git
git push -u origin main
```

---

### Step 3: Enable GitHub Pages

1. In your repository, go to **Settings** (top menu)

2. **Scroll down** to "Pages" (left sidebar)

3. Under **"Build and deployment"**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/frontend**
   
4. **Click "Save"**

5. **Wait 1-2 minutes**

6. **Refresh the page** - you'll see:
   ```
   Your site is live at https://YOUR-USERNAME.github.io/duck-wod/
   ```

7. **Click the link** to view your app!

---

### Step 4: Run First Fetch (Manual)

1. Go to **Actions** tab (top menu)

2. You'll see: **"🦆 Daily Workout Fetch"**

3. **Click on it**

4. **Click "Run workflow"** (right side)
   - Branch: main
   - Click green **"Run workflow"** button

5. **Wait 2-3 minutes**

6. **Refresh** - you should see:
   - ✅ Green checkmark = Success
   - ❌ Red X = Failed (check logs)

7. **Go to your repository** → `data/workouts.json`
   - It should now have workout data!

8. **Visit your GitHub Pages URL** again
   - You should see workouts! 🎉

---

## 🎨 What You'll See

### Landing Page (Today)
- Top bar with last 14 days
- Workout cards from each source
- Clean, dark blue theme

### Find Workout Tab
- Enter time (minutes)
- Select equipment
- Get best match with % score

### Sources Tab
- Toggle sources on/off
- See which have archives

---

## 📊 Project Structure

```
duck-wod-phase1/
├── frontend/
│   └── index.html              # Single-page app
├── backend/
│   ├── scrapers/
│   │   ├── myleo.py           # Scraper #1
│   │   ├── greenbeach.py      # Scraper #2
│   │   └── others.py          # Scrapers #3-5
│   └── fetch_all.py           # Main runner
├── data/
│   └── workouts.json          # 14-day storage
├── .github/workflows/
│   └── daily-fetch.yml        # Auto-fetch at 6 AM
└── README.md
```

---

## 🔧 How It Works

### Daily Automatic Fetch
1. **Every morning at 6 AM** (Israel time)
2. GitHub Actions runs `fetch_all.py`
3. Script fetches from all 5 sources
4. Saves to `data/workouts.json`
5. Keeps only last 14 days
6. Commits & pushes automatically

### Frontend
- Pure HTML/CSS/JS (no frameworks!)
- Reads from `../data/workouts.json`
- Works on GitHub Pages
- No backend needed
=======
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
>>>>>>> 1d69df1 (Initial commit from new folder)

---

## 🐛 Troubleshooting

<<<<<<< HEAD
### "No workouts showing"
**Fix:**
1. Go to Actions tab
2. Check if workflow ran successfully
3. Check `data/workouts.json` exists
4. Make sure GitHub Pages is enabled

### "Actions workflow failed"
**Fix:**
1. Click on the failed run
2. Read the error log
3. Common issues:
   - Network timeout (re-run)
   - Website HTML changed (need to update scraper)
   - Permissions (check workflow has `permissions: contents: write`)

### "GitHub Pages not working"
**Fix:**
1. Settings → Pages
2. Make sure branch = **main** and folder = **/frontend**
3. Wait 2-3 minutes after enabling
4. Check URL format: `https://USERNAME.github.io/duck-wod/`

---

## 🎯 Usage

### Daily Routine
1. **Open your GitHub Pages URL**
2. **See today's workouts** automatically
3. **Click days** to see history
4. **Find workout** if you want a specific match
5. **Share** via WhatsApp

### Toggle Sources
1. Go to **Sources** tab
2. Click toggle to enable/disable
3. Disabled sources won't show (but data is kept)

---

## 📱 Mobile Use

### Add to Home Screen
**iPhone:**
1. Open in Safari
2. Tap share icon
3. "Add to Home Screen"

**Android:**
1. Open in Chrome
2. Menu → "Add to Home Screen"

Now it's like a native app! 📲

---

## 🔮 Future Features (NOT in Phase 1)

- Scheduled WhatsApp notifications
- User-defined notification times
- Generic "add any source" system
- Workout history charts
- Personal workout log

These are **documented only**, not implemented.

---

## 💡 Why Phase 1 is Simple

### What We Did NOT Build:
- ❌ Generic scraper engine
- ❌ Plugin system
- ❌ "Add any website" feature
- ❌ AI workout generation
- ❌ Workout modification

### Why?
1. **Get it working first**
2. **Real users** > Perfect architecture
3. **5 sources is enough** to validate the idea
4. **Can always expand later**

---

## 🔐 Privacy & Data

- All data is **public** (GitHub Pages)
- No user accounts
- No tracking
- No cookies
- Toggle settings saved in **localStorage** (browser only)
=======
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
>>>>>>> 1d69df1 (Initial commit from new folder)

---

## 📞 Support

<<<<<<< HEAD
### Having Issues?

1. **Check the logs:**
   - Actions tab → Latest run → Click to see details

2. **Check the data:**
   - Browse to `data/workouts.json` in your repo

3. **Test locally:**
   ```bash
   cd backend
   pip install requests beautifulsoup4
   python fetch_all.py
   ```

4. **Open an issue:**
   - Go to your repo → Issues → New issue

---

## 🎉 You're Done!

Your app is now:
- ✅ **Live** on GitHub Pages
- ✅ **Fetching** daily at 6 AM
- ✅ **Working** with 5 sources
- ✅ **Ready** for daily use

**Bookmark your GitHub Pages URL and check it every morning!**

---

## 🦆 Enjoy Your Workouts!

Built with simplicity and clarity for the CrossFit community.

**Phase 2** (generic scrapers, notifications) coming later.  
For now: **train hard, code simple.** 💪
=======
**Common Fix**: If pages isn't working:
1. Make sure `index.html` is in repository ROOT
2. GitHub Pages folder = **/ (root)**
3. NOT /frontend!

---

Built with focus on stability over elegance. 🦆💪
>>>>>>> 1d69df1 (Initial commit from new folder)
