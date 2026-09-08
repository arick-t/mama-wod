/**
 * The handoff: last month, in a form the coach's brain can read in one breath.
 *
 * When a second block is written for an athlete, the brain has to know what the first
 * one actually did — or it writes the same month again. It used to be handed the
 * previous block as JSON (priorBlockStart, weeks[], coachPrefs…), which is both long
 * and hard to read; the brain asked for a compact TEXT summary instead, capped, in a
 * fixed layout (coach agent, 2026-09-08).
 *
 * The layout, verified against a real block at 1,130 characters:
 *
 *   PRIOR BLOCK 1 (absolute weeks 1-4) · deload was week 4 of that block
 *   W1 build · <theme> · <summary>
 *   W2 build · <theme> · <summary>
 *   W3 intensify · <theme> · <summary>
 *   W4 deload · <theme> · <summary>
 *   PROGRESSED: mon Back Squat Heavy Sets -> Front Squat Heavy Triples | tue …
 *   FORMATS USED: AMRAP, for time, quality sets, EMOM, work/rest intervals
 *   STANDING REQUESTS: no warm-up written | no 1RM figures reported, load by RPE
 *
 * Two traps the brain fell into building this, and the rules that come out of them:
 *
 *  1. A block can START MID-WEEK, so week 1 does not carry every day. Comparing week 1
 *     with the last week would report whole days as "did not progress" when the truth
 *     is that they did not exist yet. Each day is therefore compared from the FIRST
 *     week that carried it.
 *  2. PROGRESSED must not end at the DELOAD week. A comparison that ends there shows a
 *     block getting easier, which is the opposite of what it did. It ends at the last
 *     BUILD week, and the deload is reported once, in the title row.
 *
 * And a ceiling: under 4,000 characters. The server cuts at 12,000 without a word, so
 * this trims itself, longest part first, and says nothing it cannot fit.
 *
 * Browser: <script src="lib/coach-block-handoff.js"></script> → CoachBlockHandoff
 * Node: require("./coach-block-handoff")
 *
 * 0 LLM. No network. It reads a block and writes a paragraph.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CoachBlockHandoff = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  /* The brain's own ceiling. The server truncates at 12,000 silently, so this is well
     inside it and the trimming is ours to control. */
  const MAX_CHARS = 4000;

  /* Formats worth naming back to the brain: it uses the list to vary the next month
     rather than repeat it. Written as they should read in the line. */
  const FORMATS = [
    { label: "AMRAP", re: /\bamrap\b/i },
    { label: "EMOM", re: /\bemom\b/i },
    { label: "E2MOM", re: /\be2mom\b/i },
    { label: "for time", re: /\bfor time\b/i },
    { label: "chipper", re: /\bchipper\b/i },
    { label: "quality sets", re: /\bquality\b/i },
    { label: "work/rest intervals", re: /\bintervals?\b|\bwork\s*\/\s*rest\b/i },
    { label: "tabata", re: /\btabata\b/i },
    { label: "ladder", re: /\bladder\b/i },
    { label: "every minute", re: /\bevery\s+\d+\s*(?:min|minutes?)\b/i },
    { label: "max effort", re: /\bmax (?:effort|reps)\b/i },
  ];

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function str(v, max) {
    const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    return max ? s.slice(0, max) : s;
  }

  /** Is this day a rest day, or simply not written? Either way it carries nothing. */
  function dayCarriesWork(day) {
    const parts = isPlainObject(day) && Array.isArray(day.parts) ? day.parts : [];
    for (const p of parts) {
      if (!p) continue;
      const title = str(p.title);
      const lines = Array.isArray(p.lines) ? p.lines.join(" ") : "";
      const blob = (title + " " + lines).toLowerCase();
      if (!title && !lines.trim()) continue;
      if (/^(rest(\s*day)?|off(\s*day)?)\b/.test(blob.trim())) continue;
      return true;
    }
    return false;
  }

  /**
   * What that day was, in a few words: the heaviest thing it asked for.
   *
   * The first part's title is what the owner and the brain both call the session —
   * "Back Squat Heavy Sets" — and it is what a progression is read from.
   */
  function dayHeadline(day, week, dayKey) {
    const parts = isPlainObject(day) && Array.isArray(day.parts) ? day.parts : [];
    for (const p of parts) {
      const t = str(p && p.title, 60);
      if (t && !/^part\s+[a-z]$/i.test(t)) return t;
    }
    /* Nothing named: the week's own focus line for that day says what it was for. */
    const overview = isPlainObject(week) && Array.isArray(week.overview) ? week.overview : [];
    for (const o of overview) {
      if (o && o.day === dayKey) {
        const f = str(o.focus, 60);
        if (f && f !== "—") return f;
      }
    }
    /* Still nothing: the first line of work is better than silence. */
    for (const p of parts) {
      const lines = Array.isArray(p && p.lines) ? p.lines : [];
      for (const l of lines) {
        const s = str(l, 60);
        if (s) return s;
      }
    }
    return "";
  }

  function isDeloadWeek(week, index1, deloadWeekIndex) {
    if (deloadWeekIndex && index1 === (parseInt(deloadWeekIndex, 10) || 0)) return true;
    return String((week && week.phase) || "").toLowerCase() === "deload";
  }

  /** "build" / "intensify" / "deload" — the phase as the brain writes it. */
  function phaseOf(week, index1, deloadWeekIndex) {
    if (isDeloadWeek(week, index1, deloadWeekIndex)) return "deload";
    const p = str(week && week.phase, 20).toLowerCase();
    return p || "build";
  }

  /**
   * Every format the block actually used, in the order they first appeared.
   * @param {object[]} weeks
   */
  function formatsUsed(weeks) {
    const seen = {};
    const out = [];
    for (const w of Array.isArray(weeks) ? weeks : []) {
      const days = isPlainObject(w) && isPlainObject(w.days) ? w.days : {};
      for (const k of DAY_KEYS) {
        const parts = isPlainObject(days[k]) && Array.isArray(days[k].parts) ? days[k].parts : [];
        for (const p of parts) {
          const blob = str(p && p.title) + " " + (Array.isArray(p && p.lines) ? p.lines.join(" ") : "");
          for (const f of FORMATS) {
            if (seen[f.label]) continue;
            if (f.re.test(blob)) {
              seen[f.label] = true;
              out.push(f.label);
            }
          }
        }
      }
    }
    return out;
  }

  /**
   * What moved, day by day.
   *
   * From the FIRST week that carried the day to the LAST BUILD week that carried it —
   * see the two traps at the top of this file. A day whose headline never changed is
   * left out: the line is about movement, and listing everything that stayed the same
   * buries what did not.
   */
  function progressions(weeks, deloadWeekIndex) {
    const list = Array.isArray(weeks) ? weeks : [];
    const out = [];
    for (const k of DAY_KEYS) {
      let first = "";
      let last = "";
      for (let i = 0; i < list.length; i++) {
        const w = list[i] || {};
        const day = (isPlainObject(w.days) ? w.days : {})[k];
        if (!dayCarriesWork(day)) continue;
        const head = dayHeadline(day, w, k);
        if (!head) continue;
        if (!first) first = head;
        /* The deload week is not the end of a progression — it is a week off. */
        if (!isDeloadWeek(w, i + 1, deloadWeekIndex)) last = head;
      }
      if (!first || !last || first === last) continue;
      out.push(k + " " + first + " -> " + last);
    }
    return out;
  }

  /**
   * The things the athlete has asked for that outlive one block.
   *
   * Deterministic, from what is on file — never a guess about a person. Anything the
   * caller knows on top of these can be passed in and is kept as it is.
   */
  function standingRequests(opts) {
    const o = isPlainObject(opts) ? opts : {};
    const profile = isPlainObject(o.profile) ? o.profile : {};
    const out = [];
    const given = Array.isArray(o.standing) ? o.standing : [];
    for (const g of given) {
      const s = str(g, 120);
      if (s) out.push(s);
    }
    /* No numbers reported means the brain must load by feel, and it has to be told —
       otherwise it writes percentages of a 1RM nobody ever gave it. */
    const lifts = isPlainObject(profile.lifts) ? profile.lifts : {};
    const anyLift = Object.keys(lifts).some(function (k) {
      return parseFloat(lifts[k]) > 0;
    });
    if (!anyLift) out.push("no 1RM figures reported, load by RPE");
    /* A block written with no warm-up part is a standing decision, not an oversight. */
    if (o.warmupWritten === false) out.push("no warm-up written");
    const avoid = str(profile.avoidInProgram, 120);
    if (avoid) out.push("avoid: " + avoid);
    return out;
  }

  /** Did the block ever write a warm-up? Used by standingRequests. */
  function hasWarmup(weeks) {
    for (const w of Array.isArray(weeks) ? weeks : []) {
      const days = isPlainObject(w) && isPlainObject(w.days) ? w.days : {};
      for (const k of DAY_KEYS) {
        const parts = isPlainObject(days[k]) && Array.isArray(days[k].parts) ? days[k].parts : [];
        for (const p of parts) {
          const blob = str(p && p.title) + " " + (Array.isArray(p && p.lines) ? p.lines.join(" ") : "");
          if (/warm[\s-]?up|mobility|activation/i.test(blob)) return true;
        }
      }
    }
    return false;
  }

  /**
   * The handoff itself.
   *
   * @param {object} o
   * @param {object} o.block the block that was just finished — { weeks: [...] }
   * @param {number} o.blockIndex which block it was, 1-based
   * @param {number} o.startWeek its first week, counted from the start of the plan
   * @param {number} [o.deloadWeekIndex] which week of THAT block was the deload
   * @param {object} [o.profile] the athlete's profile, for the standing requests
   * @param {string[]} [o.standing] anything else that outlives the block
   * @returns {string} at most 4,000 characters, or "" when there is nothing to say
   */
  function buildHandoffText(o) {
    const src = isPlainObject(o) ? o : {};
    const block = isPlainObject(src.block) ? src.block : {};
    const weeks = Array.isArray(block.weeks) ? block.weeks : [];
    if (!weeks.length) return "";
    const blockIndex = Math.max(1, parseInt(src.blockIndex, 10) || 1);
    const startWeek = Math.max(1, parseInt(src.startWeek, 10) || 1);
    const endWeek = startWeek + weeks.length - 1;
    const deload = parseInt(src.deloadWeekIndex, 10) || 0;

    /* The title row: which block, where it sat in the plan, and where the deload was.
       The deload is reported HERE and nowhere else — see the second trap. */
    let deloadSays = "no deload in that block";
    let deloadFound = deload;
    if (!deloadFound) {
      for (let i = 0; i < weeks.length; i++) {
        if (String((weeks[i] || {}).phase || "").toLowerCase() === "deload") {
          deloadFound = i + 1;
          break;
        }
      }
    }
    if (deloadFound) deloadSays = "deload was week " + deloadFound + " of that block";

    const lines = [];
    lines.push(
      "PRIOR BLOCK " + blockIndex + " (absolute weeks " + startWeek + "-" + endWeek + ") · " + deloadSays
    );

    const weekLines = [];
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i] || {};
      /* "W1 build · theme · summary" — the week and its phase read as one word pair,
         exactly as the brain writes them (coach agent, 2026-09-08). */
      const head = "W" + (i + 1) + " " + phaseOf(w, i + 1, deloadFound);
      const bits = [head];
      const theme = str(w.theme, 90);
      const summary = str(w.summaryLine, 160);
      if (theme) bits.push(theme);
      if (summary) bits.push(summary);
      weekLines.push(bits.join(" · "));
    }

    const moved = progressions(weeks, deloadFound);
    const formats = formatsUsed(weeks);
    const standing = standingRequests({
      profile: src.profile,
      standing: src.standing,
      warmupWritten: hasWarmup(weeks),
    });

    /* Assembled longest-part-first so the trimming below has something to give up. */
    const body = weekLines.slice();
    if (moved.length) body.push("PROGRESSED: " + moved.join(" | "));
    if (formats.length) body.push("FORMATS USED: " + formats.join(", "));
    if (standing.length) body.push("STANDING REQUESTS: " + standing.join(" | "));

    let text = lines.concat(body).join("\n");
    if (text.length <= MAX_CHARS) return text;

    /* Over the ceiling. Give up detail in the order it can be spared: the week
       summaries first (the theme still says what the week was), then the progressions
       from the end, and never the title row. */
    const shortWeeks = [];
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i] || {};
      const bits = ["W" + (i + 1) + " " + phaseOf(w, i + 1, deloadFound)];
      const theme = str(w.theme, 60);
      if (theme) bits.push(theme);
      shortWeeks.push(bits.join(" · "));
    }
    const tail = [];
    if (moved.length) tail.push("PROGRESSED: " + moved.join(" | "));
    if (formats.length) tail.push("FORMATS USED: " + formats.join(", "));
    if (standing.length) tail.push("STANDING REQUESTS: " + standing.join(" | "));
    text = lines.concat(shortWeeks, tail).join("\n");
    while (text.length > MAX_CHARS && moved.length > 1) {
      moved.pop();
      const t2 = [];
      t2.push("PROGRESSED: " + moved.join(" | "));
      if (formats.length) t2.push("FORMATS USED: " + formats.join(", "));
      if (standing.length) t2.push("STANDING REQUESTS: " + standing.join(" | "));
      text = lines.concat(shortWeeks, t2).join("\n");
    }
    /* Still over: a hard cut on a line boundary, so the brain never reads half a fact. */
    if (text.length > MAX_CHARS) {
      const cut = text.slice(0, MAX_CHARS);
      const lastBreak = cut.lastIndexOf("\n");
      text = lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
    }
    return text;
  }

  return {
    DAY_KEYS,
    MAX_CHARS,
    FORMATS,
    buildHandoffText,
    progressions,
    formatsUsed,
    standingRequests,
    hasWarmup,
    dayHeadline,
    dayCarriesWork,
  };
});
