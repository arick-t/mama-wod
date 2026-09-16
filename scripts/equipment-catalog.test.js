/**
 * The equipment catalogue - the list, and the two promises around it.
 * Run: node scripts/equipment-catalog.test.js
 *
 * PROMISE 1 - the browse filter does not move. The list was extracted from index.html on
 * 2026-09-14 to be shared with the intake and the post-check. LEGACY below is that map as it
 * stood, captured mechanically from the file, and scoreWod walks KEYWORDS in order: a changed
 * key, a changed order or a changed keyword changes every match score an athlete sees. Nothing
 * may be added to it - rows added for the questionnaire carry scoring:false.
 *
 * PROMISE 2 - the checker blocks what is certain and nothing else. Every case below is a real
 * line: what the coach wrote for עודד מכינה against equipment that does not exist there, what
 * he owns and must never be blocked on, and the movements that need nothing and can never be
 * blocked at all.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const C = require("../lib/equipment-catalog.js");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok -", name);
}

/* Captured from index.html at extraction time. Do not hand-edit: if a keyword genuinely must
   change, change it in lib/equipment-catalog.js and update this table in the same commit, so
   the diff shows an athlete-visible change being made on purpose. */
const LEGACY = {
  "RUN": [
    "run",
    "running",
    "meter",
    "mile",
    "km",
    "400m",
    "800m",
    "200m",
    "400 m"
  ],
  "BARBELL": [
    "barbell",
    "overhead squat",
    "ohs",
    "deadlift",
    "sumo deadlift",
    "romanian deadlift",
    "rdl",
    "clean",
    "squat clean",
    "power clean",
    "snatch",
    "squat snatch",
    "power snatch",
    "clean & jerk",
    "clean and jerk",
    "push press",
    "split jerk",
    "push jerk",
    "shoulder to overhead",
    "s2oh",
    "strict press",
    "overhead press",
    "floor press",
    "bent over row",
    "barbell thruster",
    "barbell lunge",
    "front rack",
    "back rack",
    "good morning",
    "hang clean",
    "hang snatch",
    "muscle snatch",
    "muscle clean"
  ],
  "RIG RACK": [
    "back squat",
    "front squat",
    "overhead press",
    "strict press",
    "push press",
    "push jerk",
    "split jerk",
    "bench press",
    "rig",
    "rack",
    "squat rack"
  ],
  "PULLUP BAR": [
    "strict pull-up",
    "strict pull up",
    "pull-up",
    "pullup",
    "pull up",
    "kipping pull-up",
    "butterfly pull-up",
    "chest-to-bar",
    "chest to bar",
    "c2b",
    "chin-up",
    "chin up",
    "weighted pull-up",
    "mixed grip pull-up",
    "bar hang",
    "toes to bar",
    "toes-to-bar",
    "ttb",
    "t2b",
    "knees to elbows",
    "k2e",
    "l-sit hang",
    "around the world",
    "windshield wiper",
    "strict leg raise",
    "bar muscle-up",
    "bmu",
    "strict bar muscle-up",
    "one-arm pull-up",
    "pullover",
    "archer pull-up",
    "typewriter pull-up",
    "dead hang",
    "scapular pull-up",
    "negative pull-up",
    "commando pull-up",
    "burpee pull up",
    "burpee pull-up"
  ],
  "ROW": [
    "row",
    "rowing",
    "rower",
    "cal row",
    "erg",
    "concept2"
  ],
  "BIKE": [
    "bike",
    "assault bike",
    "echo bike",
    "bikeerg",
    "bike erg",
    "cal bike",
    "concept2 bike"
  ],
  "DUMBBELL": [
    "dumbbell",
    "dumbbells",
    " db ",
    "db.",
    "2x dumbbell",
    "2x db",
    "double dumbbell",
    "dumbbell snatch",
    "dumbbell clean",
    "dumbbell clean & jerk",
    "dumbbell thruster",
    "dumbbell jerk",
    "devil press",
    "man-maker",
    "renegade row",
    "dumbbell bench press",
    "dumbbell floor press",
    "goblet lunge",
    "dumbbell overhead squat",
    "goblet squat",
    "dumbbell box step-up",
    "farmer walk",
    "dumbbell strict press",
    "dumbbell push press",
    "dumbbell deadlift",
    "dumbbell shoulder to overhead",
    "dumbbell burpee",
    "overhead lunge"
  ],
  "KETTLEBELL": [
    "kettlebell",
    "kettlebells",
    " kb ",
    "ktb",
    "2x kettlebell",
    "2x kb",
    "double kettlebell",
    "russian swing",
    "american swing",
    "kettlebell swing",
    "goblet squat",
    "kettlebell snatch",
    "kettlebell clean",
    "kettlebell clean & jerk",
    "turkish get-up",
    "tgu",
    "kettlebell jerk",
    "kettlebell thruster",
    "sdhp",
    "sumo deadlift high pull",
    "suitcase carry",
    "farmer carry",
    "kettlebell lunge",
    "kettlebell front squat",
    "kettlebell deadlift",
    "kettlebell shoulder to overhead",
    "kettlebell push press",
    "kettlebell press"
  ],
  "ROPE CLIMB": [
    "rope climb",
    "rope climbs"
  ],
  "SKIPPING ROPE": [
    "double under",
    "double unders",
    " du ",
    "triple under",
    "triple unders",
    "rope crossover",
    "rope crossovers",
    "skip",
    "jump rope"
  ],
  "WALL BALL": [
    "wall ball",
    "wallball",
    " wb ",
    "w.b",
    "wall ball shot",
    "wall ball clean",
    "wall ball thruster",
    "wall ball sit-up",
    "wall ball lunge",
    "wall ball chest pass",
    "wall ball lateral toss",
    "wall ball slam",
    "over-the-shoulder toss",
    "weighted wall ball"
  ],
  "WALL DRILLS": [
    "handstand push-up",
    "handstand push up",
    "hspu",
    "kipping hspu",
    "deficit handstand",
    "wall climb",
    "wall walk",
    "wallwalk",
    "strict handstand push-up",
    "wall facing handstand"
  ],
  "RINGS": [
    "ring row",
    "ring rows",
    "ring push-up",
    "ring push up",
    "ring support",
    "ring pull-up",
    "ring pull up",
    "ring dip",
    "ring dips",
    "l-sit on rings",
    "ring toes to bar",
    "ring rollout",
    "skin the cat",
    "ring muscle-up",
    "ring muscle up",
    "strict ring muscle-up",
    "ring chest-to-bar",
    "forward roll",
    "backward roll"
  ],
  "SKI": [
    "ski",
    "ski erg",
    "skierg",
    "ski erg"
  ],
  "SLED": [
    "sled push",
    "sled pull",
    "sled drag",
    "hand-over-hand",
    "sled sprint",
    "lateral sled",
    "sled row",
    "sled chest press",
    "sled bear crawl"
  ],
  "BOX": [
    "box jump",
    "box jumps",
    "box jump-over",
    "box step-up",
    "box step up",
    "box step-over",
    "weighted box step-up",
    "burpee box jump",
    "burpee box jump-over",
    "box dip",
    "box pike push-up",
    "seated box jump",
    "bjo"
  ],
  "D-BALL": [
    "d-ball",
    "dball",
    "slam ball",
    "atlas stone",
    "sandbag",
    " d-ball slam",
    "d-ball over",
    "d-ball clean",
    "bear hug squat",
    "bear hug carry",
    "d-ball front rack",
    "d-ball chest pass",
    "ground to overhead",
    "atlas stone clean",
    "atlas stone to shoulder",
    "atlas stone over bar",
    "platform load",
    "atlas stone extension"
  ]
};

const legacyIds = Object.keys(LEGACY);

ok("every legacy category is still here, in the original order", JSON.stringify(Object.keys(C.KEYWORDS)) === JSON.stringify(legacyIds));
ok("the scoring map is exactly the legacy map", JSON.stringify(C.KEYWORDS) === JSON.stringify(LEGACY));
ok("seventeen scoring categories", legacyIds.length === 17);
ok(
  "two hundred and fifty-eight movement names",
  legacyIds.reduce(function (n, k) {
    return n + C.KEYWORDS[k].length;
  }, 0) === 258
);

/* The rows added on 2026-09-14 from a real studio inventory. They must never reach scoring. */
["BENCH", "TRAP BAR", "DIP BARS", "BANDS"].forEach(function (id) {
  const it = C.byId(id);
  ok(id + " is in the catalogue", !!it);
  ok(id + " is not in the scoring map", !C.KEYWORDS[id] && it.scoring === false);
});

ok("twenty-one rows in all", C.ITEMS.length === 21);
ok(
  "every row is complete",
  C.ITEMS.every(function (it) {
    return it.id && it.he && it.group && it.keywords.length && it.blocking.length;
  })
);
ok(
  "every group is one of the five",
  C.ITEMS.every(function (it) {
    return ["always", "station", "loaded", "tick", "environment"].indexOf(it.group) >= 0;
  })
);

/* The owner's decision of 2026-09-14: a blank count means "not stated" on these five, and
   "no constraint" everywhere else. */
ok(
  "the five scarce machines, and only those",
  JSON.stringify(
    C.ITEMS.filter(function (it) {
      return it.scarce;
    }).map(function (it) {
      return it.id;
    })
  ) === JSON.stringify(["RIG RACK", "PULLUP BAR", "ROW", "BIKE", "SKI"])
);
ok(
  "a ceiling is asked for where the number is a limit, not a count",
  JSON.stringify(
    C.ITEMS.filter(function (it) {
      return it.ceiling;
    }).map(function (it) {
      return it.id + ":" + it.ceiling;
    })
  ) === JSON.stringify(["DUMBBELL:kg", "KETTLEBELL:kg", "WALL BALL:kg", "BOX:cm", "D-BALL:kg"])
);
ok("the run is asked for its length", C.byId("RUN").metric === "distance");
ok("the wall is present unless denied", C.byId("WALL DRILLS").group === "always");

/* --- what the coach actually wrote for a room that owns none of it --- */
function needs(line) {
  return JSON.stringify(C.requiredFor(line));
}
ok("a ring row needs rings - and NOT a rowing machine", needs("Ring Rows x10") === '[["RINGS"]]');
ok("single-unders need a rope", needs("20 Single-Unders") === '[["SKIPPING ROPE"]]');
ok("a 50cm box jump needs a box", needs("Box Jump 50 cm") === '[["BOX"]]');
ok("a 200m row needs the rower, not the running track", needs("200m Row") === '[["ROW"]]');
ok("a bike erg needs the bike", needs("Bike Erg 15 cal") === '[["BIKE"]]');

/* --- what he owns. A false block is worse than the bug it fixes. --- */
ok("a trap bar deadlift does not demand an olympic bar", needs("5 Trap Bar Deadlifts") === '[["TRAP BAR"]]');
ok("a bar dip does not demand rings", needs("Bar Dips 3x8") === '[["DIP BARS"]]');
ok("a rope climb needs the rope", needs("Rope Climb x2") === '[["ROPE CLIMB"]]');
ok("a run needs the track", needs("400m Run") === '[["RUN"]]');

/* --- either one will do --- */
ok("a goblet squat takes a dumbbell OR a kettlebell", needs("Goblet Squat 20kg") === '[["DUMBBELL","KETTLEBELL"]]');
ok("a farmer carry takes either too", needs("Farmer Carry 40m") === '[["DUMBBELL","KETTLEBELL"]]');
ok("a bent over row is barbell work, not a rower", needs("Bent Over Row 5x5") === '[["BARBELL"]]');

/* --- the floor is always open. This is the guard the owner asked for by name. --- */
const FREE = [
  "15 Burpees",
  "Walking Lunge 20m",
  "Air Squats x30",
  "Handstand Hold 30s",
  "Mountain Climbers",
  "Hollow Rock x20",
  "Side Plank 45s",
  "Pistols x10",
];
FREE.forEach(function (line) {
  ok('"' + line + '" needs nothing', C.requiredFor(line).length === 0);
  ok('"' + line + '" is recognised as free', C.hasBodyOnly(line));
});
/* Forty, since shuttle work joined the pool on 2026-09-15: a shuttle needs floor, and a
   week built on them is not a week without bodyweight work. */
ok("forty movements need nothing at all", C.BODY_ONLY.length === 40);

/* --- the app reads the shared list and keeps no copy of its own --- */
ok("the app loads the catalogue", index.indexOf('<script src="lib/equipment-catalog.js"></script>') >= 0);
ok("the app no longer carries its own copy", !/var EQ = \{[\s\S]*?"BARBELL"/.test(index));
ok("the app reads KEYWORDS from the catalogue", /var EQ = \(typeof EquipmentCatalog[\s\S]*?KEYWORDS\)/.test(index));
ok("the app reads the free movements from the catalogue", /var EQ_BODY_ONLY = \(typeof EquipmentCatalog[\s\S]*?BODY_ONLY\)/.test(index));
ok("the catalogue tag comes before the script that uses it", index.indexOf('lib/equipment-catalog.js') < index.indexOf("function scoreWod"));

console.log("\nequipment catalogue: all good");

/* --- a shuttle run is floor work, and the coach has to be told so ---------
 * A room with no running route must still be given shuttles: ten metres out and back
 * needs nothing (owner, 2026-09-15).
 * ------------------------------------------------------------------------- */
ok("a shuttle run requires nothing", JSON.stringify(C.requiredFor("6 x 10m shuttle run")) === "[]");
ok("nor do shuttle sprints", JSON.stringify(C.requiredFor("Shuttle sprints 15m")) === "[]");
ok("A REAL RUN STILL NEEDS A ROUTE", JSON.stringify(C.requiredFor("Run 800m")) === '[["RUN"]]');
ok("and one line holding both keeps the route requirement",
  JSON.stringify(C.requiredFor("Run 800m then 10 shuttle runs")) === '[["RUN"]]');
ok("a shuttle counts as bodyweight work", C.hasBodyOnly("6 x 10m shuttle run") === true);
/* An out-and-back is deliberately NOT suppressed: a kilometre out and back is a road run,
   and suppressing it would hide a real violation. */
ok("an out-and-back is still a run", JSON.stringify(C.requiredFor("1km out and back run")) === '[["RUN"]]');
/* And the inventory says it in as many words, or the coach never writes one. */
const invNoRoute = C.inventoryText({ RUN: { have: false }, DUMBBELL: { have: true, cap: 20 } }, { room: true });
ok("THE INVENTORY TELLS THE COACH SHUTTLES ARE ALWAYS OPEN", /SHUTTLE RUNS ARE FLOOR WORK, NOT RUNNING/.test(invNoRoute));
ok("and that the line about a route is about a route", /forbids a route, never a shuttle/.test(invNoRoute));
