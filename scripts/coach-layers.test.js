/**
 * Guards on the knowledge layers.
 *
 * These prompts are the coach's professional knowledge on the programming path, where File Search
 * is off. Three things can quietly ruin them and none would fail any other test: Hebrew leaking
 * into a prompt (the workout JSON is English — POL-004), a source name leaking (POL-007), and a
 * layer switching on when it should not (the owner's own worry: an injury layer that turns every
 * workout line into a menu of three).
 *
 * Run: node scripts/coach-layers.test.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const LAYERS_DIR = path.join(root, "lib", "coach-layers");
const L = require("../lib/coach-layers/index.js");
const EQUIVALENCE = require("../lib/coach-equivalence-table.js");

let passed = 0;
function ok(name, cond, detail) {
  if (!cond) {
    console.error("FAIL:", name, detail || "");
    process.exitCode = 1;
    throw new Error(name);
  }
  passed++;
  console.log("ok —", name);
}

/** Every prompt module, by name, plus the equivalence table which ships with them. */
function allPrompts() {
  const out = { "equivalence-table": EQUIVALENCE };
  fs.readdirSync(LAYERS_DIR)
    .filter(function (f) {
      return f.endsWith(".js") && f !== "index.js";
    })
    .forEach(function (f) {
      out[f.replace(/\.js$/, "")] = require(path.join(LAYERS_DIR, f));
    });
  return out;
}

/* Character budgets. A layer that doubles in size doubles what every brick costs, so growth is a
   decision, not an accident. Raise a number here deliberately and say why. */
const MAX_CHARS = {
  "coach-craft": 3200,
  /* Raised from 5500 on 2026-09-02: the owner asked for three additions — the four models are a
     compass and not a gate for a limited-equipment studio, modality rotation must not be hardened,
     and the scope limit must be stated out loud. About 40 extra tokens a call. */
  "layer1-methodology": 6000,
  /* 4900 as of 2026-09-03: the marked movement FAMILIES are the primary input now, and the
     matrix underneath is indexed by AREA — the coach had to bridge the two by inference. It no
     longer does. */
  "layer1-injuries": 4900,
  /* 7600 as of 2026-09-02. Two raises and two real trims got it here, and every line is
     owner-approved and universal: the skill-fresh / capacity-tired distinction moved in from the
     competitor layer (a training rule, not a competition rule), and the session-length ceiling
     arrived once the admin module confirmed the contract for it. This is the always-on
     construction layer, so it is the one budget worth watching.
     IF IT HAS TO SHRINK, the first thing out is "HOW MANY DAYS, AND WHOSE DAYS THEY ARE": half of
     it is a studio rule an individual reads for nothing and half is the reverse. Splitting it per
     agent would take ~600 characters off every brick. Do that before trimming anything the owner
     approved line by line. */
  "layer2-general": 7900,
  "layer2-individual": 4000,
  /* The two halves of the old HOW MANY DAYS section, each read by one product only. Both grew on
     2026-09-03: the studio took the station-to-people rule out of the always-on layer, and the
     individual took the 3-consecutive-day limit out of the competitor layer. Both are now on the
     one path that needs them instead of on every path or none. */
  "layer2-days-studio": 1200,
  "layer2-days-individual": 1200,
  /* Conditional: only a studio that bought N sessions a week pays for it. */
  "layer2-session-count": 3200,
  "layer3-gymnastics": 4000,
  "layer3-weightlifting": 3500,
  "layer3-endurance": 3500,
  "layer3-competitors": 4200,
  "layer3-partner": 2500,
  "equivalence-table": 5500,
};

function testShape() {
  const prompts = allPrompts();
  const names = Object.keys(prompts).sort();
  /* The floor is only here to catch a module that was emptied by accident. It was 400 until the
     day-count split on 2026-09-03 produced two legitimately tiny modules — a rule that applies to
     one product should not be padded to clear a test threshold. */
  ok("every layer module exports a non-empty string (" + names.length + " modules)",
    names.every(function (n) {
      return typeof prompts[n] === "string" && prompts[n].length > 100;
    }),
    names
      .filter(function (n) {
        return typeof prompts[n] !== "string" || prompts[n].length <= 100;
      })
      .join(", "));

  names.forEach(function (n) {
    ok("within its character budget: " + n,
      MAX_CHARS[n] != null && prompts[n].length <= MAX_CHARS[n],
      n + " is " + prompts[n].length + " chars, budget " + MAX_CHARS[n]);
  });
}

function testNoHebrew() {
  const prompts = allPrompts();
  Object.keys(prompts).forEach(function (n) {
    const hits = String(prompts[n]).match(/[֐-׿]/g) || [];
    ok("English only (POL-004): " + n, hits.length === 0, hits.length + " Hebrew characters");
  });
}

function testNoSourceLeak() {
  /* POL-007: the athlete must never learn where the knowledge came from. Author names, publisher
     names and our own plumbing all count. */
  const FORBIDDEN = /Glassman|Tsypkin|Mayhem|Westside|Two.?Brain|CrossFit Journal|Jenni Orr|Jason Brown|Chris Cooper|Spealler|File Search|Google Drive|fileSearchStore|myleo|Restoration/i;
  const prompts = allPrompts();
  Object.keys(prompts).forEach(function (n) {
    const m = String(prompts[n]).match(FORBIDDEN);
    ok("names no source (POL-007): " + n, !m, m ? "found: " + m[0] : "");
  });
}

function testScope() {
  /* The owner narrowed the coach's scope below what the sources cover, on 2026-09-01:
     "אנחנו מגבילים אותו לתנועות, משקלים ומספרים בלבד... אני לא מתיימר להיות אחראי על מאזן נוזלים
      או על קלוריות והתאוששות של מתאמנים."
     He then asked for the word nutrition to be deleted outright rather than caveated, because a
     term present in a prompt is a term a model may volunteer. So no prompt may carry diet,
     hydration or pathology vocabulary — not even as background, and not even in the source's own
     safety wording. */
  const OUT_OF_SCOPE =
    /nutrition|nutrient|macronutrient|rhabdo|myoglobin|hydrat|dehydrat|electrolyte|carbohydrate|\bdiet\b|calorie intake|grams? of protein|litres? per hour/i;
  const prompts = allPrompts();
  Object.keys(prompts).forEach(function (n) {
    const m = String(prompts[n]).match(OUT_OF_SCOPE);
    ok("stays inside movements, loads and numbers: " + n, !m, m ? "found: " + m[0] : "");
  });

  const L1 = require("../lib/coach-layers/layer1-methodology.js");
  ok("layer 1 states the scope limit out loud", /SCOPE \(HARD\)/.test(L1));
  ok("the hierarchy of development no longer opens with food",
    /HIERARCHY OF DEVELOPMENT[\s\S]{0,200}metabolic conditioning -> gymnastics/.test(L1));

  /* Machine calories are a unit of WORK. The scope ban must not accidentally stop the coach from
     prescribing 20 cal on a rower — which is exactly what an unqualified ban on "calories" does. */
  ok("machine calories are explicitly still allowed",
    /unit of WORK and are always fine to prescribe/i.test(L1));
  ok("the endurance layer still prescribes machine calories",
    /cal\b/i.test(require("../lib/coach-layers/layer3-endurance.js")));
}

function testNumbersHaveProvenance() {
  const flat = EQUIVALENCE.replace(/\s+/g, " ");

  ok("the %1RM chart is present and complete",
    /1RM 100%/.test(EQUIVALENCE) && /12RM 70%/.test(EQUIVALENCE));

  /* Lift-to-lift ratios have no source in the knowledge base, and the owner's instruction was:
     do not guess. So the table must REFUSE the conversion rather than offer a plausible number —
     a guessed clean max becomes a real load on a real bar. */
  ok("no lift-to-lift ratio is offered",
    !/Front Squat ~|Clean ~\d|Snatch ~\d|Deadlift ~1\d\d%/.test(EQUIVALENCE),
    "a lift ratio reappeared — there is still no source for one");
  ok("the table says outright that lift-to-lift conversion does not exist",
    /NO reliable way to derive one lift's max from another/i.test(flat));
  ok("an untested number is never quoted to the athlete as a max",
    /Never state a number the athlete has not tested as if it were their max/i.test(flat));

  /* Machine equivalence has a source (the aerobic conversion sheet the owner added on 2026-09-01).
     On 2026-09-02 he chose the WODWELL icon chart over the sex-split alternative on the next page
     — "מרחק הוא מרחק" — and the two disagreed on bike-erg by 25%, so the row below is the choice
     itself, not decoration. If someone reinstates the other chart this fails. */
  ok("the chosen (unsplit) machine table is the one in the file",
    /1000 \| +800 \| +1000 \| +2000 \| +60/.test(EQUIVALENCE),
    "the machine table is not the WODWELL rows");
  ok("no sex-split rows came back",
    !/\d \/ \d/.test(EQUIVALENCE.slice(0, EQUIVALENCE.indexOf("--- %1RM"))),
    "an M/W split reappeared in the machine tables");
  ok("the ratios are given so the coach can convert an unlisted distance",
    /ski = row · bike-erg = 2x row · run = 0\.8x row/.test(EQUIVALENCE));
  ok("the coach is told to prefer meters over calories",
    /Prefer meters over calories/i.test(flat));
  /* A real studio: rig, seven barbells, kettlebells, dumbbells, wall balls, boxes, and 200 m of
     road outside. No rower, no bike, no ski. The table lists what is EQUIVALENT, not what is
     available, and nothing said so — the swap rule could have sent the coach to a machine that is
     not in the room. */
  ok("a swap is limited to equipment the place actually has",
    /ONLY SWAP TO SOMETHING THE PLACE ACTUALLY HAS/.test(EQUIVALENCE) &&
      /A room with no ergometers gets its cyclic work from running, shuttles, jump rope and loaded carries/i.test(
        flat
      ));
  ok("the time-domain sanity check is present, with the AMRAP example",
    /12-minute\s*AMRAP gives two slow rounds/.test(flat));

  /* The injury matrix moved to layer1-injuries on 2026-09-02 so a healthy athlete stops paying
     ~700 tokens a brick for it. Assert both halves of the move. */
  ok("the injury matrix is no longer in the always-on table",
    !/SUBSTITUTION MATRIX/i.test(EQUIVALENCE));
  ok("the injury matrix is in the conditional injury layer",
    /SUBSTITUTION MATRIX, when an AREA was named instead/i.test(
      require("../lib/coach-layers/layer1-injuries.js")
    ));
  /* The intake sends movement FAMILIES, the matrix is indexed by AREA, and the coach was left to
     bridge the two by inference. Both routes are spelled out now. */
  ok("a marked movement family maps to a substitute directly",
    /--- A MARKED MOVEMENT FAMILY \(the usual input\) ---/.test(
      require("../lib/coach-layers/layer1-injuries.js")
    ) &&
      ["deep squat ->", "hinge / deadlift ->", "overhead press ->", "hanging from the bar ->",
        "kipping ->", "jumping ->", "running ->"].every(function (k) {
        return require("../lib/coach-layers/layer1-injuries.js").indexOf(k) >= 0;
      }));
  ok("the function is kept rather than deleted",
    /Keep its FUNCTION with a lower-demand version, do not delete the function/.test(
      require("../lib/coach-layers/layer1-injuries.js")
    ));
  ok("machine conversion and stimulus scales stayed always-on",
    /MACHINE EQUIVALENCE, BY DISTANCE/.test(EQUIVALENCE) &&
      /STIMULUS-PRESERVING SCALES/.test(EQUIVALENCE));

  /* Sourced scaling order from the Level 1 guide, plus the practice it explicitly forbids. */
  ok("scaling order is load -> volume -> movement", /1\) LOAD *2\) VOLUME/i.test(flat));
  ok("progressive scaling is forbidden", /FORBIDDEN: progressive scaling/i.test(flat));
}

function testGeneralLayerDecisions() {
  const G = require("../lib/coach-layers/layer2-general.js");
  const flat = G.replace(/\s+/g, " ");

  /* A studio has no shared rest day — different people come on different days. The owner rejected
     the 3-on/1-off cycle for it on 2026-09-02. */
  /* The day-count rule split per product on 2026-09-03 — each side reads only its own half. */
  const DAYS_STUDIO = require("../lib/coach-layers/layer2-days-studio.js").replace(/\s+/g, " ");
  const DAYS_INDIV = require("../lib/coach-layers/layer2-days-individual.js").replace(/\s+/g, " ");
  ok("a studio is programmed seven days by default",
    /Program SEVEN days a week unless the intake asks for fewer/i.test(DAYS_STUDIO));
  ok("the 3-on/1-off cycle is no longer the default shape",
    !/A repeating block of THREE TRAINING DAYS then rest/.test(G) &&
      /Do NOT build a 3-on\/1-off cycle/.test(DAYS_STUDIO));
  ok("inventing a rest day is forbidden for a studio",
    /do NOT insert a rest day the intake did not ask for/i.test(DAYS_STUDIO));
  ok("an individual still gets rest days from the intake",
    /Training days and rest days come from the intake exactly/i.test(DAYS_INDIV) &&
      /Their marked days ARE the weekly structure/i.test(DAYS_INDIV));
  ok("neither product reads the other's day rule",
    !/Program SEVEN days a week/i.test(DAYS_INDIV) &&
      !/come from the intake exactly/i.test(DAYS_STUDIO));

  /* Moved here on 2026-09-03 after the owner asked what happens when a general-fitness athlete
     marks all seven days: the answer was nothing, because the rule lived in the competitor layer
     and that only lights up for a declared competitor. It is a limit on a body. */
  ok("every individual gets the 3-consecutive-day limit, not just competitors",
    /NEVER MORE THAN 3 CONSECUTIVE TRAINING DAYS \(HARD\)/.test(DAYS_INDIV) &&
      /it holds in\s*every case, including when the athlete marked all seven days/i.test(DAYS_INDIV));
  ok("the fourth day is downgraded, not deleted",
    /make it ACTIVE RECOVERY/.test(DAYS_INDIV) &&
      /The intake left that day free: it is a rest day/.test(DAYS_INDIV) &&
      /Seven marked days become three on, one light, three on/.test(DAYS_INDIV));
  ok("no escape hatch is offered",
    /There is no exception to this\. Do not create one for an athlete who says they can handle more/.test(
      DAYS_INDIV
    ));
  ok("a general-fitness athlete's pack actually contains the limit",
    L.buildLayerPack({ agent: "individual", profile: { competitor: false, goals: "get fit" } })
      .text.indexOf("3 CONSECUTIVE TRAINING DAYS") >= 0);

  /* The station-to-people rule moved the other way: out of the always-on layer and onto the studio
     path, because an individual was reading a rule about sharing barbells in a class. */
  ok("the station-to-people rule is on the studio path only",
    /COUNT THE STATIONS AGAINST THE PEOPLE/.test(DAYS_STUDIO) && !/COUNT THE STATIONS/.test(G));
  ok("an individual's pack does not carry it",
    L.buildLayerPack({ agent: "individual", profile: { goals: "get fit" } }).text.indexOf(
      "COUNT THE STATIONS"
    ) < 0);
  /* "לעיתים לא תהיה מגבלה == סטודיו גדול / מאמנים שמאמנים בחוץ" — a missing cap is a real answer,
     not a missing one, and inventing a number there would constrain a room that is not constrained. */
  ok("no capacity cap means the equipment is the whole constraint",
    /IF NO CAP IS GIVEN, do not invent one/.test(DAYS_STUDIO) &&
      /the whole constraint is the EQUIPMENT/.test(DAYS_STUDIO) &&
      /Bodyweight, running, carries and shared implements scale to any number of\s*people/i.test(
        DAYS_STUDIO
      ));
  ok("the day rules left layer2-general entirely",
    !/SEVEN days a week|AN INDIVIDUAL:/.test(G),
    "the split half-happened — layer2-general still carries a day rule");
  ok("a named day in the intake wins outright", /WHATEVER THE INTAKE NAMES, WINS/.test(G));

  /* The seven-day week is our own synthesis (2026-09-02) and the only rule here with no source.
     Modality is pinned so a studio can publish a schedule; character drifts so the member who
     only comes on two fixed days still meets every structure. Both halves have to hold, or one of
     the two failures it was designed around comes back. */
  ok("modality is pinned to the weekday",
    /PINNED — each programmed day's MODALITY/.test(G) &&
      /keep each day's modality stable from week to week/i.test(flat));
  ok("character drifts across weeks instead of restarting",
    /DRIFTS — the day's CHARACTER/.test(G) &&
      /let\s*the rotation carry into the next week instead of restarting it/i.test(flat));
  ok("the seventh day has no special role",
    /NO DAY IS SPECIAL and no day has a default role/.test(G) &&
      /the same continuum — including the seventh/.test(flat));
  ok("no long-mixed-modality default came back for day seven",
    !/mixed[- ]modality (piece|metcon)|long mixed/i.test(G),
    "the seventh day was given a default role again");
  ok("a named day overrides both axes",
    /that naming replaces BOTH axes for that day/.test(G));

  /* "סעיף אנושי לגמרי ואין להתחשב בו" — the engine writes one session at one standard; the human
     coach characterises the room. No experience tiers, and nothing keyed to months of training. */
  ok("no experience tiers", !/BEGINNER:|INTERMEDIATE:|EXPERIENCED:|RETURNING:/.test(G));
  ok("no months-of-training thresholds", !/18 months|36 months|18-36/.test(G));
  ok("one session at one standard, adapted by the human coach",
    /Write ONE session at ONE standard/.test(G) && /the human coach adapts on the floor/i.test(flat));

  /* The completion window is programming, not a judgement about people, so it survived the cut. */
  ok("the completion window survived", /COMPLETION WINDOW/.test(G));

  /* THE FENCES around the strength source (2026-09-02). "יש תיעדוף למה שגלסמן אמר בכל הסעיפים."
     A method may fill the strength slot; it may not reorganise the week. */
  ok("precedence is stated where the model reads it, not only in policy",
    /PRECEDENCE INSIDE THIS LAYER \(HARD\)/.test(G) &&
      /Strength methods fill the strength slot — they NEVER reorganise the week/.test(G));
  ok("a body-part or lift-type weekly split is refused outright",
    /If a method implies a weekly split by body part or by lift type, that split does not apply here/.test(
      flat
    ));

  /* The powerlifting skeleton is gone: no four-day upper/lower max-effort split. */
  ok("the ME/DE weekly skeleton is gone",
    !/MAX EFFORT lower|DYNAMIC EFFORT\s*\n?lower|one MAX EFFORT upper/i.test(G),
    "the body-part split came back");
  ok("the strength methods are scoped to the W day, not the week",
    /FILLING THE STRENGTH SLOT \(does not change the shape of the week\)/.test(G) &&
      /When a day's focus is W, the lift can be met in one of two ways/.test(G));
  ok("speed work is justified in Glassman's own terms",
    /power training — force x distance \/ time/.test(G));

  /* Accessory has a ceiling now, not a share of the week. */
  ok("accessory carries an explicit ceiling",
    /NEVER instead of the conditioning\. Conditioning is the bulk of weekly volume/.test(G));
  ok("accessory is no longer the largest share of volume",
    !/largest single share of weekly volume|largest proportion/i.test(G),
    "the powerlifting volume claim came back");

  /* Whatever else is cut, the operations insight must survive on its own. */
  const spineStart = G.indexOf("--- FILLING THE STRENGTH SLOT");
  const spineEnd = G.indexOf("--- THE MIXED-ATTENDANCE");
  ok("the strength block is one contiguous, removable section",
    spineStart > 0 && spineEnd > spineStart, "block=" + spineStart + " next=" + spineEnd);
  const outsideBlock = G.slice(0, spineStart) + G.slice(spineEnd);
  ok("no strength-method vocabulary leaks outside that section",
    !/HEAVY EFFORT|SPEED EFFORT|ACCESSORY/.test(outsideBlock),
    "removing the block would leave dangling references");

  /* Approved unchanged and worth pinning: the box problem that has no individual equivalent. */
  ok("the mixed-attendance rule is intact",
    /Someone who only trains Tue\/Thu\/Sat must still meet squat, hinge/i.test(flat));
  ok("an explicit request beats format rotation",
    /that request WINS over format rotation/i.test(flat));

  /* A brick is a month (4 weeks) and the deload is a continuous cadence across months, not the
     last week of a block: ask for every 4 weeks and it lands in week 4 of block 1; ask for 5+ and
     it lands inside a later block. So placement is an INPUT, and a block may hold none. */
  ok("a block is four weeks", /A block is FOUR weeks — one month/.test(G));
  ok("the coach never chooses the deload week itself",
    /A DELOAD WEEK IS GIVEN TO YOU\. NEVER CHOOSE ONE YOURSELF/.test(G));
  ok("a block may hold no deload at all",
    /Named none: all four are build weeks/.test(flat) &&
      /a block may hold one or none, at any of its four\s*weeks/i.test(flat));
  ok("the last week of a block is not assumed to be a deload",
    /NEVER decide that the last week of a block is a deload/.test(flat));
  ok("no fifth week is ever added", /never add a fifth week/.test(flat));
  /* The admin module's own worked examples: block 1 (start 1, every 4) -> week 4; a block that
     starts mid-cadence (start 3, every 4) -> week 2. So week 4 must not be assumed. */
  ok("week 4 is not assumed to be the deload",
    /The deload can land on week 2 of one block and week 4 of the next\. Do NOT assume week 4/.test(
      flat
    ));
  ok("a request with no deload instruction is treated as an old one",
    /If the request carries no deload instruction AT ALL, it is an old request: build four weeks with\s*no deload and invent no placement/i.test(
      flat
    ));

  /* Session length: the admin module confirmed the contract, including what is NOT guaranteed —
     sessionLimits is the coach's free-text box and may carry no number at all. */
  ok("session length is a ceiling, not a target",
    /--- HOW LONG A SESSION IS ---/.test(G) && /it is a CEILING, not a target/.test(flat));
  ok("the whole session fits inside the stated minutes",
    /the WHOLE session fits inside it — warm-up, strength, conditioning,\s*accessory/i.test(flat));
  ok("with no number given, the notes are the only source and nothing is invented",
    /the schedule notes are the only source/.test(flat) &&
      /If they carry no number either, do NOT invent one/.test(flat));
  ok("a duration is never inferred from the sessions-differ flag",
    /Never read a duration out of the fact that sessions differ\. That is a flag, not a value/.test(
      flat
    ));
  ok("no five-week brick language survives in this layer",
    !/5[- ]week|five week|week 5\b|weeks 1-4/i.test(G),
    "the five-week brick came back into the layer");
}

function testIndividualLayerDecisions() {
  const I = require("../lib/coach-layers/layer2-individual.js");
  const flat = I.replace(/\s+/g, " ");

  /* Periodisation deleted rather than gated on 2026-09-02 — a gate invites the model to look for a
     reason to open it: "עונות - לא רלוונטי כלל וכלל... אנחנו נכין אותו לרוחב". */
  ok("no training seasons", !/OFF-SEASON|PRE-SEASON|COMPETITION SEASON/.test(I));
  ok("periodisation is refused outright, not gated",
    /NO PERIODISATION/.test(I) && /do not name a season, and do not\s*build toward a peak/i.test(flat));
  ok("a date the athlete mentions constrains the block, nothing more",
    /honour it as a constraint on that block — not as a reason to\s*restructure their training year/i.test(flat));

  /* The owner's correction, 2026-09-02: equipment caps the load, not the movement. An earlier
     draft was going to hedge the progressions into "the main loaded pattern", which implied a
     dumbbell athlete cannot squat. He is right that they can. */
  ok("equipment limits load, not movement",
    /Equipment limits the LOAD, not the movement/.test(I) &&
      /A back squat with dumbbells is still a back squat/.test(I));
  ok("swapping a pattern for lack of a barbell is forbidden",
    /NEVER swap a\s*pattern out because there is no barbell/i.test(flat));
  ok("the strength stimulus has a route that does not need load",
    /get it from reps, tempo, pauses, unilateral loading,\s*range of motion and shorter rest/i.test(flat));

  /* THE MOVE (2026-09-02). Competitor material was reaching every single athlete: a movement
     ranking whose own criteria include "likely to be tested in competition", and a week with three
     olympic-lift days and three squat days offered as a DEFAULT. Both now sit behind the competitor
     gate. Assert both ends, or the move silently half-happens. */
  const C = require("../lib/coach-layers/layer3-competitors.js");
  ok("the movement tiers left the individual layer",
    !/TIER 1|TIER 2|TIER 3/.test(I), "the tier ranking is still reaching every athlete");
  ok("the movement tiers are behind the competitor gate", /TIER 1 \(all three\)/.test(C));
  ok("the tier ranking says out loud that it is competition-weighted",
    /this ranking is weighted by what a CONTEST tests/.test(C));
  ok("the barbell-centred week left the individual layer",
    !/olympic lift \+ back squat volume/.test(I), "competitor volume is still the default week");
  ok("the barbell-centred week is behind the competitor gate",
    /olympic lift \+ back squat volume/.test(C) &&
      /Three olympic-lift days and three squat days is competitor volume/.test(C));
  ok("a general athlete is told the balance IS the priority",
    /There is no movement ranking for a general-fitness athlete/.test(I));
  ok("the individual layer defers the weekly shape to the general layer",
    /Take it from the general layer/.test(I));

  /* The rest-day clash between this layer and the seven-day studio default, settled 2026-09-02:
     seven days is a default for a ROOM; the 3-consecutive limit is a limit on a BODY. */
  const Cflat = C.replace(/\s+/g, " ");
  ok("the competitor layer says it governs a person, not a room",
    /THIS IS ONE PERSON, NOT A ROOM \(HARD\)/.test(C) &&
      /The seven-day studio default does not apply to an individual at all/i.test(Cflat));
  ok("an individual's intake days are the weekly structure and they win",
    /their own training days from the intake ARE the weekly structure/i.test(Cflat));
  /* The 3-consecutive rule itself moved to layer2-days-individual on 2026-09-03 — it is a limit on
     a body, and leaving it here meant a general-fitness athlete who marked seven days got nothing.
     This layer now points at it rather than restating it, so there is one copy to change. */
  ok("the competitor layer defers to the individual day limit rather than restating it",
    /the 3-consecutive-day limit stated for every individual applies here unchanged/i.test(Cflat) &&
      !/NO MORE THAN 3 CONSECUTIVE TRAINING DAYS/.test(C),
    "the rule is stated twice — one copy will drift");

  /* Two instructions the source gives that we cannot honour, and one that was in the wrong file. */
  ok("the advanced multi-session tier is gone",
    !/ADVANCED —|Multiple sessions daily|3 to 6 hours/i.test(C),
    "a tier this app does not serve came back");
  /* "יום כפול - לא חלק מהשירותים שאנחנו נותנים - אין אצלינו דבר כזה." The app renders one workout
     per calendar day, so this is a product fact and not only a competitor rule: it is stated in
     the always-on general layer, and restated here because this is the one source that pushes the
     other way. Both have to hold. */
  ok("no double days in the competitor layer",
    /NO DOUBLE DAYS, ever, at any level/.test(C));
  ok("extra work becomes a part, not a second session",
    /Extra work becomes another part of that session, not a second session/.test(Cflat));
  ok("one session per programmed day is stated in the always-on general layer",
    /ONE SESSION PER PROGRAMMED DAY \(HARD\)/.test(
      require("../lib/coach-layers/layer2-general.js")
    ));
  ok("splitting a day into morning and evening is forbidden",
    /never split a day into a morning and an evening piece/i.test(
      require("../lib/coach-layers/layer2-general.js").replace(/\s+/g, " ")
    ));
  ok("the coach no longer scores the athlete on domains it has no data for",
    !/Score the athlete across their domains/.test(C) &&
      /Do not invent a score for them across domains you have no data on/i.test(Cflat));
  ok("skill-fresh / capacity-tired moved to the general layer",
    !/SKILL gaps \(gymnastics, barbell technique\)/.test(C) &&
      /SKILL \(gymnastics, barbell technique\) is built ONLY by focused practice while FRESH/.test(
        require("../lib/coach-layers/layer2-general.js")
      ));

  /* Periodisation is out everywhere, including for a declared competitor. Match the PRESCRIPTION,
     not the vocabulary — the refusal line below necessarily contains the words it forbids, which is
     the same trap the calories ban fell into. */
  ok("no annual plan is prescribed in the competitor layer",
    !/Annual plan ->|mesocycle|macrocycle|blocks of 2-4 months/i.test(C),
    "periodisation came back as a prescription");
  ok("the competitor layer refuses seasons and peaking explicitly",
    /HARD: no annual plan, no season, no peaking cycle/.test(C));
  ok("a competitor is trained broadly rather than tapered",
    /trained broadly, not tapered toward a date/.test(C));

  /* What this layer exists for: it must not read like a class programme. */
  ok("the layer states what changes with a single athlete",
    /A one-athlete brick that\s*looks like a class programme is a wasted brick/i.test(flat));
  ok("core lifts are trained across rep ranges",
    /trained only as a 1RM is half-trained/.test(I));
}

function testInjuryGate() {
  ok("no restriction reported -> injury layer stays off",
    !L.hasNamedRestriction({ goals: "get fitter" }, null));
  ok('"none" is not a restriction',
    !L.hasNamedRestriction({ injuries: "none" }, null));
  ok('Hebrew "אין" is not a restriction',
    !L.hasNamedRestriction({ injuries: "אין" }, null));
  ok("a named injury switches the layer on",
    L.hasNamedRestriction({ injuries: "Left shoulder impingement" }, null));
  ok("a studio population that names a limitation switches it on",
    L.hasNamedRestriction(null, { population: "several members with knee pain" }));

  /* The studio's goals field was folded into the population box on 2026-09-03, so that box now
     carries ordinary programming words as well as restrictions. A bare body part must not count:
     "back squat" and "shoulder press" are what a studio trains, not what it avoids. */
  [
    "a women's studio, ages 23-50",
    "סטודיו נשים בין הגילאים 23-50",
    "we do a lot of back squat and shoulder press",
    "mixed adults, knee sleeves available",
  ].forEach(function (t) {
    ok("not a restriction: " + t, !L.hasNamedRestriction(null, { population: t }));
  });
  [
    "a few members with knee pain",
    "שניים עם כאב בברך",
    "one member post-op shoulder",
    "יש מגבלות אצל חלק",
    "several need to avoid overhead",
  ].forEach(function (t) {
    ok("is a restriction: " + t, L.hasNamedRestriction(null, { population: t }));
  });

  /* And the same box now has to reach INTENT, or a studio that says what it trains for selects
     nothing at all. */
  ok("the population box routes a discipline when it names one",
    L.pickLayer3(null, { population: "סטודיו נשים 23-50. רוצות לשפר ריצה וסיבולת" }).indexOf(
      "endurance"
    ) >= 0);
  ok("a purely descriptive population still selects nothing",
    L.pickLayer3(null, { population: "סטודיו נשים בין הגילאים 23-50" }).length === 0);

  const off = L.buildLayerPack({ agent: "individual", profile: { goals: "get fitter" } });
  ok("the pack really omits the injury layer when nothing was reported",
    off.layers.indexOf("layer1-injuries") < 0, off.layers.join(", "));

  /* From a real screen: "No injuries" in the free text AND "Deep squat" ticked. Not a
     contradiction, and probably the commonest answer a healthy adult gives. Both halves have to
     hold: the gate fires, and the layer does not let "no injuries" cancel the marked list. */
  const mixed = { injuries: "No injuries", avoidMovements: { deep_squat: true } };
  ok('"No injuries" plus a ticked movement still switches the layer on',
    L.hasNamedRestriction(mixed, null));
  ok("the avoid list is stated as authoritative over the free text",
    /THE AVOID LIST IS AUTHORITATIVE \(HARD\)/.test(
      require("../lib/coach-layers/layer1-injuries.js")
    ) &&
      /even when the free text says 'no injuries'/i.test(
        require("../lib/coach-layers/layer1-injuries.js").replace(/\s+/g, " ")
      ));
  ok("the layer does not assume a restriction means an injury",
    /AN INJURY IS ONLY ONE REASON/.test(require("../lib/coach-layers/layer1-injuries.js")));

  /* The owner's actual worry, asserted: one prescription per line, no menus. */
  const INJ = require("../lib/coach-layers/layer1-injuries.js");
  ok("the injury layer forbids 'or' inside a workout line",
    /ONE prescription per line/i.test(INJ) && /never write 'X or Y'/i.test(INJ));
  ok("an individual athlete gets no scaling block at all",
    /there is no scaling block at all/i.test(INJ));
  ok("a class scaling block is capped at 2-3 lines",
    /at most 2-3 lines/i.test(INJ));
}

function testRouting() {
  const athlete = { goals: "I want a strict muscle-up and to add 10kg to my clean and jerk" };
  const picked = L.pickLayer3(athlete, null);
  ok("a gymnastics + barbell goal selects those two disciplines",
    picked.indexOf("gymnastics") >= 0 && picked.indexOf("weightlifting") >= 0,
    picked.join(", "));
  ok("never more than " + L.MAX_LAYER3 + " discipline layers at once",
    picked.length <= L.MAX_LAYER3, picked.join(", "));
  /* The competitor layer is a mode rather than a discipline, but it is large, so it takes a slot
     instead of stacking on top. Three layer-3 modules at once is the failure the cap exists for. */
  const both = L.pickLayer3(
    { competitor: true, goals: "muscle-up and a heavier clean and jerk" },
    null
  );
  ok("a declared competitor with two goals still gets only " + L.MAX_LAYER3 + " layers",
    both.length === L.MAX_LAYER3 && both[0] === "competitors", both.join(", "));

  const quiet = L.pickLayer3({ goals: "general fitness" }, null);
  ok("a general goal selects no discipline layer", quiet.length === 0, quiet.join(", "));

  const studio = L.buildLayerPack({
    agent: "studio",
    studioIntake: { goals: "general fitness", population: "mixed adults" },
  });
  ok("the studio agent never receives the individual layer",
    studio.layers.indexOf("layer2-individual") < 0, studio.layers.join(", "));
  ok("the studio agent does receive the general construction layer",
    studio.layers.indexOf("layer2-general") >= 0);

  const solo = L.buildLayerPack({ agent: "individual", profile: { goals: "general fitness" } });
  ok("the individual agent receives the individual layer",
    solo.layers.indexOf("layer2-individual") >= 0, solo.layers.join(", "));

  const chat = L.buildLayerPack({ agent: "individual", profile: { goals: "general fitness" }, programming: false });
  ok("chat carries no construction layer and no arithmetic",
    chat.layers.indexOf("layer2-general") < 0 &&
      chat.layers.indexOf("equivalence-table") < 0,
    chat.layers.join(", "));
  ok("chat still carries the floor (craft + methodology)",
    chat.layers.indexOf("coach-craft") >= 0 && chat.layers.indexOf("layer1-methodology") >= 0);

  const forced = L.buildLayerPack({ agent: "studio", studioIntake: {}, layer3: ["partner"] });
  ok("an explicit discipline request is honoured",
    forced.layers.indexOf("layer3-partner") >= 0, forced.layers.join(", "));
}

/**
 * The router against the REAL intake packet, built by the real contract.
 *
 * Every case here was a live bug found on 2026-09-02 when the admin agent's handoff described what
 * the packet actually contains. Scoring the whole packet with unbounded substrings meant:
 *   - "COMPETITOR: no" matched "compet", so the competitor layer switched on for exactly the
 *     athletes it exists to stay away from;
 *   - "SKILLS" matched "ski", so endurance switched on for everyone;
 *   - the LIFTS / RUN and SKILLS sections made every athlete look like a weightlifter and an
 *     endurance athlete, because they had reported a back squat and a row — capability, not intent.
 */
function testRouterAgainstRealPacket() {
  const CI = require("../lib/coach-intake-sync-contract.js");
  const base = {
    displayName: "A", gender: "male", age: "34", bodyweight: "80", experience: "2 years",
    trainingDays: ["sun", "tue", "thu"], scheduleNotes: "Mornings",
    trainingSetup: "Well-equipped functional training gym", activeRecoveryPref: "no",
    lifts: { back_squat: 120, deadlift: 160, clean: 80, snatch: 60 },
    skills: { double_unders: 1, pull_ups: 1, toes_to_bar: 1 },
    sessionMinutes: 60, injuries: "none", goals: "Get fitter and lose a few kilos",
    competitor: false,
  };
  const withPacket = function (over) {
    const s = Object.assign({}, base, over || {});
    return { fixedIntakePacket: CI.buildFixedIntakePrompt(s), goals: s.goals, injuries: s.injuries };
  };

  ok("a general-fitness packet selects NO discipline layer",
    L.pickLayer3(withPacket(), null).length === 0,
    JSON.stringify(L.pickLayer3(withPacket(), null)));

  /* The COMPETITOR line does not exist on main yet — it arrives with the admin release, which is
     why these two assert against the exact strings that release emits rather than against what
     the local contract can build today. The router has to satisfy both worlds: an old packet has
     no such line and falls back to free text, a new one is authoritative in both directions. */
  const NEW_PACKET_NO = withPacket().fixedIntakePacket +
    "\nCOMPETITOR: no — general fitness athlete, not preparing for a competition.";
  const NEW_PACKET_YES = withPacket().fixedIntakePacket +
    "\nCOMPETITOR: YES — training for a competition / actively competing. Program accordingly.";
  ok('"COMPETITOR: no" does not switch the competitor layer on',
    !L.competitorDeclared({ fixedIntakePacket: NEW_PACKET_NO }, null));
  ok('"COMPETITOR: YES" does switch it on',
    L.competitorDeclared({ fixedIntakePacket: NEW_PACKET_YES }, null));
  ok("the explicit competitor field beats everything",
    L.competitorDeclared({ competitor: true, fixedIntakePacket: NEW_PACKET_NO }, null) &&
      !L.competitorDeclared({ competitor: false, fixedIntakePacket: NEW_PACKET_YES }, null));
  ok("today's packet, with no COMPETITOR line, still falls back to stated intent",
    L.competitorDeclared(withPacket({ goals: "I want to compete at a local throwdown" }), null) &&
      !L.competitorDeclared(withPacket(), null));

  /* The packet's tail order settled on 2026-09-03: GOALS, COMPETITOR, IMPROVE FOCUS, AVOID,
     AVOID (also), HEAVIEST IMPLEMENT, DOES NOT WANT. The GOALS extractor has to stop at the first
     of those and not swallow the rest, or every athlete inherits the whole tail as "intent". */
  const TAIL =
    "GOALS:\nFirst muscle-up this year, and stay injury free.\n" +
    "COMPETITOR: no — general fitness athlete, not preparing for a competition.\n" +
    "IMPROVE FOCUS: none selected — general fitness, no single focus. Priority is the balance itself.\n" +
    "AVOID: none marked.\n" +
    "AVOID (also): nothing else stated.\n" +
    "HEAVIEST IMPLEMENT: full gym loading available — prescribe by %1RM from the reported lifts.\n" +
    "DOES NOT WANT: nothing stated.";
  const fullPacket =
    "PROFILE:\nName: A\n\nLIFTS / RUN:\nBack Squat: 140 kg\n\n" +
    "SKILLS (marked = Rx-capable; unmarked = scale):\nDouble unders\n\n" + TAIL;
  ok("the goals section is read out of the new tail order",
    JSON.stringify(L.pickLayer3({ fixedIntakePacket: fullPacket }, null)) === '["gymnastics"]',
    JSON.stringify(L.pickLayer3({ fixedIntakePacket: fullPacket }, null)));
  ok("the tail's own boilerplate does not leak into intent",
    L.pickLayer3({ fixedIntakePacket: fullPacket.replace(/First muscle-up[^\n]*/, "Get fitter.") }, null)
      .length === 0,
    "a line from the tail is being scored as if the athlete had said it");
  ok("the full packet reads as non-competitor and unrestricted",
    !L.competitorDeclared({ fixedIntakePacket: fullPacket }, null) &&
      !L.hasNamedRestriction({ fixedIntakePacket: fullPacket, injuries: "" }, null));

  ok("reported lifts and skills do not imply a discipline focus",
    L.pickLayer3(withPacket({ goals: "Just want to feel good" }), null).length === 0,
    "capability is being read as intent");

  ok("a stated gymnastics goal selects gymnastics only",
    JSON.stringify(L.pickLayer3(withPacket({ goals: "I want my first muscle-up" }), null)) ===
      '["gymnastics"]');
  ok("a stated engine goal selects endurance only",
    JSON.stringify(L.pickLayer3(withPacket({ goals: "Build my engine, I gas out fast" }), null)) ===
      '["endurance"]');
  ok("a stated barbell goal selects weightlifting only",
    JSON.stringify(L.pickLayer3(withPacket({ goals: "Add 10kg to my clean and jerk" }), null)) ===
      '["weightlifting"]');

  /* The substring casualties, asserted one by one so a future edit to the regexes fails loudly. */
  [
    ["preparing for a hike", "gymnastics via 'ring' in 'preparing'"],
    ["walk more during the week", "gymnastics via 'ring' in 'during'"],
    ["get a good impression at work events", "weightlifting via 'press' in 'impression'"],
    ["use the open gym more", "competitors via 'open'"],
    ["skipping fewer sessions", "gymnastics/endurance via 'kip' and 'ski'"],
  ].forEach(function (pair) {
    ok("no false layer from: " + pair[0],
      L.pickLayer3(withPacket({ goals: pair[0] }), null).length === 0,
      pair[1] + " -> " + JSON.stringify(L.pickLayer3(withPacket({ goals: pair[0] }), null)));
  });

  /* The injury gate against the packet's own "none". */
  ok("the packet's INJURIES: none keeps the injury layer off",
    L.buildLayerPack({ agent: "individual", profile: withPacket() }).layers.indexOf(
      "layer1-injuries"
    ) < 0);
  ok("a real injury in the packet switches it on",
    L.buildLayerPack({
      agent: "individual",
      profile: withPacket({ injuries: "Left shoulder impingement, avoid overhead" }),
    }).layers.indexOf("layer1-injuries") >= 0);
}

/**
 * A studio can buy a NUMBER of sessions instead of a weekly plan, and then describe each one:
 * "long strength + short metcon under 10 minutes", "one part only, partner metcon", "stations".
 * The intake screen says what that mode means — "No weekday attached — the coach delivers them
 * whenever suits their groups" — so every weekday rule in layer2-general needs a translation, and
 * the descriptions have to be read as instructions rather than hints (owner, 2026-09-02).
 */
function testSessionCountMode() {
  const S = require("../lib/coach-layers/layer2-session-count.js");
  const flat = S.replace(/\s+/g, " ");

  ok("session-count mode is detected from the mode", L.sellsSessionsByCount({ scheduleMode: "session_count" }));
  ok("a weekly-plan studio is not session-count",
    !L.sellsSessionsByCount({ scheduleMode: "weekly_schedule", sessionsPerWeek: 3 }));
  ok("a half-filled intake with a count still routes correctly",
    L.sellsSessionsByCount({ sessionsPerWeek: 3 }));
  ok("an individual never gets the session-count layer",
    L.buildLayerPack({ agent: "individual", profile: { goals: "get fitter" } }).layers.indexOf(
      "layer2-session-count"
    ) < 0);
  ok("a weekly-plan studio never gets it",
    L.buildLayerPack({ agent: "studio", studioIntake: { scheduleMode: "weekly_schedule" } }).layers.indexOf(
      "layer2-session-count"
    ) < 0);
  ok("a session-count studio does get it",
    L.buildLayerPack({
      agent: "studio",
      studioIntake: { scheduleMode: "session_count", sessionsPerWeek: 3 },
    }).layers.indexOf("layer2-session-count") >= 0);

  ok("the session index replaces the weekday as the thing that carries identity",
    /The session INDEX carries the identity a weekday carries elsewhere/.test(S));
  ok("no weekdays and no invented rest days in this mode",
    /Do NOT attach weekdays, and\s*do NOT invent rest days/i.test(flat));
  ok("the exact number of sessions is produced",
    /Produce EXACTLY the number of sessions asked for/.test(S));
  /* The admin module capped sessionsPerWeek at 7, not 14: a week is held by weekdays and there are
     seven places to write. Two sessions on one day are two parts of that day's card — which is the
     same rule layer2-general already states as ONE SESSION PER PROGRAMMED DAY. */
  ok("at most seven sessions a week, and a doubled day is two parts",
    /At most SEVEN sessions a week/.test(S) &&
      /they are two PARTS of that\s*day's single session — never two sessions on one day/i.test(flat));

  /* The descriptions are instructions. These four are the owner's own examples. */
  ok("a described session is a HARD instruction, every week",
    /Treat every such description as a HARD instruction for that session, EVERY week/.test(S));
  /* The owner fills these boxes in Hebrew — "מטקון ארוך בלבד", "כוח ומטקון קצר" — so the rules
     may not depend on an English phrase, and the lengths he writes are RELATIVE rather than
     numeric. Both had to be stated as principles instead of quoted examples. */
  ok("descriptions are read in any language",
    /Descriptions may be written in ANY language/.test(S));
  ok("a single-piece description is honoured, however it is phrased",
    /means ONE part/.test(S) &&
      /Do not add a warm-up part, an accessory part or a\s*second piece/i.test(flat));
  ok("a named length is a ceiling for the room",
    /A named length is a CEILING for the room, not a target/.test(S) &&
      /not for the fittest person in it/.test(flat));
  ok("relative lengths are instructions and stay consistent across the week",
    /RELATIVE lengths — short, medium, long — are the normal way this gets written/.test(S) &&
      /the long one must actually be materially longer/.test(flat));
  ok("a format word like 'stations' is an instruction too",
    /A 'stations' session is a format instruction\s*in the same way — build it as stations/i.test(flat));
  ok("a description outranks a default in any other layer",
    /If a description conflicts with a default in any other layer, THE DESCRIPTION WINS/.test(S));
  ok("undescribed sessions are treated as interchangeable",
    /If the sessions are NOT described, treat them as interchangeable/.test(flat));

  /* Hebrew is a first-class input: the intake header says answers may be in any language, and the
     owner fills these boxes in Hebrew. With an English-only trigger table his four sessions
     selected NO discipline layer, while the same four in English selected endurance. */
  const hebrewStudio = {
    scheduleMode: "session_count", sessionsPerWeek: 4, sessionsDiffer: true,
    sessionTypes: ["תחנות אירובי", "כוח ומטקון קצר", "כוח קצר ומטקון בינוני באורכו", "מטקון ארוך בלבד"],
  };
  ok("Hebrew session descriptions select a discipline layer",
    L.pickLayer3(null, hebrewStudio).indexOf("endurance") >= 0,
    JSON.stringify(L.pickLayer3(null, hebrewStudio)));
  ok("Hebrew and English descriptions route the same way",
    JSON.stringify(L.pickLayer3(null, hebrewStudio)) ===
      JSON.stringify(
        L.pickLayer3(null, Object.assign({}, hebrewStudio, {
          sessionTypes: ["aerobic stations", "strength and short metcon", "short strength and medium metcon", "long metcon only"],
        }))
      ));
  /* \b is not a boundary for Hebrew in JS, so these two would otherwise match מתח (pull-up). */
  ok("מתחיל and מתחרה do not trigger the gymnastics layer",
    L.pickLayer3({ goals: "אני מתחיל להתאמן" }, null).length === 0 &&
      L.pickLayer3({ goals: "אני לא מתחרה" }, null).indexOf("gymnastics") < 0);
  ok("real Hebrew terms do route",
    L.pickLayer3({ goals: "הליכת ידיים" }, null).indexOf("gymnastics") >= 0 &&
      L.pickLayer3({ goals: "לשפר ריצה" }, null).indexOf("endurance") >= 0 &&
      L.pickLayer3({ goals: "סנאץ' כבד" }, null).indexOf("weightlifting") >= 0 &&
      L.pickLayer3({ goals: "אימון בזוגות" }, null).indexOf("partner") >= 0);

  /* The descriptions also feed discipline selection — "partner metcon" should reach the router. */
  const pack = L.buildLayerPack({
    agent: "studio",
    studioIntake: {
      scheduleMode: "session_count", sessionsPerWeek: 3, sessionsDiffer: true,
      sessionTypes: ["long strength + short metcon under 10 minutes", "one part only, partner metcon", "stations"],
    },
  });
  ok("a session description steers the discipline layer too",
    pack.layers.indexOf("layer3-partner") >= 0, pack.layers.join(", "));
}

/**
 * The four structured fields the admin module added on 2026-09-03, at this layer's request.
 * Each one replaces an inference with a decision — the same fix as competitor, for the same
 * reason: a ticked box is an answer, a sentence is something a model may or may not weigh.
 */
function testStructuredIntakeFields() {
  /* improveFocus{} drives discipline selection. It became load-bearing when the movement tiers
     moved behind the competitor gate and "the athlete's stated goal decides where the dedicated
     strength and skill time goes" took their place. */
  ok("a ticked gymnastics focus selects gymnastics",
    JSON.stringify(L.pickLayer3({ improveFocus: { gymnastics: true } }, null)) === '["gymnastics"]');
  ok("engine and olympic lifting select both layers",
    L.pickLayer3({ improveFocus: { engine: true, olympic_lifting: true } }, null).sort().join() ===
      "endurance,weightlifting");

  /* Two focuses map to NOTHING on purpose, and both would be wrong to map. */
  ok("max strength alone loads no discipline layer",
    L.pickLayer3({ improveFocus: { max_strength: true } }, null).length === 0,
    "layer3-weightlifting is about the olympic lifts; heavy/speed effort is already in layer 2");
  ok("general fitness alone loads no discipline layer",
    L.pickLayer3({ improveFocus: { general_fitness: true } }, null).length === 0,
    "for a general athlete the balance IS the priority");

  /* "A specific skill" is a tick plus a box. The tick says nothing; the box is the answer — and
     the admin module warned the box may be empty even when the tick is set. */
  ok("a specific skill routes from the box beside it",
    JSON.stringify(
      L.pickLayer3({ improveFocus: { specific_skill: true }, improveFocusOther: "muscle-up" }, null)
    ) === '["gymnastics"]');
  ok("an empty specific-skill box selects nothing rather than guessing",
    L.pickLayer3({ improveFocus: { specific_skill: true }, improveFocusOther: "" }, null).length === 0);

  /* A tick outranks prose, and prose still fills what the ticks leave open.
     This matters more than it did: the owner narrowed improveFocus on 2026-09-03 to competitors
     only, so it is EMPTY for every general-fitness athlete and prose is their only route. If this
     ever fails, the majority of athletes silently stop getting a discipline layer. */
  ok("prose still routes when nothing is ticked",
    JSON.stringify(L.pickLayer3({ improveFocus: {}, goals: "I want a bigger engine" }, null)) ===
      '["endurance"]');
  ok("a general-fitness athlete routes from prose alone, in both languages",
    L.pickLayer3({ competitor: false, improveFocus: {}, goals: "first muscle-up" }, null)
      .indexOf("gymnastics") >= 0 &&
      L.pickLayer3({ competitor: false, improveFocus: {}, goals: "לשפר ריצה" }, null)
        .indexOf("endurance") >= 0);
  ok("a declared competitor plus a focus still fits the cap",
    L.pickLayer3({ competitor: true, improveFocus: { gymnastics: true, engine: true } }, null)
      .length === L.MAX_LAYER3);

  /* avoidMovements{} settles the injury gate outright — no inference about severity, which is the
     whole point of asking about movements rather than conditions. */
  ok("a ticked movement family is a named restriction",
    L.hasNamedRestriction({ injuries: "", avoidMovements: { deep_squat: true } }, null));
  ok("the free box beside it counts too",
    L.hasNamedRestriction({ injuries: "", avoidMovements: {}, avoidMovementsOther: "no burpees" }, null));
  ok("an empty avoidMovements object is not a restriction",
    !L.hasNamedRestriction({ injuries: "", avoidMovements: {} }, null));
  ok("the seven families match the substitution matrix families",
    ["deep_squat", "hinge_deadlift", "overhead_press", "hanging_bar", "kipping", "jumping", "running"]
      .every(function (k) {
        return L.hasNamedRestriction({ avoidMovements: { [k]: true } }, null);
      }));

  /* A stated dislike is an intake constraint, not a preference to argue with. */
  ok("a stated dislike is honoured as a constraint",
    /A STATED DISLIKE IS A CONSTRAINT TOO/.test(
      require("../lib/coach-layers/layer2-general.js")
    ));
}

function testPackBudget() {
  /* The heaviest realistic pack. If this grows past the cap, every brick got more expensive and
     somebody should have said so. */
  const heavy = L.buildLayerPack({
    agent: "individual",
    profile: {
      goals: "muscle-up, clean and jerk, better engine, first competition",
      injuries: "shoulder impingement",
    },
  });
  /* 34k is the real worst case, not a padded one: an injured, declared competitor with a barbell
     goal — craft + methodology + injuries + equivalence + general + individual + competitors +
     weightlifting. It went UP when the competitor layer absorbed the tiers and the barbell week
     from layer2-individual, which is the same characters sitting behind a gate instead of reaching
     everyone. A general athlete's pack is 22k. If this rises again without a decision behind it,
     something is being padded. */
  /* 36k as of 2026-09-03: the movement-family mapping added ~650 characters to the injury layer,
     which is in the heaviest pack by definition. It is the layer's primary input path, so the
     mapping is not optional — but this pack is now 9.4k tokens and worth watching. A general
     healthy athlete's pack is 22k, and that is the number most bricks actually pay. */
  ok("the heaviest pack stays under 36k characters",
    heavy.chars < 36000, heavy.chars + " chars, layers: " + heavy.layers.join(", "));
  ok("the pack reports which layers it used",
    Array.isArray(heavy.layers) && heavy.layers.length >= 6, heavy.layers.join(", "));
}

function main() {
  console.log("\n=== Coach knowledge layers ===\n");
  testShape();
  testNoHebrew();
  testNoSourceLeak();
  testScope();
  testNumbersHaveProvenance();
  testGeneralLayerDecisions();
  testIndividualLayerDecisions();
  testInjuryGate();
  testRouting();
  testRouterAgainstRealPacket();
  testSessionCountMode();
  testStructuredIntakeFields();
  testPackBudget();
  console.log("\nPassed:", passed);
  if (process.exitCode) {
    console.error("\nLAYER CHECKS FAILED");
    process.exit(1);
  }
  console.log("\nLAYER CHECKS PASSED");
}

main();
