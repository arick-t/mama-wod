/**
 * THE GYM QUESTIONNAIRE — its own contract, and that is the whole point.
 *
 * WHY THIS IS NOT lib/coach-intake-sync-contract.js. The owner's instruction when the second
 * brain was started: "אסור בתכלית האיסור שמשהו ממנוע הקרוספיט שבנינו יפגע", and later, about
 * the questionnaire specifically: "אני שכח מזה שאנחנו משתמשים באותו תחקור או מדברים עם המוח
 * הזה 'קרוספיט' זה לא יקרה... וזה מסוכן אפילו שאתה חושב את זה כדי שלא בטעות תהיה זליגה".
 *
 * THE LINE IS DRAWN IN EXACTLY ONE PLACE. The LOOK is shared — the same card, the same classes,
 * the same tab strip, because a coach should not have to learn two products. The PLUMBING is
 * not: a gym client's answers never enter the functional profile, never become a
 * fixedIntakePacket, and never reach the functional brain. This file imports nothing from that
 * side and nothing from that side imports this.
 *
 * WHAT IT PRODUCES: a packet for the gym brain, in its language — the split, the volume, the
 * equipment the room actually holds, and the limits to work around.
 *
 * 0 LLM.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GymIntake = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ── The steps. Five, and each one earns its place. ────────────────────────── */
  var STEPS = [
    { id: "gym_profile", label: "Profile" },
    { id: "gym_equipment", label: "Equipment" },
    { id: "gym_schedule", label: "Schedule" },
    { id: "gym_injuries", label: "Limits" },
    { id: "gym_goals", label: "Goals" },
  ];

  /* ── The split tree. Sessions decide which splits open — nothing else does. ──
     Checked arithmetically against the owner's own two rules (twice a week per large group,
     72 hours between). Three shapes he originally listed were removed because they cannot
     satisfy them under ANY placement of days, and the five-day shape was found by search. */
  var SPLITS = {
    full_body: { label: "FULL BODY", sessions: [2, 3] },
    ab_full_body: { label: "A+B + FULL BODY", sessions: [3] },
    push_pull_legs: { label: "PUSH / PULL / LEGS", sessions: [3, 6] },
    ab_muscle_1: { label: "A+B by muscle size (pairing 1)", sessions: [4] },
    ab_muscle_2: { label: "A+B by muscle size (pairing 2)", sessions: [4] },
    upper_lower: { label: "A+B by body half (upper / lower)", sessions: [4] },
    ppl_upper_lower: { label: "PUSH/PULL/LEGS + UPPER/LOWER", sessions: [5] },
  };

  function splitsFor(sessions) {
    var n = parseInt(sessions, 10) || 0;
    if (n <= 2) return ["full_body"];
    if (n === 3) return ["full_body", "ab_full_body", "push_pull_legs"];
    if (n === 4) return ["ab_muscle_1", "ab_muscle_2", "upper_lower"];
    if (n === 5) return ["ppl_upper_lower"];
    return ["push_pull_legs"];
  }

  /* ── Equipment. Not a theoretical list: exactly what the exercise library builds with. ──
     Ticking "a fully equipped commercial gym" means every tier-1 row is present and nothing
     more is asked. The eleven rows below are for everywhere else. */
  var EQUIPMENT = [
    { id: "dumbbells", label: "Dumbbells", gear: ["Dumbbells"] },
    { id: "barbell", label: "Olympic barbell + plates", gear: ["Olympic Barbell"] },
    { id: "cables", label: "Cable station — dual pulley + attachments", gear: ["Dual Adjustable Pulley", "Cable Attachments"] },
    { id: "benches", label: "Benches — flat + adjustable", gear: ["Flat Bench", "Adjustable Bench"] },
    { id: "smith", label: "Smith machine", gear: ["Smith Machine"] },
    { id: "mats", label: "Exercise mats", gear: ["Exercise Mats"] },
    { id: "rack", label: "Squat rack / bench press station", gear: ["Squat Rack", "Flat Bench Press Station"] },
    { id: "pullup", label: "Pull-up bar + dip station", gear: ["Pull-up Bar", "Dip Station", "Assisted Dip / Chin-up Machine"] },
    { id: "leg_machines", label: "Leg machines — press, extension, curl, abductor", gear: ["Leg Press", "Leg Extension Machine", "Leg Curl Machine", "Abductor / Adductor Machine"] },
    { id: "upper_machines", label: "Back & chest machines — pulldown, row, press, pec deck", gear: ["Lat Pulldown Machine", "Seated Cable Row Machine", "Chest Press Machine", "Pec Deck / Butterfly"] },
    { id: "ez_bar", label: "EZ / curl bar", gear: ["EZ / Curl Bar"] },
  ];

  /** Tier 2 — asked for separately, and never the backbone of a programme. */
  var EXTRAS = [
    { id: "hack_squat", label: "Hack squat machine", gear: ["Hack Squat Machine"] },
    { id: "hip_thrust", label: "Hip thrust machine", gear: ["Hip Thrust Machine"] },
    { id: "calf", label: "Calf raise machine", gear: ["Calf Raise Machine"] },
    { id: "tbar", label: "T-bar row / landmine", gear: ["Landmine Attachment / T-Bar Row"] },
    { id: "plate_row", label: "Plate-loaded row", gear: ["Plate-Loaded Row"] },
    { id: "incline_press", label: "Incline chest press machine", gear: ["Incline Chest Press Machine"] },
    { id: "shoulder_press", label: "Shoulder press machine", gear: ["Shoulder Press Machine"] },
    { id: "rear_delt", label: "Rear delt fly machine", gear: ["Rear Delt Fly Machine"] },
    { id: "lateral", label: "Lateral raise machine", gear: ["Lateral Raise Machine"] },
    { id: "preacher", label: "Preacher curl bench", gear: ["Preacher Curl Bench"] },
    { id: "ab_wheel", label: "Ab wheel", gear: ["Ab Wheel"] },
    { id: "roman_chair", label: "Roman chair", gear: ["Roman Chair / Captains Chair"] },
    { id: "hyper", label: "45-degree hyperextension bench", gear: ["45-degree Hyperextension Bench"] },
  ];

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_LABELS = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };

  var MIN_DELOAD_EVERY = 6;
  var MAX_DELOAD_EVERY = 12;
  var BLOCK_WEEKS = 6;

  function isObj(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function marks(raw, defs) {
    var out = {};
    var src = isObj(raw) ? raw : {};
    defs.forEach(function (d) {
      if (src[d.id] === true || (isObj(src[d.id]) && src[d.id].have === true)) out[d.id] = true;
    });
    return out;
  }

  /**
   * Everything the questionnaire holds, cleaned. Nothing is invented: a question that was not
   * answered comes back empty, and the packet says so rather than guessing.
   */
  function normalize(raw) {
    var r = isObj(raw) ? raw : {};
    var sessions = parseInt(r.sessionsPerWeek, 10);
    if (!(sessions >= 2 && sessions <= 6)) sessions = 0;

    var allowed = sessions ? splitsFor(sessions) : [];
    var split = allowed.indexOf(String(r.split || "")) >= 0 ? String(r.split) : "";

    var days = Array.isArray(r.trainingDays)
      ? r.trainingDays.filter(function (d) {
          return DAY_KEYS.indexOf(d) >= 0;
        })
      : [];

    var deloadOn = r.deloadWeek === true;
    var every = parseInt(r.deloadEveryWeeks, 10);
    var cadence = deloadOn && every >= MIN_DELOAD_EVERY && every <= MAX_DELOAD_EVERY ? every : 0;

    var mins = parseInt(r.sessionMinutes, 10);

    return {
      clientName: String(r.clientName || "").slice(0, 120),
      gender: r.gender === "male" || r.gender === "female" ? r.gender : "",
      age: parseInt(r.age, 10) > 0 ? parseInt(r.age, 10) : 0,
      bodyweight: parseInt(r.bodyweight, 10) > 0 ? parseInt(r.bodyweight, 10) : 0,
      experience: String(r.experience || "").slice(0, 40),
      /* Which language the ATHLETE reads their programme in. The questionnaire itself is
         English, like every other card in this module. */
      outputLanguage: r.outputLanguage === "he" ? "he" : "en",

      fullyEquipped: r.fullyEquipped === true,
      equipment: marks(r.equipment, EQUIPMENT),
      extras: marks(r.extras, EXTRAS),

      sessionsPerWeek: sessions,
      split: split,
      trainingDays: days,
      sessionMinutes: mins >= 20 && mins <= 120 ? mins : 0,
      /* The TICK and the validated CADENCE are kept apart on purpose. Collapsing them loses
         the one state worth reporting: somebody asked for a deload and never said how often.
         Fold them together and missing() can no longer see it, and the athlete silently gets
         no deload after asking for one. */
      deloadAsked: deloadOn,
      deloadWeek: cadence > 0,
      deloadEveryWeeks: cadence,

      injuries: String(r.injuries || "").slice(0, 600),
      goalHealth: r.goalHealth === true,
      goalHypertrophy: r.goalHypertrophy === true,
      emphasis: String(r.emphasis || "").slice(0, 200),
    };
  }

  /**
   * What is still missing before a programme can be built.
   *
   * A question nobody answered must never become a guess: the split decides the whole shape of
   * the month, and the equipment decides whether the exercises exist in the room at all.
   */
  function missing(raw) {
    var v = normalize(raw);
    var out = [];
    if (!v.clientName) out.push("The athlete needs a name.");
    if (!v.sessionsPerWeek) out.push("How many sessions a week? Between 2 and 6.");
    if (v.sessionsPerWeek && !v.split) out.push("Choose the split for " + v.sessionsPerWeek + " sessions a week.");
    if (v.trainingDays.length && v.sessionsPerWeek && v.trainingDays.length !== v.sessionsPerWeek) {
      out.push("Pick exactly " + v.sessionsPerWeek + " training days — " + v.trainingDays.length + " are ticked.");
    }
    if (!v.fullyEquipped && !Object.keys(v.equipment).length) {
      out.push("Tick the equipment this gym has, or mark it as a fully equipped commercial gym.");
    }
    if (v.deloadAsked && !v.deloadEveryWeeks) {
      out.push("A deload week is on — say how often, between " + MIN_DELOAD_EVERY + " and " + MAX_DELOAD_EVERY + " weeks.");
    }
    if (!v.goalHealth && !v.goalHypertrophy) out.push("Pick at least one goal.");
    return out;
  }

  /** The equipment the room actually holds, as the exercise library names it. */
  function gearList(raw) {
    var v = normalize(raw);
    var out = {};
    var take = function (defs, picked) {
      defs.forEach(function (d) {
        if (picked[d.id]) {
          d.gear.forEach(function (g) {
            out[g] = true;
          });
        }
      });
    };
    if (v.fullyEquipped) {
      EQUIPMENT.forEach(function (d) {
        d.gear.forEach(function (g) {
          out[g] = true;
        });
      });
    } else {
      take(EQUIPMENT, v.equipment);
    }
    take(EXTRAS, v.extras);
    return Object.keys(out).sort();
  }

  /**
   * The packet the gym brain reads. Its own shape, its own words, and it states what was NOT
   * answered instead of letting the model fill the gap.
   */
  function buildGymPacket(raw) {
    var v = normalize(raw);
    var lines = [];
    lines.push("GYM INTAKE COMPLETE — build a " + BLOCK_WEEKS + "-week gym block now.");
    lines.push("Write ONE week. It repeats for the whole block.");
    lines.push("");
    lines.push("ATHLETE:");
    lines.push("Name: " + (v.clientName || "unknown"));
    lines.push("Gender: " + (v.gender || "unknown") + " | Age: " + (v.age || "unknown") + " | Bodyweight: " + (v.bodyweight ? v.bodyweight + " kg" : "unknown"));
    lines.push("Experience: " + (v.experience || "unknown"));
    lines.push("");
    lines.push("THE SPLIT — GIVEN TO YOU, NOT YOURS TO CHOOSE:");
    lines.push("Sessions per week: " + (v.sessionsPerWeek || "unknown"));
    lines.push("Split: " + (v.split ? (SPLITS[v.split] || {}).label : "NOT CHOSEN — do not invent one"));
    lines.push(
      "Training days: " +
        (v.trainingDays.length
          ? v.trainingDays
              .map(function (d) {
                return DAY_LABELS[d];
              })
              .join(", ")
          : "not named")
    );
    lines.push("Session length: " + (v.sessionMinutes ? v.sessionMinutes + " min — this decides how many exercises fit, not whether the session is good" : "not stated"));
    lines.push(
      v.deloadEveryWeeks
        ? "DELOAD: one deload week every " + v.deloadEveryWeeks + " weeks, counted continuously across blocks."
        : "DELOAD: none in this programme. Do NOT add one."
    );
    lines.push("");
    lines.push("EQUIPMENT — every exercise you write must exist in this list:");
    if (v.fullyEquipped) {
      lines.push("A fully equipped commercial gym. Everything standard is present.");
    } else {
      lines.push(gearList(raw).join(" | ") || "NOTHING TICKED — do not write a programme without this.");
    }
    lines.push("");
    lines.push("LIMITS: " + (v.injuries || "none reported"));
    lines.push("Work around a limit. Do NOT write rehabilitation programming — that is not this product.");
    lines.push("");
    var goals = [];
    if (v.goalHealth) goals.push("a healthy, active life");
    if (v.goalHypertrophy) goals.push("basic to moderate muscle growth");
    lines.push("GOAL: " + (goals.join(" and ") || "not stated"));
    if (v.emphasis) {
      lines.push("EMPHASIS: " + v.emphasis);
      lines.push("That muscle is trained FIRST in its sessions, while they are fresh. Anything else is not emphasis.");
    }
    return lines.join("\n");
  }

  return {
    STEPS: STEPS,
    SPLITS: SPLITS,
    EQUIPMENT: EQUIPMENT,
    EXTRAS: EXTRAS,
    DAY_KEYS: DAY_KEYS,
    DAY_LABELS: DAY_LABELS,
    BLOCK_WEEKS: BLOCK_WEEKS,
    MIN_DELOAD_EVERY: MIN_DELOAD_EVERY,
    MAX_DELOAD_EVERY: MAX_DELOAD_EVERY,
    splitsFor: splitsFor,
    normalize: normalize,
    missing: missing,
    gearList: gearList,
    buildGymPacket: buildGymPacket,
  };
});
