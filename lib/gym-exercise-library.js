/**
 * THE GYM EXERCISE LIBRARY — the thing without which none of the ordering rules can run.
 *
 * WHY THIS FILE EXISTS. The gym doctrine turns on three ordering rules: "compound before
 * isolated" (the one rule all three sources back, and the only one with a proven mechanism),
 * "large muscle group before small", and "a FULL BODY session opens on the lower body". Not one
 * of them can be obeyed — or checked — unless every exercise carries three tags: WHICH MUSCLE it
 * trains, whether it is COMPOUND or ISOLATED, and WHICH EQUIPMENT it needs. The owner's own
 * transcript named this as the blocker on 2026-09-14: "ספריית תרגילים מסווגת חסרה… זהו הפער
 * שחוסם את הפעלת הכללים שכבר נכתבו."
 *
 * The Drive document maps EQUIPMENT to MUSCLE. It does not map EXERCISE to anything. This does.
 *
 * TIERS ARE THE HARD PART, NOT THE NAMES. Every exercise here names equipment drawn from that
 * document and carries its availability tier: tier 1 is safe to assume in any commercial gym,
 * tier 2 must be confirmed with the athlete and always needs a tier-1 fallback beside it. A
 * programme whose backbone rests on tier 2 breaks in half the gyms in the country — so every
 * tier-2 entry names its stand-in, and a test asserts that none is missing one.
 *
 * NOT CROSSFIT. lib/equipment-catalog.js is the functional world: rings, rig, erg, wall ball.
 * This is the commercial gym: machines, cables, a Smith. They do not overlap and neither
 * replaces the other. The gym gets a checker of its own (owner, 2026-09-22: "זה תחום אחר לגמרי
 * — סט חוקים שונה, שיטה שונה ובדיקות שונות").
 *
 * 0 LLM. A table, read the same way by the questionnaire, the prompt and the check.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GymExerciseLibrary = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** The four large groups the doctrine counts twice a week, and the small ones it does not. */
  var LARGE = ["legs", "back", "chest", "shoulders"];
  var SMALL = ["biceps", "triceps", "calves", "core"];

  var HE = {
    legs: "רגליים",
    back: "גב",
    chest: "חזה",
    shoulders: "כתפיים",
    biceps: "יד קדמית",
    triceps: "יד אחורית",
    calves: "תאומים",
    core: "ליבה",
  };

  /* ── The library ────────────────────────────────────────────────────────────────
     en · he · muscle · kind · gear · tier · tier-1 fallback · half of the body.
     `half` exists for one rule only: a FULL BODY session opens on the lower body. */
  var EX = [
    /* ── LEGS ─────────────────────────────────────────────────────────────────── */
    ["Back Squat", "סקוואט אחורי", "legs", "compound", ["Squat Rack", "Olympic Barbell"], 1, "", "lower"],
    ["Front Squat", "סקוואט קדמי", "legs", "compound", ["Squat Rack", "Olympic Barbell"], 1, "", "lower"],
    ["Goblet Squat", "סקוואט גביע", "legs", "compound", ["Dumbbells"], 1, "", "lower"],
    ["Smith Machine Squat", "סקוואט בסמית", "legs", "compound", ["Smith Machine"], 1, "", "lower"],
    ["Leg Press", "לחיצת רגליים", "legs", "compound", ["Leg Press"], 1, "", "lower"],
    ["Romanian Deadlift", "דדליפט רומני", "legs", "compound", ["Olympic Barbell"], 1, "", "lower"],
    ["Conventional Deadlift", "דדליפט", "legs", "compound", ["Olympic Barbell"], 1, "", "lower"],
    ["Dumbbell Walking Lunge", "לאנג בהליכה", "legs", "compound", ["Dumbbells"], 1, "", "lower"],
    ["Bulgarian Split Squat", "סקוואט בולגרי", "legs", "compound", ["Dumbbells", "Flat Bench"], 1, "", "lower"],
    ["Step-up", "עליית מדרגה", "legs", "compound", ["Dumbbells", "Flat Bench"], 1, "", "lower"],
    ["Barbell Hip Thrust", "הרמת אגן עם מוט", "legs", "compound", ["Olympic Barbell", "Flat Bench"], 1, "", "lower"],
    ["Cable Pull-through", "משיכת כבל בין הרגליים", "legs", "compound", ["Dual Adjustable Pulley"], 1, "", "lower"],
    ["Back Extension", "פשיטת גב", "legs", "isolation", ["45-degree Hyperextension Bench"], 2, "Cable Pull-through", "lower"],
    ["Hack Squat Machine", "הק סקוואט", "legs", "compound", ["Hack Squat Machine"], 2, "Leg Press", "lower"],
    ["Hip Thrust Machine", "מכונת הרמת אגן", "legs", "compound", ["Hip Thrust Machine"], 2, "Barbell Hip Thrust", "lower"],
    ["Leg Extension", "פשיטת ברך", "legs", "isolation", ["Leg Extension Machine"], 1, "", "lower"],
    ["Leg Curl", "כפיפת ברך", "legs", "isolation", ["Leg Curl Machine"], 1, "", "lower"],
    ["Abductor Machine", "מכונת מרחיקים", "legs", "isolation", ["Abductor / Adductor Machine"], 1, "", "lower"],
    ["Adductor Machine", "מכונת מקרבים", "legs", "isolation", ["Abductor / Adductor Machine"], 1, "", "lower"],
    ["Dumbbell Calf Raise", "עליית עקבים עם דאמבל", "calves", "isolation", ["Dumbbells"], 1, "", "lower"],
    ["Calf Raise Machine", "מכונת עליית עקבים", "calves", "isolation", ["Calf Raise Machine"], 2, "Dumbbell Calf Raise", "lower"],

    /* ── BACK ─────────────────────────────────────────────────────────────────── */
    ["Lat Pulldown", "משיכת פולי עליון", "back", "compound", ["Lat Pulldown Machine"], 1, "", "upper"],
    ["Pull-up", "מתח", "back", "compound", ["Pull-up Bar"], 1, "", "upper"],
    ["Chin-up", "מתח באחיזה תחתונה", "back", "compound", ["Pull-up Bar"], 1, "", "upper"],
    ["Assisted Pull-up", "מתח בסיוע מכונה", "back", "compound", ["Assisted Dip / Chin-up Machine"], 1, "", "upper"],
    ["Seated Cable Row", "חתירה בישיבה בכבל", "back", "compound", ["Seated Cable Row Machine"], 1, "", "upper"],
    ["Barbell Bent-over Row", "חתירה במוט בהטיה", "back", "compound", ["Olympic Barbell"], 1, "", "upper"],
    ["One-arm Dumbbell Row", "חתירה עם דאמבל יד אחת", "back", "compound", ["Dumbbells", "Flat Bench"], 1, "", "upper"],
    ["Chest-supported Dumbbell Row", "חתירה בשכיבת חזה", "back", "compound", ["Dumbbells", "Adjustable Bench"], 1, "", "upper"],
    ["Smith Machine Row", "חתירה בסמית", "back", "compound", ["Smith Machine"], 1, "", "upper"],
    ["T-Bar Row", "חתירת טי-בר", "back", "compound", ["Landmine Attachment / T-Bar Row"], 2, "Barbell Bent-over Row", "upper"],
    ["Plate-Loaded Row", "חתירה במכונה עם דיסקיות", "back", "compound", ["Plate-Loaded Row"], 2, "Seated Cable Row", "upper"],
    ["Straight-arm Pulldown", "משיכת פולי בידיים ישרות", "back", "isolation", ["Dual Adjustable Pulley"], 1, "", "upper"],
    ["Cable Face Pull", "משיכת חבל לפנים", "back", "isolation", ["Dual Adjustable Pulley", "Cable Attachments"], 1, "", "upper"],
    ["Barbell Shrug", "משיכת כתפיים עם מוט", "back", "isolation", ["Olympic Barbell"], 1, "", "upper"],

    /* ── CHEST ────────────────────────────────────────────────────────────────── */
    ["Barbell Bench Press", "לחיצת חזה בשכיבה", "chest", "compound", ["Flat Bench Press Station", "Olympic Barbell"], 1, "", "upper"],
    ["Incline Barbell Bench Press", "לחיצת חזה בשיפוע במוט", "chest", "compound", ["Adjustable Bench", "Olympic Barbell"], 1, "", "upper"],
    ["Dumbbell Bench Press", "לחיצת חזה עם דאמבלים", "chest", "compound", ["Dumbbells", "Flat Bench"], 1, "", "upper"],
    ["Incline Dumbbell Press", "לחיצת חזה בשיפוע עם דאמבלים", "chest", "compound", ["Dumbbells", "Adjustable Bench"], 1, "", "upper"],
    ["Chest Press Machine", "מכונת לחיצת חזה", "chest", "compound", ["Chest Press Machine"], 1, "", "upper"],
    ["Smith Machine Bench Press", "לחיצת חזה בסמית", "chest", "compound", ["Smith Machine"], 1, "", "upper"],
    ["Chest Dip", "מקבילים לחזה", "chest", "compound", ["Dip Station"], 1, "", "upper"],
    ["Push-up", "שכיבות סמיכה", "chest", "compound", ["Exercise Mats"], 1, "", "upper"],
    ["Incline Chest Press Machine", "מכונת לחיצה בשיפוע", "chest", "compound", ["Incline Chest Press Machine"], 2, "Incline Dumbbell Press", "upper"],
    ["Pec Deck", "פרפר במכונה", "chest", "isolation", ["Pec Deck / Butterfly"], 1, "", "upper"],
    ["Cable Chest Fly", "פרפר בכבלים", "chest", "isolation", ["Dual Adjustable Pulley"], 1, "", "upper"],
    ["Dumbbell Fly", "פרפר עם דאמבלים", "chest", "isolation", ["Dumbbells", "Adjustable Bench"], 1, "", "upper"],

    /* ── SHOULDERS ────────────────────────────────────────────────────────────── */
    ["Standing Overhead Press", "לחיצת כתפיים בעמידה", "shoulders", "compound", ["Squat Rack", "Olympic Barbell"], 1, "", "upper"],
    ["Seated Dumbbell Shoulder Press", "לחיצת כתפיים בישיבה", "shoulders", "compound", ["Dumbbells", "Adjustable Bench"], 1, "", "upper"],
    ["Smith Machine Shoulder Press", "לחיצת כתפיים בסמית", "shoulders", "compound", ["Smith Machine", "Adjustable Bench"], 1, "", "upper"],
    ["Arnold Press", "לחיצת ארנולד", "shoulders", "compound", ["Dumbbells", "Adjustable Bench"], 1, "", "upper"],
    ["Shoulder Press Machine", "מכונת לחיצת כתפיים", "shoulders", "compound", ["Shoulder Press Machine"], 2, "Seated Dumbbell Shoulder Press", "upper"],
    ["Dumbbell Lateral Raise", "הרחקת זרועות לצדדים", "shoulders", "isolation", ["Dumbbells"], 1, "", "upper"],
    ["Cable Lateral Raise", "הרחקה לצד בכבל", "shoulders", "isolation", ["Dual Adjustable Pulley", "Cable Attachments"], 1, "", "upper"],
    ["Dumbbell Rear Delt Fly", "פרפר הפוך עם דאמבלים", "shoulders", "isolation", ["Dumbbells", "Adjustable Bench"], 1, "", "upper"],
    ["Dumbbell Front Raise", "הרמת זרועות לפנים", "shoulders", "isolation", ["Dumbbells"], 1, "", "upper"],
    ["Rear Delt Fly Machine", "מכונת פרפר הפוך", "shoulders", "isolation", ["Rear Delt Fly Machine"], 2, "Dumbbell Rear Delt Fly", "upper"],
    ["Lateral Raise Machine", "מכונת הרחקה לצד", "shoulders", "isolation", ["Lateral Raise Machine"], 2, "Dumbbell Lateral Raise", "upper"],

    /* ── BICEPS ───────────────────────────────────────────────────────────────── */
    ["Barbell Curl", "כפיפת מרפקים במוט", "biceps", "isolation", ["EZ / Curl Bar"], 1, "", "upper"],
    ["Dumbbell Curl", "כפיפת מרפקים עם דאמבלים", "biceps", "isolation", ["Dumbbells"], 1, "", "upper"],
    ["Hammer Curl", "כפיפת פטיש", "biceps", "isolation", ["Dumbbells"], 1, "", "upper"],
    ["Incline Dumbbell Curl", "כפיפת מרפקים בשיפוע", "biceps", "isolation", ["Dumbbells", "Adjustable Bench"], 1, "", "upper"],
    ["Cable Curl", "כפיפת מרפקים בכבל", "biceps", "isolation", ["Dual Adjustable Pulley", "Cable Attachments"], 1, "", "upper"],
    ["Preacher Curl", "כפיפת מרפקים בספסל סקוט", "biceps", "isolation", ["Preacher Curl Bench"], 2, "Incline Dumbbell Curl", "upper"],

    /* ── TRICEPS ──────────────────────────────────────────────────────────────── */
    ["Cable Triceps Pushdown", "פשיטת מרפקים בכבל", "triceps", "isolation", ["Dual Adjustable Pulley", "Cable Attachments"], 1, "", "upper"],
    ["Overhead Cable Extension", "פשיטת מרפקים מעל הראש בכבל", "triceps", "isolation", ["Dual Adjustable Pulley", "Cable Attachments"], 1, "", "upper"],
    ["Skull Crusher", "פשיטת מרפקים בשכיבה", "triceps", "isolation", ["EZ / Curl Bar", "Flat Bench"], 1, "", "upper"],
    ["Dumbbell Overhead Extension", "פשיטת מרפקים עם דאמבל", "triceps", "isolation", ["Dumbbells"], 1, "", "upper"],
    ["Close-grip Bench Press", "לחיצת חזה באחיזה צרה", "triceps", "compound", ["Flat Bench Press Station", "Olympic Barbell"], 1, "", "upper"],
    ["Triceps Dip", "מקבילים לתלת ראשי", "triceps", "compound", ["Dip Station"], 1, "", "upper"],

    /* ── CORE — at the end of the session, and never counted in the set total ──── */
    ["Plank", "פלאנק", "core", "isolation", ["Exercise Mats"], 1, "", "core"],
    ["Side Plank", "פלאנק צידי", "core", "isolation", ["Exercise Mats"], 1, "", "core"],
    ["Dead Bug", "דד באג", "core", "isolation", ["Exercise Mats"], 1, "", "core"],
    ["Cable Crunch", "כפיפות בטן בכבל", "core", "isolation", ["Dual Adjustable Pulley", "Cable Attachments"], 1, "", "core"],
    ["Pallof Press", "לחיצת פאלוף", "core", "isolation", ["Dual Adjustable Pulley", "Cable Attachments"], 1, "", "core"],
    ["Hanging Knee Raise", "הרמת ברכיים בתלייה", "core", "isolation", ["Pull-up Bar"], 1, "", "core"],
    ["Ab Wheel Rollout", "גלגלת בטן", "core", "isolation", ["Ab Wheel"], 2, "Plank", "core"],
    ["Roman Chair Knee Raise", "הרמת ברכיים בכיסא רומי", "core", "isolation", ["Roman Chair / Captains Chair"], 2, "Hanging Knee Raise", "core"],
  ];

  function row(a) {
    return {
      en: a[0],
      he: a[1],
      muscle: a[2],
      kind: a[3],
      gear: a[4].slice(),
      tier: a[5],
      fallback: a[6] || "",
      half: a[7],
      isCompound: a[3] === "compound",
      isLarge: LARGE.indexOf(a[2]) >= 0,
    };
  }

  var ALL = EX.map(row);

  function byMuscle(m) {
    return ALL.filter(function (e) {
      return e.muscle === m;
    });
  }

  /** Only what a generic commercial gym is safe to assume. A programme's backbone lives here. */
  function assumable() {
    return ALL.filter(function (e) {
      return e.tier === 1;
    });
  }

  /** The tier-1 stand-in for a tier-2 exercise. Never prescribe tier 2 without carrying this. */
  function fallbackFor(en) {
    var hit = ALL.filter(function (e) {
      return e.en === en;
    })[0];
    if (!hit || hit.tier === 1) return null;
    return (
      ALL.filter(function (e) {
        return e.en === hit.fallback;
      })[0] || null
    );
  }

  /**
   * Find the exercise a written line is about, in either language.
   *
   * Longest match wins, for the same reason the equipment catalogue matches that way: "Incline
   * Dumbbell Press" must not be read as "Dumbbell Press" and land on the wrong bench.
   */
  function find(text) {
    var t = String(text || "").toLowerCase();
    if (!t.trim()) return null;
    var best = null;
    ALL.forEach(function (e) {
      var en = e.en.toLowerCase();
      if (t.indexOf(en) >= 0 && (!best || en.length > best.en.length)) best = e;
      if (e.he && text.indexOf(e.he) >= 0 && (!best || e.he.length > (best.he || "").length)) best = e;
    });
    return best;
  }

  return {
    ALL: ALL,
    LARGE: LARGE,
    SMALL: SMALL,
    HE: HE,
    byMuscle: byMuscle,
    assumable: assumable,
    fallbackFor: fallbackFor,
    find: find,
  };
});
