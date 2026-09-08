/**
 * Four calls, in order: how a whole block actually gets written.
 *
 * One `generate_block` does NOT return a full month, and that is by design rather than
 * by accident (coach agent, 2026-09-08): a single full seven-day week is ~8,000 output
 * tokens, so four of them in one answer is what used to cut a block mid-JSON. The
 * server's own instruction says weeks 2–4 come back as headers — theme, phase,
 * summaryLine and a seven-day overview — with `days` left empty, to be filled by
 * `generate_week_detail`. Nobody was making those calls, so every athlete had one week
 * of training and three empty ones.
 *
 * The brain has NO MEMORY. Each call starts from zero and knows only what it is given,
 * so whoever holds the programme is the only one who can feed it forward. That is this
 * file's whole job:
 *
 *   generate_block            → week 1, saved and shown at once
 *   generate_week_detail w=2  → saved and shown when it lands
 *   generate_week_detail w=3  → saved and shown when it lands
 *   generate_week_detail w=4  → the block is whole
 *
 * Four rules, and each one is a correctness rule rather than a preference:
 *
 *  1. SERIAL, never parallel. Firing the three together is tempting and wrong: each
 *     call would see only week 1, all three would reach the same conclusions, and the
 *     variety between weeks comes from each one seeing the ones before it.
 *  2. `priorWeeks` carries the FULL weeks, unshortened. The server compacts them itself
 *     into per-day movement and format inventories without weights — shortening them
 *     here would take the variety away.
 *  3. Save and render each week as it lands. The owner asked for the table after week
 *     one, then each week appearing as it is ready. Same calls, same cost.
 *  4. Resume from the point of failure, running only what is missing — both because a
 *     rebuild costs money and because it would rewrite weeks he has already approved.
 *
 * Browser: <script src="lib/coach-week-fill-plan.js"></script> → CoachWeekFillPlan
 * Node: require("./coach-week-fill-plan")
 *
 * 0 LLM in this file. It decides what to ask for; it never asks.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CoachWeekFillPlan = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  /** Does this day hold anything at all? A written part is a written part. */
  function dayIsWritten(day) {
    const parts = isPlainObject(day) && Array.isArray(day.parts) ? day.parts : [];
    for (const p of parts) {
      const title = String((p && p.title) || "").trim();
      const lines = Array.isArray(p && p.lines) ? p.lines.join(" ").trim() : "";
      if (title || lines) return true;
    }
    return false;
  }

  /**
   * A week is written when at least ONE of its days holds something.
   *
   * Deliberately not "every day": a rest day is legitimately `parts: []` with only a
   * focus line, and a week of one training day and six rests is a real week. What this
   * separates is the HEADER the block comes back with — theme, phase, summaryLine and a
   * seven-day overview, with `days` empty — from a week that has actually been filled.
   *
   * The overview is no help here: a header carries a full seven-day overview, rest
   * lines included. Reading "Rest" there as "written" made every empty week look
   * finished, which is the bug this whole file exists to fix.
   */
  function weekIsWritten(week) {
    if (!isPlainObject(week)) return false;
    const days = isPlainObject(week.days) ? week.days : {};
    for (const k of DAY_KEYS) {
      if (dayIsWritten(days[k])) return true;
    }
    return false;
  }

  /**
   * Which weeks still need filling, in the order they must be asked for.
   *
   * 1-based, because every week number the owner and the brain say out loud is 1-based.
   * The order is the plan: week 2 before week 3 before week 4, always.
   */
  function missingWeeks(block) {
    const weeks = isPlainObject(block) && Array.isArray(block.weeks) ? block.weeks : [];
    const out = [];
    for (let i = 0; i < weeks.length; i++) {
      if (!weekIsWritten(weeks[i])) out.push(i + 1);
    }
    return out;
  }

  /** The weeks already written, as FULL objects — see rule 2. */
  function priorWeeksFor(block, weekIndex1) {
    const weeks = isPlainObject(block) && Array.isArray(block.weeks) ? block.weeks : [];
    const out = [];
    for (let i = 0; i < weeks.length && i < weekIndex1 - 1; i++) {
      if (weekIsWritten(weeks[i])) out.push(weeks[i]);
    }
    return out;
  }

  /**
   * The body of one week-fill request, exactly as the brain asked for it.
   *
   * @param {object} o
   * @param {object} o.block the block that came back from generate_block
   * @param {number} o.weekIndex which week to fill, 1-based
   * @param {object} o.athleteProfile the SAME profile that was sent to generate_block
   * @param {object} [o.studioIntake] a room only — its presence decides "this is a studio"
   * @param {number} [o.blockStartWeek] where this block sits in the plan
   * @returns {object|null} the request body, or null when there is nothing to ask
   */
  function weekFillBody(o) {
    const src = isPlainObject(o) ? o : {};
    const block = isPlainObject(src.block) ? src.block : null;
    const wi = parseInt(src.weekIndex, 10);
    if (!block || !(wi >= 1)) return null;
    const week = (Array.isArray(block.weeks) ? block.weeks : [])[wi - 1];
    if (!isPlainObject(week)) return null;

    const body = {
      action: "generate_week_detail",
      intakeComplete: true,
      athleteProfile: src.athleteProfile,
      weekIndex: wi,
      /* The header the block itself came back with — this is what makes the filled week
         the week that was planned, rather than a new idea. */
      theme: String(week.theme || ""),
      phase: String(week.phase || ""),
      summaryLine: String(week.summaryLine || ""),
      overview: Array.isArray(week.overview) ? week.overview.slice(0, 7) : [],
      priorWeeks: priorWeeksFor(block, wi),
      forceJson: true,
    };
    /* A room only. Its presence is the decision, so it is never sent empty. */
    if (isPlainObject(src.studioIntake)) body.studioIntake = src.studioIntake;
    const startWeek = parseInt(src.blockStartWeek, 10);
    if (startWeek >= 1) body.blockStartWeek = startWeek;
    if (src.athleteId) body.athleteId = String(src.athleteId);
    if (isPlainObject(src.costCaps)) body.costCaps = src.costCaps;
    return body;
  }

  /**
   * Put a returned week into the block.
   *
   * The header stays the block's own: the brain was asked to fill the week that was
   * planned, and if it answers with a different theme the plan is what counts. Only the
   * days — and the overview, which is the day map — come from the answer.
   *
   * @returns {{ok:boolean, block?:object, error?:string}}
   */
  function applyWeek(block, week) {
    if (!isPlainObject(block) || !Array.isArray(block.weeks)) {
      return { ok: false, error: "no block to fill" };
    }
    if (!isPlainObject(week)) return { ok: false, error: "no week came back" };
    const wi = parseInt(week.weekIndex, 10);
    if (!(wi >= 1) || wi > block.weeks.length) return { ok: false, error: "that week is not in this block" };
    const days = isPlainObject(week.days) ? week.days : null;
    if (!days) return { ok: false, error: "the week came back with no days" };

    let next;
    try {
      next = JSON.parse(JSON.stringify(block));
    } catch (e) {
      return { ok: false, error: "block is not copyable" };
    }
    const target = next.weeks[wi - 1] || {};
    const filled = {};
    for (const k of DAY_KEYS) {
      filled[k] = isPlainObject(days[k]) ? days[k] : { parts: [] };
    }
    target.days = filled;
    if (Array.isArray(week.overview) && week.overview.length) {
      target.overview = week.overview.slice(0, 7);
    }
    /* Kept from the plan, not from the answer — see the note above. */
    target.weekIndex = wi;
    target.phase = String(target.phase || week.phase || "");
    target.theme = String(target.theme || week.theme || "");
    target.summaryLine = String(target.summaryLine || week.summaryLine || "");
    next.weeks[wi - 1] = target;
    return { ok: true, block: next };
  }

  /**
   * Where the build is, in one sentence he can read at a glance.
   *
   * "בונה שבוע 3 מתוך 4" — never a spinner with no number: a full block is two to four
   * minutes, and a bar with no count reads as stuck (coach agent, 2026-09-08).
   */
  function progressText(o) {
    const src = isPlainObject(o) ? o : {};
    const total = Math.max(1, parseInt(src.total, 10) || 1);
    const now = parseInt(src.week, 10) || 0;
    if (src.done === true) return "הלבנה שלמה · " + total + " שבועות";
    if (!now) return "בונה את השבוע הראשון…";
    return "בונה שבוע " + now + " מתוך " + total + "…";
  }

  /** How many of the block's weeks are written, for the same sentence. */
  function writtenCount(block) {
    const weeks = isPlainObject(block) && Array.isArray(block.weeks) ? block.weeks : [];
    let n = 0;
    for (const w of weeks) if (weekIsWritten(w)) n += 1;
    return n;
  }

  /**
   * The plan, in one object: what is done, what is next, and what is left.
   *
   * This is what a "continue" button reads — it never restarts, it asks for what is
   * missing (rule 4).
   */
  function planFor(block) {
    const weeks = isPlainObject(block) && Array.isArray(block.weeks) ? block.weeks : [];
    const missing = missingWeeks(block);
    return {
      total: weeks.length,
      written: writtenCount(block),
      missing: missing,
      next: missing.length ? missing[0] : 0,
      done: weeks.length > 0 && missing.length === 0,
    };
  }

  return {
    DAY_KEYS,
    dayIsWritten,
    weekIsWritten,
    missingWeeks,
    priorWeeksFor,
    weekFillBody,
    applyWeek,
    progressText,
    writtenCount,
    planFor,
  };
});
