/**
 * WHAT THE LAST GYM BLOCK LEAVES FOR THE NEXT ONE.
 *
 * MEASURED, NOT NARRATED. The functional product learned this the hard way and the owner said
 * it plainly: a handoff that tells a story is a handoff a model can agree with and ignore.
 * Everything below is counted off the block that was actually delivered — which exercises,
 * how many sets each muscle got, which week the deload fell on, what the coach changed by
 * hand. No adjectives, no "the athlete did well".
 *
 * WHY A GYM BLOCK NEEDS ONE AT ALL, and why it is the OPPOSITE of the functional one.
 * Inside a block the exercises are frozen on purpose: progressive overload here means the
 * SAME movement getting heavier week after week, and nobody gets stronger at an exercise that
 * keeps being swapped (gym layer 1, principle 3). So the variety has to live BETWEEN blocks —
 * and the only way the next block can vary from the last is to be told what the last one was.
 * Without this, block two is a coin toss that lands on the same six exercises about as often
 * as not, and the athlete runs the same programme for twelve weeks.
 *
 * THE DELOAD IS A COUNT, NOT A HABIT. The cadence runs from the rest actually given, not from
 * week one of whichever block is being written, so the week the last deload fell on travels
 * with everything else. lib/gym-block-build.js and lib/client-intake.js both read it.
 *
 * 0 LLM. It counts.
 *
 * Browser: <script src="lib/gym-handoff.js"></script> → GymHandoff
 * Node: require("./gym-handoff.js")
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./gym-exercise-library.js"));
  } else {
    root.GymHandoff = factory(root.GymExerciseLibrary);
  }
})(typeof self !== "undefined" ? self : this, function (Library) {
"use strict";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/* Long enough to name every exercise of a six-day week twice over; short enough that it can
   never become the biggest thing in the request. */
const MAX_CHARS = 2200;

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** The sets at the front of a written line. A line we cannot count is not counted. */
function setsOf(line) {
  const m = String(line || "").trim().match(/^(\d{1,2})\s*[x×]/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** The exercise half of a line, for a human to read back. */
function nameOf(line) {
  return String(line || "")
    /* The unit only counts when it IS the word after the number. Without the boundary the
       "s" matched the S of "Seated" and the name came back as "eated Dumbbell Overhead
       Press" (2026-10-05). */
    .replace(/^\s*\d{1,2}\s*[x×]\s*\d{1,3}(?:\s*(?:s|sec|secs|seconds|min|minutes)\b)?\s*/i, "")
    .replace(/@\s*\d{1,2}\s*\/\s*10\s*$/, "")
    .trim();
}

/**
 * Every exercise the block prescribed, with the sets it carried and the muscle it trained.
 *
 * ONE WEEK IS THE WHOLE BLOCK — the six are identical by construction — so the first week
 * that has anything written in it is the one that is counted. Counting all six would report
 * every exercise six times and say nothing more.
 */
function exercisesOf(block) {
  const weeks = (isObj(block) && Array.isArray(block.weeks) ? block.weeks : []).filter(function (w) {
    return DAY_KEYS.some(function (d) {
      return (((w.days || {})[d] || {}).parts || []).length;
    });
  });
  const week = weeks[0];
  const out = [];
  if (!week) return out;
  DAY_KEYS.forEach(function (d) {
    const parts = ((week.days || {})[d] || {}).parts || [];
    parts.forEach(function (p) {
      (p.lines || []).forEach(function (line) {
        const sets = setsOf(line);
        const name = nameOf(line);
        if (!sets || !name) return;
        const known = Library && Library.find ? Library.find(line) : null;
        out.push({ day: d, name: name, sets: sets, muscle: known ? known.muscle : "" });
      });
    });
  });
  return out;
}

/** Sets per muscle across the week, so the next block can be told what was under-trained. */
function volumeOf(rows) {
  const per = {};
  rows.forEach(function (r) {
    if (!r.muscle) return;
    per[r.muscle] = (per[r.muscle] || 0) + r.sets;
  });
  return per;
}

/**
 * The absolute week the last deload fell on, 0 when there was none.
 *
 * Absolute, because the cadence is continuous across blocks: a count that restarted every
 * block would give an athlete two rests in a row, or none for months.
 */
function lastDeloadWeek(block, startWeek) {
  const weeks = isObj(block) && Array.isArray(block.weeks) ? block.weeks : [];
  const first = parseInt(startWeek, 10) > 0 ? parseInt(startWeek, 10) : 1;
  let last = 0;
  weeks.forEach(function (w, i) {
    if (w && w.phase === "deload") last = first + i;
  });
  return last;
}

/** Days the coach rewrote by hand. What a human changed is the strongest signal here. */
function coachEditedDays(block) {
  const weeks = isObj(block) && Array.isArray(block.weeks) ? block.weeks : [];
  const out = [];
  weeks.forEach(function (w, i) {
    DAY_KEYS.forEach(function (d) {
      const day = (w.days || {})[d] || {};
      if (day.ownerEdited === true || day.modified === true) out.push("W" + (i + 1) + " " + d);
    });
  });
  return out;
}

/**
 * The handoff, as an object the request carries and a human can read.
 *
 * @param {object} o
 * @param {object} o.block the block that was delivered
 * @param {number} [o.startWeek] the absolute week that block began on
 * @param {object} [o.answers] the questionnaire, for the split this athlete is on
 * @returns {{ok:boolean, handoff?:object, why?:string}}
 */
function handoffFrom(o) {
  const src = isObj(o) ? o : {};
  const block = isObj(src.block) ? src.block : null;
  if (!block) return { ok: false, why: "there is no previous block to carry forward" };
  const rows = exercisesOf(block);
  if (!rows.length) return { ok: false, why: "the previous block has nothing written in it" };

  const startWeek = parseInt(src.startWeek, 10) > 0 ? parseInt(src.startWeek, 10) : 1;
  const weeks = (block.weeks || []).length;
  return {
    ok: true,
    handoff: {
      blocksDone: 1,
      weeksDone: weeks,
      /* Where the NEXT block starts counting, so the deload lands where the cadence says. */
      nextStartWeek: startWeek + weeks,
      lastDeloadWeek: lastDeloadWeek(block, startWeek),
      split: String((src.answers && src.answers.split) || ""),
      exercises: rows.map(function (r) {
        return { day: r.day, name: r.name, sets: r.sets, muscle: r.muscle };
      }),
      weeklySets: volumeOf(rows),
      coachEdited: coachEditedDays(block),
    },
  };
}

/**
 * The same thing in words, for the brain.
 *
 * It names the exercises TO BE CHANGED and the volume to be corrected, and says nothing about
 * how the athlete felt — nobody measured that, so nobody may claim it.
 */
function handoffText(handoff) {
  const h = isObj(handoff) ? handoff : null;
  if (!h) return "";
  const lines = [];
  lines.push("=== WHAT CAME BEFORE (measured off the block just finished) ===");
  lines.push(
    "The athlete has trained " + (h.weeksDone || 0) + " weeks on this programme. This block is " +
      "weeks " + (h.nextStartWeek || 1) + " onward."
  );
  if (h.lastDeloadWeek) {
    lines.push("The last deload fell on week " + h.lastDeloadWeek + ". The cadence continues from there, not from week one.");
  } else {
    lines.push("No deload has been given yet.");
  }
  const names = (h.exercises || []).map(function (e) {
    return e.name;
  });
  if (names.length) {
    lines.push("");
    lines.push("EXERCISES ALREADY USED — change most of them:");
    lines.push("  " + names.join(" · "));
    lines.push(
      "Inside a block the movements are frozen so the load can rise on them. Between blocks " +
        "they CHANGE: keep the structure and the split, and pick different variations of the " +
        "same patterns. An athlete who runs the same six exercises for three months stops " +
        "adapting to them."
    );
  }
  const vol = h.weeklySets || {};
  const low = Object.keys(vol).filter(function (m) {
    return vol[m] > 0 && vol[m] < 10;
  });
  if (low.length) {
    lines.push("");
    lines.push(
      "UNDER TEN SETS A WEEK LAST BLOCK: " +
        low.map(function (m) {
          return m + " (" + vol[m] + ")";
        }).join(", ") +
        ". Bring these up this time if the split allows it."
    );
  }
  if ((h.coachEdited || []).length) {
    lines.push("");
    lines.push(
      "THE COACH REWROTE THESE DAYS BY HAND: " + h.coachEdited.join(", ") +
        ". He had a reason. Whatever he changed them to is the better guide to this athlete " +
        "than what was written for them."
    );
  }
  return lines.join("\n").slice(0, MAX_CHARS);
}

return {
  DAY_KEYS,
  MAX_CHARS,
  setsOf,
  nameOf,
  exercisesOf,
  volumeOf,
  lastDeloadWeek,
  coachEditedDays,
  handoffFrom,
  handoffText,
};
});
