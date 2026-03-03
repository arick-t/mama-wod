# 🦆 DUCK-WOD - Version 19.5

**CrossFit Workout Aggregator** - Daily WODs from 10 sources

## ✅ v19.5 - Find Workout & Benchmarks (Feb 27, 2026)

- ✅ **Find Workout**: Always show top 3 from box sources (14 days); up to 3 from Hero/Benchmark/Open when checked. WOD-only scoring, equipment extra ≤1 preferred, labels (התאמה מלאה / זמן שונה). Unlimited time no longer zeros score; guards for empty data and bad workouts.
- ✅ **Benchmarks**: No duplicate names in 14-day view (Grace/Barbara once). Scraper: dedupe by name; parse `<ul>`/`<ol>`/`<li>` and headings so full content (e.g. Nicole) is captured. `fetch_benchmarks_for_days()` for unique benchmark per day.

**Status**: 10/10 sources working • ~140 WODs • 100% clean

## 🚀 Quick Upgrade

```bash
unzip duck-wod-v19.5.zip
cd your-repo && rm -rf * 
cp -r ../duck-wod-v19.5/* . && cp ../duck-wod-v19.5/.gitignore . && cp -r ../duck-wod-v19.5/.github .
git add . && git commit -m "🔧 v19.5" && git push
```

Workflow runs automatically after push!

## 📋 Sources

**Special**: Hero • Benchmark • Open  
**Boxes**: myleo • CrossFit.com • Restoration • 1013 • Panda • Ton Bridge • Linchpin

---

**Version 19.5** • Feb 27, 2026 • All systems operational ✅
