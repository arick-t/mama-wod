# Warehouse format vocabulary — Hero / Benchmark / Open

**Status:** stable reference (rare updates).  
**Sources:** `data/special_cache.json` warehouses (scraped once / refreshed rarely).  
**Use:** format literacy + occasional intentional inclusion when it matches athlete goals.  
**Never:** verbatim Hero/Open/Benchmark text as the athlete’s programmed day (IP + pedagogy).

---

## Purpose

Give the coach a **format dictionary** and judgment rules for when a classic test piece (or its *structure*) belongs in a personal plan.

---

## Snapshot (as of 2026-07-31)

| Warehouse | Approx. size | Dominant shapes |
|-----------|--------------|-----------------|
| Heroes | ~250 workout-like entries | Mostly **For Time** chippers / couplets with runs, pull-ups, burpees, cleans, deadlifts, box jumps |
| Benchmarks | ~36 named girls/heroes-style tests | **For Time**, ladders (e.g. 50-40-…), some AMRAP; classic couplets/triplets (thruster+pull-up, DL+HSPU, etc.) |
| Open (Games Open) | ~69 workouts across 2011–2026 | Heavy **AMRAP / complete-as-many**; also For Time; frequent DU, thrusters, snatches, C2B/BMU, TTB, burpees, box, wall-ball |

---

## Format vocabulary to master

1. **For Time chipper** — long task list, one clock; pacing and break strategy matter.
2. **Couplet / Triplet For Time** — 2–3 movements, often descending or fixed rounds (incl. 21-15-9 family).
3. **AMRAP (fixed window)** — score = rounds+reps; Open-style repeatability and standards.
4. **Ladder** — ascending/descending rep schemes (Annie-style, etc.).
5. **Buy-in / cash-out** — rare spice; use sparingly.
6. **Hero volume tax** — long mono (800m–1 mile) + loaded work; respect recovery and athlete level.

---

## When to include (second-floor judgment)

Include a classic **structure** or a rare named-test *inspired* day only if:

- Athlete goal benefits (e.g. Open prep → Open-like AMRAP standards; mental grit → controlled Hero-style chipper);
- It fits the week’s interference and recovery;
- Loads/reps are scaled via athlete profile (POL-016) and scaling craft (POL-006);
- It does **not** replace L1 variety for the whole brick.

Default brick: original programming. Classics are **seasoning**, not the meal.

---

## How to learn from warehouses (without copying)

- Extract **shape**: time domain, number of movements, mono vs gymnastics vs weightlifting mix.
- Extract **standard culture**: unbroken expectations, movement standards, score types.
- Rebuild a fresh piece with different movements/loads that hit the same training effect for **this** athlete.

---

## Anti-patterns

- Pasting Fran/Diane/Open XX.X text into Personal Coach JSON.
- Scheduling Hero-volume every week for a general GPP athlete.
- Revealing warehouse / source names (POL-007).

---

## Changelog

### 2026-07-31 — first fill
- Built format vocabulary from special_cache heroes / benchmarks / open counts and dominant shapes.
