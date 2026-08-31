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
 * Six tabs, and deliberately nothing about an individual's capability (2.c).
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

  var TABS = [
    { id: "profile", label: "Client & payment" },
    { id: "equipment", label: "Equipment" },
    { id: "schedule", label: "Schedule" },
    { id: "deload", label: "Deload week" },
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
      scheduleMode: "session_count",
      sessionsPerWeek: 3,
      /* Only meaningful in weekly_schedule mode: a focus per weekday, blank = rest. */
      weeklySchedule: DAY_KEYS.reduce(function (acc, k) {
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
    out.sessionsPerWeek = Number.isFinite(n) && n >= 1 && n <= MAX_SESSIONS_PER_WEEK ? n : 3;

    var ws = isPlainObject(r.weeklySchedule) ? r.weeklySchedule : {};
    DAY_KEYS.forEach(function (k) {
      out.weeklySchedule[k] = clampText(ws[k], 200);
    });

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
    if (v.scheduleMode === "weekly_schedule") {
      var filled = DAY_KEYS.filter(function (k) {
        return v.weeklySchedule[k].trim();
      });
      if (!filled.length) problems.push("Weekly schedule is selected — fill at least one day.");
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
      lines.push("SCHEDULE: fixed weekdays —");
      DAY_KEYS.forEach(function (k) {
        var focus = v.weeklySchedule[k].trim();
        lines.push("  " + DAY_LABELS[k] + ": " + (focus || "Rest"));
      });
    } else {
      lines.push(
        "SCHEDULE: " + v.sessionsPerWeek + " sessions per week, no fixed weekdays — " +
          "the coach decides when to run them."
      );
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
