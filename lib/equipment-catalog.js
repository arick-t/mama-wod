/**
 * The equipment catalogue - one list, read by everyone.
 *
 * WHY THIS FILE EXISTS. The list lived inside index.html as `EQ`, serving the browse filter
 * alone, while the intake asked for equipment as ONE FREE-TEXT FIELD. On 2026-09-09 the first
 * real studio brick (עודד מכינה) came back prescribing ring rows, single-unders, 50cm box jumps
 * and a rower - none of which exist in that room - and 22.5 kg dumbbells in a room whose ceiling
 * is 15 kg. The doctrine was never missing: POL-027 says "never invent missing machines/rigs/
 * ropes/rings" and it WAS sent. It simply had no teeth, because the coach received a paragraph
 * and a paragraph cannot be checked.
 *
 * So the same list now feeds three consumers: the questionnaire (what the room HAS), the prompt
 * (an inventory instead of a sentence) and the checker (a movement whose implement was never
 * ticked is a violation, not a suggestion).
 *
 * ONE-DIRECTIONAL, ALWAYS. The catalogue says what a movement REQUIRES. It never says what the
 * coach may write. Equipment is additive (POL-027), and nothing here can block a BODY_ONLY
 * movement - an empty inventory still leaves a full session's worth of work. Owner, 2026-09-14:
 * "אסור בטעות שנשכח או נשמיט את הדברים שלא צריך ציוד בשבילם".
 *
 * TWO MATCHERS, ONE LIST. Ranking a scraped workout and blocking a prescription are not the
 * same job, and the inherited keywords were built for the first. KEYWORDS is that list, byte
 * for byte, and scoreWod still gets exactly what it always got. Blocking uses the stricter
 * set: the loose tokens removed, the missing movements added, and two rules below.
 *
 * 0 LLM. No I/O. Pure data and five pure functions.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.EquipmentCatalog = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* GROUPS - what the questionnaire does with the row. Decided by the owner, 2026-09-14:
   *   always       floor / wall / bodyweight. Present unless explicitly denied.
   *   station      a place a person stands. In a ROOM the count decides whether it can be
   *                written for the whole class; for one athlete it is a plain yes/no.
   *   loaded       the question is not how many but UP TO WHAT - a ceiling, in kg or cm.
   *   tick         have it for the class or do not.
   *   environment  not equipment but a property of the place. RUN needs its length, always,
   *                for a room and for one athlete alike.
   *
   * SCARCE - the five machines no room owns one of per athlete. A blank count on these means
   * "not stated", NOT "unlimited": the coach programs them as a rotation station and never
   * class-wide. Every other row treats blank as no constraint, which is what the owner asked
   * for. The precedent is already in lib/client-intake.js for class capacity - three answers,
   * not two: a number, no ceiling, and "not stated - do NOT assume one station per person".
   */
  var ITEMS = [
    {
      id: "RUN",
      en: "Running route",
      he: "מסלול ריצה",
      group: "environment",
      metric: "distance",
      scoring: true,
      keywords: ["run", "running", "meter", "mile", "km", "400m", "800m", "200m", "400 m"],
      blocking: ["run", "running"],
    },
    {
      id: "BARBELL",
      en: "Olympic barbell",
      he: "מוט אולימפי",
      group: "station",
      scoring: true,
      keywords: ["barbell", "overhead squat", "ohs", "deadlift", "sumo deadlift", "romanian deadlift", "rdl", "clean", "squat clean", "power clean", "snatch", "squat snatch", "power snatch", "clean & jerk", "clean and jerk", "push press", "split jerk", "push jerk", "shoulder to overhead", "s2oh", "strict press", "overhead press", "floor press", "bent over row", "barbell thruster", "barbell lunge", "front rack", "back rack", "good morning", "hang clean", "hang snatch", "muscle snatch", "muscle clean"],
      blocking: ["barbell", "overhead squat", "ohs", "deadlift", "sumo deadlift", "romanian deadlift", "rdl", "clean", "squat clean", "power clean", "snatch", "squat snatch", "power snatch", "clean & jerk", "clean and jerk", "push press", "split jerk", "push jerk", "shoulder to overhead", "s2oh", "strict press", "overhead press", "floor press", "bent over row", "barbell thruster", "barbell lunge", "front rack", "back rack", "good morning", "hang clean", "hang snatch", "muscle snatch", "muscle clean", "barbell row", "pendlay row"],
    },
    {
      id: "RIG RACK",
      en: "Rig / squat rack",
      he: "ראק / מתקן",
      group: "station",
      scarce: true,
      scoring: true,
      keywords: ["back squat", "front squat", "overhead press", "strict press", "push press", "push jerk", "split jerk", "bench press", "rig", "rack", "squat rack"],
      blocking: ["back squat", "front squat", "overhead press", "strict press", "push press", "push jerk", "split jerk", "bench press", "rig", "rack", "squat rack"],
    },
    {
      id: "PULLUP BAR",
      en: "Pull-up station",
      he: "עמדת מתח",
      group: "station",
      scarce: true,
      scoring: true,
      keywords: ["strict pull-up", "strict pull up", "pull-up", "pullup", "pull up", "kipping pull-up", "butterfly pull-up", "chest-to-bar", "chest to bar", "c2b", "chin-up", "chin up", "weighted pull-up", "mixed grip pull-up", "bar hang", "toes to bar", "toes-to-bar", "ttb", "t2b", "knees to elbows", "k2e", "l-sit hang", "around the world", "windshield wiper", "strict leg raise", "bar muscle-up", "bmu", "strict bar muscle-up", "one-arm pull-up", "pullover", "archer pull-up", "typewriter pull-up", "dead hang", "scapular pull-up", "negative pull-up", "commando pull-up", "burpee pull up", "burpee pull-up"],
      blocking: ["strict pull-up", "strict pull up", "pull-up", "pullup", "pull up", "kipping pull-up", "butterfly pull-up", "chest-to-bar", "chest to bar", "c2b", "chin-up", "chin up", "weighted pull-up", "mixed grip pull-up", "bar hang", "toes to bar", "toes-to-bar", "ttb", "t2b", "knees to elbows", "k2e", "l-sit hang", "around the world", "windshield wiper", "strict leg raise", "bar muscle-up", "bmu", "strict bar muscle-up", "one-arm pull-up", "pullover", "archer pull-up", "typewriter pull-up", "dead hang", "scapular pull-up", "negative pull-up", "commando pull-up", "burpee pull up", "burpee pull-up"],
    },
    {
      id: "ROW",
      en: "Rowing machine",
      he: "מכונת חתירה",
      group: "station",
      scarce: true,
      scoring: true,
      keywords: ["row", "rowing", "rower", "cal row", "erg", "concept2"],
      blocking: ["row", "rowing", "rower", "cal row", "erg", "concept2"],
    },
    {
      id: "BIKE",
      en: "Bike",
      he: "אופניים",
      group: "station",
      scarce: true,
      scoring: true,
      keywords: ["bike", "assault bike", "echo bike", "bikeerg", "bike erg", "cal bike", "concept2 bike"],
      blocking: ["bike", "assault bike", "echo bike", "bikeerg", "bike erg", "cal bike", "concept2 bike"],
    },
    {
      id: "DUMBBELL",
      en: "Dumbbells",
      he: "דאמבלים",
      group: "loaded",
      ceiling: "kg",
      scoring: true,
      keywords: ["dumbbell", "dumbbells", " db ", "db.", "2x dumbbell", "2x db", "double dumbbell", "dumbbell snatch", "dumbbell clean", "dumbbell clean & jerk", "dumbbell thruster", "dumbbell jerk", "devil press", "man-maker", "renegade row", "dumbbell bench press", "dumbbell floor press", "goblet lunge", "dumbbell overhead squat", "goblet squat", "dumbbell box step-up", "farmer walk", "dumbbell strict press", "dumbbell push press", "dumbbell deadlift", "dumbbell shoulder to overhead", "dumbbell burpee", "overhead lunge"],
      /* The abbreviations are written without the padding spaces that " db " needs: a line that
         OPENS with "DB Snatch 22.5 kg" has no space before the db, so the item went unmatched and
         the 22.5 kg ceiling check never ran. Found 2026-09-14 running Oded's own brick. */
      blocking: ["dumbbell", "dumbbells", " db ", "db.", "2x dumbbell", "2x db", "double dumbbell", "dumbbell snatch", "dumbbell clean", "dumbbell clean & jerk", "dumbbell thruster", "dumbbell jerk", "devil press", "man-maker", "renegade row", "dumbbell bench press", "dumbbell floor press", "goblet lunge", "dumbbell overhead squat", "goblet squat", "dumbbell box step-up", "farmer walk", "dumbbell strict press", "dumbbell push press", "dumbbell deadlift", "dumbbell shoulder to overhead", "dumbbell burpee", "overhead lunge", "farmer carry", "db row", "dumbbell row", "db snatch", "db clean", "db thruster", "db press", "db lunge", "db deadlift", "db step-up"],
    },
    {
      id: "KETTLEBELL",
      en: "Kettlebells",
      he: "קטלבלים",
      group: "loaded",
      ceiling: "kg",
      scoring: true,
      keywords: ["kettlebell", "kettlebells", " kb ", "ktb", "2x kettlebell", "2x kb", "double kettlebell", "russian swing", "american swing", "kettlebell swing", "goblet squat", "kettlebell snatch", "kettlebell clean", "kettlebell clean & jerk", "turkish get-up", "tgu", "kettlebell jerk", "kettlebell thruster", "sdhp", "sumo deadlift high pull", "suitcase carry", "farmer carry", "kettlebell lunge", "kettlebell front squat", "kettlebell deadlift", "kettlebell shoulder to overhead", "kettlebell push press", "kettlebell press"],
      blocking: ["kettlebell", "kettlebells", " kb ", "ktb", "2x kettlebell", "2x kb", "double kettlebell", "russian swing", "american swing", "kettlebell swing", "goblet squat", "kettlebell snatch", "kettlebell clean", "kettlebell clean & jerk", "turkish get-up", "tgu", "kettlebell jerk", "kettlebell thruster", "sdhp", "sumo deadlift high pull", "suitcase carry", "farmer carry", "kettlebell lunge", "kettlebell front squat", "kettlebell deadlift", "kettlebell shoulder to overhead", "kettlebell push press", "kettlebell press", "farmer walk"],
    },
    {
      id: "ROPE CLIMB",
      en: "Climbing rope",
      he: "חבל טיפוס",
      group: "station",
      scoring: true,
      keywords: ["rope climb", "rope climbs"],
      blocking: ["rope climb", "rope climbs"],
    },
    {
      id: "SKIPPING ROPE",
      en: "Jump rope",
      he: "חבל קפיצה",
      group: "tick",
      scoring: true,
      keywords: ["double under", "double unders", " du ", "triple under", "triple unders", "rope crossover", "rope crossovers", "skip", "jump rope"],
      blocking: ["double under", "double unders", " du ", "triple under", "triple unders", "rope crossover", "rope crossovers", "jump rope", "single under", "single-under", "single unders"],
    },
    {
      id: "WALL BALL",
      en: "Wall balls",
      he: "וול בול",
      group: "loaded",
      ceiling: "kg",
      scoring: true,
      keywords: ["wall ball", "wallball", " wb ", "w.b", "wall ball shot", "wall ball clean", "wall ball thruster", "wall ball sit-up", "wall ball lunge", "wall ball chest pass", "wall ball lateral toss", "wall ball slam", "over-the-shoulder toss", "weighted wall ball"],
      blocking: ["wall ball", "wallball", " wb ", "w.b", "wall ball shot", "wall ball clean", "wall ball thruster", "wall ball sit-up", "wall ball lunge", "wall ball chest pass", "wall ball lateral toss", "wall ball slam", "over-the-shoulder toss", "weighted wall ball"],
    },
    {
      id: "WALL DRILLS",
      en: "A clear wall",
      he: "קיר פנוי",
      group: "always",
      scoring: true,
      keywords: ["handstand push-up", "handstand push up", "hspu", "kipping hspu", "deficit handstand", "wall climb", "wall walk", "wallwalk", "strict handstand push-up", "wall facing handstand"],
      blocking: ["handstand push-up", "handstand push up", "hspu", "kipping hspu", "deficit handstand", "wall climb", "wall walk", "wallwalk", "strict handstand push-up", "wall facing handstand"],
    },
    {
      id: "RINGS",
      en: "Gymnastic rings",
      he: "טבעות",
      group: "station",
      scoring: true,
      keywords: ["ring row", "ring rows", "ring push-up", "ring push up", "ring support", "ring pull-up", "ring pull up", "ring dip", "ring dips", "l-sit on rings", "ring toes to bar", "ring rollout", "skin the cat", "ring muscle-up", "ring muscle up", "strict ring muscle-up", "ring chest-to-bar", "forward roll", "backward roll"],
      blocking: ["ring row", "ring rows", "ring push-up", "ring push up", "ring support", "ring pull-up", "ring pull up", "ring dip", "ring dips", "l-sit on rings", "ring toes to bar", "ring rollout", "skin the cat", "ring muscle-up", "ring muscle up", "strict ring muscle-up", "ring chest-to-bar", "forward roll", "backward roll"],
    },
    {
      id: "SKI",
      en: "Ski erg",
      he: "סקי",
      group: "station",
      scarce: true,
      scoring: true,
      keywords: ["ski", "ski erg", "skierg", "ski erg"],
      blocking: ["ski", "ski erg", "skierg", "ski erg"],
    },
    {
      id: "SLED",
      en: "Sled",
      he: "סלד",
      group: "station",
      scoring: true,
      keywords: ["sled push", "sled pull", "sled drag", "hand-over-hand", "sled sprint", "lateral sled", "sled row", "sled chest press", "sled bear crawl"],
      blocking: ["sled push", "sled pull", "sled drag", "hand-over-hand", "sled sprint", "lateral sled", "sled row", "sled chest press", "sled bear crawl"],
    },
    {
      id: "BOX",
      en: "Plyo boxes",
      he: "קופסאות",
      group: "station",
      ceiling: "cm",
      scoring: true,
      keywords: ["box jump", "box jumps", "box jump-over", "box step-up", "box step up", "box step-over", "weighted box step-up", "burpee box jump", "burpee box jump-over", "box dip", "box pike push-up", "seated box jump", "bjo"],
      blocking: ["box jump", "box jumps", "box jump-over", "box step-up", "box step up", "box step-over", "weighted box step-up", "burpee box jump", "burpee box jump-over", "box dip", "box pike push-up", "seated box jump", "bjo"],
    },
    {
      id: "D-BALL",
      en: "D-ball / sandbag",
      he: "די-בול / שק חול",
      group: "loaded",
      ceiling: "kg",
      scoring: true,
      keywords: ["d-ball", "dball", "slam ball", "atlas stone", "sandbag", " d-ball slam", "d-ball over", "d-ball clean", "bear hug squat", "bear hug carry", "d-ball front rack", "d-ball chest pass", "ground to overhead", "atlas stone clean", "atlas stone to shoulder", "atlas stone over bar", "platform load", "atlas stone extension"],
      blocking: ["d-ball", "dball", "slam ball", "atlas stone", "sandbag", " d-ball slam", "d-ball over", "d-ball clean", "bear hug squat", "bear hug carry", "d-ball front rack", "d-ball chest pass", "ground to overhead", "atlas stone clean", "atlas stone to shoulder", "atlas stone over bar", "platform load", "atlas stone extension"],
    },
    {
      id: "BENCH",
      en: "Bench",
      he: "ספסל",
      group: "station",
      scoring: false,
      keywords: ["bench press", "incline press", "db bench", "dumbbell bench press", "flat bench"],
      blocking: ["bench press", "incline press", "db bench", "dumbbell bench press", "flat bench"],
    },
    {
      id: "TRAP BAR",
      en: "Trap bar",
      he: "טראפ בר",
      group: "station",
      scoring: false,
      keywords: ["trap bar", "hex bar", "trap bar deadlift", "hex bar deadlift"],
      blocking: ["trap bar", "hex bar", "trap bar deadlift", "hex bar deadlift"],
    },
    {
      id: "DIP BARS",
      en: "Dip bars / parallettes",
      he: "מקבילים",
      group: "station",
      scoring: false,
      keywords: ["bar dip", "parallel bar", "parallettes", "matador", "dip station"],
      blocking: ["bar dip", "parallel bar", "parallettes", "matador", "dip station"],
    },
    {
      id: "BANDS",
      en: "Resistance bands",
      he: "גומיות",
      group: "tick",
      scoring: false,
      keywords: ["banded", "band-assisted", "band assisted", "pull-apart", "band pull"],
      blocking: ["banded", "band-assisted", "band assisted", "pull-apart", "band pull"],
    },
  ];

  /* Movements that need nothing at all. A checker may never flag one of these, whatever the
   * inventory says, and a week built without a single one of them is itself a violation. */
  var BODY_ONLY = [
    "sit-up",
    "sit up",
    "sit-ups",
    "v-up",
    "v-ups",
    "burpee",
    "burpees",
    "push-up",
    "push up",
    "push-up",
    "handstand",
    "walking lunge",
    "reverse lunge",
    "forward lunge",
    "air squat",
    "air squats",
    "lunges",
    "jumping lunge",
    "hollow rock",
    "hollow hold",
    "plank",
    "side plank",
    "mountain climber",
    "jumping jack",
    "bear crawl",
    "broad jump",
    "superman",
    "arch hold",
    "weighted sit-up",
    "burpees over the bar",
    "pistol",
    "pistols",
    "one leg squat",
    "one-leg squat",
    "one leg squats",
    "single leg squat"
  ];

  /* The legacy map, key for key and in the original order. index.html's scoreWod walks it and
   * every browse-filter match score depends on the exact set, so nothing may be added to it:
   * rows added for the questionnaire carry scoring:false and stay out BY DESIGN. */
  function keywordMap() {
    var out = {};
    ITEMS.forEach(function (it) {
      if (it.scoring) out[it.id] = it.keywords;
    });
    return out;
  }

  function byId(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }

  function inGroup(group) {
    return ITEMS.filter(function (it) {
      return it.group === group;
    });
  }

  /**
   * What a line of programming REQUIRES, as a list of alternative-groups: [["RINGS"],
   * ["DUMBBELL","KETTLEBELL"]] means it needs rings AND either a dumbbell or a kettlebell.
   * A group is satisfied when the room has ANY member, so a goblet squat is not blocked in a
   * room with dumbbells and no kettlebells.
   *
   * Two rules, both learned from running Oded's own brick through this file:
   *
   * SPECIFICITY. When one matched phrase contains another, the longer one wins and the shorter
   * item is dropped. "Ring Rows" matched both RINGS ("ring row") and ROW ("row") and would have
   * demanded a rowing machine; "Trap Bar Deadlift" matched TRAP BAR and BARBELL. Without this
   * rule the checker blocks correct programming, which is worse than the bug it fixes.
   *
   * SHARED KEYWORD = ALTERNATIVES. When the SAME phrase matches two items they merge into one
   * group. That is how "goblet squat" ends up meaning "a dumbbell or a kettlebell" without a
   * table of exceptions to maintain.
   */
  function requiredFor(text) {
    var t = String(text || "").toLowerCase();
    var hits = [];
    ITEMS.forEach(function (it) {
      it.blocking.forEach(function (kw) {
        /* EVERY occurrence, with its position. Matching once per keyword lost a real violation:
           "10 Ring Rows, 20 Single-Unders, 200m Row" contains "row" twice — once inside "ring
           row", once as the rowing machine — and dropping the whole item because the FIRST
           occurrence was covered let a room with no rower be prescribed 200m of rowing. */
        var from = 0;
        var at;
        while ((at = t.indexOf(kw, from)) !== -1) {
          hits.push({ id: it.id, kw: kw, at: at, end: at + kw.length });
          from = at + 1;
        }
      });
    });

    /* Specificity, positionally: a hit is dropped only when a LONGER phrase covers that same
       stretch of text. "ring row" swallows the "row" inside it and nothing else. */
    var kept = hits.filter(function (h) {
      return !hits.some(function (other) {
        return (
          other.kw.length > h.kw.length && other.at <= h.at && other.end >= h.end
        );
      });
    });

    var byKeyword = {};
    var order = [];
    kept.forEach(function (h) {
      if (!byKeyword[h.kw]) {
        byKeyword[h.kw] = [];
        order.push(h.kw);
      }
      if (byKeyword[h.kw].indexOf(h.id) < 0) byKeyword[h.kw].push(h.id);
    });

    /* One group per distinct requirement: two phrases naming the same single item are one
       requirement, not two. */
    var groups = [];
    order.forEach(function (kw) {
      var ids = byKeyword[kw].slice().sort();
      var key = ids.join("|");
      if (
        !groups.some(function (g) {
          return g.slice().sort().join("|") === key;
        })
      ) {
        groups.push(byKeyword[kw]);
      }
    });
    return groups;
  }

  /**
   * The inventory, as the coach receives it. ONE renderer for both questionnaires: a room and
   * a person answer different forms, but what reaches the coach must read the same or the two
   * products drift into two dialects of the same fact.
   *
   * What it replaced: the owner's paragraph pasted after a single EQUIPMENT: label - eleven
   * unlabelled lines running into the next field, with the load ceiling buried mid-sentence.
   * The coach read prose and prescribed rings, a rower and 22.5 kg against a 15 kg ceiling.
   * POL-027 forbade every one of those and could not stop him: a rule is only obeyed against
   * a fact, and there was no fact.
   *
   * Returns "" when no row is ticked. A list of twenty-one falses is what an untouched form
   * posts, and it is indistinguishable from a room that owns nothing - so it means "not
   * answered", and the caller keeps whatever it said before.
   *
   * @param {object} list    { ID: {have, qty, cap} }
   * @param {object} [opts]  { room, maxAtOnce, extraText }
   */
  function inventoryText(list, opts) {
    var v = list && typeof list === "object" ? list : {};
    /* Ticking NOTHING is an answer — an athlete with a floor, a wall and no kit at all.
       The caller that knows a checklist was filled says so with opts.answered, and gets
       the inventory with every row marked NOT AVAILABLE. Without that flag an empty list
       is "never asked", and the caller falls back to its own older wording, which for an
       individual used to read "full gym loading available" (owner, 2026-09-15). */
    var answered =
      (opts && opts.answered === true) ||
      Object.keys(v).some(function (k) {
        return v[k] && v[k].have;
      });
    if (!answered) return "";

    var room = !!(opts && opts.room);
    var atOnce = parseInt(opts && opts.maxAtOnce, 10) || 0;
    var width = 0;
    ITEMS.forEach(function (it) {
      if (it.id.length > width) width = it.id.length;
    });

    var rows = [];
    ITEMS.forEach(function (it) {
      /* The floor and the wall are not inventory. POL-027 already says they are always there,
         and listing them invites the coach to treat them as optional. */
      if (it.group === "always") return;
      var r = v[it.id] && typeof v[it.id] === "object" ? v[it.id] : null;
      var pad = it.id + new Array(Math.max(1, width - it.id.length + 2)).join(" ");
      if (!r || !r.have) {
        rows.push("  " + pad + " NOT AVAILABLE");
        return;
      }
      var notes = [];
      if (it.metric === "distance") {
        notes.push(
          r.cap ? "route is " + r.cap + " m long - nothing longer exists" : "length not stated"
        );
      }
      if (it.ceiling === "kg" && r.cap) notes.push("MAX LOAD " + r.cap + " kg - never prescribe heavier");
      if (it.ceiling === "cm" && r.cap) notes.push("height " + r.cap + " cm");
      if (room) {
        if (r.qty && atOnce && r.qty < atOnce) {
          notes.push(r.qty + " for a class of " + atOnce + " - a rotation station, NEVER a class-wide piece");
        } else if (r.qty) {
          notes.push(r.qty + " available");
        } else if (it.scarce) {
          /* Owner, 2026-09-14, and the reason one spin bike became a class-wide Bike Erg:
             blank on a machine is "not stated", not "unlimited". */
          notes.push("count not stated - treat as ONE rotation station, do NOT assume one per athlete");
        }
      }
      rows.push("  " + pad + " available" + (notes.length ? " · " + notes.join(" · ") : ""));
    });

    var out = [
      "EQUIPMENT - CHECKED INVENTORY (HARD). This is the place, item by item. Anything marked",
      "NOT AVAILABLE does not exist: do not write it, do not scale to it, and do not substitute",
      "another machine for it. Bodyweight, floor and wall work are ALWAYS available and are",
      "never listed here (POL-027).",
    ].concat(rows);

    var extra = String((opts && opts.extraText) || "").trim();
    if (extra) {
      /* Additive only, and said out loud. Free text cannot be checked mechanically, so it may
         widen what is allowed and may never narrow it (owner, 2026-09-09). */
      out.push("ALSO REPORTED, in the owner's words - this ADDS to the list above and never");
      out.push("removes from it: " + extra);
    }
    return out.join("\n");
  }

  /** Does this text name a movement that needs nothing? Used to prove a week was not built
   *  entirely out of equipment - the owner's standing requirement. */
  function hasBodyOnly(text) {
    var t = String(text || "").toLowerCase();
    for (var i = 0; i < BODY_ONLY.length; i++) {
      if (t.indexOf(BODY_ONLY[i]) !== -1) return true;
    }
    return false;
  }

  return {
    ITEMS: ITEMS,
    BODY_ONLY: BODY_ONLY,
    KEYWORDS: keywordMap(),
    byId: byId,
    inGroup: inGroup,
    requiredFor: requiredFor,
    hasBodyOnly: hasBodyOnly,
    inventoryText: inventoryText,
  };
});
