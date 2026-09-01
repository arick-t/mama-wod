/**
 * Cross-cutting intake for a coach / studio client (checklist 2.b).
 *
 * A brick written for a room full of people cannot be built from one person's
 * numbers. The athlete intake asks for age, bodyweight, 1RMs, named skills and
 * injuries — every one of those is meaningless when the same session is delivered to
 * a mixed group. So this is a different questionnaire, not a trimmed one: what the
 * PLACE has, when it trains, whether a deload belongs in the plan, who trains there,
 * and what they are training for.
 *
 * Five tabs, and deliberately nothing about an individual's capability (2.c).
 *
 * UMD: admin-clients.html loads this directly, and the server validates against the
 * same file — one definition of the questionnaire, no drift.
 *
 * 0 LLM.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CLIENT_INTAKE = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_LABELS = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };

  /* Exactly two choices, as specified. "Well equipped" needs no elaboration; anything
     else is a free description, because a half-equipped room is not a checklist. */
  var EQUIPMENT_OPTIONS = [
    { id: "functional_gym", label: "Well-equipped functional training gym", needsDetail: false },
    { id: "other", label: "OTHER", needsDetail: true },
  ];

  /* Two ways a place trains, and they change the shape of the plan, not just a field:
     - weekly_schedule → sessions are pinned to weekdays, Sun–Sat as everywhere else
     - session_count   → N sessions per week with no weekday at all; the coach decides
                         when to run them */
  var SCHEDULE_MODES = [
    { id: "session_count", label: "Number of sessions" },
    { id: "weekly_schedule", label: "Weekly schedule" },
  ];

  /* The deload used to be its own step. It is one checkbox and it IS part of the
     schedule, so a whole tab for it only added a click. Folded into "schedule". */
  /* Population and Goals were two tabs saying nearly the same thing about the same
     room, and the owner merged them on 2026-09-01: one tab, a session length, and one
     box for who they are, what limits them and what they are training for. */
  var TABS = [
    { id: "profile", label: "Client & payment" },
    { id: "equipment", label: "Equipment" },
    { id: "schedule", label: "Schedule" },
    { id: "population", label: "Population & limits" },
  ];

  /* A session with no length is a guess with a stopwatch attached, so it is asked for
     and refused when missing — the same rule as the session count and the deload.
     The range is the owner's. */
  var MIN_SESSION_MINUTES = 20;
  var MAX_SESSION_MINUTES = 120;

  var MAX_SESSIONS_PER_WEEK = 14;
  /* The product is sold BY THE MONTH, and a month of programming is four weeks. The
     deload is therefore not "the last week of the block" — it is a CADENCE that keeps
     counting across month boundaries. Set it to 5 and month one is four build weeks,
     while month two OPENS on the deload (owner, 2026-09-01). The module has to
     remember where in the cycle it is; a counter that resets every month would put a
     deload every fourth week no matter what was asked for.
     Four is the floor, on the owner's professional call: three build weeks and a
     deload is the leanest cycle that still trains anything. */
  var WEEKS_PER_MONTH = 4;
  var MIN_DELOAD_EVERY = 4;
  var MAX_DELOAD_EVERY = 12;
  var TEXT_MAX = 2000;

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function clampText(v, max) {
    return String(v == null ? "" : v).slice(0, max || TEXT_MAX);
  }

  function emptyIntake() {
    return {
      clientName: "",
      monthlyAmount: 0,
      paymentMethod: "",
      equipment: "functional_gym",
      equipmentOther: "",

      /* --- how the place trains -------------------------------------------
       * Two shapes, and they are genuinely different plans rather than a field:
       *
       *  session_count   — N sessions a week with NO weekday attached. The coach
       *                    decides when to run them. Optionally the sessions differ
       *                    from one another, in which case each gets a character.
       *  weekly_schedule — sessions sit on weekdays. Optionally rest days are part of
       *                    the plan, and optionally specific weekdays carry a standing
       *                    note ("Fridays are partner workouts").
       * ------------------------------------------------------------------ */
      /* "" = not answered. The Schedule tab opens with nothing ticked (owner,
         2026-09-01), and defaulting to a mode he did not pick is how a studio gets a
         weekday plan when it asked for a session count. validateIntake blocks instead. */
      scheduleMode: "",
      /* 0 = not answered yet. The box starts empty on purpose: guessing "3" for a
         paying client's program is exactly the kind of quiet default that ships a
         wrong plan. validateIntake refuses to build until it is filled. */
      sessionsPerWeek: 0,
      /* false = the sessions are interchangeable — a standard CrossFit week. */
      sessionsDiffer: false,
      /* One character per session, only when they differ. Index 0 = session 1. */
      sessionTypes: [],

      /* Default NO, on the owner's instruction: rest days are the coach's call
         unless the plan is meant to carry them. */
      includeRestDays: false,
      /* WHICH days are the rest days. Asking "include rest days?" without asking which
         ones leaves the decision to whoever fills the calendar, and for a studio that
         trains Sunday to Thursday that is a guess with a schedule attached. */
      restDays: DAY_KEYS.reduce(function (acc, k) {
        acc[k] = false;
        return acc;
      }, {}),
      /* Standing, repeating emphasis per weekday — not a one-off note. */
      dayEmphasisEnabled: false,
      dayEmphasis: DAY_KEYS.reduce(function (acc, k) {
        acc[k] = "";
        return acc;
      }, {}),

      /* Default NO: four-week blocks back to back, no deload (owner's default). */
      deloadWeek: false,
      /* The cadence: a deload on this week and every N weeks after it, counted from
         the program's first week and never reset by a new month. 0 = the owner has
         not said yet, and validateIntake refuses to build rather than guessing. */
      deloadEveryWeeks: 0,
      /* Minutes per session, including the warm-up. 0 = not answered yet. */
      sessionMinutes: 0,
      population: "",
      /* Kept in the shape so an existing client's goals text is never lost: the form
         folds it into the population box the first time the tab is opened. Nothing
         writes it any more. */
      goals: "",
    };
  }

  function normalizeIntake(raw) {
    var r = isPlainObject(raw) ? raw : {};
    var out = emptyIntake();

    out.clientName = clampText(r.clientName, 120);
    var amt = Number(r.monthlyAmount);
    out.monthlyAmount = Number.isFinite(amt) && amt >= 0 ? Math.round(amt) : 0;
    out.paymentMethod = clampText(r.paymentMethod, 200);

    out.equipment = r.equipment === "other" ? "other" : "functional_gym";
    out.equipmentOther = out.equipment === "other" ? clampText(r.equipmentOther, TEXT_MAX) : "";

    out.scheduleMode =
      r.scheduleMode === "weekly_schedule" || r.scheduleMode === "session_count"
        ? r.scheduleMode
        : "";
    var n = parseInt(r.sessionsPerWeek, 10);
    out.sessionsPerWeek = Number.isFinite(n) && n >= 1 && n <= MAX_SESSIONS_PER_WEEK ? n : 0;

    /* Each mode's answers are dropped when it is not the chosen one, so a switch
       cannot leave contradictory answers behind — and with no mode chosen, neither
       branch's answers are kept at all. */
    if (out.scheduleMode === "session_count") {
      out.sessionsDiffer = r.sessionsDiffer === true;
      if (out.sessionsDiffer) {
        var types = Array.isArray(r.sessionTypes) ? r.sessionTypes : [];
        out.sessionTypes = [];
        for (var i = 0; i < out.sessionsPerWeek; i++) {
          out.sessionTypes.push(clampText(types[i], 200));
        }
      } else {
        out.sessionTypes = [];
      }
      out.includeRestDays = false;
      out.dayEmphasisEnabled = false;
    } else if (out.scheduleMode === "weekly_schedule") {
      out.sessionsDiffer = false;
      out.sessionTypes = [];
      out.sessionsPerWeek = 0;
      out.includeRestDays = r.includeRestDays === true;
      if (out.includeRestDays) {
        var rd = isPlainObject(r.restDays) ? r.restDays : {};
        DAY_KEYS.forEach(function (k) {
          out.restDays[k] = rd[k] === true;
        });
      }
      out.dayEmphasisEnabled = r.dayEmphasisEnabled === true;
      if (out.dayEmphasisEnabled) {
        var em = isPlainObject(r.dayEmphasis) ? r.dayEmphasis : {};
        DAY_KEYS.forEach(function (k) {
          out.dayEmphasis[k] = clampText(em[k], 400);
        });
      }
    } else {
      /* No mode chosen: hold nothing from either branch. */
      out.sessionsDiffer = false;
      out.sessionTypes = [];
      out.sessionsPerWeek = 0;
      out.includeRestDays = false;
      out.dayEmphasisEnabled = false;
    }

    out.deloadWeek = r.deloadWeek === true;
    var dl = parseInt(r.deloadEveryWeeks, 10);
    out.deloadEveryWeeks =
      out.deloadWeek && Number.isFinite(dl) && dl >= MIN_DELOAD_EVERY && dl <= MAX_DELOAD_EVERY
        ? dl
        : 0;
    var mins = parseInt(r.sessionMinutes, 10);
    out.sessionMinutes =
      Number.isFinite(mins) && mins >= MIN_SESSION_MINUTES && mins <= MAX_SESSION_MINUTES ? mins : 0;
    out.population = clampText(r.population, TEXT_MAX);
    out.goals = clampText(r.goals, TEXT_MAX);
    return out;
  }

  /**
   * What must be filled before a program can be built. Kept short on purpose: the
   * owner is the one answering, and a form that nags is a form that gets faked.
   * @returns {string[]} human-readable problems, empty when ready
   */
  function validateIntake(raw) {
    var v = normalizeIntake(raw);
    var problems = [];
    if (!v.clientName.trim()) problems.push("A client name is required.");
    if (v.equipment === "other" && !v.equipmentOther.trim()) {
      problems.push("Equipment is set to OTHER — describe what the place actually has.");
    }
    if (!v.scheduleMode) {
      problems.push("Pick how the place trains: a weekly session count, or a full weekly plan.");
    }
    if (v.scheduleMode === "session_count" && v.sessionsPerWeek < 1) {
      problems.push("How many sessions per week? The box is empty.");
    }
    if (v.scheduleMode === "session_count" && v.sessionsDiffer) {
      var described = v.sessionTypes.filter(function (t) {
        return t.trim();
      });
      if (described.length !== v.sessionsPerWeek) {
        problems.push(
          "The sessions differ — describe each one (" +
            described.length +
            " of " +
            v.sessionsPerWeek +
            " filled)."
        );
      }
    }
    if (v.scheduleMode === "weekly_schedule" && v.includeRestDays) {
      var restPicked = DAY_KEYS.filter(function (k) {
        return v.restDays[k];
      });
      if (!restPicked.length) {
        problems.push("Rest days are part of the plan — tick which days they are, or turn it off.");
      }
      if (restPicked.length === DAY_KEYS.length) {
        problems.push("Every day is marked as rest. Leave at least one training day.");
      }
    }
    if (v.scheduleMode === "weekly_schedule" && v.dayEmphasisEnabled) {
      var noted = DAY_KEYS.filter(function (k) {
        return v.dayEmphasis[k].trim();
      });
      if (!noted.length) {
        problems.push("Day emphases are on — write a note on at least one day, or turn it off.");
      }
    }
    if (v.deloadWeek && !v.deloadEveryWeeks) {
      problems.push(
        "A deload week is on — say which week it lands on (" +
          MIN_DELOAD_EVERY +
          "–" +
          MAX_DELOAD_EVERY +
          "). Three build weeks and a deload is the leanest cycle that works."
      );
    }
    if (!v.sessionMinutes) {
      problems.push(
        "How long is a session? " +
          MIN_SESSION_MINUTES +
          "–" +
          MAX_SESSION_MINUTES +
          " minutes, warm-up included."
      );
    }
    if (!v.population.trim()) {
      problems.push("Describe the place, who trains there, and what they are training for.");
    }
    return problems;
  }

  /**
   * Weeks created at a time: one month, four weeks — the unit the product is SOLD in.
   * The deload no longer changes this length; it is a cadence laid over the timeline
   * (see deloadEveryWeeks), so a five-week cadence simply means next month opens on a
   * deload rather than that this month grew a fifth week.
   */
  function weekCountFor() {
    return WEEKS_PER_MONTH;
  }

  /**
   * Is this week a deload? Counted on the ABSOLUTE week index — week 1 is the first
   * week the client ever trained, not the first week of the current month. That is
   * the whole point: the cycle survives the month boundary.
   * @param {number} absoluteWeekIndex 1-based, continuous across months
   */
  function isDeloadWeek(raw, absoluteWeekIndex) {
    var v = normalizeIntake(raw);
    var n = parseInt(absoluteWeekIndex, 10);
    if (!v.deloadWeek || !v.deloadEveryWeeks) return false;
    if (!Number.isFinite(n) || n < 1) return false;
    return n % v.deloadEveryWeeks === 0;
  }

  /**
   * The brief the owner reads while writing. Not a prompt — nothing here reaches a
   * provider (POL-029); it is a reminder of the constraints they set.
   */
  function briefFor(raw) {
    var v = normalizeIntake(raw);
    var lines = [];
    lines.push("EQUIPMENT: " + (v.equipment === "other" ? v.equipmentOther : "Well-equipped functional training gym"));
    if (!v.scheduleMode) {
      lines.push("SCHEDULE: not answered yet.");
    } else if (v.scheduleMode === "weekly_schedule") {
      lines.push("SCHEDULE: sessions sit on weekdays.");
      var restNamed = DAY_KEYS.filter(function (k) {
        return v.restDays[k];
      }).map(function (k) {
        return DAY_LABELS[k];
      });
      lines.push(
        "  REST DAYS: " +
          (v.includeRestDays
            ? restNamed.length
              ? restNamed.join(", ") + " — no session on these days."
              : "part of the plan, but no day was named yet."
            : "not planned — the coach decides.")
      );
      if (v.dayEmphasisEnabled) {
        lines.push("  STANDING EMPHASES (repeat every week):");
        DAY_KEYS.forEach(function (k) {
          var note = v.dayEmphasis[k].trim();
          if (note) lines.push("    " + DAY_LABELS[k] + ": " + note);
        });
      }
    } else {
      lines.push(
        "SCHEDULE: " + (v.sessionsPerWeek || "—") + " sessions per week, no fixed weekdays — " +
          "the coach decides when to run them."
      );
      if (v.sessionsDiffer) {
        lines.push("  THE SESSIONS DIFFER:");
        v.sessionTypes.forEach(function (t, i) {
          lines.push("    Session " + (i + 1) + ": " + (t.trim() || "—"));
        });
      } else {
        lines.push("  The sessions are interchangeable — a standard CrossFit week.");
      }
    }
    lines.push(
      "MONTH: " + weekCountFor() + " weeks" +
        (v.deloadWeek && v.deloadEveryWeeks
          ? " · DELOAD every " +
            v.deloadEveryWeeks +
            " weeks (weeks " +
            v.deloadEveryWeeks +
            ", " +
            v.deloadEveryWeeks * 2 +
            ", … counted from the client's first week — the cycle crosses month ends)"
          : " · no deload — four build weeks, month after month")
    );
    lines.push("SESSION: " + (v.sessionMinutes ? v.sessionMinutes + " minutes, warm-up included" : "—"));
    lines.push("POPULATION / LIMITS / GOALS: " + (mergedPopulation(v) || "—"));
    return lines.join("\n");
  }

  /**
   * The one free-text box, for a client written before the two tabs were merged: their
   * goals text is carried into it rather than dropped on the floor.
   */
  function mergedPopulation(raw) {
    var v = isPlainObject(raw) && raw.population !== undefined ? raw : normalizeIntake(raw);
    var pop = String(v.population || "").trim();
    var goals = String(v.goals || "").trim();
    if (!goals) return pop;
    if (!pop) return goals;
    if (pop.indexOf(goals) >= 0) return pop;
    return pop + "\n\n" + goals;
  }

  return {
    DAY_KEYS: DAY_KEYS,
    DAY_LABELS: DAY_LABELS,
    EQUIPMENT_OPTIONS: EQUIPMENT_OPTIONS,
    SCHEDULE_MODES: SCHEDULE_MODES,
    TABS: TABS,
    MAX_SESSIONS_PER_WEEK: MAX_SESSIONS_PER_WEEK,
    WEEKS_PER_MONTH: WEEKS_PER_MONTH,
    MIN_SESSION_MINUTES: MIN_SESSION_MINUTES,
    MAX_SESSION_MINUTES: MAX_SESSION_MINUTES,
    mergedPopulation: mergedPopulation,
    MIN_DELOAD_EVERY: MIN_DELOAD_EVERY,
    MAX_DELOAD_EVERY: MAX_DELOAD_EVERY,
    isDeloadWeek: isDeloadWeek,
    emptyIntake: emptyIntake,
    normalizeIntake: normalizeIntake,
    validateIntake: validateIntake,
    weekCountFor: weekCountFor,
    briefFor: briefFor,
  };
});
