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
  "layer1-injuries": 4200,
  /* Raised from 6500 on 2026-09-02: the skill-fresh / capacity-tired distinction moved in here
     from the competitor layer, where it had been reaching only declared competitors. It is a
     training rule, not a competition rule. Net across the two files is roughly flat. */
  "layer2-general": 7000,
  "layer2-individual": 4000,
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
  ok("every layer module exports a string (" + names.length + " modules)",
    names.every(function (n) {
      return typeof prompts[n] === "string" && prompts[n].length > 400;
    }),
    names.filter(function (n) { return typeof prompts[n] !== "string"; }).join(", "));

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
  ok("the time-domain sanity check is present, with the AMRAP example",
    /12-minute\s*AMRAP gives two slow rounds/.test(flat));

  /* The injury matrix moved to layer1-injuries on 2026-09-02 so a healthy athlete stops paying
     ~700 tokens a brick for it. Assert both halves of the move. */
  ok("the injury matrix is no longer in the always-on table",
    !/SUBSTITUTION MATRIX/i.test(EQUIVALENCE));
  ok("the injury matrix is in the conditional injury layer",
    /SUBSTITUTION MATRIX BY RESTRICTED AREA/i.test(
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
  ok("a studio is programmed seven days by default", /program SEVEN days a week unless the intake/i.test(flat));
  ok("the 3-on/1-off cycle is no longer the default shape",
    !/A repeating block of THREE TRAINING DAYS then rest/.test(G) &&
      /Do NOT build a 3-on\/1-off cycle/.test(flat));
  ok("inventing a rest day is forbidden for a studio", /do NOT insert a\s*rest day the intake did not ask for/i.test(flat));
  ok("an individual still gets rest days from the intake", /AN INDIVIDUAL: training days and rest days come from the intake/i.test(flat));
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
    /individual's own training days from the intake ARE the weekly structure/i.test(Cflat));
  ok("3 consecutive days holds even when all seven were marked",
    /NO MORE THAN 3 CONSECUTIVE TRAINING DAYS\. This holds in every case, including when the athlete marked all seven days/i.test(
      Cflat
    ));
  ok("the fourth day is a lighter day, not a dropped one",
    /make it active recovery if they asked to train that day, or a rest day if the intake left it free/i.test(
      Cflat
    ));

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

  const off = L.buildLayerPack({ agent: "individual", profile: { goals: "get fitter" } });
  ok("the pack really omits the injury layer when nothing was reported",
    off.layers.indexOf("layer1-injuries") < 0, off.layers.join(", "));

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

  /* The descriptions are instructions. These four are the owner's own examples. */
  ok("a described session is a HARD instruction, every week",
    /Treat every such description as a HARD instruction for that session, EVERY week/.test(S));
  ok("'one part only' is honoured literally",
    /'One part only' means ONE part/.test(S) &&
      /Do not add a warm-up part, an accessory part or a second\s*piece/i.test(flat));
  ok("a named time cap is a ceiling for the room",
    /the piece must finish inside 10 minutes for the room, not for the fittest person in it/.test(
      flat
    ));
  ok("a description outranks a default in any other layer",
    /If a description conflicts with a default in any other layer, THE DESCRIPTION WINS/.test(S));
  ok("undescribed sessions are treated as interchangeable",
    /If the sessions are NOT described, treat them as interchangeable/.test(flat));

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
  ok("the heaviest pack stays under 34k characters",
    heavy.chars < 34000, heavy.chars + " chars, layers: " + heavy.layers.join(", "));
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
  testPackBudget();
  console.log("\nPassed:", passed);
  if (process.exitCode) {
    console.error("\nLAYER CHECKS FAILED");
    process.exit(1);
  }
  console.log("\nLAYER CHECKS PASSED");
}

main();
