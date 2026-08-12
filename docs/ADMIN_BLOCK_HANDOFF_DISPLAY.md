# Admin block display + handoff UX — accumulate

Branch: `cursor/admin-block-handoff-display-f8bf`  
Base: `main` (Admin **1.5.9** · Coach **2.3.8**)  
Status: **open** — prompt sent to coach engine; code fixes after response.

## Founder report (2026-08-12)

- Intake 1:1 ✓
- Build plan very slow ✓ (completed)
- Handoff popup ✓ — need same link in athlete tab
- Block calendar **empty** («ללא תכנון» all days) — athlete «אריק מחשב 2»
- Block UI ≠ app pprog display

## Likely root cause (empty calendar)

`buildBlockWorkoutMap` returns `{}` when `currentBlock.blockStart` missing/invalid → all days «ללא תכנון».

## Target (same pipeline as intake)

1. **Data:** normalize block on `create_athlete` like app `applyPprogBlock`.
2. **UI:** reuse app pprog calendar + day card renders (shared or iframe contract).
3. **Handoff:** after `autoCreateLink`, store URL on snapshot + populate handoff section + copy button.

See prompt: `docs/ADMIN_BLOCK_EXPERIMENT_PROMPT.md`
