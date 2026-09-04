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
  /* 5600 as of 2026-09-03: an intake arrived with every skill marked Rx-capable AND "deep squat"
     marked to avoid. The layer said the avoid list wins but never said it also removes a SKILL the
     athlete claims — so a pistol and a squat snatch were still on the menu. Conditional layer:
     only a restricted athlete pays for it. The last 100 point the coach at the explicit
     AVOID OVERRIDES line the admin module now emits. */
  "layer1-injuries": 5600,
  /* 7600 as of 2026-09-02. Two raises and two real trims got it here, and every line is
     owner-approved and universal: the skill-fresh / capacity-tired distinction moved in from the
     competitor layer (a training rule, not a competition rule), and the session-length ceiling
     arrived once the admin module confirmed the contract for it. This is the always-on
     construction layer, so it is the one budget worth watching.
     IF IT HAS TO SHRINK, the first thing out is "HOW MANY DAYS, AND WHOSE DAYS THEY ARE": half of
     it is a studio rule an individual reads for nothing and half is the reverse. Splitting it per
     agent would take ~600 characters off every brick. Do that before trimming anything the owner
     approved line by line. */
  /* 8350 as of 2026-09-03: session length is one number, but athletes report a longer weekend in
     the notes ("45, weekends I can reach 60"). The ceiling rule read as uniform and would have
     flattened the long day away. Then the admin module delivered sessionMinutesByDay, so the
     bullet list had to name the per-day case as its own — with a single number now legitimately
     absent rather than missing. */
  /* 9500 as of 2026-09-03, from the coverage pass before wiring the layers into the coach: three
     rules in the two live briefs had no equivalent anywhere in the layers and would have been lost
     silently — the nervous-system stacking limit, priming a pattern before loading it, and the
     requirement that every part carry loading language and not only a stated stimulus. All three
     are always-on, which is why they land here. The pairing PRINCIPLE came with them; the source's
     list of ten concrete pairings deliberately did not, because POL-021 says patterns inspire and
     are never copied, and a list in the prompt is an invitation to copy it. */
  /* 10200 as of 2026-09-03, from reading the first brick the wired brain produced. Three faults
     in it were writing faults, not programming faults: a part titled "Snatch Progression" whose
     first line worked up to a CLEAN, a three-movement piece labelled a couplet, and a box in
     inches after we had just taken inches out of the gymnastics layer. All three are always-on
     and cheap to state. */
  /* 11100 as of 2026-09-03. The owner's framing after reading week 2 of a real brick, which had
     repeated week 1's Saturday movement for movement: "אין סיכוי שאין קשר בין שבוע 1>2>3>4 זה
     נבנה זה מתקשר אחד עם השני וזה חייב להיות מגולם בשיטה שבה המוח חושב = זה קרוספיט." A WEEK IS
     NOT AN ISLAND is the rule half of that; the data half is priorWeeksBlock() in the coach. */
  "layer2-general": 11900,
  /* 4500 as of 2026-09-03: MORE THAN ONE PLACE. "קצה 1" trains in a full box mid-week and at home
     at weekends; the intake has one setting, so the packet said "never prescribe a kg figure" for
     an athlete with a tested 160 kg back squat. The layer now reads the athlete's own description
     of the setup instead of the single tick — and, once the admin module shipped the fields, at the
     Primary / Also trains / LOAD lines by name, including the case where no days are given. */
  /* 5500 as of 2026-09-04. The 1RM gate: week 4 of a real brick tested a 100% back squat single
     and put 45 heavy deadlifts in the same session, and nobody had asked for a test — the block
     call invented a "Performance Testing" theme weeks earlier and the week fill obeyed it. Owner:
     "1RM זה מבחן שלא צריך לעשות אותו בטווחי זמן שמישהו זוכר בכלל כשהמטרה שלך היא רק להתאמן."
     The two lines that used to grant a soft permission ("test a single only occasionally") now
     point at the computed gate instead of reading as licence. */
  /* 6600 as of 2026-09-04: the two-working-parts rule. Week 2 of the competitor's brick came back
     with a third part in FIVE sessions out of five, and the owner's arithmetic is the reason it
     matters: "אנחנו מדברים על שעה אפקטיבית, 3 חלקים בכזה יחס של כמות אימונים בני שעה זה לא
     אפקטיבי". An hour divided three ways is eighteen minutes a piece before transitions. The
     studio has its own version of this rule for its own reason — the coach's floor — so the two
     are stated separately rather than shared. */
  "layer2-individual": 6600,
  /* 3200 as of 2026-09-03. Started at 1220 as four continuity bullets. The owner then reset its
     priority — "חשוב מאוד שלא יהיו 2 לבנות זהות אחרת אין התקדמות לעולם" — so not-repeating became
     the headline with the four progression axes under it, and a studio section was added because
     the same failure is worse in a room where nobody can ask for a revision. Fires only on a
     continuation, so a first brick still pays nothing. */
  "layer2-continuation": 3200,
  /* The two halves of the old HOW MANY DAYS section, each read by one product only. Both grew on
     2026-09-03: the studio took the station-to-people rule out of the always-on layer, and the
     individual took the 3-consecutive-day limit out of the competitor layer. Both are now on the
     one path that needs them instead of on every path or none. */
  /* 3400 as of 2026-09-04, from the owner reading the first studio brick. Three rules, and the
     format one is the load-bearing insight: in a room where everything is stations, the FORMAT is
     the variety and the progression at once, because the movements are whatever the place owns and
     the load is self-selected. Studio path only — an individual pays nothing for any of it. */
  "layer2-room-studio": 5600,
  "layer2-days-individual": 1200,
  /* Conditional: only a studio that bought N sessions a week pays for it. */
  "layer2-session-count": 3200,
  "layer3-gymnastics": 4000,
  "layer3-weightlifting": 3500,
  "layer3-endurance": 3500,
  /* 4600 as of 2026-09-03, owner review: the two experience tiers came out and were replaced by
     the rule that the intake's days are the whole answer — "אם יש מישהו עם שאיפות תחרותיות
     שמתאמן רק 3 פעמים בשבוע הוא יקבל 3 אימונים הכי מתאימים לו" — plus the precedence line that
     settles this layer against a discipline layer. Net growth, and worth it: both replaced rules
     were producing a session count nobody asked for. */
  "layer3-competitors": 4600,
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
  const DAYS_STUDIO = require("../lib/coach-layers/layer2-room-studio.js").replace(/\s+/g, " ");
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

  /* A studio's character is two things wearing one coat: identity, which sets tone, and a
     BOUNDARY, which decides what is never written. "לא עושים סנאצ'ים עם מוט" is the second kind,
     and it was buried in a paragraph about atmosphere for the coach to infer. */
  ok("a place's boundary is a house rule, not a mood",
    /A place's boundary is a HOUSE RULE, not a mood/.test(DAYS_STUDIO) &&
      /It holds in every session, every week/.test(DAYS_STUDIO));
  ok("the boundary may not be evaded on a technicality",
    /DO NOT EVADE IT ON A TECHNICALITY/.test(DAYS_STUDIO) &&
      /do not reach for\s*something that is obviously the same thing under another name/i.test(
        DAYS_STUDIO
      ) &&
      /do not go looking for the gap/i.test(DAYS_STUDIO));
  ok("the function survives the boundary",
    /Keep the movement's FUNCTION — explosive hip extension, load overhead — with a tool that fits/i.test(
      DAYS_STUDIO
    ));
  /* The line that stops this becoming an excuse for a soft programme. */
  ok("character narrows the vocabulary and never the standards",
    /A PLACE'S CHARACTER NARROWS THE VOCABULARY, NEVER THE STANDARDS/.test(DAYS_STUDIO) &&
      /It\s*gets a good session from a different vocabulary — not a loose one/i.test(DAYS_STUDIO));
  ok("an individual never reads the studio's house rules",
    L.buildLayerPack({ agent: "individual", profile: { goals: "get fit" } }).text.indexOf(
      "HOUSE RULE"
    ) < 0);
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

  /* "קצה 1", 2026-09-03: session length 45, "different times on different days" UNTICKED, and the
     notes saying "at the weekend I can reach 60". Both answers are true, and the ceiling rule read
     as uniform — which would have flattened away the one long session of the week, the session
     that most needs the time because it is the day he trains at home. */
  ok("a note naming a longer day is honoured alongside the number",
    /A number given AND the notes name a DIFFERENT length for some days/.test(G));
  ok("the long day gets the piece that needs the time",
    /Use the longer day — put the piece that needs the time there/i.test(flat));
  ok("neither flattening nor stretching every session is allowed",
    /Do not flatten every session to the smaller number and do not stretch them all to the\s*larger one/i.test(
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

  /* "קצה 1", 2026-09-03. The intake has ONE equipment setting per athlete, and he has two: a full
     box Mon-Fri and a garage on Saturday. He ticked "home or limited equipment" and left the
     heaviest-implement box empty, so the packet emitted four tested 1RMs (160 kg back squat) and
     then "never by a kg figure" underneath them. The layer has to read his own description of the
     setup rather than the single tick, or the best data in the intake is thrown away. */
  ok("two places is a case the layer knows",
    /MORE THAN ONE PLACE IS COMMON \(HARD\)/.test(I));
  ok("two places means no single load ceiling",
    /there is no single load ceiling in this case and you must not apply one/i.test(flat));
  ok("the gym days are prescribed from the reported lifts",
    /On the days they have the gym: prescribe from their REPORTED LIFTS, by %1RM/.test(I));
  ok("a blanket refusal to name a kg is called out as data thrown away",
    /a blanket 'no kg figures' throws them away/i.test(flat));
  ok("the athlete is told which day the session was written for",
    /SAY WHICH DAY IS WHICH in the session itself/.test(I));
  ok("loaded work is placed on the gym days",
    /Put the loaded work on the gym days and the equipment-light work on the others/.test(I));

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

  /* Same intake, second conflict: "All skills" ticked as Rx-capable AND "deep squat" ticked to
     avoid. A pistol IS a deep squat, and so is a squat snatch — which he also reported at 90 kg.
     The avoid list already won over the free text; it now has to win over a claimed SKILL too, or
     the coach resolves the clash in favour of the more flattering answer. */
  const INJflat = require("../lib/coach-layers/layer1-injuries.js").replace(/\s+/g, " ");
  ok("an avoided pattern also removes a skill the athlete says they have",
    /AND IT ALSO REMOVES A SKILL THEY SAID THEY HAVE/.test(
      require("../lib/coach-layers/layer1-injuries.js")
    ));
  ok("the clash is not resolved in favour of the skill",
    /That is not a contradiction to resolve in favour of the skill: the avoid list wins/i.test(
      INJflat
    ));
  ok("deep squat avoided is spelled out down to the movements",
    /Deep squat avoided means no pistol, no squat snatch, no squat clean, no overhead squat, no thruster/i.test(
      INJflat
    ));
  ok("the athlete's confidence does not reopen the pattern",
    /however confident the athlete is/i.test(INJflat));
  ok("the function survives the removal",
    /Keep the FUNCTION with a version that stays out of the bottom/i.test(INJflat));

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

  /* The COMPETITOR line SHIPPED with 22.0, and merging it turned this block red: every packet the
     contract builds now carries an authoritative "COMPETITOR: no", so a competitive phrase in the
     free-text goal no longer switches the layer on. That is the behaviour the owner asked for —
     "תיבה מסומנת היא החלטה" — so the assertion was stale, not the router. The fallback still
     matters for a packet stored before the release, and it is asserted against a packet with the
     line stripped rather than against the contract declining to emit one. */
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
  /* An authoritative "no" beats a competitive phrase in the goal text. This is the case the
     release created and the one that was asserted backwards. */
  ok('"COMPETITOR: no" beats a competitive goal in free text',
    !L.competitorDeclared(
      withPacket({ goals: "I want to compete at a local throwdown" }),
      null
    ));
  /* A packet stored before 22.0 has no such line. Strip it to build that world, rather than
     trusting the contract not to emit one — which is exactly what broke here. */
  const OLD_PACKET = function (goals) {
    const p = withPacket({ goals: goals }).fixedIntakePacket
      .split(String.fromCharCode(10))
      .filter(function (l) {
        return !/^COMPETITOR:/.test(l);
      })
      .join(String.fromCharCode(10));
    return { fixedIntakePacket: p, goals: goals };
  };
  ok("a pre-22.0 packet still falls back to stated intent",
    L.competitorDeclared(OLD_PACKET("I want to compete at a local throwdown"), null) &&
      !L.competitorDeclared(OLD_PACKET("Get fitter and lose a few kilos"), null));

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
    /* The real worst case is a SECOND brick: an injured competitor whose block continues from a
       handoff. Added 2026-09-03 with the continuation layer, because a fixture that quietly builds
       a first brick understates what the app actually pays. */
    blockStartWeek: 5,
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
  /* 38k as of 2026-09-03, from the "קצה 1" audit: three real conflicts a live intake produced —
     an athlete with two training places, a skill claimed and its pattern avoided, and a weekend
     session longer than the stated ceiling. Two of the three are conditional (injuries, individual)
     and only the session-length line is always-on. A second brick is now folded into the fixture, so the number is the true worst case. The
     weightlifting and competitor layers then grew in the owner reviews that replaced their
     experience tiers with rules resting on data we hold — the reported numbers, and the intake's
     own training days. The coverage pass before wiring then moved three always-on rules in from the
     two live briefs, which is a transfer rather than growth: the briefs stop being injected the
     moment the router becomes the source. This pack is
     ~10.2k tokens; the general
     healthy athlete still pays 22k, which is what most bricks actually cost. */
  ok("the heaviest pack stays under 49k characters",
    heavy.chars < 49000, heavy.chars + " chars, layers: " + heavy.layers.join(", "));
  ok("the pack reports which layers it used",
    Array.isArray(heavy.layers) && heavy.layers.length >= 6, heavy.layers.join(", "));
}


/* POL-009: brick 2 is not brick 1. Added 2026-09-03 after finding that nothing in thirteen layers
   mentioned a previous block, while the policy called handoff continuity a HARD rule and the app
   had been sending a handoff all along. */
function testContinuation() {
  const K = require("../lib/coach-layers/layer2-continuation.js");
  const flat = K.replace(/\s+/g, " ");
  ok("the continuation layer knows it is not the first brick",
    /--- THIS IS NOT THE FIRST BRICK \(HARD\) ---/.test(K));
  ok("two identical bricks are called a product failure",
    /TWO IDENTICAL BRICKS ARE A PRODUCT FAILURE/.test(K));
  ok("the transition itself is named as the progression",
    /The move from one brick to the next IS the athlete's progression/i.test(flat));
  /* The likeliest path to a repeated month: the athlete changed nothing, so the packet is
     identical and the model has no reason to do anything different. */
  ok("an unchanged intake is not permission to repeat",
    /AN UNCHANGED INTAKE IS NOT PERMISSION TO REPEAT/.test(K) &&
      /Constraints repeat; work does not/.test(K));
  ok("the brick has to say what moved",
    /SAY WHAT MOVED/.test(K) &&
      /If you cannot name what progressed, you have not written a continuation/i.test(flat));
  ok("one axis at a time, and all five are named",
    /PROGRESS ON ONE AXIS AT A TIME, never all of them at once/.test(K) &&
      /- LOAD —/.test(K) && /- DENSITY —/.test(K) && /- VOLUME —/.test(K) &&
      /- COMPLEXITY —/.test(K) && /- FORMAT AND STRUCTURE —/.test(K));
  /* The owner's note, and the reason it is not a softer case: "דמיין מישהו שמגיע כל חודש לאותו
     אימון בסטודיו - זה משעמם ולא אפקטיבי!!" A room has no 1RM, and a class member cannot ask for
     a revision, so nobody reports the repetition. */
  ok("a studio's progression is format and structure, and it matters more not less",
    /FOR A STUDIO THIS MATTERS MORE, NOT LESS \(HARD\)/.test(K) &&
      /A room has no 1RM to move, so FORMAT AND STRUCTURE are its progression/i.test(flat));
  ok("the layer says out loud that nobody will report this failure",
    /unlike a single athlete they have no way to ask you to change it\. Nobody will report this failure/i.test(
      flat
    ));
  ok("reprinting last month with new numbers is named and refused",
    /never by quietly reprinting last month with new numbers/i.test(flat));
  ok("the load axis starts from where the handoff leaves it",
    /the next rung of the same scheme, from where the handoff leaves it/i.test(flat) &&
      /Not a fresh start at the bottom, and not a jump you have no evidence for/i.test(flat));
  ok("a format already used is not repeated unless it is a declared retest",
    /DO NOT REPEAT A NAMED FORMAT/.test(K) &&
      /unless it is a benchmark being retested on purpose/i.test(flat));
  ok("a change asked for last block does not expire with the block",
    /It does not expire with the block, and they should not have to ask twice/i.test(flat));
  ok("with no handoff, no history is invented",
    /IF NO HANDOFF IS GIVEN, DO NOT INVENT ONE/.test(K) &&
      /do not claim a continuity you cannot see/i.test(flat));
  ok("intake is never restarted on a continuation",
    /NEVER RESTART INTAKE/.test(K));

  /* The gate, in both directions. A rule about "the previous block" is a lie on a first brick, so
     the false case matters more than the true one. */
  const L = require("../lib/coach-layers");
  const first = L.buildLayerPack({ agent: "individual", profile: {} });
  const second = L.buildLayerPack({ agent: "individual", profile: {}, blockStartWeek: 5 });
  const studio2 = L.buildLayerPack({ agent: "studio", studioIntake: {}, continuation: true });
  ok("a first brick does not read the continuation layer",
    first.layers.indexOf("layer2-continuation") < 0, first.layers.join(", "));
  ok("a later brick does, on blockStartWeek alone",
    second.layers.indexOf("layer2-continuation") >= 0, second.layers.join(", "));
  ok("a studio continuation reads it too",
    studio2.layers.indexOf("layer2-continuation") >= 0, studio2.layers.join(", "));
  ok("the presence of a handoff is enough on its own",
    L.isContinuationBrick({ blockHandoff: "themes: engine" }) === true);
  ok("nothing stated means a first brick",
    L.isContinuationBrick({}) === false &&
      L.isContinuationBrick({ blockStartWeek: 1 }) === false &&
      L.isContinuationBrick({ blockStartWeek: "" }) === false);
  ok("chat pays nothing for it",
    L.buildLayerPack({ agent: "individual", profile: {}, blockStartWeek: 9, programming: false })
      .layers.indexOf("layer2-continuation") < 0);
}


/* The gymnastics layer, reviewed line by line with the owner on 2026-09-03. Five decisions came
   out of it and all five are asserted here, because each one reverses something the source said. */
function testGymnastics() {
  const G = require("../lib/coach-layers/layer3-gymnastics.js");
  const flat = G.replace(/\s+/g, " ");

  /* The source made the Tabata hollow standard a GATE: no skill until it holds. We have no way to
     know whether it holds — it is not in the intake — so the coach would either ignore the rule or
     refuse an athlete the muscle-up they asked for. It is now a prescription hung on the one thing
     we can actually see: the marked skills. */
  ok("the core readiness standard is a prescription, not a gate",
    /THAT STANDARD IS A PRESCRIPTION, NOT A GATE/.test(G));
  ok("the skill the athlete asked for is never withheld while waiting to find out",
    /never withhold the skill they asked for while you wait to find out/i.test(flat));
  ok("the marked skills are named as the visible evidence",
    /The MARKED SKILLS are what you can see/.test(G) &&
      /A skill they marked is a skill they perform: program it/.test(G));
  ok("core work runs alongside the goal, never instead of it",
    /run ALONGSIDE the progression below, never instead of the goal they stated/i.test(flat));

  /* "מסכים אנחנו לא מתעסקים בזה." An age-based slowdown contradicts the expectation rule in
     coach-craft — program for the best, scale for the rest — and added nothing the strict-phase
     rule did not already say. */
  ok("no age-based slowdown survives",
    !/40\+/.test(G) && !/progress more slowly/i.test(flat),
    "an age tier is back in the gymnastics layer");

  /* Kilograms and metres, so millimetres for equipment. The source specified bands and bars in
     inches. */
  ok("equipment is specified in metric",
    !/inch/i.test(G) && /nothing wider than 20 mm/.test(G) && /any bar 38 mm or under/.test(G));

  /* "משאירים פרפר זה רלוונטי לנו." The source called butterfly a dead end. It is not a rung in
     building the pull, but it is a real technique for this product's athletes and is not banned. */
  ok("butterfly is barred from the progression but not from the programme",
    /BUTTERFLY is not a step in building the pull/.test(G) &&
      /it is legitimate to train once the kipping pull-up is solid/i.test(flat));
  ok("butterfly is no longer called a dead end",
    !/dead end/i.test(G));

  /* A ring dip was listed as a prerequisite for the kipping dip while rings were also the advanced
     apparatus — circular. The prerequisite is now the two static ones. */
  ok("the kipping-dip prerequisite no longer requires the advanced apparatus",
    /No kipping dip until strict push-up and parallel-bar dip are solid/.test(G));
  ok("static apparatus still precedes dynamic",
    /Static apparatus \(floor, bar\) before dynamic apparatus \(rings\)/.test(G));

  /* Regression guard: the toes-to-bar progression was nearly lost to an edit that removed the line
     above it. It is the kind of loss no other assertion would have caught. */
  ok("the toes-to-bar progression is intact",
    /TOES-TO-BAR: strict knee-to-elbow -> flexed-knee to elbow then extend to bar -> straight leg to parallel and back to L-sit -> straight-leg toes-to-bar -> kipping/.test(
      flat
    ));
}


/* THE HEBREW BOUNDARY, revisited 2026-09-03. Three separate defects in one helper, all found by
   typing goals the way an athlete actually types them:
     1. Hebrew glues its prepositions and its definite article to the front of the word, so the
        "no Hebrew letter before" guard rejected בסנאץ, הסנאץ, המנוע, במאסל אפ. Eight of nine real
        phrasings selected NO layer.
     2. \w does not match Hebrew, so the suffix wildcard on פיסטול, אולימפי, אירובי and
        ג'ימנסטיק matched nothing — פיסטולים and אולימפיות failed even spelled bare.
     3. The apostrophe in ג'ימנסטיק, ג'רק and סנאץ' comes in three characters: ASCII ', the Hebrew
        geresh ׳ and the typographic ’. Only the first was accepted.
   The suffix lookahead still does the work it was added for, which is what keeps מתח out of
   מתחיל and מתחרה. Assert both halves — a prefix fix that also matches beginners is worse than
   the bug. */
function testHebrewBoundary() {
  const hits = [
    ["רוצה להוסיף קילו בסנאץ", "weightlifting", "prefix ב"],
    ["לשפר את הסנאץ שלי", "weightlifting", "prefix ה"],
    ["לשפר את המנוע", "endurance", "prefix ה"],
    ["להתקדם במאסל אפ", "gymnastics", "prefix ב"],
    ["להשתפר בחתירה", "endurance", "prefix ב"],
    ["לעבוד על הקיפינג", "gymnastics", "prefix ה"],
    ["בכפיפות מתח", "gymnastics", "prefix ב on a two-word term"],
    ["פיסטולים", "gymnastics", "Hebrew plural suffix"],
    ["הרמות אולימפיות", "weightlifting", "Hebrew feminine plural suffix"],
    ["להשתפר באירובי", "endurance", "prefix plus suffix"],
    ["לעבוד על הג'ימנסטיקס", "gymnastics", "ASCII apostrophe"],
    ["לעבוד על הג\u05f3ימנסטיקס", "gymnastics", "Hebrew geresh"],
    ["לעבוד על הג\u2019ימנסטיקס", "gymnastics", "typographic apostrophe"],
    ["ג\u05f3רק", "weightlifting", "geresh in ג'רק"],
  ];
  hits.forEach(function (row) {
    const got = L.pickLayer3({ goals: row[0] }, null);
    ok('"' + row[0] + '" selects ' + row[1] + " (" + row[2] + ")",
      got.indexOf(row[1]) >= 0,
      "got " + JSON.stringify(got));
  });

  /* The other half of the guard: these must still select nothing. מתח (pull-up) lives inside
     מתחיל and מתחרה, and a prefix rule that let those through would be a worse bug than the one
     it fixed. */
  ["אני מתחיל", "אני לא מתחרה", "להתחיל להתאמן", "מתחיל להתאמן השבוע"].forEach(function (g) {
    ok('"' + g + '" still selects no discipline',
      L.pickLayer3({ goals: g }, null).length === 0,
      JSON.stringify(L.pickLayer3({ goals: g }, null)));
  });
}


/* Weightlifting, reviewed with the owner 2026-09-03. Six decisions, each reversing the source. */
function testWeightlifting() {
  const W = require("../lib/coach-layers/layer3-weightlifting.js");
  const flat = W.replace(/\s+/g, " ");

  /* The experience tiers again — third layer to carry them, third time out. The replacement is the
     data we hold: a reported 90 kg snatch is not a beginner, and an empty field is the signal. */
  ok("no experience tier survives in the weightlifting layer",
    !/beginner/i.test(W) && !/intermediate lifter/i.test(W) && !/less skilled/i.test(W),
    "an experience tier is back in the weightlifting layer");
  ok("the reported numbers replace the label",
    /READ THE REPORTED NUMBERS, NEVER AN EXPERIENCE LABEL/.test(W) &&
      /A reported snatch or clean & jerk figure is a tested lift/.test(W));
  ok("an empty field means the pattern is the work",
    /No figure reported for a lift, or the skill left unmarked: the PATTERN is the work/.test(W));
  ok("load still follows position",
    /Load follows position, never leads it/.test(W));

  /* 3-5 lifting sessions a week is a weightlifting programme. Our athlete has five training days
     in total and this is one focus among several. */
  ok("the lifting spreads across existing days instead of taking the week",
    /HOW MUCH OF THE WEEK THIS TAKES \(HARD\)/.test(W) &&
      /spread the barbell work across the training days the athlete already has/i.test(flat));
  ok("no days are added and the week does not become a lifting programme",
    /Do NOT add days, and do NOT turn the week into a weightlifting programme/i.test(flat));
  ok("no session-count prescription is left in the layer",
    !/3-5 sessions a week/i.test(flat), "a specialist frequency came back");

  /* Banned outright rather than gated: a list of exceptions invites the model to find a way in,
     and this is the same family as the powerlifting source the owner refused. */
  ok("daily-max squat templates are banned for everyone",
    /NO DAILY-MAX SQUAT TEMPLATES\. Not for anyone, at any level, under any condition/.test(W));
  ok("the ban is not a list of exceptions",
    !/contraindicated for/i.test(W));

  /* The coach writes four weeks ahead and cannot know last session's single, so a kg figure it
     computes is invented. The intent survives, addressed to the athlete. */
  ok("the heavy single is judged on feel and never taken to failure",
    /A heavy single is judged on FEEL and never taken to failure/.test(W));
  ok("the increment is the athlete's, not a number the coach writes",
    /Tell the ATHLETE in the session to add a little on their last session if it is there; never write that kg figure yourself/i.test(
      flat
    ));
  ok("no computed kilo increment survives",
    !/beat the previous session by at least 1 kg/i.test(flat));

  /* The two-setting athlete reached this layer too. */
  ok("technical work goes where the barbell is",
    /PUT THE TECHNICAL WORK ON THE DAYS THE BARBELL EXISTS/.test(W) &&
      /on the other days keep the pattern with the implement they have/i.test(flat));

  /* Kept from the source, and worth pinning: these are the safety rules. */
  ok("never ending on a miss is kept",
    /NEVER end a set or a session on a miss/.test(W));
  ok("the three-miss ceiling is kept",
    /Maximum 3 missed attempts on heavy snatch or clean & jerk in a session/.test(W));
  ok("a barbell in a metcon is still called conditioning",
    /A barbell in a metcon is conditioning, not lifting/.test(W));

  /* Both layer-3 headers claimed the router selects them by the day's modality. It never sees the
     day. Documentation, but a lie in a header is how the next person builds the wrong thing. */
  const fs2 = require("fs");
  ["layer3-weightlifting.js", "layer3-gymnastics.js"].forEach(function (f) {
    const src = fs2.readFileSync(path.join(LAYERS_DIR, f), "utf8").split(String.fromCharCode(10)).join(" ").replace(/ \* /g, "");
    ok(f + " does not claim the router sees the day's modality",
      /router never sees the day/.test(src) && !/Lights up when the day's modality/.test(src));
  });

  /* The endurance verbs. "לרוץ יותר" is how a person writes it; the table only knew the noun. */
  ["לרוץ יותר", "רוצה לרוץ 10 קמ", "לחתור טוב יותר", "לשחות", "רכיבה על אופניים"].forEach(
    function (g) {
      ok('"' + g + '" selects endurance',
        L.pickLayer3({ goals: g }, null).indexOf("endurance") >= 0,
        JSON.stringify(L.pickLayer3({ goals: g }, null)));
    }
  );
}


/* Endurance, reviewed with the owner 2026-09-03. The layer was priced entirely in %HRmax and the
   intake collects neither a max heart rate nor whether the athlete owns a monitor. */
function testEndurance() {
  const E = require("../lib/coach-layers/layer3-endurance.js");
  const flat = E.replace(/\s+/g, " ");

  ok("no heart-rate percentage survives anywhere in the layer",
    (E.match(/\d+%/g) || []).length === 0 && !/HRmax/i.test(E),
    "a heart-rate percentage is back in a layer whose athlete has no monitor");
  ok("the ban on prescribing a heart rate is stated out loud",
    /Never prescribe a heart-rate percentage/.test(E) &&
      /the athlete has not told us their max and may own no monitor/i.test(flat));

  /* The owner's four parameters, each defined by something an athlete can judge without kit. */
  ok("the four paces are the intensity language",
    /THE FOUR PACES — THIS IS THE ONLY INTENSITY LANGUAGE/.test(E));
  ["EASY PACE", "MODERATE PACE", "HIGH PACE", "MAXIMAL PACE"].forEach(function (p) {
    ok(p + " is defined", new RegExp("- " + p + ":").test(E));
  });
  ok("the paces are defined by breathing and by how long they hold",
    /full sentences while moving\. Holds for an hour or more/.test(E) &&
      /a word at a time\. Holds 5-20 minutes/.test(E) &&
      /no talking, and it cannot be held/.test(E));
  ok("no conversion from a reported time to a pace band is invented",
    /never invent a conversion between a time and a pace band/i.test(flat));

  /* "להוריד את השער - לא לשם אנחנו מכוונים לא רלוונטי למוצר שלנו." */
  ok("the four-week base gate is gone",
    !/at least 4 weeks/i.test(flat) &&
      !/only after the 4-week base/i.test(flat) &&
      !/PHASE 1|PHASE 2/.test(E),
    "the base-before-threshold gate came back");
  ok("both session types still exist without a sequence between them",
    /--- ?THE LONG SESSION|THE LONG SESSION:/.test(E) && /THE THRESHOLD SESSION:/.test(E));

  /* "הכי טוב במגבלות מה שיש." */
  ok("a place with none of the five modalities still gets engine work",
    /IF THE PLACE HAS NONE OF THE FIVE, do the best available/.test(E) &&
      /otherwise a cyclical bodyweight movement held at the target pace/i.test(flat));
  ok("even then it is never a loaded implement",
    /Still never a loaded implement/.test(E));
  ok("loaded engine work is still refused outright",
    /Do NOT build aerobic capacity with barbells or dumbbells/.test(E));

  /* Calories per minute is an output, not a distance. */
  ok("the EMOM calorie figures are marked as an example",
    /THE CALORIE FIGURES ARE AN EXAMPLE, NOT A PRESCRIPTION/.test(flat));
  ok("the number scales to the athlete while the ratio is kept",
    /pick a number this athlete can actually hold for the whole piece/i.test(flat) &&
      /keep the RATIO between the machines from the equivalence table/i.test(flat));
  ok("no single calorie figure is copied across the three machines",
    /Do not copy one number across all three/.test(E));

  /* Kept: the dose, and the refusal to convert a brick into zone work. */
  ok("engine work stays an addition to a varied week",
    /Engine work is an ADDITION to a varied week, never a replacement for it/.test(E));
  ok("the whole brick is never turned into easy aerobic work",
    /never turn an athlete's whole brick into easy aerobic work/i.test(flat));
  ok("the endurance header no longer claims the router sees the day",
    /router never sees the day/.test(
      require("fs")
        .readFileSync(path.join(LAYERS_DIR, "layer3-endurance.js"), "utf8")
        .split(String.fromCharCode(10))
        .join(" ")
        .replace(/ \* /g, "")
    ));
}


/* Partner, reviewed with the owner 2026-09-03. Four changes; the odd-number-of-people case was
   deliberately left out — "תניח לזה ותן למאמן האנושי להתמודד". */
function testPartner() {
  const P = require("../lib/coach-layers/layer3-partner.js");
  const flat = P.replace(/\s+/g, " ");

  /* The header said four structures and listed five. */
  ok("the structure list is not miscounted",
    !/FOUR STRUCTURES/.test(P) && /THE STRUCTURES, AND WHAT EACH IS FOR:/.test(P));
  ["YOU GO / I GO", "CHIPPER", "SYNCHRO", "CARDIO SPLIT", "ALTERNATING EMOM"].forEach(function (k) {
    ok(k + " is still one of them", P.indexOf("- " + k) >= 0);
  });

  /* Double the volume, same clock. Without this said out loud, a 45-minute ceiling becomes 90. */
  ok("doubled volume does not double the clock",
    /THE CLOCK DOES NOT CHANGE/.test(P) &&
      /The session-length ceiling from the intake holds exactly as it does on any other day/i.test(
        flat
      ));
  ok("the reason the extra volume fits is stated",
    /The extra volume fits because each athlete rests half the time/i.test(flat) &&
      /not a reason to write a longer session/i.test(flat));
  ok("the volume rule itself is intact",
    /the total volume is DOUBLE or TRIPLE the individual prescription/i.test(flat));

  /* The connection to the room layer: a pair halves the stations a piece needs. This is what turns
     a partner day from a change of pace into the answer to the station-versus-people count. */
  ok("partner structures are named as the answer to a station shortage",
    /WHEN THE EQUIPMENT IS SHORT, THIS IS THE TOOL:/.test(P) &&
      /a partner structure halves the stations a piece needs/i.test(flat));
  ok("it is reached for before staggering starts or dropping the loaded work",
    /rather than staggering starts or dropping the loaded work/i.test(flat));

  /* A home studio or an outdoor coach has no machine, and the cardio split assumed one. */
  ok("the cardio split works with no machine",
    /WITH NO MACHINE, the holding partner holds a position or a carry instead/i.test(flat) &&
      /the structure is unchanged/i.test(flat));

  /* Deliberately absent. If someone adds it later they should have to delete this assertion and
     think about why it was left out. */
  ok("no rule was invented for an odd number of athletes",
    !/odd number/i.test(P),
    "the owner left this to the human coach on purpose");
}


/* Competitors, reviewed with the owner 2026-09-03. Four changes. */
function testCompetitorReview() {
  const C2 = require("../lib/coach-layers/layer3-competitors.js");
  const flat = C2.replace(/\s+/g, " ");

  /* Fourth layer to carry experience tiers, and the worst of the four: they prescribed a session
     count ("3-4 days rising toward 6", "up to 6 days a week") against an intake that already
     states the training days, which the owner ruled is the winning answer. */
  ok("no experience tier survives in the competitor layer",
    !/DEVELOPING —/.test(C2) && !/INTERMEDIATE —/.test(C2) && !/days a week rising toward/.test(flat),
    "an experience tier is back in the competitor layer");
  ok("the intake's days are the whole answer",
    /HOW MANY DAYS THEY GET \(HARD\)/.test(C2) &&
      /The days in their intake, and nothing else/.test(C2));
  ok("a competitive goal earns no extra sessions",
    /A competitive goal does not earn an athlete more sessions than they said they train/i.test(flat));
  ok("three days a week gets the three best sessions",
    /trains three times a week gets the three sessions that serve them best/i.test(flat));
  ok("volume is never inferred from how serious the goal sounds",
    /Never infer a training volume from how serious the goal sounds/.test(C2));
  ok("the skill sessions survived the tier deletion, attached to existing days",
    /up to two low-intensity skill sessions a week/i.test(flat) &&
      /attached to the start or end of a session they already have\. Attached — never a session of their own/i.test(
        flat
      ));

  /* The owner's precedence call, and it runs the other way from the recommendation put to him:
     "תוכנית המתחרים תנצח את תוכנית המוט ולמה? כי היא מדברת על רוחב למתחרה ולא על סקיל ספציפי." */
  ok("this layer wins a clash with a discipline layer",
    /IF THIS SHAPE CLASHES WITH A DISCIPLINE LAYER, THIS ONE WINS/.test(C2));
  ok("the reason for that precedence is stated, not just asserted",
    /this layer is about preparing a competitor BROADLY, and the barbell density here is breadth for them rather than specialisation/i.test(
      flat
    ));

  /* "גם לא ימסר תאריך - אנחנו לא נותנים שירות כזה וזה לא קהל הלקוחות שלנו." No event week, and no
     intake field for a date either. */
  ok("there is no event week and no date is requested",
    /NO EVENT WEEK/.test(C2) &&
      /Do not build a week around a contest date, and do not ask for one/i.test(flat));
  ok("a date the athlete mentions changes nothing here",
    /a date they happen to mention changes nothing/i.test(flat));
  ok("the old event-week choreography is gone",
    !/dry run, rest, game day/i.test(flat));

  /* Kept on purpose — the core of the layer, all of it resting on data we hold. */
  ok("the weakness is still read off unmarked skills and the lowest lifts",
    /the unmarked skills and the lowest lifts in the intake/i.test(flat));
  ok("no invented domain score",
    /Do not invent a score for them across domains you have no data on/i.test(flat));
  ok("one weakness per block is kept",
    /A block carries ONE primary goal or weakness/.test(C2));
  ok("the tier ranking is kept and still declares itself contest-weighted",
    /TIER 1 \(all three\)/.test(C2) &&
      /this ranking is weighted by what a CONTEST tests/i.test(flat));
  ok("the header no longer says the competitor field is still coming",
    /field HAS since arrived/.test(
      require("fs").readFileSync(path.join(LAYERS_DIR, "layer3-competitors.js"), "utf8")
    ));
}


/* The craft layer had a budget and a routing assertion and no content assertions at all. It has
   one now, for the principle the owner escalated on 2026-09-03 from a layer tweak to a product
   foundation: "תיקון שורש פילוסופי של כל התפיסה של איך אנחנו מסתכלים על לקוח == נשאר אצלינו +
   מתפתח ומשתפר באופן מתמיד". It therefore has to live in the ALWAYS-ON layer and in the policy,
   not only in the conditional continuation layer that a first brick never reads. */
function testCraftFoundation() {
  const CR = require("../lib/coach-layers/coach-craft.js");
  const flat = CR.replace(/\s+/g, " ");
  ok("the long-term relationship is stated in the always-on craft layer",
    /THE CLIENT STAYS, AND IMPROVES/.test(CR) &&
      /This is a long-term relationship, not a delivered product/.test(CR));
  ok("the client is assumed to still be here next month",
    /will still be here next month, and the month after/i.test(flat));
  ok("the progression is named as what the client pays for",
    /that progression IS what they are paying for/i.test(flat));
  ok("two identical blocks are a failure even when both are good",
    /TWO IDENTICAL BLOCKS ARE A FAILURE even when both are good blocks/.test(CR));
  ok("an unchanged intake is not a reason for unchanged work, in the always-on layer too",
    /the constraints repeat, the work does not/i.test(flat));
  /* Both agents, both actions: a studio brick and a first individual brick must carry it. */
  ok("a studio brick carries the principle",
    L.buildLayerPack({ agent: "studio", studioIntake: {} }).text.indexOf(
      "THE CLIENT STAYS, AND IMPROVES"
    ) >= 0);
  ok("a first individual brick carries it too",
    L.buildLayerPack({ agent: "individual", profile: {} }).text.indexOf(
      "THE CLIENT STAYS, AND IMPROVES"
    ) >= 0);
}


/* The coverage pass, 2026-09-03: what the two live briefs held that the layers did not. Kept as
   assertions because the whole point of the exercise was that these three would otherwise vanish
   the moment coach-foundation-brief and coach-layer2-ops-brief stop being injected. */
function testBriefCoverage() {
  const G2 = require("../lib/coach-layers/layer2-general.js");
  const flat = G2.replace(/\s+/g, " ");
  ok("the nervous-system stacking limit survived the move",
    /HOW THE WEEK'S TAXES STACK \(HARD\)/.test(G2) &&
      /NEVER STACK THREE MAXIMAL-NERVOUS-SYSTEM DAYS IN A ROW/.test(flat));
  ok("the hard/moderate distribution across consecutive days is stated",
    /HARD - HARD - MODERATE, or HARD - MODERATE - HARD/.test(G2));
  ok("a moderate or skill day goes between them",
    /Put a moderate day or a skill day between them/i.test(flat));
  ok("priming a pattern before loading it survived",
    /PRIME THE PATTERN BEFORE YOU LOAD IT/.test(G2) &&
      /A primer is never there to make the athlete tired/i.test(flat));
  ok("loading language is required on every part",
    /EVERY TRAINING PART CARRIES LOADING LANGUAGE \(HARD\)/.test(G2));
  ok("the difference between a stimulus and loading language is spelled out",
    /A stated stimulus is the INTENTION; loading language is what the athlete actually executes/i.test(
      flat
    ));
  ok("a part with neither is refused",
    /A part carrying neither is not a prescription, it is a suggestion/i.test(flat));
  ok("the complementary pairing principle came across",
    /PAIR ELEMENTS THAT DO NOT COMPETE/.test(G2) &&
      /so the limiter is the intended stimulus and not one exhausted muscle group/i.test(flat));
  /* And deliberately NOT the source's pairing list. If someone adds it, they delete this. */
  ok("the source's concrete pairing list was not imported",
    !/strength cycle\+midline|pull\+lunge\+mono/i.test(G2),
    "POL-021 says patterns inspire and are never copied");
  /* The interference rule was already here under different wording — asserted so a future
     coverage pass does not re-add it as a duplicate. */
  ok("the interference rule is here once, not twice",
    (flat.match(/maximal strength tax and maximal long-aerobic tax/g) || []).length === 1);
}


/* Written after reading the first brick the wired brain actually produced (2026-09-03). Every rule
   here fixes something that was in the output, not something imagined. */
function testWritingRules() {
  const G3 = require("../lib/coach-layers/layer2-general.js");
  const flat = G3.replace(/\s+/g, " ");
  ok("a part's title, focus and work must name the same movement",
    /A PART'S TITLE, ITS STATED FOCUS AND ITS WORK NAME THE SAME MOVEMENT/.test(G3));
  ok("the snatch/clean contradiction is named as the example",
    /If the part is a snatch progression, no line in it works up to a clean/i.test(flat));
  ok("a couplet is two elements and a triplet three",
    /A couplet has exactly TWO elements and a triplet exactly THREE/.test(G3) &&
      /Do not label a three-movement piece a couplet/i.test(flat));
  ok("metric only, with the box height as the example",
    /METRIC ONLY\. Kilograms, metres, centimetres/.test(G3) &&
      /a 24 inch box is a 60 cm box/i.test(flat));
  ok("no imperial unit is used anywhere in the layer itself",
    !/inches(?![^.]*is a)/i.test(flat.replace("24 inch box is a 60 cm box", "")),
    "an imperial unit crept back in");
}


/* Same-brick week continuity, 2026-09-03. The failure that produced it: week 2 of a real brick put
   the identical 30 single-arm DB snatches at 22.5 kg in the identical Saturday slot as week 1,
   because the week-fill call carried no trace of week 1 and nothing required the movements to move.
   The rule is here; the data it reads is assembled in api/personal-coach.js. */
function testWeekContinuity() {
  const G4 = require("../lib/coach-layers/layer2-general.js");
  const flat = G4.replace(/\s+/g, " ");
  ok("a week is not an island",
    /--- A WEEK IS NOT AN ISLAND \(HARD\) ---/.test(G4) &&
      /Weeks 1 to 4 of a brick BUILD ON EACH OTHER/.test(G4));
  ok("week 2 is described as what week 1 earned",
    /Week 2 is what week 1 earned, week 3 is what week 2 earned/i.test(flat));
  ok("the earlier weeks are read and moved on from",
    /WHERE THE EARLIER WEEKS OF THIS BRICK ARE GIVEN TO YOU, READ THEM AND MOVE ON FROM THEM/.test(
      flat
    ));
  ok("the repeated weekday slot is named as the commonest failure",
    /The same loaded movement in the same weekday slot two weeks running/i.test(flat));
  ok("rotating the format while keeping the movements is refused",
    /ROTATION APPLIES TO THE WORK, NOT ONLY TO THE FORMAT/.test(G4) &&
      /it is the same session with more of it/i.test(flat));
  ok("progressing volume does not excuse repeating the selection",
    /Progressing the volume is good and does not excuse repeating the selection/i.test(flat));
  ok("with no prior weeks given, nothing is invented",
    /WHERE THEY ARE NOT GIVEN, do not invent what came before/.test(flat));
}


/* The 1RM gate, 2026-09-04. Cadence is the owner's: a general individual tests a major lift once
   every six bricks and never before the third; a declared competitor every four, from the third.
   No exceptions. The layer states the reasoning; whether THIS brick may test is a computed fact in
   the request, so the coach never has to remember when a lift was last tested. */
function testOneRmGate() {
  const I2 = require("../lib/coach-layers/layer2-individual.js");
  const flat = I2.replace(/\s+/g, " ");
  ok("testing a 1RM is stated as rare and HARD",
    /--- TESTING A 1RM IS RARE \(HARD\) ---/.test(I2));
  ok("a max is called a test, not training",
    /A one-rep max is a TEST, not training/.test(I2));
  ok("permission comes from the request, never from the coach",
    /Whether this brick may carry one is a fact stated in the request/i.test(flat) &&
      /You never decide to test/i.test(flat));
  ok("a week theme is not permission",
    /you never infer permission from a week theme/i.test(flat),
    "the exact route the failure took is not closed");
  ok("the cadence is written down",
    /once every SIX bricks and never before the third/i.test(flat) &&
      /a declared competitor once every four/i.test(flat));
  /* The first version said NO EXCEPTIONS, which also bound the OWNER — and he is the reason the
     cadence is safe: "אל תשכח שיש לו מאמן אנושי, בגלל זה הוא שם כדי לראות אם מתאים לו מבחן 1RM
     אחרי 3 או 4 חודשים." That wording inverted POL-030's own ladder, where a manual decision by
     the owner sits above HARD policy, and would have fought a brick note under POL-024. */
  ok("the cadence binds the coach, not the human coach",
    /THAT CADENCE BINDS YOU, NOT THE HUMAN COACH/.test(I2) &&
      /whether a max suits them after three or four months is his judgement to make/i.test(flat));
  ok("an instruction from the human coach is honoured",
    /When he instructs a test, honour it and keep the session rules/i.test(flat) &&
      /what is forbidden is deciding it yourself/i.test(flat));
  ok("the owner's reason is kept, not just the number",
    /does not need a number at intervals they would even remember/i.test(flat));
  ok("heavy triples and percentage work are explicitly not tests",
    /Heavy triples, a 5RM, ascending sets and percentage work are not tests/i.test(flat));
  /* Both soft permissions rewritten — either one alone reads as licence. */
  ok("no soft permission to test a single survives",
    !/test a single only/i.test(I2) && !/more often than a max back squat/i.test(I2),
    "a line still reads as permission to test");
  ok("the back squat is named the last lift to spend a test on",
    /the back squat is the last lift to spend that on/i.test(flat));
}


/* The three studio rules from 2026-09-04. Each one fixes something that was in the first brick for
   "סטודיו בראשית", not something imagined. */
function testStudioFormatRules() {
  const R = require("../lib/coach-layers/layer2-room-studio.js");
  const flat = R.replace(/\s+/g, " ");
  /* Two stations sessions in week 1 came back with the same skeleton and different numbers. */
  ok("the format is named as the variety in a room",
    /--- IN A ROOM, THE FORMAT \*IS\* THE VARIETY \(HARD\) ---/.test(R) &&
      /the FORMAT is what makes one session different from another, not the movement list/i.test(
        flat
      ));
  /* A calendar window did not survive contact. The owner: "זה גם לא פותר את הבעיה אם יהיה סטודיו
     שרוצה רק 3 אימונים או אחד של 5, סתם לקחנו 4 כדוגמה." A rotation scales to any session count
     on its own — with M structures and N slots a week the cycle takes M/N weeks. */
  ok("it is a rotation, not a calendar window",
    /HOW IT WORKS: A ROTATION, NOT A CALENDAR WINDOW/.test(R) &&
      /does not repeat one until that rotation has been exhausted/i.test(flat));
  ok("the rotation scales to three sessions a week or five",
    /a room buying three sessions a week, or five, consumes the rotation at its own rate/i.test(
      flat
    ) && /the cycle simply takes M\/N weeks/.test(flat));
  ok("the rotation is never stretched to fit a calendar",
    /Never stretch or compress the rotation to land on a calendar/.test(flat));
  /* The fix for the inventory problem, and it was free: the slots do not share one list. Week 1
     using AMRAP in a regular session had been spending it for the stations slot too. */
  ok("each session type has its own rotation",
    /THE ROTATIONS ARE SEPARATE PER SESSION TYPE/.test(R) &&
      /an AMRAP couplet in session 1 does not spend AMRAP for the stations slot/i.test(flat));
  /* The owner's own point, placed on the right axis: an EMOM every 90s instead of every 60s is
     not variety. It is the progression of a structure the room already knows. */
  ok("structure is the variety and the dials are the progression",
    /STRUCTURE IS THE VARIETY\. THE DIALS ARE THE PROGRESSION/.test(R));
  ok("moving a dial is not a new structure, with the arithmetic",
    /Moving a dial is NOT a new structure: 4 rounds of 40s\/20s and 3 rounds of 90s\/30s are one structure twice/i.test(
      flat
    ));
  ok("EMOM and E2MOM are named as one family",
    /a fixed window that rotates the stations \(EMOM, E2MOM — one family\)/.test(flat));
  ok("the dials move when a structure comes round again",
    /When a structure comes round again in the rotation, THAT is when the dials move/.test(flat));
  /* And stations are what the room BOUGHT, not a format to rotate away from. */
  ok("stations are not treated as a format",
    /STATIONS ARE NOT A FORMAT/.test(flat) &&
      /They are what this place bought, and they appear as often as the intake says/i.test(flat));
  ok("what rotates is the structure inside the stations",
    /What rotates is the structure INSIDE them/.test(flat));

  ok("the prior weeks are named as where the used formats are listed",
    /they name the formats already used\. Read them, and take the next structure in the rotation/i.test(
      flat
    ));
  ok("the format is called the room's progression axis too",
    /It is also the room's progression axis, so it is doing two jobs at once/i.test(flat));

  /* "אימון בן 3 חלקים - קשה למאמן וגם למתאמן הלא מרוכז." */
  ok("two working parts is the studio shape",
    /--- TWO PARTS IS THE SHAPE \(HARD\) ---/.test(R) &&
      /A THREE-WORKING-PART SESSION APPEARS AT MOST ONCE IN TWO WEEKS/.test(flat));
  /* The coach wrote an explicit warm-up part into all four sessions, which pushed two of them to
     three parts. Owner: "מאשר חימום לא נספר, לעיתים אולי נתבקש אפילו לא ליצור אותו." The limit was
     about three WORKING blocks — three explanations and three equipment resets — and a warm-up is
     not one of those. */
  ok("a warm-up part does not count toward the limit",
    /A WARM-UP PART DOES NOT COUNT toward that/.test(flat) &&
      /Warm-up plus two working parts is the normal shape/.test(flat));
  ok("a place that runs its own warm-up gets none written",
    /IF THE INTAKE SAYS THE PLACE RUNS ITS OWN WARM-UP, do not write one at all/.test(flat) &&
      /let the floor coach do their job/i.test(flat));
  ok("the reason is the coach's floor, not a preference",
    /a session the coach manages instead of coaches/i.test(flat));

  /* A 200 m shuttle inside a 20 m indoor lane. */
  ok("a short lane is not a running track",
    /--- A SHORT INDOOR LANE IS NOT A RUNNING TRACK \(HARD\) ---/.test(R) &&
      /THE TURNS ARE THE COST, NOT THE METRES/.test(flat));
  ok("the lane is for carries, lunge walks and short sprints",
    /A 20 m lane is for CARRIES, LUNGE WALKS and SHORT SPRINTS of one or two lengths/.test(flat));
  ok("accumulating distance in the lane is refused with its arithmetic",
    /200 m as ten turns of a 20 m lane is twenty changes of direction/i.test(flat));
  ok("a room with no running distance still gets the stimulus",
    /take the same stimulus from carries, lunge walks, single-length sprints/i.test(flat));

  /* The owner settled what a "no barbells" boundary means, the same day: "עושים שם הכל פשוט לא עם
     מוט - קלינים, תראסטרים וכו'". The boundary is the IMPLEMENT. Stated because the
     no-technicality rule right above it could otherwise be read as a reason to drop the pattern
     too, which turns a house rule into a thinner programme. */
  ok("an implement boundary limits the implement and nothing else",
    /IT LIMITS THE IMPLEMENT AND NOTHING ELSE/.test(R) &&
      /does not remove the clean, the snatch, the thruster or the jerk from this place/i.test(flat));
  ok("every pattern is still trained with what the room owns",
    /Every pattern is still trained, with the dumbbells and kettlebells the room owns/.test(flat));
  ok("a banned implement is not a request for a timid programme",
    /a place that banned an implement did not ask for a timid programme/i.test(flat));

  /* None of it reaches an individual. */
  ok("an individual pays nothing for the studio format rules",
    L.buildLayerPack({ agent: "individual", profile: {} }).text.indexOf(
      "THE FORMAT *IS* THE VARIETY"
    ) < 0);
}


/* The warm-up checkbox, 2026-09-04. Studio-only was my call and the owner corrected it: his own
   test athlete trains in a full box mid-week, where the box runs the group warm-up, and at home at
   weekends where it has to be written. An experienced athlete with a routine of their own would
   otherwise lose eight of forty-five minutes to a block they skip. Lives in layer2-general so one
   rule serves both products. */
function testWarmUpIsAnIntakeAnswer() {
  const G5 = require("../lib/coach-layers/layer2-general.js");
  const flat = G5.replace(/\s+/g, " ");
  ok("writing the warm-up is an intake answer, not the coach's choice",
    /WHETHER YOU WRITE THE WARM-UP IS AN INTAKE ANSWER, not your choice/.test(flat));
  ok("when written it sits inside the session length and is not a working part",
    /it counts inside the stated session length and it is not one of the working parts/i.test(flat));
  ok("when declined the session opens with the first working part",
    /write none and open with the first working part/i.test(flat));
  /* The dangerous reading, closed explicitly: "no warm-up" is not "no preparation". */
  ok("declining the warm-up never removes the primer",
    /THAT NEVER REMOVES THE PRIMER/.test(G5) &&
      /belongs to the WORKING part, not to the warm-up, and it stays whatever the answer was/i.test(
        flat
      ));
  ok("the reason is stated, not just the rule",
    /Nobody goes from nothing to a heavy set/i.test(flat));
  /* The third case, and the one that matters until the field ships: an older packet has no such
     line, and silence must not be read as a refusal. */
  ok("no warm-up line at all means write one",
    /WITH NO SUCH LINE IN THE PACKET AT ALL, WRITE ONE/.test(flat) &&
      /do not read silence as a refusal/i.test(flat));
  /* Both products, since the field is on both intakes. */
  ["individual", "studio"].forEach(function (a) {
    ok(a + " reads the warm-up rule",
      L.buildLayerPack(
        a === "studio" ? { agent: "studio", studioIntake: {} } : { agent: "individual", profile: {} }
      ).text.indexOf("WHETHER YOU WRITE THE WARM-UP IS AN INTAKE ANSWER") >= 0);
  });
}


/* An individual's session shape, 2026-09-04. Same conclusion as the studio rule, different reason:
   the studio's is about a coach running a room, this one is about an hour not dividing into three
   useful pieces. */
function testTwoWorkingParts() {
  const I3 = require("../lib/coach-layers/layer2-individual.js");
  const flat = I3.replace(/\s+/g, " ");
  ok("two working parts is the session",
    /--- TWO WORKING PARTS IS THE SESSION \(HARD\) ---/.test(I3) &&
      /TWO working parts is the default/.test(flat));
  ok("the arithmetic is given, not just the rule",
    /Divide an hour three ways and each piece gets about eighteen minutes before transitions/i.test(
      flat
    ));
  ok("half-doing three things is named as the failure",
    /half-done three things instead of finishing two/i.test(flat));
  ok("a third part is a short accessory and nothing else",
    /A THIRD PART IS A SHORT ACCESSORY AND NOTHING ELSE/.test(flat) &&
      /It is not a second conditioning piece and not a second skill block/i.test(flat));
  ok("three training stimuli in one session are refused outright",
    /NEVER THREE TRAINING STIMULI IN ONE SESSION/.test(flat) &&
      /whatever the minutes add up to/i.test(flat));
  ok("the accessory is capped at twice a week",
    /The accessory appears at most TWICE A WEEK/.test(flat) &&
      /Every session carrying one is the failure this rule exists to stop/i.test(flat));
  /* Studio keeps its own rule, for its own reason. */
  ok("the studio version is separate and still there",
    /--- TWO PARTS IS THE SHAPE \(HARD\) ---/.test(
      require("../lib/coach-layers/layer2-room-studio.js")
    ));
  ok("a studio does not read the individual version",
    L.buildLayerPack({ agent: "studio", studioIntake: {} }).text.indexOf(
      "TWO WORKING PARTS IS THE SESSION"
    ) < 0);
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
  testCraftFoundation();
  testBriefCoverage();
  testWritingRules();
  testWeekContinuity();
  testOneRmGate();
  testStudioFormatRules();
  testWarmUpIsAnIntakeAnswer();
  testTwoWorkingParts();
  testContinuation();
  testGymnastics();
  testHebrewBoundary();
  testWeightlifting();
  testEndurance();
  testPartner();
  testCompetitorReview();
  testPackBudget();
  console.log("\nPassed:", passed);
  if (process.exitCode) {
    console.error("\nLAYER CHECKS FAILED");
    process.exit(1);
  }
  console.log("\nLAYER CHECKS PASSED");
}

main();
