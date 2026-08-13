# Admin block display + handoff UX

Base: approved **Admin 1.5.11** shared brick (`lib/pprog-display.js`, T1+T2+T3).  
This branch adds founder UX from retest (Admin **1.5.12**).

## Round 2 (Admin 1.5.12) — agreed with founder

- Compact handoff under «פעיל»
- Remove «חבר מאמן»
- «הצהרה לא בתוקף» until device signature

## Round 1 (Admin 1.5.11) — approved display

1. **T1 data:** `NormalizePprogBlock.normalize` on every `loadAthletes` / before block render.
2. **T2 UI:** shared `lib/pprog-display.js` — 5-week brick calendar + day card + parts. Admin block is `readOnly`.
3. **T3 Athlete→Admin (0 AI):** debounced snapshot after Done and Terms.
4. **T4 Admin→Athlete edit:** not included.
