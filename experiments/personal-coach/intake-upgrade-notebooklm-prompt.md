# NotebookLM prompt — Intake upgrade: DUCK-WOD vs Competitors Questionnaire

**How to use:** Paste into NotebookLM with these sources loaded (same notebook or uploaded PDFs):
1. **CrossFit Specialty Course: Competitors Training Guide** (Athlete Questionnaire + Assessment Web sections)
2. Optional companion: **NSCA Load Chart** (only for load/% context — not the questionnaire form)
3. Optional: this prompt itself as the “current product intake” source of truth

Ask NotebookLM to answer in **English**, structured, product-ready (bullets + priority). Do **not** invent fields not in the sources.

---

## Prompt (copy from here)

```
You are advising a product team building an AI Personal Coach for CrossFit-style athletes (DUCK-WOD / Personal Coach).

### Goal
Compare our CURRENT live athlete intake questionnaire to the Athlete Questionnaire + Assessment Web in the CrossFit Competitors Training Guide. Recommend precise upgrades that improve programming accuracy WITHOUT turning intake into a long medical/lifestyle survey.

### Product constraints (HARD — respect these)
- Intake must stay SHORT (mobile, high completion). Target: still finishable in a few minutes.
- After intake we build a 5-week brick; we already silently build an internal capability profile from lifts/run/skills/BW/gender (ratio tables + engine conversion). Blank lifts = unknown → estimate.
- We already have cost guardrails (~monthly envelope); do not recommend bloating intake “just in case.”
- We are AI software, not a clinician: no medical diagnosis questions; injuries stay programming constraints only.
- English UI; athlete may answer in any language.
- Do NOT recommend auto-regenerating existing plans when intake fields change later — surgical updates only.

### CURRENT live intake (source of truth — fixed 9-step app form)
1. Profile — name/nickname, gender, age, bodyweight (kg), training experience (free text)
2. Training setup — multi-select: well-equipped functional gym / conventional gym / other home or limited equipment (+ detail if limited)
3. Weekly schedule — which days train (Sun–Sat) + optional schedule notes
4. Active recovery — No / Yes + preferred weekday if Yes (macro deload is separate: week 5 preset)
5. Lifts — 1RM kg: Back Squat, Deadlift, Clean & Jerk, Snatch; plus 2000 m run time; blank = unknown
6. Skills checklist — Muscle-up, Handstand walk, HSPU, Pistol, Ring MU, Double-unders, Toes-to-bar, Pull-ups, Chest-to-bar (marked = Rx capable)
7. Session limits — free text (time / schedule constraints)
8. Injuries / limitations — free text (+ “no injuries” option)
9. Goals — free text for this block

What we intentionally do NOT ask today (and why we might still skip): height; sleep; nutrition detail; family/lifestyle essay; training partners; open-ended “strengths/weaknesses”; Front Squat/Press/Clean as separate 1RMs (we estimate from the four lifts).

### Comparator (from uploaded Competitors Training Guide)
Focus on:
- Athlete Questionnaire fields (demographics, lifestyle, CF tenure, athletic background, nutrition, sleep, schedule/family, equipment access, partners, strengths/weaknesses, goals, etc.)
- Assessment Web — how it drives weakness-targeted programming
- Any guidance on what is essential vs optional for programming decisions

### Deliverables (structured)
A) Coverage matrix — table: Competitors field/theme | Present in our intake? (Yes/Partial/No) | Programming value (High/Med/Low) | Athlete friction if added (High/Med/Low)
B) Ranked recommendations — top 7 changes only, format:
   Priority | Change | Why (programming) | Friction | Suggested UX (required / optional advanced / infer-don’t-ask)
C) Explicit DO NOT ADD — fields that look good in the Guide but are low ROI or high friction / out of scope for AI coach
D) Assessment Web — which 3–5 assessment dimensions matter most for our 5-week brick, and whether each should be: asked in intake, inferred from lifts/skills/run, or deferred to mid-brick Soft Upgrade
E) Minimal “Intake vNext” proposal — keep ≤11 steps if possible; mark each step Required vs Optional
F) Risks — over-collection, false precision, abandonment, cost of more tokens later

Be concrete. Prefer “add one checkbox / one short free-text” over new multi-page surveys. Cite the Guide section when recommending a field.
```

---

## Notes for us (not for NotebookLM)
- Source parked in Layer 2 distill as: “Assessment Web / NSCA load charts → Layer 3”.
- Live coach consult (separate) will be cross-checked against NotebookLM output.
