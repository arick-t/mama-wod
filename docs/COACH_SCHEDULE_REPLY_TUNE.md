# Coach schedule-change reply tuning

Branch: `cursor/coach-schedule-reply-tune-f8bf`  
Base: `main` (Coach **2.3.6**)  
Status: **open — accumulate only** (do not merge until founder asks)

## Goal

When an athlete asks to **change training schedule** (whole-brick FAB or brick chat), the coach must:

1. Map the note → `weeklySchedule` / `activeRecovery` (POL-024) — **not** re-intake.
2. Reply with **one short Confirm? line** naming the schedule change only (POL-022).
3. After confirm → surgical WEEK/DAY JSON on **remaining days** only (POL-023).
4. **Never** injury disclaimer / equipment re-ask / goals review on pure schedule swaps.

## Related policy (already shipped)

| Rule | Role |
|------|------|
| POL-022 | One short Confirm? before apply |
| POL-023 | Surgical edit, remaining days only |
| POL-024 | Map note → intake section; freeze others |
| POL-026 | Unplanned session + rest shift (Budget gates in client) |

Case study: `docs/case-studies/whole-brick-rest-shift-2026-08-09.md`

## Known gaps to tune (founder queue)

1. **General schedule change** (not POL-026): e.g. “train Tue/Thu instead of Mon/Wed” — coach may still reply with paragraphs, re-ask intake, or injury framing.
2. **POL-026 client override** is hard-coded to one English Confirm? line — may not match athlete’s actual ask (different rest day, no extra session, Hebrew note).
3. **Post-confirm chat** should stay `Done.` / `Updated.` — no follow-up questions.
4. **Calendar truth** after confirm: day titles / Rest roles must match the agreed shift (see 2.3 LOGGED + tomorrow Rest).

## Files (likely touch)

- `api/personal-coach.js` — BRICK / WHOLE-PROGRAM prompt block (POL-024 / POL-026 examples for schedule-only)
- `api/coach-policy.js` — POL-024 / POL-026 wording if policy-level
- `index.html` — `pprogClassifyIntakeSections`, POL-026 gates, Confirm? template, `pprogApplyPol026CalendarTruth`
- `scripts/` — regression tests for schedule-note classification + forced Confirm? shape

## Hard constraints

- Workout programming quality non-negotiable — no weaker model path for applies.
- No full `generate_block` / large rebuild on schedule-only notes.
- Apply only after explicit confirm (`yes` / `כן` / Confirm).

## Test notes (manual)

1. Whole-brick: “מחר מנוחה במקום היום” → one Confirm? → calendar shows tomorrow Rest.
2. Whole-brick: “שנה אימונים לימים א', ג', ה'” → Confirm? names new training days → remaining weeks updated surgically.
3. Must **not** trigger injury disclaimer or equipment questions.
