/**
 * Turning a rest day into a session, and a session into a rest day (21.7).
 *
 * This looks like it should be one line — set the parts and be done. It is not, and
 * the reason is easy to miss:
 *
 *   isPprogRestDay() decides a day is REST from the WEEK OVERVIEW FOCUS first
 *   (lib/normalize-pprog-block.js), before it ever looks at that day's parts.
 *
 * So writing a session into a day whose overview still says "Rest" produces a day
 * that holds a real workout and still renders as a rest day — an edit that appears
 * to save and then appears to have done nothing. Both directions therefore have to
 * move the overview focus AND the parts, together, or neither.
 *
 * That is the whole job of this module, and why it exists rather than being inlined
 * at three call sites that would each get it subtly wrong.
 *
 * 0 LLM.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DayRestToggle = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  /* The shape the rest of the codebase already recognises as rest. */
  var REST_TITLE = "REST DAY";
  var REST_LINE = "Rest";
  var REST_FOCUS = "Rest";

  /* What an overview focus says when a day becomes a session again. Deliberately
     generic: the owner writes the real focus, we only stop it saying "Rest". */
  var DEFAULT_TRAINING_FOCUS = "Training";

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function restPartsFor(dayKey) {
    var k = String(dayKey || "day").slice(0, 12);
    return [{ id: k + "-rest", title: REST_TITLE, lines: [REST_LINE] }];
  }

  /** True when these parts are nothing but a rest marker. */
  function partsAreRest(parts) {
    if (!Array.isArray(parts) || !parts.length) return true;
    if (parts.length > 1) return false;
    var p = parts[0] || {};
    var blob = (String(p.title || "") + " " + (Array.isArray(p.lines) ? p.lines.join(" ") : "")).toLowerCase().trim();
    return /^(rest(\s*day)?|off(\s*day)?)\b/.test(blob) || blob === "";
  }

  function isRestFocusText(focus) {
    var f = String(focus || "").toLowerCase().trim();
    return f === "" || /^(rest|rest\s*day|off|off\s*day|מנוחה)$/.test(f);
  }

  function ensureOverview(week) {
    if (!Array.isArray(week.overview)) week.overview = [];
    DAY_KEYS.forEach(function (k) {
      var found = null;
      for (var i = 0; i < week.overview.length; i++) {
        if (week.overview[i] && week.overview[i].day === k) {
          found = week.overview[i];
          break;
        }
      }
      if (!found) week.overview.push({ day: k, focus: "" });
    });
    return week;
  }

  function setOverviewFocus(week, dayKey, focus) {
    ensureOverview(week);
    for (var i = 0; i < week.overview.length; i++) {
      if (week.overview[i] && week.overview[i].day === dayKey) {
        week.overview[i].focus = String(focus == null ? "" : focus).slice(0, 120);
        return;
      }
    }
  }

  function overviewFocus(week, dayKey) {
    if (!isPlainObject(week) || !Array.isArray(week.overview)) return "";
    for (var i = 0; i < week.overview.length; i++) {
      if (week.overview[i] && week.overview[i].day === dayKey) {
        return String(week.overview[i].focus || "");
      }
    }
    return "";
  }

  /**
   * Read whether a day currently reads as rest — the same way the renderer will.
   * Overview first, exactly like isPprogRestDay.
   */
  function dayIsRest(week, dayKey) {
    if (!isPlainObject(week)) return true;
    if (isRestFocusText(overviewFocus(week, dayKey))) {
      var day = (week.days || {})[dayKey];
      /* An overview that says Rest while the day holds a real session means someone
         wrote parts without moving the focus. Trust the parts — that is the bug this
         module exists to prevent, and reporting it as rest would hide it. */
      if (day && !partsAreRest(day.parts)) return false;
      return true;
    }
    return false;
  }

  /**
   * Make a day a REST day: canonical rest parts AND a Rest overview focus.
   * @param {object} week mutated in place
   */
  function makeRest(week, dayKey) {
    if (!isPlainObject(week) || DAY_KEYS.indexOf(dayKey) < 0) return week;
    if (!isPlainObject(week.days)) week.days = {};
    week.days[dayKey] = { parts: restPartsFor(dayKey) };
    setOverviewFocus(week, dayKey, REST_FOCUS);
    return week;
  }

  /**
   * Make a day a SESSION: the given parts AND an overview focus that is not "Rest".
   * Without the focus change the day would keep rendering as rest.
   * @param {object} week mutated in place
   * @param {string} dayKey
   * @param {Array} parts
   * @param {string} [focus] optional focus label; a sensible one is derived otherwise
   */
  function makeSession(week, dayKey, parts, focus) {
    if (!isPlainObject(week) || DAY_KEYS.indexOf(dayKey) < 0) return week;
    if (!isPlainObject(week.days)) week.days = {};
    var list = Array.isArray(parts) ? parts : [];
    week.days[dayKey] = { parts: list };

    var wanted = String(focus == null ? "" : focus).trim();
    if (!wanted) {
      /* Prefer the first part's title over a generic word — it is what the owner
         actually wrote, and it is what shows in the calendar. */
      var firstTitle = list.length ? String((list[0] || {}).title || "").trim() : "";
      wanted = firstTitle || DEFAULT_TRAINING_FOCUS;
    }
    /* Guard the whole point of this module: never leave a session labelled Rest. */
    if (isRestFocusText(wanted)) wanted = DEFAULT_TRAINING_FOCUS;
    setOverviewFocus(week, dayKey, wanted);

    /* The overview is not the only rest test. isPprogRestDay ALSO reads a single
     * part whose text begins with a rest word — so a session whose one part happens
     * to be titled "Rest" collapses straight back into a rest day, focus or no focus.
     *
     * Retitle only that title, never the lines: the owner's actual programming is
     * untouched, and the postcondition of this function ("the renderer will call this
     * a session") is kept rather than merely intended. */
    if (list.length === 1) {
      var only = list[0] || {};
      var titleReadsRest = isRestFocusText(String(only.title || ""));
      var hasRealLines = Array.isArray(only.lines) && only.lines.some(function (ln) {
        return String(ln || "").trim() && !isRestFocusText(ln);
      });
      if (titleReadsRest && hasRealLines) only.title = wanted;
    }
    return week;
  }

  /** One entry point for both directions. */
  function setDayRest(week, dayKey, isRest, parts, focus) {
    return isRest === true ? makeRest(week, dayKey) : makeSession(week, dayKey, parts, focus);
  }

  return {
    DAY_KEYS: DAY_KEYS,
    REST_TITLE: REST_TITLE,
    REST_LINE: REST_LINE,
    REST_FOCUS: REST_FOCUS,
    DEFAULT_TRAINING_FOCUS: DEFAULT_TRAINING_FOCUS,
    restPartsFor: restPartsFor,
    partsAreRest: partsAreRest,
    isRestFocusText: isRestFocusText,
    overviewFocus: overviewFocus,
    setOverviewFocus: setOverviewFocus,
    dayIsRest: dayIsRest,
    makeRest: makeRest,
    makeSession: makeSession,
    setDayRest: setDayRest,
  };
});
