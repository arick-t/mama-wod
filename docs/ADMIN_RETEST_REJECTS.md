# Admin retest rejects — **SHIPPED** Admin 1.5.9 (production)

**Merged:** 2026-08-12 · `main` · PR #79  
**Live:** GitHub Pages `https://arick-t.github.io/mama-wod/admin.html` · API `https://mama-wod.vercel.app`

## Production baseline (now live)
- Admin **1.5.9** · Coach **2.3.6**
- GitHub Pages admin → Vercel API (`adminApiUrl`)
- Intake 1:1 · Build plan · FAB hidden · numeric keyboards
- Same-athleteId reclaim + fresh Terms on new intake sitting

## Rejects — all fixed in 1.5.9
1. **FAB visible during +מתאמן** — FAB outside `#app`, `admin-intake-open`, `hidden`.
2. **Numeric keyboards** — shared `CoachIntakeSync`, `#intake-fixed lang=en`.
3. **Build plan fails step 9** — `adminApiUrl` → Vercel; admin auth + retries.

## Retest checklist
1. Hard refresh admin (1.5.9 in title/badge).
2. Login → +מתאמן → full intake → Build plan (~3 min).
3. Verify handoff link opens claim.html on GitHub Pages path.
