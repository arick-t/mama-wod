# 🦆 DUCK-WOD — גרסה **19.8** (`package.json`: `19.8.0`)

**CrossFit Workout Aggregator** - Daily WODs from 10 sources

> הגרסה המוצגת באתר היא **v19.8** (בכותרת ובפס המשני). מקור אמת: `VERSION` + `package.json` — ראו `docs/VERSIONING.md`.

## ✅ v19.8 (Mar 2026)

- שעון: מסך מלא / פריסות, שדרוגי צליל (Web + Capacitor), CI workflows.
- סנכרון מספור גרסאות (בעבר `package.json` היה 1.x וה־UI היה v19.7 — מאוחד ל־**19.8.0**).

## ✅ v19.7 (Feb 2026) — Sources polish & UI cleanup

- ✅ **MYLEO**: Score/stimulus as notes; aerobic power [vo2 max] & muscular endurance as notes; block spacing.
- ✅ **CF 1013**: Article-based parsing (Strength / WOD); sub-subheading for WOD name; pagination (2 weeks history); Saturday single block.
- ✅ **Benchmarks**: No duplicate name line; 15-day unique window.
- ✅ **UI**: Removed debug “last fetch” / “reload data” row.

**Status**: 10/10 sources working • ~140 WODs • 100% clean

## 🚀 Quick Upgrade

```bash
unzip duck-wod-v19.8.zip
cd your-repo && rm -rf * 
cp -r ../duck-wod-v19.8/* . && cp ../duck-wod-v19.8/.gitignore . && cp -r ../duck-wod-v19.8/.github .
git add . && git commit -m "🔧 v19.8" && git push
```

Workflow runs automatically after push!

## 📋 Sources

**Special**: Hero • Benchmark • Open  
**Boxes**: myleo • CrossFit.com • Restoration • 1013 • Panda • Ton Bridge • Linchpin

---

**Version 19.8** • Mar 2026 • All systems operational ✅
