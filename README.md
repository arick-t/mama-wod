# 🦆 DUCK-WOD - Version 19.4

**CrossFit Workout Aggregator** - Daily WODs from 10 sources

## ✅ v19.4 - Timer Fullscreen & Weights (Feb 27, 2026)

- ✅ **Timer fullscreen**: One shared AudioContext on Start — beep/whistle/bell at every work↔rest transition (mobile-friendly). "Overall Time" at top; phase name larger; Round left, Set right; Pause between LAST/NEXT; ▶/⏸/Close
- ✅ **Stopwatch (For Time)**: Count-up with filling ring; bell at start, whistle at rest; config tightened
- ✅ **Weights**: Every "X lb" shown as "X lb (Y kg)" in all sources (incl. Open)
- ✅ **CrossFit.com**: Sundays return no WOD; day bar shows 14 non-Sunday days
- ✅ **Dev**: `DEV.md`, `serve-mobile.ps1` / `serve-mobile.cmd` for phone testing

**Status**: 10/10 sources working • ~140 WODs • 100% clean

## 🚀 Quick Upgrade

```bash
unzip duck-wod-v19.4.zip
cd your-repo && rm -rf * 
cp -r ../duck-wod-v19.4/* . && cp ../duck-wod-v19.4/.gitignore . && cp -r ../duck-wod-v19.4/.github .
git add . && git commit -m "🔧 v19.4" && git push
```

Workflow runs automatically after push!

## 📋 Sources

**Special**: Hero • Benchmark • Open  
**Boxes**: myleo • CrossFit.com • Restoration • 1013 • Panda • Ton Bridge • Linchpin

---

**Version 19.4** • Feb 27, 2026 • All systems operational ✅
