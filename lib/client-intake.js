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
    module.exports = factory(require("./equipment-catalog.js"));
  } else {
    /* admin.html must load lib/equipment-catalog.js BEFORE this file. There is a test for
       that ordering, because a missing catalogue here would silently draw an empty
       equipment tab rather than fail. */
    root.CLIENT_INTAKE = factory(root.EquipmentCatalog);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog) {
  "use strict";

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_LABELS = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };

  /* Two choices and a paragraph - and that is exactly how the first real studio brick came
     back full of equipment the room does not own. "Well equipped" is now a SHORTCUT that
     fills the checklist rather than a way to skip it, and OTHER stops being a separate road:
     it is the free-text box beside the list, which only ever ADDS permissions. Owner,
     2026-09-14: "הפריסט לא מחליף את הרשימה - הוא ממלא אותה מראש". */
  var EQUIPMENT_OPTIONS = [
    { id: "functional_gym", label: "Well-equipped functional training gym", needsDetail: false },
    { id: "other", label: "OTHER", needsDetail: true },
  ];

  /* A room's answer for one implement. Three fields, and each one means something different
     when it is empty:
       have  false is an answer - the coach may not use it, at all.
       qty   BLANK means "not stated". On the five scarce machines that is NOT "unlimited":
             no room owns a rower per athlete, so the coach gets a rotation station. On
             everything else blank really is "no constraint" (owner, 2026-09-14).
       cap   the ceiling - kg for loads, cm for a box, metres for the run. Blank means the
             coach may not put a number on it, never that the number is unlimited. This is
             the field that would have stopped 22.5 kg dumbbells in a 15 kg room. */
  function emptyEquipmentRow() {
    return { have: false, qty: null, cap: null };
  }

  function normalizeEquipmentList(raw) {
    var out = {};
    if (!Catalog || !Array.isArray(Catalog.ITEMS)) return out;
    var src = isPlainObject(raw) ? raw : {};
    Catalog.ITEMS.forEach(function (item) {
      var r = isPlainObject(src[item.id]) ? src[item.id] : null;
      if (!r) return;
      var row = emptyEquipmentRow();
      row.have = r.have === true;
      /* A count or a ceiling on something the room does not have is noise that would reach
         the coach as a fact. Dropped with the tick. */
      if (!row.have) {
        out[item.id] = row;
        return;
      }
      var q = parseInt(r.qty, 10);
      row.qty = Number.isFinite(q) && q > 0 ? Math.min(999, q) : null;
      var c = parseInt(r.cap, 10);
      row.cap = Number.isFinite(c) && c > 0 ? Math.min(99999, c) : null;
      out[item.id] = row;
    });
    return out;
  }

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
    { id: "equipment", label: "Equipment & space" },
    { id: "schedule", label: "Schedule" },
    { id: "population", label: "Population & limits" },
  ];

  /**
   * WHO IS IN THE ROOM, as facts rather than a paragraph.
   *
   * The paragraph held four different things at once — who they are, what limits them,
   * what they are training for, and the specific targets — and the coach had to infer all
   * four. It is where the product broke on the first real studio brick: a room of
   * seventeen-year-olds who had never tested a lift was described in prose, so nothing
   * could act on the age or on the absence of maxima, and the brick came back written in
   * percentages of a number that does not exist (owner, 2026-09-15).
   *
   * The age is a RANGE and not a band: a studio can genuinely run from 16 to 50, and a
   * band would make us pick a lie.
   */
  var MIN_AGE = 10;
  var MAX_AGE = 90;
  var LEVEL_DEFS = [
    { id: "beginners", label: "Beginners" },
    { id: "mixed", label: "Mixed ability" },
    { id: "experienced", label: "Experienced" },
    { id: "competitive", label: "Competitive" },
  ];
  var GROUP_TYPE_DEFS = [
    { id: "general_fitness", label: "General fitness" },
    { id: "prep", label: "Pre-army / selection prep" },
    { id: "youth", label: "Youth / academy" },
    { id: "women_only", label: "Women only" },
    { id: "sport_athletes", label: "Athletes of a sport" },
  ];

  /* A session with no length is a guess with a stopwatch attached, so it is asked for
     and refused when missing — the same rule as the session count and the deload.
     The range is the owner's. */
  var MIN_SESSION_MINUTES = 20;
  var MAX_SESSION_MINUTES = 120;

  /* Seven, because a week in the programme has seven places to write and no more:
     lib/client-program-store.js keys a week by weekday. Fourteen was a number the model
     could not hold — an eighth session had nowhere to live. Two sessions in one day are
     written the way they are actually coached: two parts on the same day card
     (owner, 2026-09-02). */
  var MAX_SESSIONS_PER_WEEK = 7;
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

  function clampAge(v) {
    var n = parseInt(v, 10);
    if (!(n >= MIN_AGE && n <= MAX_AGE)) return 0;
    return n;
  }

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
      /* The checklist. Empty is a legitimate state and it is what every intake answered
         before 2026-09-14 carries: an old questionnaire keeps working and keeps its
         paragraph, and nothing is inferred on the owner's behalf. */
      /* The running track rides here too, on the RUN row: it is not equipment but a property
         of the place, and its LENGTH is what decides whether intervals are possible. Its cap
         is metres, and it is the one number the owner asked to REQUIRE once the row is
         ticked - for a room and for one athlete alike. */
      equipmentList: {},
      /* How many people work at once. Asked as a NUMBER because that is the answer the
         owner actually gave when the question said "stations": he answered capacity, and
         wrote the equipment count in the equipment box, where it belongs (coach agent,
         2026-09-03). */
      maxAthletesAtOnce: 0,
      /* And a room that has no practical ceiling must be able to say so: forcing a number
         would invent a limit that is not there. Absent is not the same as none. */
      noCapacityCap: false,
      /* What this place does NOT do. An operative boundary - "no barbell snatches" -
         buried in a paragraph about atmosphere is a boundary the coach has to infer.
         Same field name as the individual's, deliberately: it is the same idea. */
      avoidInProgram: "",

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
      ageFrom: 0,
      ageTo: 0,
      level: "",
      groupTypes: {},
      /* The one tick that opens percentages for a room. See loadBasisText. */
      maximaTested: false,
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
    out.equipmentList = normalizeEquipmentList(r.equipmentList);
    /* Always asked, whatever the equipment answer was. */
    out.maxAthletesAtOnce = Number.isFinite(parseInt(r.maxAthletesAtOnce, 10)) && parseInt(r.maxAthletesAtOnce, 10) > 0
      ? Math.min(200, parseInt(r.maxAthletesAtOnce, 10))
      : 0;
    out.noCapacityCap = r.noCapacityCap === true;
    out.avoidInProgram = clampText(r.avoidInProgram, 400);

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
    out.ageFrom = clampAge(r.ageFrom);
    out.ageTo = clampAge(r.ageTo);
    out.level = LEVEL_DEFS.some(function (d) {
      return d.id === r.level;
    })
      ? String(r.level)
      : "";
    out.groupTypes = {};
    GROUP_TYPE_DEFS.forEach(function (d) {
      if (isPlainObject(r.groupTypes) && r.groupTypes[d.id] === true) out.groupTypes[d.id] = true;
    });
    out.maximaTested = r.maximaTested === true;
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
    /* The only number on the checklist that is REQUIRED, and only once the row is ticked:
       "there is a run" without a length is the answer that produced a 3 km interval session
       for a place whose track is 3 km long in total (owner, 2026-09-14). Every other blank
       stays legitimate on purpose - a form that nags is a form that gets faked. */
    if (v.equipmentList.RUN && v.equipmentList.RUN.have && !v.equipmentList.RUN.cap) {
      problems.push("There is a running route — how long is it, in metres?");
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
    /* The facts are asked for; the prose is not. A paragraph was required here until
       2026-09-15 and it is what the marks replaced — requiring both would be asking the
       same question twice, which is the habit this round has been breaking. */
    if (!v.ageFrom || !v.ageTo) {
      problems.push("What is the age range in the room? " + MIN_AGE + "-" + MAX_AGE + ".");
    } else if (v.ageFrom > v.ageTo) {
      problems.push("The age range runs from the younger to the older.");
    }
    if (!v.level) {
      problems.push("What is the ability level in the room?");
    }
    return problems;
  }

  /**
   * Weeks created at a time: one month, four weeks — the unit the product is SOLD in.
   * The deload no longer changes this length; it is a cadence laid over the timeline
   * (see deloadEveryWeeks), so a five-week cadence simply means next month opens on a
   * deload rather than that this month grew a fifth week.
   */
  /**
   * The inventory, as the coach receives it.
   *
   * This function is the whole point of the change. What the coach used to get was the
   * owner's paragraph pasted after a single label - eleven unlabelled Hebrew lines running
   * into the next field, with "up to 15 kg dumbbells" buried mid-sentence. He read it as
   * prose, prescribed rings and 22.5 kg, and POL-027 could not stop him because a rule can
   * only be obeyed against a fact, and there was no fact.
   *
   * So: one line per implement, an explicit NOT AVAILABLE for everything unticked, and the
   * scarcity read out rather than left to be worked out from two numbers in different parts
   * of the packet.
   *
   * Returns "" when the checklist was never filled, so an intake answered before 2026-09-14
   * keeps its paragraph exactly as it was. Nothing is inferred on the owner's behalf.
   *
   * @param {object} v         a normalised intake
   * @param {object} [opts]    { room: boolean, maxAtOnce: number }
   */
  function equipmentInventory(v, opts) {
    if (!Catalog || !Array.isArray(Catalog.ITEMS)) return "";
    var list = isPlainObject(v && v.equipmentList) ? v.equipmentList : {};
    /* At least one tick, not merely a list of keys. The form posts all rows whenever the tab
       has been drawn, so an untouched questionnaire arrives as twenty-one false answers -
       indistinguishable from a room that owns nothing. Telling the coach "NOTHING EXISTS"
       because nobody opened the tab is the worst failure available here. */
    var answered = Object.keys(list).some(function (k) {
      return list[k] && list[k].have;
    });
    if (!answered) return "";

    var room = !!(opts && opts.room);
    var atOnce = parseInt(opts && opts.maxAtOnce, 10) || 0;
    var width = 0;
    Catalog.ITEMS.forEach(function (it) {
      if (it.id.length > width) width = it.id.length;
    });

    var rows = [];
    Catalog.ITEMS.forEach(function (it) {
      /* The floor and the wall are not inventory. POL-027 already says they are always
         there, and listing them invites the coach to treat them as optional. */
      if (it.group === "always") return;
      var r = isPlainObject(list[it.id]) ? list[it.id] : null;
      var pad = it.id + new Array(Math.max(1, width - it.id.length + 2)).join(" ");
      if (!r || !r.have) {
        rows.push("  " + pad + " NOT AVAILABLE");
        return;
      }
      var notes = [];
      if (it.metric === "distance") {
        notes.push(r.cap ? "route is " + r.cap + " m long - nothing longer exists" : "length not stated");
      }
      if (it.ceiling === "kg" && r.cap) notes.push("MAX LOAD " + r.cap + " kg - never prescribe heavier");
      if (it.ceiling === "cm" && r.cap) notes.push("height " + r.cap + " cm");
      if (room) {
        if (r.qty && atOnce && r.qty < atOnce) {
          notes.push(
            r.qty + " for a class of " + atOnce + " - a rotation station, NEVER a class-wide piece"
          );
        } else if (r.qty) {
          notes.push(r.qty + " available");
        } else if (it.scarce) {
          /* The owner's rule of 2026-09-14, and the reason Oded's one spin bike became a
             class-wide Bike Erg: blank on a machine is "not stated", not "unlimited". */
          notes.push("count not stated - treat as ONE rotation station, do NOT assume one per athlete");
        }
      }
      rows.push("  " + pad + " available" + (notes.length ? " · " + notes.join(" · ") : ""));
    });

    var out = [
      "EQUIPMENT - CHECKED INVENTORY (HARD). This is the room, item by item. Anything marked",
      "NOT AVAILABLE does not exist here: do not write it, do not scale to it, and do not",
      "substitute another machine for it. Bodyweight, floor and wall work are ALWAYS available",
      "and are never listed here (POL-027).",
    ].concat(rows);

    var extra = String((v && v.equipmentOther) || "").trim();
    if (extra) {
      /* Additive only, and said out loud. A free-text box cannot be checked mechanically, so
         it may widen what is allowed and may never narrow it (owner, 2026-09-09). */
      out.push("ALSO REPORTED, in the owner's words - this ADDS to the list above and never");
      out.push("removes from it: " + extra);
    }
    return out.join("\n");
  }

  function weekCountFor() {
    return WEEKS_PER_MONTH;
  }

  /**
   * Is this week a deload? Counted on the ABSOLUTE week index — week 1 is the first
   * week the client ever trained, not the first week of the current month. That is
   * the whole point: the cycle survives the month boundary.
   * @param {number} absoluteWeekIndex 1-based, continuous across months
   */
  function isDeloadWeek(raw, absoluteWeekIndex, sinceWeek) {
    var v = normalizeIntake(raw);
    var n = parseInt(absoluteWeekIndex, 10);
    if (!v.deloadWeek || !v.deloadEveryWeeks) return false;
    if (!Number.isFinite(n) || n < 1) return false;
    /* Counted from the LAST deload, not from week one.
       The owner set five weeks for a second block whose first block had deloaded on
       week 4 - and got weeks 4 and 5 back to back, because the count restarted from the
       beginning of the programme instead of from the last rest he actually gave
       (owner, 2026-09-03). With no previous deload this is the old arithmetic exactly. */
    var since = parseInt(sinceWeek, 10);
    if (!Number.isFinite(since) || since < 0) since = 0;
    if (n <= since) return false;
    return (n - since) % v.deloadEveryWeeks === 0;
  }

  /**
   * The brief the owner reads while writing. Not a prompt — nothing here reaches a
   * provider (POL-029); it is a reminder of the constraints they set.
   */
  /**
   * The packet a STUDIO intake hands the coach — the twin of the individual's
   * buildFixedIntakePrompt, and deliberately not briefFor().
   *
   * briefFor is a reminder for the owner while he writes by hand; it must never become a
   * prompt, because then one string would be serving two masters and nobody could say
   * which rule it followed (agreed with the coach agent, 2026-09-02). This one is
   * declared, tested, and goes through the PII scrub like the individual's.
   *
   * Every line that carries a decision is present in BOTH directions, and each carries
   * the instruction for the case where there is no answer — a line that only appears
   * when the answer is yes cannot be relied on at all.
   */
  function buildStudioIntakePrompt(raw) {
    var v = normalizeIntake(raw);
    var restNamed = DAY_KEYS.filter(function (k) {
      return v.restDays[k];
    }).map(function (k) {
      return DAY_LABELS[k];
    });
    var emphasisNamed = DAY_KEYS.filter(function (k) {
      return String(v.dayEmphasis[k] || "").trim();
    }).map(function (k) {
      return DAY_LABELS[k] + ": " + String(v.dayEmphasis[k]).trim();
    });
    var types = (v.sessionTypes || []).filter(function (t) {
      return String(t || "").trim();
    });
    var lines = [
      "STUDIO INTAKE COMPLETE - build a full 4-week training brick for this ROOM now.",
      "Answers may be in any language; all workout/program text MUST be English.",
      "Return <<<BLOCK_JSON>>> with exactly 4 weeks. Do not re-ask intake questions.",
      "",
      "POPULATION AND GOALS:",
      "WHO IS IN THE ROOM: " + (populationFacts(v) || "not stated."),
      mergedPopulation(v) || "Nothing further stated - program for the room described above.",
      /* The tick that decides whether a percentage means anything here. Stated in both
         directions, because a line that appears only when the answer is yes cannot be
         relied on (coach agent, 2026-09-02). */
      v.maximaTested === true
        ? "MAXIMA: this room has tested its members' 1RM on the main lifts, so a percentage " +
          "has a number to be a percentage of and each member takes it from their own."
        : "MAXIMA: NOT TESTED in this room. Do not write %1RM - see LOAD BASIS.",
      /* The identity, and then the boundary - the same region, because one is the tone
         and the other is the rule (coach agent, 2026-09-03). */
      String(v.avoidInProgram || "").trim()
        ? "DOES NOT DO: " + String(v.avoidInProgram).trim()
        : "DOES NOT DO: nothing stated.",
      "",
      /* The checklist when it was filled, the old paragraph when it was not. Both shapes
         have to survive: real clients answered this questionnaire before the list existed,
         and their programmes are written by hand and must not be touched. */
      equipmentInventory(v, { room: true, maxAtOnce: v.maxAthletesAtOnce }) ||
        "EQUIPMENT: " +
          (v.equipment === "other"
            ? String(v.equipmentOther || "").trim() || "other - not described."
            : "Well-equipped functional training gym."),
      /* The binding constraint in a room is how many people can work at once. */
      /* Three answers, not two: a room with no ceiling and a question nobody answered
         are different rooms, and the coach does different things in them. */
      v.maxAthletesAtOnce > 0
        ? "MAX AT ONCE: " + v.maxAthletesAtOnce + " athletes at the busiest class."
        : v.noCapacityCap
        ? "MAX AT ONCE: no practical limit - the constraint is the equipment, not the floor space."
        : "MAX AT ONCE: not stated - do NOT assume one station per person.",
      "",
      "SCHEDULE MODE: " + (v.scheduleMode || "not answered."),
    ];
    if (v.scheduleMode === "session_count") {
      lines.push("SESSIONS PER WEEK: " + (v.sessionsPerWeek || "not stated."));
      /* Not hints: these are the coach's cross-cutting instructions for each session in
         order, and layer2-session-count reads them as HARD (coach agent, 2026-09-02). */
      lines.push(
        types.length
          ? "SESSION TYPES (in order, session 1 first):\n" +
            types
              .map(function (t, i) {
                return "  " + (i + 1) + ". " + String(t).trim();
              })
              .join("\n")
          : "SESSION TYPES: none given - the sessions are interchangeable."
      );
      lines.push("WEEKDAYS: none. The sessions have no weekday attached - write them in order.");
    } else if (v.scheduleMode === "weekly_schedule") {
      lines.push(
        v.includeRestDays && restNamed.length
          ? "REST DAYS: " + restNamed.join(", ") + " - no session on these days."
          : v.includeRestDays
          ? "REST DAYS: part of the plan, but no day was named."
          : "REST DAYS: not planned - the coach decides."
      );
      lines.push(
        v.dayEmphasisEnabled && emphasisNamed.length
          ? "DAY EMPHASIS: " + emphasisNamed.join(" | ")
          : "DAY EMPHASIS: none given - no weekday carries a fixed emphasis."
      );
    }
    lines.push(
      "SESSION LENGTH: " +
        (v.sessionMinutes ? v.sessionMinutes + " minutes (warm-up included)." : "not stated.")
    );
    lines.push(
      v.deloadWeek && v.deloadEveryWeeks
        ? "DELOAD CADENCE: every " + v.deloadEveryWeeks +
          " weeks, counted continuously across months. The block being built states which of its weeks is the deload; do NOT choose a different one and do NOT add a fifth week."
        : "DELOAD: none in this programme. Do NOT add one, and do NOT add a fifth week."
    );
    return lines.join("\n");
  }

  function briefFor(raw) {
    var v = normalizeIntake(raw);
    var lines = [];
    lines.push(
      equipmentInventory(v, { room: true, maxAtOnce: v.maxAthletesAtOnce }) ||
        "EQUIPMENT: " +
          (v.equipment === "other" ? v.equipmentOther : "Well-equipped functional training gym")
    );
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
    lines.push("WHO IS IN THE ROOM: " + (populationFacts(v) || "—"));
    lines.push("POPULATION / LIMITS / GOALS: " + (mergedPopulation(v) || "—"));
    lines.push("MAXIMA TESTED: " + (v.maximaTested === true ? "yes" : "no"));
    return lines.join("\n");
  }

  /**
   * The one free-text box, for a client written before the two tabs were merged: their
   * goals text is carried into it rather than dropped on the floor.
   */
  /**
   * Who is in the room, in one line the coach can act on.
   *
   * These are the answers the paragraph used to bury. The line is also what reaches the
   * layer router as stated intent — a studio whose population is only marks would
   * otherwise select no discipline layer at all (see lib/coach-layers).
   */
  function populationFacts(v) {
    var out = [];
    if (v.ageFrom && v.ageTo) out.push("ages " + v.ageFrom + "-" + v.ageTo);
    else if (v.ageFrom) out.push("from age " + v.ageFrom);
    else if (v.ageTo) out.push("up to age " + v.ageTo);
    var lvl = LEVEL_DEFS.filter(function (d) {
      return d.id === v.level;
    })[0];
    if (lvl) out.push(lvl.label.toLowerCase());
    var kinds = GROUP_TYPE_DEFS.filter(function (d) {
      return v.groupTypes && v.groupTypes[d.id] === true;
    }).map(function (d) {
      return d.label.toLowerCase();
    });
    if (kinds.length) out.push(kinds.join(", "));
    return out.join(" · ");
  }

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
    LEVEL_DEFS: LEVEL_DEFS,
    GROUP_TYPE_DEFS: GROUP_TYPE_DEFS,
    MIN_AGE: MIN_AGE,
    MAX_AGE: MAX_AGE,
    populationFacts: populationFacts,
    MAX_SESSIONS_PER_WEEK: MAX_SESSIONS_PER_WEEK,
    WEEKS_PER_MONTH: WEEKS_PER_MONTH,
    MIN_SESSION_MINUTES: MIN_SESSION_MINUTES,
    MAX_SESSION_MINUTES: MAX_SESSION_MINUTES,
    mergedPopulation: mergedPopulation,
    MIN_DELOAD_EVERY: MIN_DELOAD_EVERY,
    MAX_DELOAD_EVERY: MAX_DELOAD_EVERY,
    isDeloadWeek: isDeloadWeek,
    emptyIntake: emptyIntake,
    emptyEquipmentRow: emptyEquipmentRow,
    equipmentInventory: equipmentInventory,
    normalizeIntake: normalizeIntake,
    validateIntake: validateIntake,
    weekCountFor: weekCountFor,
    buildStudioIntakePrompt: buildStudioIntakePrompt,
    briefFor: briefFor,
  };
});
