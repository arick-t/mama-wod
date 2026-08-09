# Case study: whole-brick rest-day shift (2026-08-09)

## Athlete ask (whole-brick FAB)
Skipped planned rest → spontaneous session today (run / back squat / deadlift / AMRAP pull-ups) → rest tomorrow. Reported workout details in Hebrew via **Coach · whole brick**.

## Observed failures
1. Calendar day titles / roles did not reflect the schedule shift (today still wrong; tomorrow not Rest).
2. Tomorrow was not set to Rest.
3. Many repetitive coach turns (equipment, goals, feeling) — re-intake feel; breaks POL-022.
4. Injury / “cannot evaluate physical risks” framing on a normal schedule swap.
5. **Missing core:** coach did not *process* today’s completed work as real training load and fold it into the remaining brick (only talked about it).

## Target behavior (POL-022 + POL-023 + POL-024 + POL-026)
1. **Ingest today’s session** — parse what was done (movements, loads, volume, duration) and treat it as completed training load for Israel-today.
2. **Calendar truth** — keep/show today’s performed work (do not wipe it into Rest); set **tomorrow → Rest** when asked.
3. **Weigh into the plan** — after Confirm, surgically bias remaining days: recover overlapping lifts/engine already taxed; do not full-redesign the brick.
4. **Chat** — one short line, e.g.  
   `Schedule: log today’s session, rest tomorrow, ease overlapping load later this week. Confirm?`  
   → on confirm apply WEEK/DAY JSON → `Done.`
5. **Safety** — injury disclaimer only for pain/injury/distress language — never for “I trained on a rest day.”

## Budget (2026-08-09)
**Approved-with-conditions.** Target ~3 units/success (1× Confirm chat + 1× surgical apply).
Hard gates in code: apply only after explicit Confirm; no `generate_block` / Soft Upgrade / large rebuild B / full `BLOCK_JSON` on this path; if no WEEK/DAY JSON after Confirm → local tomorrow→Rest only; `[ATHLETE_EXTRA_SESSIONS]` ≤2 short notes.

## Branch
`cursor/fix-whole-brick-rest-shift-d279`
