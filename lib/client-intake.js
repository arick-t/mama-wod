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
  var TABS = [
    { id: "profile", label: "Client & payment" },
    { id: "equipment", label: "Equipment" },
    { id: "schedule", label: "Schedule" },
    { id: "population", label: "Population & limits" },
    { id: "goals", label: "Goals" },
  ];

  var MAX_SESSIONS_PER_WEEK = 14;
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
      scheduleMode: "session_count",
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
      /* Standing, repeating emphasis per weekday — not a one-off note. */
      dayEmphasisEnabled: false,
      dayEmphasis: DAY_KEYS.reduce(function (acc, k) {
        acc[k] = "";
        return acc;
      }, {}),

      /* Default NO: four-week blocks back to back, no deload (owner's default). */
      deloadWeek: false,
      population: "",
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

    out.scheduleMode = r.scheduleMode === "weekly_schedule" ? "weekly_schedule" : "session_count";
    var n = parseInt(r.sessionsPerWeek, 10);
    out.sessionsPerWeek = Number.isFinite(n) && n >= 1 && n <= MAX_SESSIONS_PER_WEEK ? n : 0;

    /* Only meaningful in session_count mode — dropped otherwise so a mode switch
       cannot leave contradictory answers behind. */
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
    } else {
      out.sessionsDiffer = false;
      out.sessionTypes = [];
      out.includeRestDays = r.includeRestDays === true;
      out.dayEmphasisEnabled = r.dayEmphasisEnabled === true;
      if (out.dayEmphasisEnabled) {
        var em = isPlainObject(r.dayEmphasis) ? r.dayEmphasis : {};
        DAY_KEYS.forEach(function (k) {
          out.dayEmphasis[k] = clampText(em[k], 400);
        });
      }
    }

    out.deloadWeek = r.deloadWeek === true;
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
    if (v.scheduleMode === "weekly_schedule" && v.dayEmphasisEnabled) {
      var noted = DAY_KEYS.filter(function (k) {
        return v.dayEmphasis[k].trim();
      });
      if (!noted.length) {
        problems.push("Day emphases are on — write a note on at least one day, or turn it off.");
      }
    }
    if (!v.population.trim()) problems.push("Describe the place and who trains there.");
    if (!v.goals.trim()) problems.push("Goals are required.");
    return problems;
  }

  /** Weeks in a block: 5 with a deload, otherwise 4 back-to-back (owner's rule). */
  function weekCountFor(raw) {
    return normalizeIntake(raw).deloadWeek ? 5 : 4;
  }

  /**
   * The brief the owner reads while writing. Not a prompt — nothing here reaches a
   * provider (POL-029); it is a reminder of the constraints they set.
   */
  function briefFor(raw) {
    var v = normalizeIntake(raw);
    var lines = [];
    lines.push("EQUIPMENT: " + (v.equipment === "other" ? v.equipmentOther : "Well-equipped functional training gym"));
    if (v.scheduleMode === "weekly_schedule") {
      lines.push("SCHEDULE: sessions sit on weekdays.");
      lines.push(
        "  REST DAYS: " +
          (v.includeRestDays
            ? "part of the plan — mark them in the week."
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
      "BLOCK: " + weekCountFor(v) + " weeks" +
        (v.deloadWeek ? ", week 5 is a deload" : ", no deload — the next 4-week block follows straight after")
    );
    lines.push("POPULATION / LIMITS: " + (v.population || "—"));
    lines.push("GOALS: " + (v.goals || "—"));
    return lines.join("\n");
  }

  return {
    DAY_KEYS: DAY_KEYS,
    DAY_LABELS: DAY_LABELS,
    EQUIPMENT_OPTIONS: EQUIPMENT_OPTIONS,
    SCHEDULE_MODES: SCHEDULE_MODES,
    TABS: TABS,
    MAX_SESSIONS_PER_WEEK: MAX_SESSIONS_PER_WEEK,
    emptyIntake: emptyIntake,
    normalizeIntake: normalizeIntake,
    validateIntake: validateIntake,
    weekCountFor: weekCountFor,
    briefFor: briefFor,
  };
});
