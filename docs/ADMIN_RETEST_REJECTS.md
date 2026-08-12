# Admin retest rejects — accumulate only (DO NOT auto-ship)

Branch: `cursor/admin-retest-rejects-f8bf`  
Base: `main` (post Admin **1.5.8** · Coach **2.3.6**)  
Rule: free-form notes → confirm understanding → append here → **one batch** when founder says start. Do not merge until asked.

## Production baseline (now live)
- Admin **1.5.8** · Coach **2.3.6**
- Intake 1:1, Build plan retry, hide FAB during +מתאמן
- Same-athleteId reclaim + fresh Terms / declaration date on new intake sitting

## Open rejects
1. **FAB stays visible during +מתאמן (2026-08-12):** Athlete chat FAB (duck + selected name, e.g. עדי) floats over intake step 2/9 on phone Safari. Expected: hidden for entire intake modal. Fix: move FAB outside `#app` (iOS fixed-in-overflow), `body.admin-intake-open` + `hidden` attribute, sync on open/start/close.
2. **Numeric keyboards not like app (2026-08-12):** Lifts step (5/9) opens Hebrew keyboard on admin (`lang="he"` page) instead of decimal keypad. Expected: same as athlete app. Fix: shared `CoachIntakeSync.renderFixedLiftsRowsHtml` / `renderFixedProfileInputHtml` with `lang="en"` + `inputmode` on numeric fields; `#intake-fixed` forced `lang=en dir=ltr`.

## Hard constraints
- Workout programming quality non-negotiable.
- Athlete-app intake = source of truth; admin reuses 1:1.
- Do not auto-push coach upgrades to all athletes.
