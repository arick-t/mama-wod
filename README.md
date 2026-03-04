# 🦆 DUCK-WOD - Version 19.7

**CrossFit Workout Aggregator** - Daily WODs from 10 sources

## ✅ v19.7 - Sources polish & UI cleanup (Feb 2026)

- ✅ **MYLEO**: Score/stimulus as notes; aerobic power [vo2 max] & muscular endurance as notes; block spacing.
- ✅ **CF 1013**: Article-based parsing (Strength / WOD); sub-subheading for WOD name; pagination (2 weeks history); Saturday single block.
- ✅ **Benchmarks**: No duplicate name line; 15-day unique window.
- ✅ **UI**: Removed debug “last fetch” / “reload data” row.

**Status**: 10/10 sources working • ~140 WODs • 100% clean

## 🚀 Quick Upgrade

```bash
unzip duck-wod-v19.7.zip
cd your-repo && rm -rf * 
cp -r ../duck-wod-v19.7/* . && cp ../duck-wod-v19.7/.gitignore . && cp -r ../duck-wod-v19.7/.github .
git add . && git commit -m "🔧 v19.7" && git push
```

Workflow runs automatically after push!

## 📋 Sources

**Special**: Hero • Benchmark • Open  
**Boxes**: myleo • CrossFit.com • Restoration • 1013 • Panda • Ton Bridge • Linchpin

---

**Version 19.7** • Feb 2026 • All systems operational ✅
