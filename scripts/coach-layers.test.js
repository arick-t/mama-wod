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
  "layer2-general": 6500,
  "layer2-individual": 5000,
  "layer3-gymnastics": 4000,
  "layer3-weightlifting": 3500,
  "layer3-endurance": 3500,
  "layer3-competitors": 3500,
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
      /Do NOT build a 3-on\/1-off cycle/.test(G));
  ok("inventing a rest day is forbidden for a studio", /do NOT insert a\s*rest day the intake did not ask for/i.test(flat));
  ok("an individual still gets rest days from the intake", /AN INDIVIDUAL: training days and rest days come from the intake/i.test(flat));
  ok("a named day in the intake wins outright", /WHATEVER THE INTAKE NAMES, WINS/.test(G));

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
    /power training in the strict sense — force x distance \/ time/.test(G));

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
  ok("the heaviest pack stays under 32k characters",
    heavy.chars < 32000, heavy.chars + " chars, layers: " + heavy.layers.join(", "));
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
  testInjuryGate();
  testRouting();
  testPackBudget();
  console.log("\nPassed:", passed);
  if (process.exitCode) {
    console.error("\nLAYER CHECKS FAILED");
    process.exit(1);
  }
  console.log("\nLAYER CHECKS PASSED");
}

main();
