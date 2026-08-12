# Admin retest rejects — accumulate only (DO NOT auto-ship)

Branch: `cursor/admin-retest-rejects-f8bf`  
Base: `main` (post Admin **1.5.8** · Coach **2.3.6**)  
Rule: free-form notes → confirm understanding → append here → **one batch** when founder says start. Do not merge until asked.

## Production baseline (now live)
- Admin **1.5.8** · Coach **2.3.6**
- Intake 1:1, Build plan retry, hide FAB during +מתאמן
- Same-athleteId reclaim + fresh Terms / declaration date on new intake sitting

## Open rejects (fixed on branch — pending founder retest)
1. **FAB stays visible during +מתאמן** — fixed: FAB outside `#app`, `admin-intake-open`, `hidden`.
2. **Numeric keyboards not like app** — fixed: shared `CoachIntakeSync` numeric HTML, `#intake-fixed lang=en`.
3. **Build plan fails at step 9** — fixed: `getAdminApiBase` / `adminApiUrl` → `mama-wod.vercel.app`; admin auth + retries.

Admin **1.5.9** on branch (was 1.5.8 on main).

## Hard constraints
- Workout programming quality non-negotiable.
- Athlete-app intake = source of truth; admin reuses 1:1.
- Do not auto-push coach upgrades to all athletes.
