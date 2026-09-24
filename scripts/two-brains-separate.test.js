/**
 * TWO BRAINS, AND A WALL BETWEEN THEM.
 *
 * From 2026-09-24 the product has two coaching brains: the functional one that has been in
 * production since 22.0, and a new one for commercial-gym resistance work. The owner's
 * instruction when the second was started: "אסור בתכלית האיסור שמשהו ממנוע הקרוספיט שבנינו
 * יפגע" — nothing of the CrossFit engine may be harmed.
 *
 * This file is that instruction, enforced. It asserts three things:
 *
 *   1. THE WALL. Neither pack contains a line of the other's doctrine, neither library knows the
 *      other's equipment, and the gym modules import nothing from lib/coach-layers/.
 *   2. THE FUNCTIONAL BRAIN HAS NOT MOVED. What it sends is pinned by its own shape — the layers
 *      it routes, the rules it names, the doctrine it states. If building the gym brain changed
 *      any of it, this fails.
 *   3. A CLIENT IS ONE OR THE OTHER. Never both.
 *
 * Run: node scripts/two-brains-separate.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const Gym = require("../lib/gym-layers");
const GymEx = require("../lib/gym-exercise-library.js");
const { buildLayerPack } = require("../lib/coach-layers");
const EquipCatalog = require("../lib/equipment-catalog.js");

const root = path.join(__dirname, "..");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ── 1 · THE WALL ──────────────────────────────────────────────────────────── */

const gymText = Gym.buildGymLayerPack({ methods: true }).text;
const funcText = buildLayerPack({
  agent: "personal",
  profile: { goals: {}, skills: {}, equipmentList: {} },
  programming: true,
}).text;

/* Words that belong to one world and would be a mistake in the other. */
const FUNCTIONAL_ONLY = ["AMRAP", "EMOM", "metcon", "kipping", "wall ball", "muscle-up", "WOD"];
/* Words that exist in ONE world only. "drop set" and "superset" are deliberately NOT here:
   they are general resistance-training terms and the functional weightlifting layer uses
   drop sets legitimately. A guard that flags a real word is a guard nobody keeps. */
const GYM_ONLY = ["Smith Machine", "Lat Pulldown", "Leg Press", "Pec Deck", "hypertroph"];

FUNCTIONAL_ONLY.forEach(function (w) {
  ok("the gym brain never says '" + w + "'", gymText.toLowerCase().indexOf(w.toLowerCase()) < 0);
});
GYM_ONLY.forEach(function (w) {
  ok("the functional brain never says '" + w + "'", funcText.toLowerCase().indexOf(w.toLowerCase()) < 0);
});

/* The modules themselves must not reach across. */
const gymFiles = fs.readdirSync(path.join(root, "lib/gym-layers")).filter((f) => f.endsWith(".js"));
ok("there are gym layer files to check", gymFiles.length >= 4);
gymFiles.forEach(function (f) {
  const src = fs.readFileSync(path.join(root, "lib/gym-layers", f), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  ok(f + " imports nothing from the functional brain", code.indexOf("coach-layers") < 0);
  ok(f + " imports nothing from the functional catalogue", code.indexOf("equipment-catalog") < 0);
});

/* Two equipment worlds that do not overlap. */
const gymGear = new Set();
GymEx.ALL.forEach(function (e) {
  e.gear.forEach(function (g) {
    gymGear.add(g.toLowerCase());
  });
});
const funcIds = EquipCatalog.ITEMS.map(function (i) {
  return String(i.id || "").toLowerCase();
});
ok("the gym library names equipment of its own", gymGear.size >= 15);
ok("and none of it is the functional catalogue's", funcIds.every((id) => !gymGear.has(id)));
ok("the functional catalogue still holds its own items", EquipCatalog.ITEMS.length >= 20);

/* ── 2 · THE FUNCTIONAL BRAIN HAS NOT MOVED ────────────────────────────────── */

const POLICY = require("../api/coach-policy.js");
const PROMPT = require("../api/hamamen-prompt.js");
const FOUNDATION = require("../api/coach-foundation-brief.js");

ok("the functional pack still routes its layers", funcText.length > 20000);
ok("it still carries its methodology", /LAYER 1/i.test(funcText));
ok("it still carries its construction layer", /LAYER 2/i.test(funcText));
ok("its deload doctrine is intact", /A DELOAD WEEK IS GIVEN TO YOU/i.test(funcText));
ok("and it still refuses to invent a fifth week", /never add a fifth|do NOT add a fifth/i.test(funcText + FOUNDATION));

ok("the functional brick is still four weeks", /Brick = FOUR weeks/i.test(FOUNDATION));
ok("POL-032 still governs it", /POL-032/.test(POLICY));
ok("the functional prompt is untouched by the gym", !/Smith|Lat Pulldown|hypertroph/i.test(PROMPT));
ok("and so is the policy", !/Smith Machine|Lat Pulldown/i.test(POLICY));

/* ── 3 · A CLIENT IS ONE OR THE OTHER ──────────────────────────────────────── */

ok("the gym pack is its own text", gymText.indexOf(funcText.slice(0, 200)) < 0);
ok("the functional pack is its own text", funcText.indexOf(gymText.slice(0, 200)) < 0);
ok("the gym states who it is NOT for", /bodybuilder/i.test(gymText) && /rehabilitation/i.test(gymText));
ok("and that the coach carries the responsibility", /human coach/i.test(gymText));

/* The one number that must differ, because it is the whole structural difference. */
ok("a gym block is six weeks", /A BLOCK IS SIX WEEKS/i.test(gymText));
ok("a functional brick is four", /FOUR weeks/i.test(FOUNDATION));

console.log("\nשני מוחות, קיר ביניהם — ומוח הקרוספיט לא זז.");
