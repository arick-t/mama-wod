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

  var FIXED_STEPS = [
    "profile",
    "setup",
    "schedule",
    "recovery",
    "lifts",
    "skills",
    "limits",
    "injuries",
    "goals",
  ];

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

  var LOCATION_DEFS = [
    { id: "functional_gym", label: "Well-equipped functional training gym" },
    { id: "conventional_gym", label: "Conventional gym" },
    { id: "other_home", label: "Other — home or limited equipment", needsDetail: true },
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
    "injuries",
    "goals",
    "fixedIntakePacket",
    "profileNotes",
    "intakeComplete",
  ];

  function asObj(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
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
    return [
      "FIXED INTAKE COMPLETE — build a full 5-week training brick now.",
      "Athlete answers may be in any language; all workout/program text MUST be English.",
      "Return <<<BLOCK_JSON>>> with exactly 5 weeks. Do not re-ask intake questions.",
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
      "MACRO DELOAD PRESET: Week 5 of this 5-week brick is a deload week by default. Athlete may later ask to space deload weeks further apart or remove them — honor that when requested in chat/goals.",
      "",
      "LIFTS / RUN:",
      liftLines.length ? liftLines.join("\n") : "unknown",
      "",
      "SKILLS (marked = Rx-capable; unmarked = scale):",
      skillLabels.length ? skillLabels.join(", ") : "None marked — scale gymnastics as needed",
      "",
      "SESSION / SCHEDULE LIMITS:",
      s.sessionLimits || "none",
      "",
      "INJURIES / LIMITATIONS:",
      s.injuries || "none",
      "",
      "GOALS:",
      s.goals || "unknown",
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
      injuries: String(s.injuries || "").slice(0, 800),
      goals: String(s.goals || "").slice(0, 800),
      fixedIntakePacket: packet,
      profileNotes: notes,
      intakeComplete: s.intakeComplete !== false,
      skillsSummary: skillsSummary(skills),
    };
  }

  /** AthleteProfile shape for /api/personal-coach generate_block (parity with app). */
  function athleteProfileForGenerateBlock(profile, opts) {
    var p = normalizeIntakeProfile(profile);
    var force = !opts || opts.forceIntakeComplete !== false;
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
      injuries: p.injuries,
      goals: p.goals,
      trainingSetup: p.trainingSetup,
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
    pkg.injuries = p.injuries;
    pkg.goals = p.goals;
    pkg.fixedIntakePacket = p.fixedIntakePacket;
    pkg.profileNotes = p.profileNotes;
    pkg.intakeComplete = true;
    pkg.intakeProfileDone = true;
    pkg.intakeLiftsDone = true;
    pkg.intakeSkillsDone = true;
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
    skillsSummary: skillsSummary,
    liftLinesFromLifts: liftLinesFromLifts,
  };
});
