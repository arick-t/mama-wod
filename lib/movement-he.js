/**
 * The movement dictionary — Hebrew beside the English, never instead of it.
 *
 * WHY IT IS BILINGUAL AND NOT A TRANSLATION. עודד asked for his athletes' programme in
 * Hebrew, and the professional world this product lives in — the literature, the
 * standards, the names a coach says out loud in an Israeli box — is English. So a line
 * reads "מתח (pull-ups)" and not one or the other (owner, 2026-09-16).
 *
 * AND IT IS WHAT KEEPS THE CHECK ALIVE. lib/coach-brick-check.js finds equipment by
 * matching ENGLISH movement names in the written line. A line translated into Hebrew
 * alone is a line the checker cannot see — which is not a hypothesis: עודד's real month
 * already contains "22 כפיפות בטן" and "שכיבות סמיכה", and the bodyweight check reported
 * a whole week as having no bodyweight work in it because of exactly that. Keeping the
 * English inside the line is the difference between a feature and a blind spot.
 *
 * SO THE DICTIONARY RUNS IN BOTH DIRECTIONS:
 *   - bilingual()  English in a line  →  "עברית (English)" for the reader
 *   - englishFor() Hebrew a coach typed → the English name, so the checker can see it
 *
 * NOTHING HERE REWRITES STORED TEXT. It is a display pass and a lookup; the programme on
 * the server keeps the words the coach wrote, so turning Hebrew off returns exactly what
 * was there and a bad line can never become permanent.
 *
 * Browser: <script src="lib/movement-he.js"></script> → MovementHe
 * Node: require("./movement-he")
 *
 * 0 LLM. No network. A table and a string pass.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MovementHe = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * The table. `en` is matched case-insensitively and may end in an optional "s"; `he`
   * is what an Israeli coach actually says, not a literal translation — "מתח" and not
   * "משיכת סנטר".
   *
   * Order does not matter: matching sorts by length so the longest phrase wins, which is
   * what makes "ring row" beat "row" and "trap bar deadlift" beat "deadlift".
   */
  var TERMS = [
    /* --- squat family ---------------------------------------------------- */
    { en: "back squat", he: "סקוואט אחורי" },
    { en: "front squat", he: "סקוואט קדמי" },
    { en: "overhead squat", he: "סקוואט מעל הראש" },
    { en: "air squat", he: "סקוואט משקל גוף" },
    { en: "goblet squat", he: "סקוואט גביע" },
    { en: "bear hug squat", he: "סקוואט חיבוק" },
    { en: "deep static squat", he: "ישיבת סקוואט עמוקה" },
    { en: "pistol", he: "פיסטול" },
    { en: "one leg squat", he: "סקוואט על רגל אחת" },
    { en: "single leg squat", he: "סקוואט על רגל אחת" },
    { en: "wall sit", he: "ישיבת קיר" },

    /* --- hinge ----------------------------------------------------------- */
    { en: "deadlift", he: "דדליפט" },
    { en: "conventional deadlift", he: "דדליפט קלאסי" },
    { en: "sumo deadlift high pull", he: "דדליפט סומו עם משיכה" },
    { en: "sumo deadlift", he: "דדליפט סומו" },
    { en: "romanian deadlift", he: "דדליפט רומני" },
    { en: "trap bar deadlift", he: "דדליפט טראפ בר" },
    { en: "hex bar deadlift", he: "דדליפט טראפ בר" },
    { en: "good morning", he: "גוד מורנינג" },
    { en: "glute bridge", he: "גשר אגן" },

    /* --- press and push -------------------------------------------------- */
    { en: "bench press", he: "לחיצת חזה" },
    { en: "floor press", he: "לחיצת חזה מהרצפה" },
    { en: "incline press", he: "לחיצת חזה בשיפוע" },
    { en: "strict press", he: "לחיצת כתפיים מבוקרת" },
    { en: "overhead press", he: "לחיצת כתפיים" },
    { en: "shoulder press", he: "לחיצת כתפיים" },
    { en: "push press", he: "פוש פרס" },
    { en: "push jerk", he: "פוש ג'רק" },
    { en: "split jerk", he: "ספליט ג'רק" },
    { en: "jerk", he: "ג'רק" },
    { en: "shoulder to overhead", he: "מכתף למעל הראש" },
    { en: "push-up", he: "שכיבות סמיכה" },
    { en: "push up", he: "שכיבות סמיכה" },
    { en: "pushup", he: "שכיבות סמיכה" },
    { en: "pike push-up", he: "שכיבות סמיכה בפייק" },
    { en: "handstand push-up", he: "שכיבות סמיכה בעמידת ידיים" },
    { en: "hspu", he: "שכיבות סמיכה בעמידת ידיים" },
    { en: "dip", he: "מקבילים" },
    { en: "ring dip", he: "מקבילים בטבעות" },
    { en: "bar dip", he: "מקבילים על מוט" },

    /* --- pull ------------------------------------------------------------ */
    { en: "pull-up", he: "מתח" },
    { en: "pull up", he: "מתח" },
    { en: "pullup", he: "מתח" },
    { en: "strict pull-up", he: "מתח מבוקר" },
    { en: "kipping pull-up", he: "מתח בקיפינג" },
    { en: "butterfly pull-up", he: "מתח פרפר" },
    { en: "weighted pull-up", he: "מתח עם משקל" },
    { en: "negative pull-up", he: "מתח שלילי" },
    { en: "chest-to-bar", he: "מתח חזה למוט" },
    { en: "chest to bar", he: "מתח חזה למוט" },
    { en: "chin-up", he: "סנטר" },
    { en: "chin up", he: "סנטר" },
    { en: "ring row", he: "משיכה בטבעות" },
    { en: "bent over row", he: "חתירה בהרכנה" },
    { en: "renegade row", he: "חתירת רנגייד" },
    { en: "bar hang", he: "תלייה על מוט" },
    { en: "dead hang", he: "תלייה חופשית" },
    { en: "scapular pull-up", he: "משיכת שכמות" },
    { en: "toes-to-bar", he: "רגליים למוט" },
    { en: "toes to bar", he: "רגליים למוט" },
    { en: "knees to elbows", he: "ברכיים למרפקים" },
    { en: "rope climb", he: "טיפוס חבל" },
    { en: "muscle-up", he: "מאסל-אפ" },
    { en: "ring muscle-up", he: "מאסל-אפ בטבעות" },
    { en: "bar muscle-up", he: "מאסל-אפ על מוט" },

    /* --- olympic --------------------------------------------------------- */
    { en: "snatch", he: "סנאץ'" },
    { en: "power snatch", he: "פאוור סנאץ'" },
    { en: "squat snatch", he: "סקוואט סנאץ'" },
    { en: "hang snatch", he: "האנג סנאץ'" },
    { en: "muscle snatch", he: "מאסל סנאץ'" },
    { en: "clean", he: "קלין" },
    { en: "power clean", he: "פאוור קלין" },
    { en: "squat clean", he: "סקוואט קלין" },
    { en: "hang clean", he: "האנג קלין" },
    { en: "muscle clean", he: "מאסל קלין" },
    { en: "clean and jerk", he: "קלין אנד ג'רק" },
    { en: "clean & jerk", he: "קלין אנד ג'רק" },
    { en: "thruster", he: "ת'רסטר" },

    /* --- carries and odd objects ----------------------------------------- */
    { en: "farmer carry", he: "הליכת חקלאי" },
    { en: "farmers carry", he: "הליכת חקלאי" },
    { en: "farmer walk", he: "הליכת חקלאי" },
    { en: "suitcase carry", he: "הליכת מזוודה" },
    { en: "bear hug carry", he: "הליכת חיבוק" },
    { en: "ground to overhead", he: "מהרצפה למעל הראש" },
    { en: "sandbag walk", he: "הליכה עם שק" },
    { en: "sandbag", he: "שק חול" },
    { en: "d-ball", he: "די-בול" },
    { en: "slam ball", he: "כדור סלאם" },
    { en: "atlas stone", he: "אבן אטלס" },
    { en: "wall ball", he: "וול בול" },
    { en: "wall ball shot", he: "זריקת וול בול" },
    { en: "kettlebell swing", he: "סווינג קטלבל" },
    { en: "russian swing", he: "סווינג רוסי" },
    { en: "american swing", he: "סווינג אמריקאי" },
    { en: "turkish get-up", he: "טרקיש גט-אפ" },
    { en: "devil press", he: "דוויל פרס" },
    { en: "man-maker", he: "מן-מייקר" },

    /* --- lunges and steps ------------------------------------------------ */
    { en: "walking lunge", he: "לאנג'ים בהליכה" },
    { en: "alternating lunge", he: "לאנג'ים לסירוגין" },
    { en: "reverse lunge", he: "לאנג' לאחור" },
    { en: "forward lunge", he: "לאנג' קדימה" },
    { en: "jumping lunge", he: "לאנג' בקפיצה" },
    { en: "overhead lunge", he: "לאנג' מעל הראש" },
    { en: "goblet lunge", he: "לאנג' גביע" },
    { en: "lunge", he: "לאנג'" },
    { en: "box step-up", he: "עלייה על קופסה" },
    { en: "box step up", he: "עלייה על קופסה" },
    { en: "box jump", he: "קפיצה על קופסה" },
    { en: "box jump-over", he: "קפיצה מעל קופסה" },
    { en: "broad jump", he: "קפיצה לרוחק" },

    /* --- core ------------------------------------------------------------ */
    { en: "sit-up", he: "כפיפות בטן" },
    { en: "sit up", he: "כפיפות בטן" },
    { en: "v-up", he: "אולר" },
    { en: "hollow hold", he: "החזקת סירה" },
    { en: "hollow rock", he: "נדנוד סירה" },
    { en: "plank", he: "פלאנק" },
    { en: "side plank", he: "פלאנק צידי" },
    { en: "superman", he: "סופרמן" },
    { en: "arch hold", he: "החזקת קשת" },
    { en: "windshield wiper", he: "מגבים" },
    { en: "strict leg raise", he: "הרמת רגליים מבוקרת" },
    { en: "l-sit", he: "אל-סיט" },

    /* --- gymnastics and the wall ----------------------------------------- */
    { en: "handstand", he: "עמידת ידיים" },
    { en: "handstand walk", he: "הליכה על ידיים" },
    { en: "wall walk", he: "הליכת קיר" },
    { en: "wall climb", he: "טיפוס קיר" },
    { en: "bear crawl", he: "זחילת דוב" },
    { en: "crab walk", he: "הליכת סרטן" },
    { en: "skin the cat", he: "סקין דה קט" },

    /* --- monostructural --------------------------------------------------- */
    { en: "shuttle run", he: "ריצת שאטל" },
    { en: "shuttle sprint", he: "ספרינט שאטל" },
    { en: "run", he: "ריצה" },
    { en: "running", he: "ריצה" },
    { en: "row", he: "חתירה" },
    { en: "rowing", he: "חתירה" },
    { en: "bike", he: "אופניים" },
    { en: "bike erg", he: "אופני ארג" },
    { en: "assault bike", he: "אופני אסולט" },
    { en: "echo bike", he: "אופני אקו" },
    { en: "ski erg", he: "סקי ארג" },
    { en: "double under", he: "דאבל אנדר" },
    { en: "single under", he: "סינגל אנדר" },
    { en: "triple under", he: "טריפל אנדר" },
    { en: "jump rope", he: "חבל קפיצה" },
    { en: "burpee", he: "ברפי" },
    { en: "bearpee", he: "ברפי" },
    { en: "mountain climber", he: "מטפסי הרים" },
    { en: "jumping jack", he: "קפיצות פישוק" },
    { en: "high knees", he: "ברכיים גבוהות" },
    { en: "sled push", he: "דחיפת מזחלת" },
    { en: "sled pull", he: "משיכת מזחלת" },
    { en: "sled drag", he: "גרירת מזחלת" },
    { en: "hiking", he: "מסע" },

    /* --- the kit itself, when it is named inside a line --------------------
     * "12 Dumbbell Goblet Squats" is half a sentence if only half of it turns over. The
     * names here are the ones the equipment checklist already uses, so the athlete reads
     * the same word for a thing that his questionnaire calls by that name. */
    { en: "dumbbell", he: "דאמבל" },
    { en: "kettlebell", he: "קטלבל" },
    { en: "barbell", he: "מוט" },
    { en: "trap bar", he: "טראפ בר" },
    { en: "hex bar", he: "טראפ בר" },
    { en: "ring", he: "טבעות" },
    { en: "box", he: "קופסה" },
    { en: "band", he: "גומייה" },
    { en: "rope", he: "חבל" },
    { en: "bench", he: "ספסל" },
    { en: "rack", he: "ראק" },
    { en: "rig", he: "מתקן" },
    { en: "parallettes", he: "מקבילונים" },

    /* --- mobility --------------------------------------------------------- */
    { en: "shoulder rotation", he: "סיבובי כתפיים" },
    { en: "hamstring stretch", he: "מתיחת ירך אחורית" },
    { en: "child pose", he: "תנוחת הילד" },
    { en: "child pos", he: "תנוחת הילד" },
    { en: "pull-apart", he: "פתיחת גומייה" },
    { en: "mobility", he: "מוביליות" },
  ];

  /* Sorted once: the longest phrase wins, which is what stops "row" from claiming the
     "row" inside "ring row" and "deadlift" from claiming "trap bar deadlift". */
  var SORTED = TERMS.slice().sort(function (a, b) {
    return b.en.length - a.en.length;
  });

  var BY_HE = (function () {
    var map = {};
    for (var i = 0; i < TERMS.length; i++) {
      var he = TERMS[i].he;
      if (!map[he]) map[he] = TERMS[i].en;
    }
    return map;
  })();

  /** Regex-safe. */
  function esc(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * A phrase, as it may appear in a written line: any case, optionally plural, and
   * hyphen or space between its words ("pull-up", "pull up", "Pull Ups").
   */
  function patternFor(en) {
    var body = esc(en).replace(/[\s\-]+/g, "[\\s\\-]+");
    return new RegExp("(^|[^A-Za-z])(" + body + "e?s?)(?![A-Za-z])", "gi");
  }

  var PATTERNS = SORTED.map(function (t) {
    return { he: t.he, en: t.en, re: patternFor(t.en) };
  });

  /**
   * One written line, with Hebrew beside every movement name it holds.
   *
   * "10 Pullup" → "10 מתח (Pullup)". The English stays exactly as the coach typed it,
   * inside the brackets: that is what the reader checks against a standard and what the
   * post-check reads.
   *
   * Idempotent — a line already carrying "עברית (English)" is left alone, so a render
   * that runs twice does not produce "מתח (מתח (Pullup))".
   */
  function bilingual(text) {
    var line = String(text == null ? "" : text);
    if (!line) return "";
    /* Spans already claimed, so a shorter phrase cannot cut into a longer one's match. */
    var taken = [];
    var out = [];
    var overlaps = function (at, end) {
      for (var i = 0; i < taken.length; i++) {
        if (at < taken[i][1] && end > taken[i][0]) return true;
      }
      return false;
    };
    for (var p = 0; p < PATTERNS.length; p++) {
      var re = PATTERNS[p].re;
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(line))) {
        var at = m.index + m[1].length;
        var end = at + m[2].length;
        if (overlaps(at, end)) continue;
        /* Already inside brackets after a Hebrew word: this line has been through here. */
        var before = line.slice(0, at);
        if (/[֐-׿][^()]*\($/.test(before)) continue;
        taken.push([at, end]);
        out.push({ at: at, end: end, he: PATTERNS[p].he });
      }
    }
    if (!out.length) return line;
    out.sort(function (a, b) {
      return a.at - b.at;
    });
    var built = "";
    var cursor = 0;
    for (var k = 0; k < out.length; k++) {
      built += line.slice(cursor, out[k].at);
      built += out[k].he + " (" + line.slice(out[k].at, out[k].end) + ")";
      cursor = out[k].end;
    }
    return built + line.slice(cursor);
  }

  /**
   * The same pass, Hebrew ONLY — no brackets, no English left in the line.
   *
   * Which is what an athlete actually wants to read: "10 מתח" and not "10 מתח (Pullup)".
   * It is safe to do this to the DISPLAYED text only because the English survives beside
   * it, out of sight, in the part's `linesEn` — see lib/coach-brick-check.js, which reads
   * that and never the shown line. Hebrew for the reader, English for the machine, and
   * neither one in the other's way (owner, 2026-09-16).
   */
  function hebrewOnly(text) {
    var line = String(text == null ? "" : text);
    if (!line) return "";
    var taken = [];
    var out = [];
    var overlaps = function (at, end) {
      for (var i = 0; i < taken.length; i++) {
        if (at < taken[i][1] && end > taken[i][0]) return true;
      }
      return false;
    };
    for (var p = 0; p < PATTERNS.length; p++) {
      var re = PATTERNS[p].re;
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(line))) {
        var at = m.index + m[1].length;
        var end = at + m[2].length;
        if (overlaps(at, end)) continue;
        taken.push([at, end]);
        out.push({ at: at, end: end, he: PATTERNS[p].he });
      }
    }
    if (!out.length) return line;
    out.sort(function (a, b) {
      return a.at - b.at;
    });
    var built = "";
    var cursor = 0;
    for (var k = 0; k < out.length; k++) {
      built += line.slice(cursor, out[k].at);
      built += out[k].he;
      cursor = out[k].end;
    }
    return (built + line.slice(cursor)).replace(/\s{2,}/g, " ").trim();
  }

  /**
   * The other direction: the English name for a Hebrew one a coach typed.
   *
   * This is what stops the Hebrew half of the product from blinding the post-check —
   * see the file header. Returns "" when the word is not one we know.
   */
  function englishFor(hebrew) {
    return BY_HE[String(hebrew || "").trim()] || "";
  }

  /**
   * A line a coach wrote in Hebrew, with the English names appended so a machine can
   * read it. Used by the check, never shown to anyone.
   */
  function withEnglish(text) {
    var line = String(text == null ? "" : text);
    if (!line || !/[֐-׿]/.test(line)) return line;
    var found = [];
    for (var i = 0; i < TERMS.length; i++) {
      if (line.indexOf(TERMS[i].he) < 0) continue;
      if (found.indexOf(TERMS[i].en) < 0) found.push(TERMS[i].en);
    }
    return found.length ? line + " [" + found.join(", ") + "]" : line;
  }

  return {
    TERMS: TERMS,
    bilingual: bilingual,
    hebrewOnly: hebrewOnly,
    englishFor: englishFor,
    withEnglish: withEnglish,
  };
});
