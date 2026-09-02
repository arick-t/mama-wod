/**
 * Coach intake sync contract (HARD)
 * — Admin «+ מתאמן» and athlete app MUST produce the same fixed-intake packet.
 * — Blob snapshot + phone claim package MUST carry the same structured profile
 *   so coach ↔ athlete ↔ admin stay in sync (no re-intake, no thin bricks).
 *
 * Browser: load via <script src="lib/coach-intake-sync-contract.js">
 * Node: require("./coach-intake-sync-contract") or ../lib/...
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CoachIntakeSync = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Eight. "limits" folded into "schedule" on 2026-09-02: when you train and for how
     long is one question, and asking it twice, four steps apart, is how an athlete ends
     up describing their week differently in each half. */
  var FIXED_STEPS = [
    "profile",
    "setup",
    "schedule",
    "recovery",
    "lifts",
    "skills",
    "injuries",
    "goals",
  ];

  /* The session length, in minutes. Same range the studio intake uses — a session under
     twenty minutes is not a session and over two hours is not a plan. */
  var MIN_SESSION_MINUTES = 20;
  var MAX_SESSION_MINUTES = 120;

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_LABELS = {
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
  };

  var SKILL_DEFS = [
    { id: "all_skills", label: "All skills", allToggle: true },
    { id: "muscle_up", label: "Muscle up" },
    { id: "handstand_walk", label: "Handstand walk" },
    { id: "handstand_pushup", label: "Handstand pushup" },
    { id: "pistol", label: "Pistol" },
    { id: "ring_muscle_up", label: "Ring muscle up" },
    { id: "double_unders", label: "Double unders" },
    { id: "toes_to_bar", label: "Toes to bar" },
    { id: "pullups", label: "Pull-ups" },
    { id: "chest_to_bar", label: "Chest to bar pull-ups" },
  ];

  /* Two answers, and they exclude each other: either the athlete has a proper functional
     box or they do not, and "both" describes nobody (owner, 2026-09-02). A conventional
     gym was a third option that this product never programmed differently for. */
  var LOCATION_DEFS = [
    { id: "functional_gym", label: "Well-equipped functional training gym", exclusive: true },
    { id: "other_home", label: "Other — home or limited equipment", needsDetail: true, exclusive: true },
  ];

  /**
   * What the athlete wants to get better at.
   *
   * Marks, not prose. "I want to get stronger" in free text reached the coach as
   * nothing at all — not because there was no intention in it, but because no word in
   * it was one the router recognised (coach agent, 2026-09-02). The free text in Goals
   * stays exactly as it is; these anchor it.
   */
  var IMPROVE_FOCUS_DEFS = [
    { id: "max_strength", label: "Max strength" },
    { id: "engine", label: "Engine / conditioning" },
    { id: "gymnastics", label: "Gymnastics and skills" },
    { id: "olympic_lifting", label: "Olympic lifting" },
    { id: "general_fitness", label: "General fitness" },
    { id: "specific_skill", label: "A specific skill", needsDetail: true },
  ];

  /**
   * Movements to program around.
   *
   * Seven FAMILIES, not seven movements: they map one-to-one onto the coach's
   * substitution matrix (ankle-knee, shoulder, lower back, upper back, hand). Changing
   * these ids silently would break that mapping, so they are keys and not labels
   * (coach agent, 2026-09-02).
   *
   * This is also the honest way to ask: the athlete writes "torn meniscus, operated four
   * months ago" in the free box, and the coach is forbidden to reason from a diagnosis.
   * A movement it may act on.
   */
  var AVOID_MOVEMENT_DEFS = [
    { id: "deep_squat", label: "Deep squat" },
    { id: "hinge_deadlift", label: "Hinge / deadlift" },
    { id: "overhead_press", label: "Overhead press" },
    { id: "hanging_bar", label: "Hanging from the bar" },
    { id: "kipping", label: "Kipping" },
    { id: "jumping", label: "Jumping" },
    { id: "running", label: "Running" },
  ];

  var LIFT_DEFS = [
    { id: "back_squat", label: "Back Squat", unit: "kg", kind: "kg" },
    { id: "deadlift", label: "Deadlift", unit: "kg", kind: "kg" },
    { id: "clean_jerk", label: "Clean & Jerk", unit: "kg", kind: "kg" },
    { id: "snatch", label: "Snatch", unit: "kg", kind: "kg" },
    { id: "run_2000", label: "2000 m run", unit: "min", kind: "run", placeholder: "e.g. 8.5" },
  ];

  var PROFILE_DEFS = [
    { id: "display_name", label: "Name / nickname", kind: "text", placeholder: "e.g. Alex" },
    { id: "gender", label: "Gender", kind: "select", options: ["male", "female"] },
    { id: "age", label: "Age", kind: "number", placeholder: "e.g. 30" },
    { id: "bodyweight", label: "Bodyweight (kg)", kind: "number", placeholder: "e.g. 78" },
    {
      id: "experience",
      label: "Training experience",
      kind: "text",
      placeholder: "e.g. 2 years functional fitness",
    },
  ];

  /** Fields that must round-trip admin ↔ phone ↔ snapshot (HARD). */
  var INTAKE_PROFILE_KEYS = [
    "displayName",
    "gender",
    "preferredLanguage",
    "age",
    "bodyweight",
    "experience",
    "trainingLocations",
    "trainingLocationOther",
    "trainingSetup",
    "trainingDays",
    "scheduleNotes",
    "activeRecoveryPref",
    "activeRecoveryDay",
    "skills",
    "lifts",
    "sessionLimits",
    /* Minutes per session, asked in the same step as the week itself (2026-09-02). */
    "sessionMinutes",
    "sessionTimesDiffer",
    /* Training for a competition. Asked as a tick box on Goals (2026-09-02). */
    "competitor",
    /* The four the coach asked for on 2026-09-02, so the things that actually CONSTRAIN
       a prescription — what to build, what to avoid, how heavy the room gets, and what
       he does not want to see — arrive as marks instead of prose to be interpreted. */
    "improveFocus",
    "improveFocusOther",
    "avoidMovements",
    "avoidMovementsOther",
    "heaviestImplementKg",
    "avoidInProgram",
    "injuries",
    "goals",
    "fixedIntakePacket",
    "profileNotes",
    "intakeComplete",
  ];

  function asObj(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Shared mobile keyboard attrs — lang=en so Hebrew admin page still gets numeric keypad on iOS. */
  function intakeNumericInputAttrs(kind) {
    var base =
      ' lang="en" dir="ltr" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"';
    if (kind === "integer") {
      return base + ' inputmode="numeric" pattern="[0-9]*"';
    }
    return base + ' inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*"';
  }

  function renderFixedLiftsRowsHtml(lifts, opts) {
    opts = opts || {};
    var prefix = opts.idPrefix || "pprog-lift-";
    var enterHint = opts.enterkeyhint || "next";
    var L = asObj(lifts);
    var html = "";
    for (var i = 0; i < LIFT_DEFS.length; i++) {
      var def = LIFT_DEFS[i];
      var val = L[def.id] != null && L[def.id] !== "" ? String(L[def.id]) : "";
      var ph = def.placeholder || (def.kind === "kg" ? "kg" : "");
      html +=
        '<div class="pprog-lifts-row">' +
        '<label for="' +
        escHtml(prefix + def.id) +
        '">' +
        escHtml(def.label) +
        "</label>" +
        '<input id="' +
        escHtml(prefix + def.id) +
        '" type="text"' +
        intakeNumericInputAttrs("decimal") +
        ' enterkeyhint="' +
        escHtml(enterHint) +
        '" data-lift-id="' +
        escHtml(def.id) +
        '" data-lift-kind="' +
        escHtml(def.kind) +
        '" placeholder="' +
        escHtml(ph) +
        '" value="' +
        escHtml(val) +
        '">' +
        '<span class="pprog-lifts-unit">' +
        escHtml(def.unit) +
        "</span></div>";
    }
    return html;
  }

  function renderFixedProfileInputHtml(def, val, opts) {
    opts = opts || {};
    var prefix = opts.idPrefix || "pprog-fx-";
    var dataAttr = opts.dataAttr || "data-fx-id";
    var modeAttr = ' lang="en" dir="ltr" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"';
    if (def.id === "age") modeAttr = intakeNumericInputAttrs("integer");
    else if (def.id === "bodyweight") modeAttr = intakeNumericInputAttrs("decimal");
    return (
      '<input id="' +
      escHtml(prefix + def.id) +
      '" type="text"' +
      modeAttr +
      " " +
      dataAttr +
      '="' +
      escHtml(def.id) +
      '" placeholder="' +
      escHtml(def.placeholder || "") +
      '" value="' +
      escHtml(String(val || "")) +
      '">'
    );
  }

  function bindIntakeNumericKeyboards(root) {
    if (!root || !root.querySelectorAll) return;
    var inputs = root.querySelectorAll(
      "input[data-lift-id], input[data-fx-id], input[data-profile-id]"
    );
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      var id =
        inp.getAttribute("data-fx-id") ||
        inp.getAttribute("data-profile-id") ||
        inp.getAttribute("data-lift-id") ||
        "";
      if (id === "display_name" || id === "experience" || id === "gender") continue;
      inp.setAttribute("lang", "en");
      inp.setAttribute("dir", "ltr");
      inp.setAttribute("autocorrect", "off");
      inp.setAttribute("autocapitalize", "off");
      inp.setAttribute("spellcheck", "false");
      if (id === "age") inp.setAttribute("inputmode", "numeric");
      else if (id === "bodyweight" || inp.getAttribute("data-lift-id")) {
        inp.setAttribute("inputmode", "decimal");
      }
    }
  }

  function liftLinesFromLifts(lifts) {
    var L = asObj(lifts);
    var lines = [];
    for (var i = 0; i < LIFT_DEFS.length; i++) {
      var def = LIFT_DEFS[i];
      var val = L[def.id];
      if (val == null || String(val).trim() === "") {
        lines.push(def.label + ": unknown");
      } else if (def.kind === "run") {
        lines.push(def.label + ": " + String(val) + " min");
      } else {
        lines.push(def.label + ": " + String(val) + " kg");
      }
    }
    return lines;
  }

  function skillLabelsFromSkills(skills) {
    var sk = asObj(skills);
    var labels = [];
    if (sk.all_skills) {
      labels.push("All skills (Rx-capable)");
      return labels;
    }
    for (var i = 0; i < SKILL_DEFS.length; i++) {
      if (SKILL_DEFS[i].allToggle) continue;
      if (sk[SKILL_DEFS[i].id]) labels.push(SKILL_DEFS[i].label);
    }
    return labels;
  }

  function skillsSummary(skills) {
    return skillLabelsFromSkills(skills).join(", ").slice(0, 400);
  }

  /**
   * Same English packet the athlete app sends to generate_block (FIXED INTAKE COMPLETE…).
   * @param {object} s structured answers (store / intakeState / intakeProfile)
   */
  /* A block is four weeks. The cadence runs on an ABSOLUTE week counter that survives
     the month boundary — that is the whole point of it (owner, 2026-09-01) — so which
     week of THIS block is the deload depends on where the block starts in that count. */
  var BLOCK_WEEKS = 4;

  /**
   * Which week of this block is the deload, 1..4, or null when none falls inside it.
   *
   * Handed to the coach rather than left to it: "a deload week is given to you, never
   * choose one yourself" is the rule the coach layers are written against
   * (coach agent, 2026-09-02).
   *
   * @param {number} startWeek absolute index of this block's first week, 1-based
   * @param {number} everyWeeks cadence; 0 or missing means no deload at all
   * @param {number} [weeks] length of the block, four unless told otherwise
   */
  function deloadWeekIndexForBlock(startWeek, everyWeeks, weeks) {
    var s0 = parseInt(startWeek, 10);
    var every = parseInt(everyWeeks, 10);
    var len = parseInt(weeks, 10);
    if (!(s0 >= 1)) s0 = 1;
    if (!(len >= 1)) len = BLOCK_WEEKS;
    if (!(every >= 1)) return null;
    for (var i = 1; i <= len; i++) {
      if ((s0 + i - 1) % every === 0) return i;
    }
    return null;
  }

  function isObj(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  /** The marked ids of a boolean map, as words, in the order the definitions declare. */
  function markedLabels(defs, map, otherText) {
    var out = [];
    var m = isObj(map) ? map : {};
    for (var i = 0; i < defs.length; i++) {
      if (m[defs[i].id] !== true) continue;
      if (defs[i].needsDetail) {
        var d = String(otherText || "").trim();
        out.push(d ? defs[i].label + " (" + d + ")" : defs[i].label);
        continue;
      }
      out.push(defs[i].label);
    }
    return out;
  }

  function buildFixedIntakePrompt(s) {
    s = s || {};
    var days = Array.isArray(s.trainingDays) ? s.trainingDays : [];
    var dayLabels = days
      .map(function (d) {
        return DAY_LABELS[d] || d;
      })
      .join(", ");
    var liftLines =
      Array.isArray(s.pendingIntakeLiftsLines) && s.pendingIntakeLiftsLines.length
        ? s.pendingIntakeLiftsLines
        : liftLinesFromLifts(s.lifts);
    var skillLabels = skillLabelsFromSkills(s.skills);
    /* Where the deload sits in THIS block, as a fact rather than a preset the coach is
       invited to reinterpret. Null means there is none inside these four weeks. */
    var deloadIdx = deloadWeekIndexForBlock(s.blockStartWeek, s.deloadEveryWeeks, BLOCK_WEEKS);
    var improveLabels = markedLabels(IMPROVE_FOCUS_DEFS, s.improveFocus, s.improveFocusOther);
    var avoidLabels = markedLabels(AVOID_MOVEMENT_DEFS, s.avoidMovements, s.avoidMovementsOther);
    var heaviestKg = parseInt(s.heaviestImplementKg, 10) || 0;
    return [
      "FIXED INTAKE COMPLETE — build a full 4-week training brick now.",
      "Athlete answers may be in any language; all workout/program text MUST be English.",
      "Return <<<BLOCK_JSON>>> with exactly 4 weeks. Do not re-ask intake questions.",
      "",
      "PROFILE:",
      "Name: " + (s.displayName || "unknown"),
      "Gender: " + (s.gender || "unknown"),
      "Age: " + (s.age || "unknown"),
      "Bodyweight: " + (s.bodyweight || "unknown") + " kg",
      "Experience: " + (s.experience || "unknown"),
      "",
      "TRAINING SETUP:",
      s.trainingSetup || "unknown",
      "",
      "WEEKLY SCHEDULE:",
      "Training days: " + (dayLabels || "unknown"),
      "Notes: " + (s.scheduleNotes || "none"),
      "",
      "ACTIVE RECOVERY:",
      s.activeRecoveryPref === "yes"
        ? "YES — include one active recovery / daily deload day on " +
          (DAY_LABELS[s.activeRecoveryDay] || s.activeRecoveryDay || "Thu") +
          ". Other training days stay full sessions."
        : "NO — do NOT program an active recovery / daily deload day. Do not force Thursday lighter unless the athlete marked it as rest.",
      /* A block is a month and the deload is a CADENCE across months, not the tail of a
         block: it is counted on an absolute week number, so it can land on week 2 of one
         block and week 4 of the next. The coach is told where, and must not move it
         (owner + coach agent, 2026-09-02). */
      deloadIdx
        ? "DELOAD: week " + deloadIdx + " of this 4-week block is the deload week. Do NOT choose a different one, and do NOT add a fifth week."
        : "DELOAD: no deload week falls inside this block. Do NOT add one, and do NOT add a fifth week.",
      "",
      "LIFTS / RUN:",
      liftLines.length ? liftLines.join("\n") : "unknown",
      "",
      "SKILLS (marked = Rx-capable; unmarked = scale):",
      skillLabels.length ? skillLabels.join(", ") : "None marked — scale gymnastics as needed",
      "",
      "SESSION LENGTH:",
      s.sessionMinutes ? s.sessionMinutes + " minutes" : "unknown",
      "",
      "SESSION / SCHEDULE LIMITS:",
      s.sessionLimits || "none",
      "",
      "INJURIES / LIMITATIONS:",
      s.injuries || "none",
      "",
      "GOALS:",
      s.goals || "unknown",
      /* Competing changes what a block is for — peaking, testing, and how heavy a
         week may get. Asked as a tick box on the Goals step (owner, 2026-09-02) and
         stated to the coach in as many words: "training for a competition" buried in
         free text is a sentence the model may or may not weigh. */
      s.competitor === true
        ? "COMPETITOR: YES — training for a competition / actively competing. Program accordingly."
        : "COMPETITOR: no — general fitness athlete, not preparing for a competition.",
      /* Every answer that carries a decision gets its own tagged line, in both
         directions - the generalisation of the COMPETITOR bug the coach reported: a
         sentence buried in free text is one the model may weigh or may not, and a line
         that appears only when the answer is yes cannot be relied on at all (coach
         agent, 2026-09-02). Each line also carries the instruction for when there is no
         answer, so nothing has to be inferred. */
      improveLabels.length
        ? "IMPROVE FOCUS: " + improveLabels.join(" · ") +
          " — spend the dedicated strength and skill time here."
        : "IMPROVE FOCUS: none selected — general fitness, no single focus. Priority is the balance itself.",
      avoidLabels.length
        ? "AVOID: " + avoidLabels.join(" · ") +
          " — program around these and substitute by movement pattern."
        : "AVOID: none marked.",
      heaviestKg > 0
        ? "HEAVIEST IMPLEMENT: " + heaviestKg + " kg."
        : "HEAVIEST IMPLEMENT: not stated — do NOT assume a load ceiling. Prescribe by RPE or by a rep target, never by a kg figure.",
      String(s.avoidInProgram || "").trim()
        ? "DOES NOT WANT: " + String(s.avoidInProgram).trim()
        : "DOES NOT WANT: nothing stated.",
    ].join("\n");
  }

  function buildProfileNotes(s) {
    s = s || {};
    return [
      "Training setup: " + (s.trainingSetup || "unknown"),
      "Training days: " +
        ((Array.isArray(s.trainingDays) && s.trainingDays.length
          ? s.trainingDays.join(",")
          : "") ||
          "unknown"),
      "Schedule notes: " + (s.scheduleNotes || "none"),
      "Active recovery: " +
        (s.activeRecoveryPref === "yes"
          ? "yes on " + (s.activeRecoveryDay || "thu")
          : "no — no active recovery / daily deload day"),
      "Macro deload preset: week 5 of each 5-week brick (athlete may ask to space or remove)",
      "Age: " + (s.age || "unknown"),
      "Bodyweight: " + (s.bodyweight || "unknown") + " kg",
      "Experience: " + (s.experience || "unknown"),
      "Session length: " + (s.sessionMinutes ? s.sessionMinutes + " min" : "unknown"),
      "Session limits: " + (s.sessionLimits || "none"),
      "Injuries/limitations: " + (s.injuries || "none"),
      "Goals: " + (s.goals || "unknown"),
    ]
      .join("\n")
      .slice(0, 2500);
  }

  /** Normalize structured intake for Blob / phone / athleteProfile. */
  function normalizeIntakeProfile(raw) {
    var s = raw && typeof raw === "object" ? raw : {};
    var skills = asObj(s.skills);
    var lifts = asObj(s.lifts);
    var locs = asObj(s.trainingLocations);
    var days = Array.isArray(s.trainingDays)
      ? s.trainingDays.filter(function (d) {
          return DAY_KEYS.indexOf(d) >= 0;
        })
      : [];
    var packet =
      s.fixedIntakePacket != null && String(s.fixedIntakePacket).trim()
        ? String(s.fixedIntakePacket).slice(0, 6000)
        : buildFixedIntakePrompt(s).slice(0, 6000);
    var notes =
      s.profileNotes != null && String(s.profileNotes).trim()
        ? String(s.profileNotes).slice(0, 2500)
        : buildProfileNotes(s);
    return {
      displayName: String(s.displayName || "").slice(0, 80),
      gender: String(s.gender || "").slice(0, 20),
      preferredLanguage: String(s.preferredLanguage || "en").slice(0, 10) || "en",
      age: String(s.age || "").slice(0, 8),
      bodyweight: String(s.bodyweight || "").slice(0, 12),
      experience: String(s.experience || "").slice(0, 120),
      trainingLocations: locs,
      trainingLocationOther: String(s.trainingLocationOther || "").slice(0, 500),
      trainingSetup: String(s.trainingSetup || "").slice(0, 800),
      trainingDays: days,
      scheduleNotes: String(s.scheduleNotes || "").slice(0, 500),
      activeRecoveryPref: s.activeRecoveryPref === "yes" ? "yes" : "no",
      activeRecoveryDay:
        s.activeRecoveryPref === "yes" && s.activeRecoveryDay
          ? String(s.activeRecoveryDay).slice(0, 8)
          : "",
      skills: skills,
      lifts: lifts,
      sessionLimits: String(s.sessionLimits || "").slice(0, 600),
      sessionMinutes: parseInt(s.sessionMinutes, 10) > 0 ? parseInt(s.sessionMinutes, 10) : 0,
      sessionTimesDiffer: s.sessionTimesDiffer === true,
      competitor: s.competitor === true,
      /* Marks the coach acts on directly (coach agent, 2026-09-02): what to build,
         what to program around, how heavy the room gets, and what he does not want. */
      improveFocus: asObj(s.improveFocus),
      improveFocusOther: String(s.improveFocusOther || "").slice(0, 200),
      avoidMovements: asObj(s.avoidMovements),
      avoidMovementsOther: String(s.avoidMovementsOther || "").slice(0, 200),
      heaviestImplementKg: parseInt(s.heaviestImplementKg, 10) > 0 ? parseInt(s.heaviestImplementKg, 10) : 0,
      avoidInProgram: String(s.avoidInProgram || "").slice(0, 400),
      injuries: String(s.injuries || "").slice(0, 800),
      goals: String(s.goals || "").slice(0, 800),
      fixedIntakePacket: packet,
      profileNotes: notes,
      intakeComplete: s.intakeComplete !== false,
      skillsSummary: skillsSummary(skills),
    };
  }

  /** AthleteProfile shape for /api/personal-coach generate_block (parity with app). */
  function emptyCostCaps() {
    return {
      dailyEdits: {},
      monthlyUnits: {},
      lastLargeRebuildAt: null,
      softUpgradeBrickStart: null,
    };
  }

  function newAthleteId() {
    var bytes = [];
    try {
      var buf = new Uint8Array(6);
      var cryptoObj =
        typeof crypto !== "undefined"
          ? crypto
          : typeof require === "function"
            ? require("crypto")
            : null;
      if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
        cryptoObj.getRandomValues(buf);
        bytes = buf;
      } else if (cryptoObj && typeof cryptoObj.randomBytes === "function") {
        bytes = cryptoObj.randomBytes(6);
      }
    } catch (eId) {}
    if (!bytes || !bytes.length) {
      var fallback = "a_" + Date.now().toString(16).slice(-8) + Math.floor(Math.random() * 256).toString(16);
      return fallback.slice(0, 16);
    }
    var hex = "";
    for (var i = 0; i < 6; i++) {
      hex += ("0" + (bytes[i] & 255).toString(16)).slice(-2);
    }
    return "a_" + hex;
  }

  function israelMonthKey(iso) {
    var s = String(iso || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    try {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jerusalem",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(new Date());
      var y = "";
      var m = "";
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "year") y = parts[i].value;
        if (parts[i].type === "month") m = parts[i].value;
      }
      if (y && m) return y + "-" + m;
    } catch (eMk) {}
    return new Date().toISOString().slice(0, 7);
  }

  function monthlyUnitsUsed(caps, todayIso) {
    var c = caps && typeof caps === "object" ? caps : {};
    if (typeof c.monthlyUnitsUsed === "number") return c.monthlyUnitsUsed | 0;
    if (c.monthlyLocked === true) return 40;
    var mk = israelMonthKey(todayIso || c.israelToday);
    var map = c.monthlyUnits && typeof c.monthlyUnits === "object" ? c.monthlyUnits : null;
    if (map && map[mk] != null) return map[mk] | 0;
    return 0;
  }

  var BRICK_FILL_UNITS = 8;

  function recordBrickFill(caps, todayIso) {
    var c = caps && typeof caps === "object" ? caps : emptyCostCaps();
    if (!c.monthlyUnits || typeof c.monthlyUnits !== "object") c.monthlyUnits = {};
    if (!c.dailyEdits || typeof c.dailyEdits !== "object") c.dailyEdits = {};
    var mk = israelMonthKey(todayIso);
    c.monthlyUnits[mk] = (c.monthlyUnits[mk] | 0) + BRICK_FILL_UNITS;
    return c;
  }

  function cloneCostCaps(caps) {
    var c = caps && typeof caps === "object" ? caps : emptyCostCaps();
    var out = emptyCostCaps();
    out.lastLargeRebuildAt = c.lastLargeRebuildAt || null;
    out.softUpgradeBrickStart = c.softUpgradeBrickStart || null;
    out.monthlyLocked = !!c.monthlyLocked;
    var dKeys = Object.keys(c.dailyEdits || {});
    for (var di = 0; di < dKeys.length; di++) out.dailyEdits[dKeys[di]] = c.dailyEdits[dKeys[di]] | 0;
    var mKeys = Object.keys(c.monthlyUnits || {});
    for (var mi = 0; mi < mKeys.length; mi++) out.monthlyUnits[mKeys[mi]] = c.monthlyUnits[mKeys[mi]] | 0;
    return out;
  }

  function athleteProfileForGenerateBlock(profile, opts) {
    var p = normalizeIntakeProfile(profile);
    var force = !opts || opts.forceIntakeComplete !== false;
    var src = profile && typeof profile === "object" ? profile : {};
    var athleteId = String(
      (opts && (opts.athleteId || opts.userId)) || src.athleteId || src.userId || ""
    ).slice(0, 80);
    var caps = cloneCostCaps((opts && opts.costCaps) || src.costCaps);
    var todayIso = String((opts && opts.israelToday) || src.israelToday || "").slice(0, 10);
    return {
      preferredLanguage: "en",
      gender: p.gender,
      age: p.age,
      bodyweight: p.bodyweight,
      experience: p.experience,
      activeRecoveryPref: p.activeRecoveryPref,
      activeRecoveryDay: p.activeRecoveryDay,
      trainingDays: p.trainingDays,
      scheduleNotes: p.scheduleNotes,
      skills: p.skills,
      lifts: p.lifts,
      displayName: p.displayName,
      intakeComplete: force ? true : !!p.intakeComplete,
      profileNotes: p.profileNotes,
      fixedIntakePacket: p.fixedIntakePacket,
      coachPrefs: [],
      hasCurrentWeek: false,
      hasCurrentBlock: false,
      sessionLimits: p.sessionLimits,
      sessionMinutes: p.sessionMinutes,
      sessionTimesDiffer: p.sessionTimesDiffer,
      injuries: p.injuries,
      goals: p.goals,
      trainingSetup: p.trainingSetup,
      /* Asked for as a field rather than a line to infer from: a router that reads
         "COMPETITOR: no" out of prose is one substring away from being wrong, and was
         (coach agent, 2026-09-02). */
      competitor: p.competitor === true,
      /* Marks, not prose - the coach asked for these as keys for the same reason it
         asked for competitor: a router that reads intent out of a sentence is one
         substring away from being wrong (coach agent, 2026-09-02). */
      improveFocus: isObj(p.improveFocus) ? p.improveFocus : {},
      improveFocusOther: String(p.improveFocusOther || ""),
      avoidMovements: isObj(p.avoidMovements) ? p.avoidMovements : {},
      avoidMovementsOther: String(p.avoidMovementsOther || ""),
      /* 0 means "not answered", and the packet line says what to do about that. */
      heaviestImplementKg: parseInt(p.heaviestImplementKg, 10) > 0 ? parseInt(p.heaviestImplementKg, 10) : 0,
      avoidInProgram: String(p.avoidInProgram || ""),
      /* Which week of THIS block is the deload, or null — computed, never guessed. */
      blockWeeks: BLOCK_WEEKS,
      deloadWeekIndex: deloadWeekIndexForBlock(
        (opts && opts.blockStartWeek) || src.blockStartWeek,
        (opts && opts.deloadEveryWeeks) || src.deloadEveryWeeks,
        BLOCK_WEEKS
      ),
      athleteId: athleteId,
      userId: athleteId,
      costCaps: caps,
      monthlyUnitsUsed: monthlyUnitsUsed(caps, todayIso),
    };
  }

  /** Merge intakeProfile onto phone localStorage store fields. */
  function applyIntakeProfileToPhoneStore(pkg, intakeProfile) {
    var p = normalizeIntakeProfile(intakeProfile || {});
    pkg.displayName = p.displayName || pkg.displayName;
    pkg.gender = p.gender || pkg.gender;
    pkg.preferredLanguage = p.preferredLanguage || "en";
    pkg.age = p.age;
    pkg.bodyweight = p.bodyweight;
    pkg.experience = p.experience;
    pkg.trainingLocations = p.trainingLocations;
    pkg.trainingLocationOther = p.trainingLocationOther;
    pkg.trainingSetup = p.trainingSetup;
    pkg.trainingDays = p.trainingDays;
    pkg.scheduleNotes = p.scheduleNotes;
    pkg.activeRecoveryPref = p.activeRecoveryPref;
    pkg.activeRecoveryDay = p.activeRecoveryDay;
    pkg.skills = p.skills;
    pkg.lifts = p.lifts;
    pkg.sessionLimits = p.sessionLimits;
    pkg.sessionMinutes = p.sessionMinutes;
    pkg.sessionTimesDiffer = p.sessionTimesDiffer;
    pkg.injuries = p.injuries;
    pkg.goals = p.goals;
    pkg.fixedIntakePacket = p.fixedIntakePacket;
    pkg.profileNotes = p.profileNotes;
    pkg.intakeComplete = true;
    pkg.intakeProfileDone = true;
    pkg.intakeLiftsDone = true;
    pkg.intakeSkillsDone = true;
    if (intakeProfile && intakeProfile.costCaps && typeof intakeProfile.costCaps === "object") {
      pkg.costCaps = cloneCostCaps(intakeProfile.costCaps);
    } else if (pkg.costCaps && typeof pkg.costCaps === "object") {
      pkg.costCaps = cloneCostCaps(pkg.costCaps);
    }
    if (intakeProfile && (intakeProfile.athleteId || intakeProfile.userId)) {
      pkg.athleteId = String(intakeProfile.athleteId || intakeProfile.userId).slice(0, 80);
      pkg.userId = pkg.athleteId;
    }
    /* HARD: never auto-stamp legal here. Athlete must accept Terms on-device
       (self-serve Start, or after admin handoff link) before the plan UI unlocks.
       That acceptance is written to data/legal-agreements.jsonl via /api/legal-agree. */
    return pkg;
  }

  return {
    FIXED_STEPS: FIXED_STEPS,
    DAY_KEYS: DAY_KEYS,
    DAY_LABELS: DAY_LABELS,
    SKILL_DEFS: SKILL_DEFS,
    LOCATION_DEFS: LOCATION_DEFS,
    LIFT_DEFS: LIFT_DEFS,
    PROFILE_DEFS: PROFILE_DEFS,
    INTAKE_PROFILE_KEYS: INTAKE_PROFILE_KEYS,
    buildFixedIntakePrompt: buildFixedIntakePrompt,
    buildProfileNotes: buildProfileNotes,
    normalizeIntakeProfile: normalizeIntakeProfile,
    athleteProfileForGenerateBlock: athleteProfileForGenerateBlock,
    applyIntakeProfileToPhoneStore: applyIntakeProfileToPhoneStore,
    emptyCostCaps: emptyCostCaps,
    cloneCostCaps: cloneCostCaps,
    newAthleteId: newAthleteId,
    israelMonthKey: israelMonthKey,
    monthlyUnitsUsed: monthlyUnitsUsed,
    recordBrickFill: recordBrickFill,
    BRICK_FILL_UNITS: BRICK_FILL_UNITS,
    BLOCK_WEEKS: BLOCK_WEEKS,
    IMPROVE_FOCUS_DEFS: IMPROVE_FOCUS_DEFS,
    AVOID_MOVEMENT_DEFS: AVOID_MOVEMENT_DEFS,
    deloadWeekIndexForBlock: deloadWeekIndexForBlock,
    skillsSummary: skillsSummary,
    liftLinesFromLifts: liftLinesFromLifts,
    escHtml: escHtml,
    intakeNumericInputAttrs: intakeNumericInputAttrs,
    renderFixedLiftsRowsHtml: renderFixedLiftsRowsHtml,
    renderFixedProfileInputHtml: renderFixedProfileInputHtml,
    bindIntakeNumericKeyboards: bindIntakeNumericKeyboards,
  };
});
