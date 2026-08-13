# Admin block display + handoff UX — accumulate

Status: **round 1 shipped** (Budget 2026-08-13) — T1+T2 (+ T3 debounce). T4 blocked.

## Founder report (2026-08-12)

- Intake 1:1 ✓
- Claim link ✓ — athlete sees correct brick
- Admin calendar was Gregorian / «ללא תכנון» / forked day-card

## Round 1 (Admin 1.5.11)

1. **T1 data:** `NormalizePprogBlock.normalize` on every `loadAthletes` / before block render.
2. **T2 UI:** shared `lib/pprog-display.js` — 5-week brick calendar + day card + parts. Admin + app call the same module. Admin shell unchanged. Block area is `readOnly` (no Done/chat write, no `personal-coach`).
3. **T3 Athlete→Admin (0 AI):** `pprogPushAdminSnapshotDebounced` after DONE/`finishFeedback` and after Terms accept. Existing `pushAdminSnapshot` payload.
4. **T4 Admin→Athlete edit:** not in this round.

## Not in this round

Human coach editing a day in admin → device. Needs a separate Budget ruling.
