# Coach Learning Leap (branch-only until approved)

## Goal

Teach the Personal Coach via a **knowledge pyramid** + **living pattern docs**, without dumping raw workout archives into the brain.

## Pyramid (HARD)

1. **Base:** CrossFit L1 + L2 training guides (already in Drive מאגר).
2. **Second floor:** Athlete intake / goals (POL-016) + professional craft in Drive (articles, specialty docs) + **living pattern digests** distilled from scraped programming.
3. Never copy a scraped session verbatim. Patterns inspire; L1/L2 + athlete goals decide.

## Living documents

| File | Role | Update cadence |
|------|------|----------------|
| `living-knowledge/coach-patterns-myleo-restoration.md` | Deep patterns from myleo + Restoration | Weekly Sunday morning |
| `living-knowledge/coach-formats-warehouse.md` | Format vocabulary from Hero / Benchmark / Open warehouses | Rare / on demand |
| `knowledge-inbox/pro-coach-articles/*.md` | Extra craft articles (same weight as other Drive docs; not special vs L1/L2) | When you add + ask to sync |

## Production safety (non-negotiable)

- All code/policy/prompt work lands on branch `cursor/coach-learning-leap-d279` first.
- **Do not merge to `main` until workout quality is reviewed** (Vercel preview / local / sample brick).
- **`npm run coach:sync-brain` must not run against production File Search** until you explicitly approve — shared brain would affect live coach even before code merge.
- Weekly workflow emails a confirmation; brain sync stays **off** unless `COACH_BRAIN_SYNC_ENABLED=true` secret is set.

## Rollback

See `checkpoints/2026-07-31-before-learning-leap/README.md`.

## Weekly job

- Workflow: `.github/workflows/weekly-coach-patterns-digest.yml`
- Cron: Sunday 05:00 UTC (~08:00 Israel summer)
- Script: `scripts/coach-weekly-patterns-digest.js`
- Email via Resend (same pattern as analytics report) to confirm the digest ran.
