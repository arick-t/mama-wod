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
  "layer1-methodology": 5500,
  "layer1-injuries": 3500,
  "layer2-general": 6500,
  "layer2-individual": 5000,
  "layer3-gymnastics": 4000,
  "layer3-weightlifting": 3500,
  "layer3-endurance": 3500,
  "layer3-competitors": 3500,
  "layer3-partner": 2500,
  "equivalence-table": 8000,
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

  /* Machine equivalence DOES have a source now (the aerobic conversion sheet the owner added on
     2026-09-01), so the table must carry the real rows rather than a hand-wave. */
  ok("machine equivalence carries real sourced rows",
    /800 \| *1000 \/ 800/.test(EQUIVALENCE) && /AIR\/ASSAULT BIKE cal/.test(EQUIVALENCE));
  ok("the coach is told to prefer meters over calories",
    /Prefer METERS over CALORIES/i.test(flat));

  /* Sourced scaling order from the Level 1 guide, including the one thing that causes rhabdo. */
  ok("scaling order is load -> volume -> movement", /1\) LOAD *2\) VOLUME/i.test(flat));
  ok("progressive scaling is forbidden", /FORBIDDEN: progressive scaling/i.test(flat));
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
  testNumbersHaveProvenance();
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
