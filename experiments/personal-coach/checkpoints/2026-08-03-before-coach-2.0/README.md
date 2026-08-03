Rollback checkpoint — Coach 1.1 production brain (from origin/main before Coach 2.0).

To roll back brain to pre-2.0 functional state:
1. Copy coach-foundation-brief.js → api/coach-foundation-brief.js
2. Copy coach-policy.js → api/coach-policy.js (or restore coach-policy-rules.md + npm run coach:sync-policy)
3. Copy l1-l2-programming-foundation.md → experiments/personal-coach/living-knowledge/
4. Remove or stop requiring lib/coach-layer2-ops-brief.js from PROGRAMMING_SYSTEM_CORE
5. Set COACH_VERSION back to "1.1" in api/personal-coach.js and index.html
6. Redeploy Vercel + refresh GitHub Pages if needed

Do NOT use this checkpoint to revert unrelated UX from v21.2.3 (calendar/FAB) unless intentionally rolling those too.

