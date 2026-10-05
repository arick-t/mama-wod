/**
 * BUILDING A GYM BLOCK — one week in, six weeks out.
 *
 * THE FROZEN WEEK IS STRUCTURAL HERE, NOT INSTRUCTED. The first version of the contract asked
 * the brain to return six weeks and told it to make them identical. That was wrong twice over:
 * it paid output tokens for six copies of the same week, and it left room for the six to drift
 * from each other — which is exactly the failure the rule exists to prevent. So the brain now
 * returns ONE week and this file repeats it. A model cannot disobey a rule it is not asked to
 * follow.
 *
 * WHY THE WEEK REPEATS AT ALL. In the functional product each week is built on the one before
 * it. Here progressive overload means the SAME exercises getting heavier session by session, and
 * an athlete cannot get stronger at an exercise that keeps being swapped. Variety lives BETWEEN
 * blocks (gym layer 1, principle 3).
 *
 * THE DELOAD WEEK, when the intake asked for one, is the same week marked lighter. It is not a
 * different week and it is not an extra call: the sessions are the sessions, and the note on the
 * week says what to do with them.
 *
 * 0 LLM.
 */

"use strict";

const GymIntake = require("./gym-intake.js");
const Intake = require("./client-intake.js");

/**
 * WHAT A DELOAD WEEK ACTUALLY ASKS OF THE ATHLETE.
 *
 * The week was already marked `phase: "deload"` and the instruction was already written into
 * the week's summaryLine — and NOTHING IN THE PRODUCT DISPLAYS A WEEK'S summaryLine. So the
 * owner opened week 6, saw the tint, saw the same five sessions, and quite reasonably asked
 * whether the deload was a bug (2026-09-30). It was not a bug in the cadence; it was a week
 * that knew what it was and had no way to say so.
 *
 * It goes in the DAY, because the day is the thing anybody opens. Nothing here parses as a
 * set, so the check ignores it: a note is not work.
 */
const DELOAD_NOTE_ID = "deload-note";
const DELOAD_NOTE = {
  id: DELOAD_NOTE_ID,
  title: "Deload week",
  lines: [
    "Same sessions as every other week — lighter.",
    "Drop one set from every exercise.",
    "Take the effort down to 5-6/10. Nothing to failure this week.",
    "The weights stay where they were. Next week you pick them back up.",
  ],
};

/**
 * ONE WEEK OF THE BLOCK, with this week's note on each session.
 *
 * `progression` is carried on the part only to be spent here: index i is week i + 1. It is
 * written in as a LEADING LINE with noteLines:1, which is the shape the display already knows
 * — it draws those italic, in the note colour, and the check skips them because a note has no
 * sets. The array itself never reaches the stored week: a reader would see it twice.
 */
function weekDays(days, weekIndex0, deload) {
  const out = JSON.parse(JSON.stringify(days));
  DAY_KEYS.forEach(function (k) {
    const day = out[k];
    if (!day || !Array.isArray(day.parts)) return;
    day.parts.forEach(function (p) {
      const note = Array.isArray(p.progression) ? String(p.progression[weekIndex0] || "").trim() : "";
      delete p.progression;
      if (!note) return;
      p.lines = [note].concat(p.lines || []);
      p.noteLines = 1;
    });
  });
  return deload ? withDeloadNote(out) : out;
}

/** The deload note on every day that has work in it, and nowhere else. */
function withDeloadNote(days) {
  const out = JSON.parse(JSON.stringify(days));
  DAY_KEYS.forEach(function (k) {
    const day = out[k];
    if (!day || !Array.isArray(day.parts) || !day.parts.length) return;
    day.parts = [JSON.parse(JSON.stringify(DELOAD_NOTE))].concat(
      day.parts.filter(function (p) {
        return !p || p.id !== DELOAD_NOTE_ID;
      })
    );
  });
  return out;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Brace-match one JSON object from `start`, so trailing prose cannot break the parse. */
function sliceBalanced(text, start) {
  if (start < 0 || !text || text[start] !== "{") return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * The week the gym brain wrote, out of whatever it wrapped it in.
 *
 * Accepts the marker it was asked for and falls back to the first balanced object in the text,
 * because a provider that drops a closing marker has still done the work.
 */
function weekFromText(text) {
  const s = String(text || "");
  if (!s.trim()) return null;
  const marked = s.match(/<<<\s*WEEK_JSON\b([\s\S]*?)(?:WEEK_JSON\s*>>>|$)/i);
  const hunt = marked ? marked[1] : s;
  const raw = sliceBalanced(hunt, hunt.indexOf("{"));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isObj(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

/**
 * One day, cleaned — and forgiving about the shape it arrives in.
 *
 * The contract shows the exact keys, and a model still drifted from them on the very first real
 * generation: it returned `days` as an ARRAY of {day_name, parts:[{group, exercises}]} instead of
 * the keyed object with {title, lines}. The work was right — the right exercises, the right
 * loads, designed around the athlete's shoulder — and a stricter reader would have thrown all of
 * it away and charged for a retry. So the names below are accepted as synonyms. Being generous
 * here costs nothing; being strict costs a whole generation.
 */
function cleanDay(raw) {
  const d = isObj(raw) ? raw : {};
  const parts = Array.isArray(d.parts) ? d.parts : Array.isArray(d.exercises) ? [{ exercises: d.exercises }] : [];
  const out = [];
  parts.forEach(function (p, i) {
    if (!isObj(p)) return;
    const src = Array.isArray(p.lines) ? p.lines : Array.isArray(p.exercises) ? p.exercises : [];
    const lines = src
      .map(function (l) {
        /* A line may itself be an object in a drifted shape. Take the text out of it. */
        if (isObj(l)) return String(l.line || l.text || l.exercise || "").trim();
        return String(l == null ? "" : l).trim();
      })
      .filter(Boolean);
    const title = String(p.title || p.group || p.name || "").trim();
    if (!lines.length && !title) return;
    /* THE SIX NOTES, ONE PER WEEK, kept whole until the week they belong to is built.
       The sessions are identical every week on purpose; these lines are the only thing that
       tells the athlete week 3 is not week 1 (owner, 2026-10-05). Load and progression only —
       the contract forbids technique coaching here, because a human stands in the room. */
    const prog = (Array.isArray(p.progression) ? p.progression : [])
      .map(function (x) {
        return String(x == null ? "" : x).trim();
      })
      .filter(Boolean);
    out.push({
      id: String(p.id || "p" + (i + 1)),
      title: title,
      lines: lines,
      progression: prog,
    });
  });
  return { parts: out };
}

/** Which weekday a drifted day belongs to: its key, its name, or its number. */
const DAY_NAMES = {
  sunday: "sun", monday: "mon", tuesday: "tue", wednesday: "wed",
  thursday: "thu", friday: "fri", saturday: "sat",
};
function dayKeyOf(raw, fallbackIndex) {
  const d = isObj(raw) ? raw : {};
  const named = String(d.day || d.day_name || d.dayName || "").trim().toLowerCase();
  if (DAY_KEYS.indexOf(named) >= 0) return named;
  if (DAY_NAMES[named]) return DAY_NAMES[named];
  const n = parseInt(d.day_number || d.dayNumber, 10);
  if (n >= 1 && n <= 7) return DAY_KEYS[n - 1];
  return DAY_KEYS[fallbackIndex % 7];
}

/** The week's days as a keyed object, whichever way they arrived. */
function daysOf(week) {
  const raw = week && week.days;
  if (isObj(raw)) return raw;
  if (!Array.isArray(raw)) return {};
  const out = {};
  raw.forEach(function (d, i) {
    out[dayKeyOf(d, i)] = d;
  });
  return out;
}

/** Is this day a rest day? Nothing written in it is the only definition we need. */
function isRest(day) {
  return !day || !Array.isArray(day.parts) || !day.parts.length;
}

/**
 * Six weeks from one.
 *
 * @param {object} week the week the brain wrote
 * @param {object} [opts]
 * @param {object} [opts.answers] the gym questionnaire, for the deload cadence
 * @param {number} [opts.startWeek] this block's first week in the plan, 1-based
 * @returns {{ok:boolean, block?:object, why?:string}}
 */
function buildBlock(week, opts) {
  const o = isObj(opts) ? opts : {};
  const src = isObj(week) ? week : null;
  if (!src) return { ok: false, why: "no week came back" };

  const asKeyed = daysOf(src);
  const days = {};
  let written = 0;
  DAY_KEYS.forEach(function (k) {
    const day = cleanDay(asKeyed[k]);
    days[k] = day;
    if (!isRest(day)) written++;
  });
  if (!written) return { ok: false, why: "the week has no training day in it" };

  const answers = GymIntake.normalize(o.answers);
  const cadence = answers.deloadEveryWeeks;
  const startWeek = parseInt(o.startWeek, 10) > 0 ? parseInt(o.startWeek, 10) : 1;

  const weeks = [];
  for (let i = 0; i < GymIntake.BLOCK_WEEKS; i++) {
    /* The deload is counted on the ABSOLUTE week of the plan, the same way it is everywhere
       else in the product: a cadence that restarted every block would drift. */
    const absolute = startWeek + i;
    /* THE PRODUCT'S OWN RULE, not a second copy of it. This used to be `absolute % cadence`,
       which agrees with Intake.isDeloadWeek for a first block and DISAGREES the moment a
       previous block has already deloaded — the count runs from the last rest actually given,
       not from week one (owner, 2026-09-03). Two calculators meant the preview could paint a
       different week from the one the server then saved. */
    const deload = Intake.isDeloadWeek(
      { deloadWeek: cadence > 0, deloadEveryWeeks: cadence },
      absolute,
      parseInt(o.deloadSinceWeek, 10) || 0
    );
    weeks.push({
      weekIndex: i + 1,
      phase: deload ? "deload" : "build",
      theme: String(src.theme || "").slice(0, 200),
      summaryLine: deload
        ? "Deload week — the same sessions, lighter. Drop a set from each exercise and take the effort down to 5-6/10."
        : String(src.summaryLine || "").slice(0, 200),
      overview: DAY_KEYS.map(function (k) {
        const day = days[k];
        return {
          day: k,
          focus: isRest(day) ? "Rest" : String((day.parts[0] && day.parts[0].title) || "Session").slice(0, 80),
        };
      }),
      /* A fresh copy per week. Sharing one object would mean an edit to week 1 silently
         rewriting all six — which is how a "frozen" week becomes an unfixable one. */
      days: weekDays(days, i, deload),
    });
  }

  return {
    ok: true,
    block: {
      summaryLine: String(src.summaryLine || "").slice(0, 200) || "6-week gym block",
      weeks: weeks,
      gymBlock: true,
    },
  };
}

/** Everything in one step: the provider's text in, a stored-shaped block out. */
function blockFromText(text, opts) {
  const week = weekFromText(text);
  if (!week) return { ok: false, why: "could not read a week out of the answer" };
  return buildBlock(week, opts);
}

module.exports = {
  DAY_KEYS,
  DELOAD_NOTE,
  DELOAD_NOTE_ID,
  withDeloadNote,
  weekFromText,
  buildBlock,
  blockFromText,
};
