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

/** One day, cleaned. A day with nothing in it is a Rest day and says so. */
function cleanDay(raw) {
  const d = isObj(raw) ? raw : {};
  const parts = Array.isArray(d.parts) ? d.parts : [];
  const out = [];
  parts.forEach(function (p, i) {
    if (!isObj(p)) return;
    const lines = (Array.isArray(p.lines) ? p.lines : [])
      .map(function (l) {
        return String(l == null ? "" : l).trim();
      })
      .filter(Boolean);
    const title = String(p.title || "").trim();
    if (!lines.length && !title) return;
    out.push({ id: String(p.id || "p" + (i + 1)), title: title, lines: lines });
  });
  return { parts: out };
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

  const days = {};
  let written = 0;
  DAY_KEYS.forEach(function (k) {
    const day = cleanDay((src.days || {})[k]);
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
    const deload = cadence > 0 && absolute % cadence === 0;
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
      days: JSON.parse(JSON.stringify(days)),
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
  weekFromText,
  buildBlock,
  blockFromText,
};
