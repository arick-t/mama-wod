# 🦆 DUCK-WOD - Version 19.1

**CrossFit Workout Aggregator** - Your daily WODs from multiple sources

---

## 🎉 What's New in Version 19.1

### 🔧 Bug Fixes from v19:

1. **🏋️ Benchmarks** - Fixed text extraction issues
   - No more broken words from underlines (e.g., "Deadlift" not "Deadlift\ns")
   - Gender weights displayed as notes (*♀ 55 lb ♂ 75 lb*)
   - Better 14-day randomization

2. **🏃 Ton Bridge** - Cleaner output
   - Separator line (By NAME|DATE) is now excluded
   - Better section title parsing (STRENGTH, METCON)
   - No more author/date lines in workout content

3. **🏆 Open WODs** - Finally working!
   - Successfully scrapes from WodWell
   - 14-day rotation (no repeats)
   - Gender weights as notes
   - Clean workout content

### 📊 Current Status:
- ✅ **10/10 sources working**
- ✅ **~140 WODs** across 14 days
- ✅ **100% clean workouts**

---

## 🌐 Live Sources

### Special Workouts (3):
1. 🦸 **Hero Workouts** - Famous CrossFit hero WODs
2. 🏋️ **Benchmark Workouts** - Classic benchmarks (Fran, Grace, etc.)
3. 🏆 **Open Workouts** - CrossFit Games Open workouts

### Box Workouts (7):
4. **myleo CrossFit** (Germany) - 14-day archive
5. **CrossFit.com** - Official daily WOD
6. **CrossFit Restoration** - 14-day archive
7. **CrossFit 1013** - 14-day archive
8. **CrossFit Panda** - 14-day archive
9. **CrossFit Ton Bridge** (UK) - 14-day archive
10. **CrossFit Linchpin** - Today only

---

## 📂 Project Structure

```
duck-wod/
├── .github/workflows/daily-fetch.yml
├── .gitignore
├── README.md
├── CHANGELOG.md
├── _headers
├── index.html
├── backend/
│   ├── fetch_all.py
│   ├── requirements.txt
│   └── scrapers/
│       ├── benchmarks.py      # ✨ FIXED v19.1
│       ├── tonbridge.py       # ✨ FIXED v19.1
│       ├── open_wods.py       # ✨ FIXED v19.1
│       └── ... (9 more)
└── data/
    └── workouts.json
```

---

## 🚀 Quick Start

### 1. Clone & Setup
```bash
git clone https://github.com/YOUR-USERNAME/duck-wod.git
cd duck-wod
```

### 2. Test Locally
```bash
cd backend
pip install -r requirements.txt
python fetch_all.py
```

### 3. Deploy to GitHub Pages
- Settings → Pages → Source: "/ (root)"
- Your site: `https://YOUR-USERNAME.github.io/duck-wod/`

### 4. Enable GitHub Actions
- Actions tab → Enable workflows
- Runs daily at 5 AM Israel time (3 AM UTC)
- Manual trigger available

---

## 🎨 Features

### Browse Tab 📅
- 14 days navigation
- Special workout indicators (Hero/Benchmark/Open)
- Source filtering
- WhatsApp sharing

### Find Tab 🔍
- Smart workout matching
- Equipment filtering (16 types)
- Time filtering
- Special workout options

### Sources Tab ⚙️
- Enable/disable sources
- Reorder (▲▼)
- Toggle all
- Reset defaults

---

## 📝 Version History

### v19.1 (Current) - February 15, 2026
- 🔧 Fixed Benchmarks text extraction
- 🔧 Fixed Ton Bridge separator line
- 🔧 Fixed Open WODs scraping
- ✅ All 10 sources working perfectly

### v19 - February 15, 2026
- 🔧 Fixed Heroes (full workouts)
- 🔧 Fixed Benchmarks (correct titles)
- 🔧 Fixed Ton Bridge (new URL)
- 🔧 Re-enabled Open WODs

### v18 - February 10, 2026
- Initial public release

---

## 🐛 Troubleshooting

### Test Individual Scrapers
```bash
cd backend/scrapers
python benchmarks.py
python tonbridge.py
python open_wods.py
```

### Check Actions Logs
1. Actions tab → Latest run
2. Expand "Fetch workouts"
3. Look for error messages

---

## 📄 License

MIT License - feel free to use and modify!

---

## 🦆 DUCK-WOD Team

**Version**: 19.1
**Last Updated**: February 15, 2026
**Status**: ✅ All systems operational
