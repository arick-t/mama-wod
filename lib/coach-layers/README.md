# Coach layers — the knowledge the coach actually programs from

Each folder in the owner's Drive becomes **one compact operational prompt** in this directory.
A prompt is not a summary of its sources: it is the set of decisions, thresholds and numbers a
coach needs while writing a session, phrased so a model can obey it.

## Why prompts and not retrieval

`/api/personal-coach` runs every programming call with `skipTools: true` — Gemini File Search is
**off** on the programming path. So four HARD rules (POL-006 / POL-017 / POL-018 / POL-021) order
the coach to use the מאגר while the מאגר is unreachable. These modules close that gap by
delivering the knowledge as text, at a cost we can measure, with no retrieval to miss.

## Provenance — how each prompt was written

1. **Gemini read the source PDFs** (`gemini-3.6-flash`, PDFs sent inline, temperature 0) with an
   extraction prompt: every rule, threshold, percentage, rep range and table, verbatim, no
   summarising. Raw extractions are kept out of the repo; regenerate with the script in the
   session scratchpad if a source changes.
2. **The prompt was authored from that extraction** — deduplicated against POL-001…POL-029 and
   against `api/coach-foundation-brief.js` / `lib/coach-layer2-ops-brief.js`, fitted to the
   BLOCK/WEEK/DAY JSON contract, and held to a character budget.
3. **The owner approved it.** Nothing here ships unapproved.

Extraction was done by Gemini rather than by reading the PDFs locally for a measured reason: a
hand-rolled extractor recovered **0 characters** from `יחידות המרה - טבלה 3.pdf` and **1 digit**
from two other conversion sources. Gemini returned the full %1RM chart. For a layer whose content
*is* numbers, that difference is the whole product.

## Which layer lights up when

See `index.js`. In short: layer 1 and layer 2-general are always on for programming; layer
2-individual only for the personal-coach agent; layer 3 by discipline; injuries only when a named
injury exists; the equivalence table always (it is a dictionary, not doctrine).

## Rules of the house

- **Numbers are quoted from the source.** Never invent a threshold. If a source does not give one,
  the prompt says so rather than filling the gap.
- **No source names.** POL-007 — nothing here may reveal where the knowledge came from.
- **English only.** The workout JSON is English (POL-004); Hebrew in a prompt leaks into output.
- **A prompt is instructions, not prose.** "Rotate M/G/W so no modality is the focus twice in a
  row" — not "CrossFit values constantly varied functional movement."
