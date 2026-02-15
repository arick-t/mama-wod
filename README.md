# 🦆 DUCK-WOD - Version 19

**CrossFit Workout Aggregator** - Your daily WODs from multiple sources

---

## 🎉 What's New in Version 19

### 🔧 Fixed Scrapers:

1. **🦸 Heroes Workouts** - Full workouts now captured (no more cuts on Fri/Sat)
2. **🏋️ Benchmarks** - Correct titles (Christine, Fran, etc.) + clean text
3. **🏃 Ton Bridge** - New URL (`/wod/`) with stable scraping
4. **🏆 Open WODs** - RE-ENABLED! Now works perfectly with 14-day rotation

### 📊 Current Status:
- ✅ **10/10 sources working** (up from 6/10)
- ✅ **~140 WODs** across 14 days
- ✅ **100% complete workouts**

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
├── .github/
│   └── workflows/
│       └── daily-fetch.yml    # GitHub Actions workflow
├── backend/
│   ├── fetch_all.py           # Main scraper runner
│   ├── requirements.txt       # Python dependencies
│   └── scrapers/
│       ├── heroes.py          # ✨ FIXED v19
│       ├── benchmarks.py      # ✨ FIXED v19
│       ├── tonbridge.py       # ✨ FIXED v19
│       ├── open_wods.py       # ✨ FIXED v19
│       ├── myleo.py
│       ├── crossfit_com.py
│       ├── linchpin.py
│       ├── restoration.py
│       ├── cf1013.py
│       ├── panda.py
│       └── others.py
├── data/
│   └── workouts.json          # Generated automatically
├── _headers                   # Cache control headers
├── index.html                 # Web UI
├── README.md
└── .gitignore
```

---

## 🚀 Quick Start

### 1. Clone & Setup
```bash
git clone https://github.com/YOUR-USERNAME/duck-wod.git
cd duck-wod
```

### 2. Test Locally (Optional)
```bash
cd backend
pip install -r requirements.txt
python fetch_all.py
```

### 3. Deploy to GitHub Pages
```bash
# Settings → Pages → Source: "/ (root)"
# Your site will be at: https://YOUR-USERNAME.github.io/duck-wod/
```

### 4. Enable GitHub Actions
The workflow runs automatically daily at 5 AM Israel time (3 AM UTC)

You can also trigger it manually:
- Go to "Actions" tab
- Select "🦆 Daily Workout Fetch"
- Click "Run workflow"

---

## 🎨 Features

### Browse Tab 📅
- Navigate 14 days of workouts
- Visual indicators for special workouts (Hero/Benchmark/Open)
- Filter by source
- Share to WhatsApp

### Find Tab 🔍
- Smart workout finder
- Filter by:
  - Available time (or unlimited)
  - Equipment available (16 types)
  - Include/exclude special workouts
- Top 3 matches with score

### Sources Tab ⚙️
- Enable/disable sources
- Reorder with drag-and-drop (▲▼)
- Toggle all on/off
- Reset to defaults
- Archive indicators (✅ 14 days / ⚠️ Today only)

---

## 🛠️ Technical Details

### Scraping Strategy
- **Archive sources**: Fetch all 14 days
- **Today-only sources**: Fetch current day only
- **Caching**: Skip already-fetched workouts
- **Error handling**: Continue on individual scraper failures

### Data Format
```json
{
  "workouts": {
    "2026-02-15": [
      {
        "date": "2026-02-15",
        "source": "myleo",
        "source_name": "myleo CrossFit",
        "url": "https://...",
        "sections": [
          {
            "title": "WARM-UP",
            "lines": ["line 1", "line 2"]
          }
        ]
      }
    ]
  },
  "last_updated": "2026-02-15T10:30:00"
}
```

---

## 🐛 Troubleshooting

### Scrapers failing?
```bash
cd backend/scrapers

# Test individual scraper
python heroes.py
python benchmarks.py
python tonbridge.py

# Run full fetch
cd ..
python fetch_all.py
```

### No workouts showing?
1. Check `data/workouts.json` exists
2. Run GitHub Actions workflow manually
3. Check Actions logs for errors

### Cache issues?
The `_headers` file prevents browser caching:
```
/*
  Cache-Control: no-cache, must-revalidate

/data/workouts.json
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
```

---

## 📝 Version History

### v19 (Current) - February 15, 2026
- 🔧 Fixed Heroes (full workouts)
- 🔧 Fixed Benchmarks (correct titles)
- 🔧 Fixed Ton Bridge (new URL)
- 🔧 Re-enabled Open WODs
- ✅ 10/10 sources working

### v18
- Initial public release
- 6 working sources

---

## 🤝 Contributing

Found a bug? Want to add a new source?

1. Fork the repo
2. Create a new scraper in `backend/scrapers/`
3. Add it to `fetch_all.py`
4. Test locally
5. Submit a PR

---

## 📄 License

MIT License - feel free to use and modify!

---

## 🙏 Credits

- **Scraped Sources**: myleo, CrossFit.com, Restoration, 1013, Panda, Ton Bridge, Linchpin
- **Special Workouts**: WodConnect (Heroes/Benchmarks), WodWell (Open)
- **Built with**: Python, BeautifulSoup, Vanilla JS

---

## 🦆 DUCK-WOD Team

**Version**: 19
**Last Updated**: February 15, 2026
**Status**: ✅ All systems operational

---

**Need help?** Check the detailed fix documentation or open an issue!
