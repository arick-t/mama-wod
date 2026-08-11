# Admin remote audit — accumulated tasks (DO NOT auto-ship)

Collected from founder remote session (production retest ongoing).
Branch: cursor/admin-remote-audit-batch-f8bf
Rule: accumulate → one batch of work. Do not merge to main until founder asks.

## Already shipped to production (this session — should have waited)
- Admin 1.5.3 All skills beside title + toggle cubes (desktop fixed intake only)
- Admin 1.5.4 No injuries active chip
- Admin 1.5.5 Build plan coach video overlay + fail restore to Goals
- Admin 1.5.6 Handoff Terms gate: no pre-stamp legal; athlete signs on device before plan unlock

## Still open / verify in production retest
1. After deleting an athlete in admin — device must lose access to that block (not leftover localStorage from before admin sync). Verify claim/ownership revoke path.
2. Coach 2.3.3 connected to +athlete / intake — verified earlier; re-confirm after new plan build.
3. Desktop admin fixed intake UX polish (if more found in retest).
4. Build plan end-to-end: GIF/video → real brick → one-time link → athlete opens → Terms → then plan.
5. Legal signature must land in legal-agreements.jsonl on Agree (handoff path).

## Founder findings (2026-08-11, production /admin.html ~1.5.5)
6. **Delete athlete does not persist:** Deleted "אריק" in admin; after refresh he reappeared (still Active / Coach Member, still in tabs). Admin showed "2 trainees" (אריק + עדי). Delete UI exists but server/Blob snapshot appears to resurrect the athlete — not just device localStorage leftover.
7. **Phone self-serve signup not landing in admin list:** Opened new user on phone with full intake; join email arrived (~21:11) subject/body like "! אריק פלא has joined the DUCK'S" from DUCK-WOD. Admin still showed only 2 trainees — new athlete never appeared in admin module tabs/count. Analytics/join email fired; admin Blob athlete list apparently not updated from phone registration path.
8. **Desktop fixed intake Skills (OK):** Step 6/9 — "All skills" beside Skills title + all skill cubes checked looks good (founder confirmed). Keep as accepted for 1.5.3 UX.
9. **Desktop fixed intake Injuries (OK):** Step 8/9 — "No injuries" active chip (✓ + teal) + field looks good (founder confirmed). Keep as accepted for 1.5.4 UX.
10. **Active recovery day UX (confusing):** Step ~4/9 — Yes/No alone is good. When days expand under Yes, create a clear visual branch/indent hierarchy so day list is obviously nested under the Yes answer (not same level as Yes/No). Also: do **not** default-select Thursday (or any day); leave day unselected until athlete picks.

## Hard constraints
- Prefer phone athlete intake UX over desktop admin if conflict.
- Do not auto-push coach upgrades to all athletes.
- Workout programming quality non-negotiable.
