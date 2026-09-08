/**
 * A client's file, in the language the coach's brain reads.
 *
 * The owner is the only person who ever sits in the back office, and what he asked for
 * is plain: he fills in an intake there and gets a whole month of training back
 * (owner, 2026-09-08). His rule about "no AI for the user" is about the APP and about
 * the page a client opens by link — never about his own module.
 *
 * The two worlds already speak the same language, which is why this file is a
 * translation and not an invention:
 *
 *  - a STUDIO's questionnaire is stored as `program.intake`, which is exactly the
 *    normalised studio intake the brain's router expects as `studioIntake` — and
 *    lib/client-intake.js already writes the room's brief for it;
 *  - an INDIVIDUAL's eight steps are stored as `program.athleteIntake`, which is what
 *    lib/coach-intake-sync-contract.js turns into an athleteProfile, packet and all.
 *
 * The presence of `studioIntake` is what tells the brain it is programming a ROOM
 * rather than a person, so it is sent for a studio and never for anybody else.
 *
 * A BLANK client is deliberately absent: that kind exists so the owner can write by
 * hand, and the brain has nothing to read there.
 *
 * Browser: <script src="lib/coach-client-brief.js"></script> → CoachClientBrief
 * Node: require("./coach-client-brief")
 *
 * 0 LLM here. It prepares a request; it does not send one.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./client-intake.js"),
      require("./coach-intake-sync-contract.js")
    );
  } else {
    /* NOT resolved here.
       In the browser this file is a <script> among twenty, and the ones it leans on may
       be further down the list — client-intake.js is. Capturing the globals now would
       capture undefined for ever, which is exactly what it did: the panel opened saying
       "the studio brief builder is not loaded" while the file was sitting right there
       (owner, 2026-09-08). They are read at CALL time instead, by name and by both
       names the product uses: lib/client-intake.js publishes CLIENT_INTAKE. */
    root.CoachClientBrief = factory(null, null);
  }
})(typeof self !== "undefined" ? self : this, function (ClientIntakeIn, CoachIntakeSyncIn) {
  "use strict";

  /** The two libraries this one reads, resolved when they are needed. */
  function libs() {
    const g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {};
    return {
      intake: ClientIntakeIn || g.CLIENT_INTAKE || g.ClientIntake || null,
      contract: CoachIntakeSyncIn || g.CoachIntakeSync || null,
    };
  }

  /* Whose programme the brain may be asked to write. */
  const STUDIO = "coach";
  const INDIVIDUAL = "athlete";

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  /**
   * May the brain write this client's month?
   *
   * @returns {{ok:boolean, kind?:string, why?:string}}
   */
  function canBrainWrite(program) {
    if (!isPlainObject(program)) return { ok: false, why: "אין תוכנית פתוחה" };
    const kind = String(program.clientKind || STUDIO);
    if (kind === "blank") {
      return { ok: false, why: "לקוח ריק נבנה בשבילך ידנית — המאמן לא כותב בו" };
    }
    if (kind === STUDIO && !isPlainObject(program.intake)) {
      return { ok: false, why: "אין תשאול סטודיו על הלקוח הזה" };
    }
    if (kind === INDIVIDUAL && !isPlainObject(program.athleteIntake)) {
      return { ok: false, why: "אין תחקיר אישי על הלקוח הזה" };
    }
    return { ok: true, kind: kind };
  }

  /** Which week of the plan this block starts on — 1, 5, 9… */
  function blockStartWeekOf(program, blockIndex1) {
    const blocks = isPlainObject(program) && Array.isArray(program.blocks) ? program.blocks : [];
    const want = parseInt(blockIndex1, 10);
    for (const b of blocks) {
      if ((parseInt(b && b.blockIndex, 10) || 0) === want) {
        return Math.max(1, parseInt(b.startWeek, 10) || 1);
      }
    }
    return 1;
  }

  /**
   * Everything one `generate_block` needs, read off the client.
   *
   * @param {object} o
   * @param {object} o.program the client programme, as the back office holds it
   * @param {number} [o.blockIndex] which block is being written, 1-based
   * @param {object} [o.costCaps] his own spend caps, so the server can refuse
   * @param {string} [o.handoff] last month, for a continuation — see coach-block-handoff
   * @returns {{ok:boolean, body?:object, kind?:string, why?:string}}
   */
  function blockRequestFor(o) {
    const src = isPlainObject(o) ? o : {};
    const program = isPlainObject(src.program) ? src.program : null;
    const allowed = canBrainWrite(program);
    if (!allowed.ok) return allowed;

    const blockIndex = Math.max(1, parseInt(src.blockIndex, 10) || 1);
    const startWeek = blockStartWeekOf(program, blockIndex);
    const kind = allowed.kind;
    const resolved = libs();
    const contract = resolved.contract;
    const intakeLib = resolved.intake;
    if (!contract || !contract.athleteProfileForGenerateBlock) {
      return { ok: false, why: "החוזה של התחקיר לא נטען" };
    }

    let profileSource;
    let messageText = "";
    let studioIntake = null;

    if (kind === STUDIO) {
      const intake = program.intake;
      if (!intakeLib || !intakeLib.buildStudioIntakePrompt) {
        return { ok: false, why: "בונה התשאול של הסטודיו לא נטען" };
      }
      studioIntake = intake;
      messageText = String(intakeLib.buildStudioIntakePrompt(intake) || "");
      /* A room has no person. What the profile carries for a studio is the arithmetic
         the brain must not guess at: how long a block is, and which week deloads. */
      profileSource = {
        displayName: String(intake.clientName || program.clientName || ""),
        deloadEveryWeeks: parseInt(intake.deloadEveryWeeks, 10) || 0,
        blockStartWeek: startWeek,
        sessionMinutes: parseInt(intake.sessionMinutes, 10) || 0,
        avoidInProgram: String(intake.avoidInProgram || ""),
        goals: String(intake.goals || ""),
        intakeComplete: true,
      };
    } else {
      const athlete = program.athleteIntake;
      profileSource = Object.assign({}, athlete, {
        blockStartWeek: startWeek,
        intakeComplete: true,
      });
      const built = contract.normalizeIntakeProfile
        ? contract.normalizeIntakeProfile(profileSource)
        : profileSource;
      messageText = String(built.fixedIntakePacket || "");
    }

    /* A studio can answer "yes, deload" without naming a cadence — the room's form has
       a tick and a number, and the tick alone means the default four (owner's studio
       form, lib/client-intake.js). Passed explicitly, because the deload WEEK is what
       the brain counts the 1RM window from and it must never be guessed. */
    let cadence = parseInt(profileSource.deloadEveryWeeks, 10) || 0;
    if (!cadence && kind === STUDIO && program.intake && program.intake.deloadWeek === true) {
      cadence = 4;
    }
    const athleteProfile = contract.athleteProfileForGenerateBlock(
      Object.assign({}, profileSource, { deloadEveryWeeks: cadence }),
      {
        forceIntakeComplete: true,
        blockStartWeek: startWeek,
        deloadEveryWeeks: cadence,
        costCaps: isPlainObject(src.costCaps) ? src.costCaps : undefined,
      }
    );
    if (!messageText.trim()) return { ok: false, why: "אין תשאול לשלוח למאמן" };

    const body = {
      action: "generate_block",
      messages: [{ role: "user", text: messageText.slice(0, 6000) }],
      athleteProfile: athleteProfile,
      intakeComplete: true,
      forceJson: true,
      /* The owner is the one asking, from his own module. */
      adminProgramming: true,
      blockStartWeek: startWeek,
    };
    if (studioIntake) body.studioIntake = studioIntake;
    if (isPlainObject(src.costCaps)) body.costCaps = src.costCaps;
    if (src.handoff) body.blockHandoff = String(src.handoff);
    return { ok: true, kind: kind, body: body, blockStartWeek: startWeek, athleteProfile: athleteProfile, studioIntake: studioIntake };
  }

  /**
   * The weeks of one block, and where they sit in the programme.
   *
   * The brain writes a block at a time, and the block being written is the one whose
   * weeks are on screen — never the whole programme (owner, 2026-09-08: a month is a
   * month, and one already approved is not rewritten).
   */
  function blockWeekWindow(program, blockIndex1) {
    const blocks = isPlainObject(program) && Array.isArray(program.blocks) ? program.blocks : [];
    const weeks = isPlainObject(program) && Array.isArray(program.weeks) ? program.weeks : [];
    const want = parseInt(blockIndex1, 10);
    for (const b of blocks) {
      if ((parseInt(b && b.blockIndex, 10) || 0) !== want) continue;
      const start = Math.max(1, parseInt(b.startWeek, 10) || 1);
      const count = Math.max(0, parseInt(b.weekCount, 10) || 0);
      return { fromIndex: start - 1, count: count, weeks: weeks.slice(start - 1, start - 1 + count) };
    }
    return { fromIndex: 0, count: weeks.length, weeks: weeks.slice() };
  }

  return {
    STUDIO,
    INDIVIDUAL,
    canBrainWrite,
    blockStartWeekOf,
    blockRequestFor,
    blockWeekWindow,
  };
});
