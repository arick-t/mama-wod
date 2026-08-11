# Admin remote audit — accumulated tasks (DO NOT auto-ship until founder merges)

Collected from founder remote session (production retest ongoing).
Branch: cursor/admin-remote-audit-batch-f8bf
Rule: accumulate → one batch of work. Do not merge to main until founder asks.

## Already shipped to production (this session — should have waited)
- Admin 1.5.3 All skills beside title + toggle cubes (desktop fixed intake only)
- Admin 1.5.4 No injuries active chip
- Admin 1.5.5 Build plan coach video overlay + fail restore to Goals
- Admin 1.5.6 Handoff Terms gate: no pre-stamp legal; athlete signs on device before plan unlock

## Batch implemented on this branch (Admin 1.5.7 — awaiting founder merge)
1. **Delete persist:** tombstone instead of hard delete; seed cannot resurrect; list filters deleted.
2. **Delete revoke:** burn open claims; client push → `athlete_revoked` → wipe `duck-wod-personal-coach-v1` + keys.
3. **Phone → admin list:** `intake_complete` feedback mirrors snapshot server-side (writeKey required).
4. **Build plan Terms:** admin auth bypasses TERMS_REQUIRED; athlete device still gated.
5. **Active recovery UX:** nest days under Yes; no Thursday default; require day if Yes.
6. **Legal jsonl:** handoff Agree path already posts `/api/legal-agree` (unchanged; verify in retest).

## Founder findings (2026-08-11)
6. Delete athlete did not persist (אריק resurrected) — fixed via tombstone.
7. Phone join email without admin list — fixed via intake_complete mirror.
8–9. Skills / Injuries OK (accepted).
10. Active recovery hierarchy + no Thu default — fixed.
11. Build plan Terms acceptance required — fixed via admin auth bypass.

## Hard constraints
- Prefer phone athlete intake UX over desktop admin if conflict.
- Do not auto-push coach upgrades to all athletes.
- Workout programming quality non-negotiable.
