/**
 * THE GYM CHECK — a different field, a different method, different checks.
 *
 * The owner's instruction when this was scoped (2026-09-22): "הבודק צריך להיות אחד נפרד ואחר
 * לחד\"כ - אין ברירה זה תחום אחר לגמרי = סט חוקים שונה, שיטה שונה ובדיקות שונות."
 *
 * HE WAS RIGHT, AND HERE IS THE PROOF THAT MADE HIM SAY IT. A perfectly ordinary gym week run
 * through the functional check came back with EIGHT blocking violations: it read "Seated Cable
 * Row" as a rowing erg that is not in the room, "Back Squat" as needing a rig, and every one of
 * the six weeks as having no bodyweight work in it. The catalogue behind that check is the
 * functional world — rings, erg, wall ball — and it does not know what a machine is.
 *
 * WHERE THE LINE IS. The same line the owner drew for the functional repair pass: BLOCKING is
 * what the athlete standing in the gym cannot do, or what they were told not to be given. A FLAG
 * is everything a coach might have meant.
 *
 *   blocking — equipment the room does not own · a movement family they asked us to avoid · a
 *              large muscle group that gets nothing at all in a week · reps outside 8-30 · a
 *              load written in kilos
 *   flags    — weekly volume outside 10-20 per group · a session outside 18-24 sets · isolation
 *              before compound · core counted in the total
 *
 * Isolation-before-compound is a FLAG and not a law-break, even though the doctrine calls
 * compound-first a law, because pre-exhaustion is a named method in layer 3 and doing exactly
 * that on purpose is legitimate. A check that blocked it would forbid a technique we teach.
 *
 * 0 LLM. 0 cost.
 */

"use strict";

const Library = require("./gym-exercise-library.js");
const GymIntake = require("./gym-intake.js");

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const LARGE = Library.LARGE;

const MIN_REPS = 8;
const MAX_REPS = 30;
const MIN_WEEKLY_SETS = 10;
const MAX_WEEKLY_SETS = 20;
const MIN_SESSION_SETS = 18;
const MAX_SESSION_SETS = 24;
const MAX_VIOLATIONS = 12;

/** Movement families the athlete asked us to keep away from, as exercises. */
const AVOID_MATCH = {
  deep_squat: /squat/i,
  hinge_deadlift: /deadlift|hip thrust|pull-through|back extension/i,
  overhead_press: /overhead press|shoulder press|arnold/i,
  hanging: /pull-up|chin-up|hanging/i,
  lunging: /lunge|split squat|step-up/i,
  heavy_pressing: /barbell bench press|close-grip bench/i,
  spinal_flexion: /crunch|sit-up/i,
};

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * One written line, read as work.
 *
 * "4 x 10 Leg Press @ 7/10" -> sets 4, reps 10, the exercise, the effort.
 * A line we cannot read is not a violation: coaches write notes, and a note is not a set.
 */
function readLine(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  /* A HOLD IS NOT REPS. "3 x 45s Plank" is three sets of forty-five seconds, and reading the
     45 as a rep count would report it as outside 8-30 and block a plank. The first real
     generation wrote exactly that line and only survived by accident: the word boundary after
     the digits happened to fail against the "s". Say it on purpose instead. */
  const hold = /^(\d{1,2})\s*[x×]\s*\d{1,3}\s*(s|sec|secs|seconds|min)\b/i.exec(s);
  const m = hold ? null : s.match(/^(\d{1,2})\s*[x×]\s*(\d{1,3})\b/);
  const ex = Library.find(s);
  if (!m && !ex) return null;
  return {
    text: s,
    sets: m ? parseInt(m[1], 10) : hold ? parseInt(hold[1], 10) : 0,
    /* Zero means "not a rep count", which is exactly what a timed hold is. */
    reps: m ? parseInt(m[2], 10) : 0,
    hold: !!hold,
    exercise: ex || null,
    kilos: /\b\d{1,3}\s*(kg|ק"?ג|קילו)\b/i.test(s),
    effort: /@\s*\d{1,2}\s*\/\s*10/.test(s),
  };
}

/**
 * Every readable line of the block, tagged with where it came from.
 *
 * ONE WEEK IS THE WHOLE BLOCK. The six weeks are identical by construction — the brain writes
 * one and lib/gym-block-build.js repeats it — so reading all six would report every finding six
 * times over and bury the one that matters. `all` exists for the case where a human has edited
 * the weeks apart and we genuinely need to look at each.
 */
function walkLines(block, all) {
  const out = [];
  let weeks = (block && block.weeks) || [];
  if (!all) {
    const first = weeks.filter(function (w) {
      return DAY_KEYS.some(function (d) {
        return (((w.days || {})[d] || {}).parts || []).length;
      });
    })[0];
    weeks = first ? [first] : [];
  }
  weeks.forEach(function (w, wi) {
    const idx = w.weekIndex || wi + 1;
    DAY_KEYS.forEach(function (d) {
      const parts = ((w.days || {})[d] || {}).parts || [];
      parts.forEach(function (p) {
        (p.lines || []).forEach(function (line) {
          const read = readLine(line);
          if (read) out.push(Object.assign({ week: idx, day: d, part: p }, read));
        });
      });
    });
  });
  return out;
}

/** The room's inventory, as a set the library's gear names can be looked up in. */
function gearSet(ctx) {
  const list = Array.isArray(ctx && ctx.equipment) ? ctx.equipment : [];
  const out = {};
  list.forEach(function (g) {
    out[String(g)] = true;
  });
  return out;
}

function checkGymBlock(block, ctx) {
  const c = isObj(ctx) ? ctx : {};
  const result = { blocking: [], flags: [], violations: [] };
  const lines = walkLines(block, c.everyWeek === true);
  if (!lines.length) {
    result.blocking.push("Nothing readable was written in this block.");
    return result;
  }

  const gear = gearSet(c);
  const answers = GymIntake.normalize(c.answers);
  const knowsGear = Object.keys(gear).length > 0;

  /* ── equipment the room does not own ─────────────────────────────────────── */
  if (knowsGear) {
    const missing = {};
    lines.forEach(function (l) {
      if (!l.exercise) return;
      const absent = l.exercise.gear.filter(function (g) {
        return !gear[g];
      });
      if (!absent.length) return;
      const key = absent.join("|");
      if (missing[key]) {
        missing[key].count++;
        return;
      }
      missing[key] = { kind: "equipment", need: absent, count: 1, where: "W" + l.week + " " + l.day, example: l.text };
      result.violations.push(missing[key]);
      result.blocking.push(
        absent.join(" / ") + " is NOT in this gym, and was prescribed (" + l.text + "). Replace it with something the room has."
      );
    });
  }

  /* ── a family they asked us to keep away from ────────────────────────────── */
  Object.keys(answers.avoid || {}).forEach(function (id) {
    if (!answers.avoid[id]) return;
    const re = AVOID_MATCH[id];
    if (!re) return;
    const hit = lines.filter(function (l) {
      return re.test(l.exercise ? l.exercise.en : l.text);
    })[0];
    if (!hit) return;
    result.violations.push({ kind: "avoided", family: id, count: 1, where: "W" + hit.week + " " + hit.day });
    result.blocking.push(
      "This athlete asked to avoid that movement family, and it was prescribed anyway (" + hit.text + ")."
    );
  });

  /* ── reps outside the range, and loads written in kilos ──────────────────── */
  const badReps = lines.filter(function (l) {
    return l.reps > 0 && (l.reps < MIN_REPS || l.reps > MAX_REPS);
  });
  if (badReps.length) {
    result.violations.push({ kind: "reps", count: badReps.length, where: "W" + badReps[0].week });
    result.blocking.push(
      badReps.length +
        " line(s) fall outside " +
        MIN_REPS +
        "-" +
        MAX_REPS +
        " reps (e.g. " +
        badReps[0].text +
        "). Below eight needs the coach to ask for it."
    );
  }
  const inKilos = lines.filter(function (l) {
    return l.kilos;
  });
  if (inKilos.length) {
    result.violations.push({ kind: "kilos", count: inKilos.length, where: "W" + inKilos[0].week });
    result.blocking.push(
      "A load was written in kilos (" + inKilos[0].text + "). Write effort out of ten — the coach adds the weight."
    );
  }

  /* ── a large muscle group that gets nothing at all ───────────────────────── */
  const perWeek = {};
  lines.forEach(function (l) {
    if (!l.exercise || !l.sets) return;
    const w = l.week;
    perWeek[w] = perWeek[w] || {};
    perWeek[w][l.exercise.muscle] = (perWeek[w][l.exercise.muscle] || 0) + l.sets;
  });
  const firstWeek = Object.keys(perWeek)[0];
  if (firstWeek) {
    LARGE.forEach(function (m) {
      if (!perWeek[firstWeek][m]) {
        result.violations.push({ kind: "untrained", muscle: m, count: 1, where: "W" + firstWeek });
        result.blocking.push(
          Library.HE[m] + " (" + m + ") gets no work at all in the week. Every large muscle group is trained."
        );
      }
    });
  }

  result.violations = result.violations.slice(0, MAX_VIOLATIONS);

  /* ── flags: everything a coach might have meant ──────────────────────────── */

  if (firstWeek) {
    LARGE.forEach(function (m) {
      const n = perWeek[firstWeek][m] || 0;
      if (!n) return;
      if (n < MIN_WEEKLY_SETS || n > MAX_WEEKLY_SETS) {
        result.flags.push(
          Library.HE[m] + " gets " + n + " sets a week — outside the " + MIN_WEEKLY_SETS + "-" + MAX_WEEKLY_SETS + " the doctrine aims at."
        );
      }
    });
  }

  /* Sets in a session, core NOT counted. */
  const bySession = {};
  lines.forEach(function (l) {
    if (!l.sets) return;
    const key = l.week + ":" + l.day;
    const core = l.exercise && l.exercise.muscle === "core";
    bySession[key] = bySession[key] || { sets: 0, core: 0 };
    if (core) bySession[key].core += l.sets;
    else bySession[key].sets += l.sets;
  });
  Object.keys(bySession).forEach(function (key) {
    const n = bySession[key].sets;
    if (!n) return;
    if (n < MIN_SESSION_SETS || n > MAX_SESSION_SETS) {
      result.flags.push(
        "The session on " + key.replace(":", " ") + " has " + n + " working sets — the range is " +
          MIN_SESSION_SETS + "-" + MAX_SESSION_SETS + ", aiming at 20. Core is not counted."
      );
    }
  });

  /* Compound before isolated, within one muscle group in one session. A flag rather than a
     block: pre-exhaustion does exactly this on purpose, and it is a method we teach. */
  const seenIsolation = {};
  lines.forEach(function (l) {
    if (!l.exercise) return;
    const key = l.week + ":" + l.day + ":" + l.exercise.muscle;
    if (!l.exercise.isCompound) {
      seenIsolation[key] = l.text;
      return;
    }
    if (seenIsolation[key]) {
      result.flags.push(
        "On " + l.day + ", " + l.text + " comes after " + seenIsolation[key] +
          " for the same muscle. Compound work goes first — unless this is pre-exhaustion on purpose."
      );
      delete seenIsolation[key];
    }
  });

  /* Core at the end of the session. */
  lines.forEach(function (l, i) {
    if (!l.exercise || l.exercise.muscle !== "core") return;
    const after = lines.filter(function (x) {
      return x.week === l.week && x.day === l.day && x.exercise && x.exercise.muscle !== "core";
    });
    const lastNonCore = after[after.length - 1];
    if (lastNonCore && lines.indexOf(lastNonCore) > i) {
      result.flags.push("Core work on " + l.day + " is not at the end of the session.");
    }
  });

  return result;
}

module.exports = {
  MAX_VIOLATIONS,
  MIN_REPS,
  MAX_REPS,
  MIN_WEEKLY_SETS,
  MAX_WEEKLY_SETS,
  MIN_SESSION_SETS,
  MAX_SESSION_SETS,
  readLine,
  walkLines,
  checkGymBlock,
};
