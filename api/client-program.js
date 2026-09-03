/**
 * Client programs — the delivery surface (POL-029).
 *
 * Two callers, two very different sets of rights, one endpoint:
 *
 *   OWNER  (admin password or session token) — creates a program, writes the
 *          training, issues access codes, sees devices, clears the unread flag.
 *   CLIENT (device token minted by redeeming a code) — reads their own program,
 *          signs the terms once, and edits the training freely.
 *
 * What this file deliberately does NOT have: any path to an AI provider. Not a
 * hidden one, not a disabled one — none. There is no Gemini or Groq call anywhere
 * in this module, so "the client has no AI exposure" is a property of the code
 * rather than a promise about the UI. That matters because the same product
 * already shipped a switched-off UI over a live endpoint once (generate-workout,
 * retired in 21.6) and we are not repeating it.
 *
 * Env: BLOB_READ_WRITE_TOKEN (storage), ADMIN_PASSWORD / ADMIN_SESSION_SECRET (owner),
 *      CLIENT_ACCESS_SECRET (optional; falls back to the admin secrets for hashing).
 */

"use strict";

const { applyCors } = require("../lib/cors-allowlist.js");
const { checkRateLimit, sendRateLimit, clientIp } = require("../lib/rate-limit.js");
const {
  checkAdminAuth,
  adminAuthDenied,
  sessionSecretReady,
  sessionSecretSource,
  MIN_SESSION_SECRET_LEN,
  mintAdminSessionToken,
  adminAuthUsedPassword,
} = require("../scripts/lib/admin/admin-auth.js");
const crypto = require("crypto");
const JsonStore = require("../scripts/lib/admin/admin-json-store.js");
const ProgramStore = require("../lib/client-program-store.js");
const Access = require("../lib/client-access.js");
const Payload = require("../lib/client-view-payload.js");
const Terms = require("../lib/client-terms.js");
const Intake = require("../lib/client-intake.js");
const Renewal = require("../lib/client-renewal.js");

/** Today, on the owner's calendar — the blocks are planned in Israel time. */
function israelTodayIso() {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}
const { sendAppMail, hasMailProvider } = require("../lib/send-app-mail.js");
const { resolveAppMailTo } = require("../lib/app-mail.js");

/* One email per changed workout, then quiet on that same workout. State lives on
   the program itself, so this works on serverless with no scheduler (checklist a.2.3). */
const EDIT_MAIL_QUIET_MS = 10 * 60 * 1000;

/* Oldest bundled app build still considered fine. Deliberately behind the current
   release: nothing about 21.7 breaks an older install, so nobody is nagged yet.
   Raise it only when a stale bundle would actually misbehave. */
const MIN_APP_VERSION = String(process.env.MIN_APP_VERSION || "21.0").trim();

const store = ProgramStore.createProgramStore({
  getJson: JsonStore.getJson,
  putJson: JsonStore.putJson,
  putJsonExclusive: JsonStore.putJsonExclusive,
  deleteJson: JsonStore.deleteJson,
  listJson: JsonStore.listJson,
});

function corsFor(req, res) {
  applyCors(req, res, {
    methods: "GET, POST, OPTIONS",
    headers: "Content-Type, X-Admin-Password, X-Admin-Token, X-Client-Token",
  });
}

/** A short fingerprint of the whole client list: same clients, same versions, same stamp. */
function stampForRows(rows) {
  const parts = (Array.isArray(rows) ? rows : [])
    .map(function (r) {
      return String((r && r.programId) || "") + ":" + String((r && r.version) || "") +
        ":" + String((r && r.updatedAt) || "") + ":" + String((r && r.unreadCount) || 0);
    })
    .sort();
  return crypto.createHash("sha1").update(parts.join("|"), "utf8").digest("hex").slice(0, 16);
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function bad(res, status, code, error, extra) {
  return res.status(status).json(Object.assign({ ok: false, code: code, error: error }, extra || {}));
}

function parseBody(req) {
  const raw = req && req.body;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw || "{}");
    } catch (e) {
      return null;
    }
  }
  return typeof raw === "object" ? raw : {};
}

function readAccess(programId) {
  return JsonStore.getJson(Access.accessKey(programId));
}

function writeAccess(programId, access) {
  return JsonStore.putJson(Access.accessKey(programId), access);
}

/** The client's credential — never a URL parameter, so it stays out of logs and history. */
function clientTokenFrom(req, body) {
  const headers = (req && req.headers) || {};
  return String(headers["x-client-token"] || (body && body.clientToken) || "").slice(0, 200);
}

/* ---------------------------------------------------------------------------
 * Owner
 * ------------------------------------------------------------------------- */

async function ownerHandler(req, res, body) {
  const action = String(body.action || "").toLowerCase();

  if (action === "list") {
    /* Mint a session token on a PASSWORD login, exactly as /api/admin-snapshot does.
     *
     * Without this the owner had to retype the password on every visit to the clients
     * page — and, worse, again after arriving from admin.html — because this endpoint
     * accepted the password and then handed back nothing to remember. Not the missing
     * env var, which is what it looked like: my endpoint simply never minted.
     *
     * Header only, never the JSON body, and only on a password login — never on a
     * token poll, which would refresh a session forever. */
    if (adminAuthUsedPassword(req)) {
      const tok = mintAdminSessionToken(undefined, {
        remember: !!(body.rememberMe || body.remember),
      });
      if (tok) {
        try {
          res.setHeader("X-Admin-Session-Token", tok);
        } catch (eHdr) {}
      }
    }
    const idx = await store.readIndex();
    if (!idx.ok) return bad(res, 503, idx.code, idx.error);
    const rows = idx.index.rows || [];
    /* Free text for the method, a number for the amount, so a total is possible
       (checklist a.3.4 / a.3.5). Owner-only — see lib/client-view-payload.js. */
    const monthlyTotal = rows.reduce(function (sum, r) {
      const n = Number(r && r.monthlyAmount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    /* The reminder rides on the page the owner opens anyway. It is bounded — the index
       says who is due, so this costs nothing on a normal load — and it is stamped per
       block, so it cannot repeat. A failure here must never cost him the list, which is
       what he actually came for. */
    let renewal = { checked: 0, mailed: 0 };
    try {
      renewal = await runRenewalCheck(store, israelTodayIso(), 5);
    } catch (e) {
      renewal = { checked: 0, mailed: 0, error: String((e && e.message) || e) };
    }
    return res.status(200).json({
      ok: true,
      rows: rows,
      /* What the poll compares against — see action "list_stamp". */
      stamp: stampForRows(rows),
      monthlyTotal: monthlyTotal,
      unreadTotal: rows.reduce(function (s, r) {
        return s + (Number(r && r.unreadCount) || 0);
      }, 0),
      renewal: renewal,
    });
  }

  if (action === "renewal_check") {
    const result = await runRenewalCheck(store, String(body.todayIso || israelTodayIso()), 20);
    return res.status(200).json({ ok: true, renewal: result });
  }

  /**
   * Remove every client, in one call — the twin of admin_purge_all.
   *
   * Same reason: one request per client meant failures nobody saw. The access row goes
   * with the program, so no code and no linked device survives it.
   */
  if (action === "purge_all") {
    const idx = await store.readIndex();
    if (!idx.ok) return bad(res, 503, idx.code, idx.error);
    const rows = (idx.index && idx.index.rows) || [];
    const removed = [];
    const failed = [];
    for (const row of rows) {
      const id = String((row && row.programId) || "");
      if (!id) continue;
      try {
        const del = await store.deleteProgram(id);
        if (!del.ok) {
          failed.push({ id: id, why: del.error || del.code });
          continue;
        }
        try {
          await JsonStore.deleteJson(Access.accessKey(id));
        } catch (eAcc) {}
        removed.push({ id: id, name: row.clientName || id });
      } catch (e) {
        failed.push({ id: id, why: String((e && e.message) || e).slice(0, 120) });
      }
    }
    return res.status(200).json({ ok: true, removed: removed, failed: failed });
  }

  /**
   * "Has any client changed anything?" — one small read of the index.
   *
   * The index carries a version and an updatedAt per client, which is exactly enough to
   * answer without touching a single program. Never a list: that is the arithmetic that
   * suspended the Blob store on 2026-09-02.
   */
  if (action === "list_stamp") {
    const idx = await store.readIndex();
    if (!idx.ok) return bad(res, 503, idx.code, idx.error);
    const rows = (idx.index && idx.index.rows) || [];
    return res.status(200).json({ ok: true, stamp: stampForRows(rows), count: rows.length });
  }

  if (action === "rebuild_index") {
    const rebuilt = await store.rebuildIndex();
    if (!rebuilt.ok) return bad(res, 503, rebuilt.code, rebuilt.error);
    return res.status(200).json({ ok: true, count: rebuilt.count });
  }

  if (action === "create") {
    /* A coach/studio client is created FROM the cross-cutting intake, and the intake
     * is what decides the block's shape: a month of four weeks, with the deload laid
     * over the timeline as a cadence (owner, 2026-09-01). An end-athlete client keeps
     * the old path. */
    const wantsIntake = body.clientKind !== "athlete";
    let intake = null;
    let weekCount = body.weekCount;
    /* An individual athlete answers a different questionnaire (the eight-step one the
       app uses), but the block is shaped by the same two facts: which weekdays they
       train, and the deload cadence. So their answers are folded into the same shape
       rather than growing a second way to lay out a month. */
    let athleteIntake = null;
    if (!wantsIntake && isPlainObject(body.athleteIntake)) {
      athleteIntake = body.athleteIntake;
      const trains = isPlainObject(athleteIntake.trainingDaysMap)
        ? athleteIntake.trainingDaysMap
        : {};
      const rest = {};
      for (const k of Intake.DAY_KEYS) rest[k] = trains[k] !== true;
      const trainingCount = Intake.DAY_KEYS.filter((k) => !rest[k]).length;
      intake = Intake.normalizeIntake({
        clientName: body.clientName,
        scheduleMode: "weekly_schedule",
        /* Every day they did not tick IS a rest day — that is what the eight-step
           intake means by picking training days. */
        includeRestDays: trainingCount > 0,
        restDays: rest,
        sessionsPerWeek: trainingCount,
        sessionMinutes: athleteIntake.sessionMinutes,
        /* His own answer, not ours. Every individual used to get "no deload week falls
           inside this block" because the question did not exist; hard-coding four instead
           would be the same mistake with a nicer number (coach agent + owner,
           2026-09-03). */
        deloadWeek: parseInt(athleteIntake.deloadEveryWeeks, 10) > 0,
        deloadEveryWeeks: parseInt(athleteIntake.deloadEveryWeeks, 10) > 0
          ? parseInt(athleteIntake.deloadEveryWeeks, 10)
          : 0,
        population: "Individual athlete",
        goals: String(athleteIntake.goals || "").slice(0, 600),
      });
      weekCount = Intake.weekCountFor(intake);
    }
    if (wantsIntake && body.intake) {
      const problems = Intake.validateIntake(body.intake);
      if (problems.length) {
        return bad(res, 400, "INTAKE_INCOMPLETE", problems.join(" "), { problems: problems });
      }
      intake = Intake.normalizeIntake(body.intake);
      weekCount = Intake.weekCountFor(intake);
    }
    const created = await store.createProgram({
      clientName: (intake && intake.clientName) || body.clientName,
      clientKind: body.clientKind,
      blockStart: body.blockStart,
      weekCount: weekCount,
      intake: intake,
    });
    if (!created.ok) return bad(res, 400, created.code, created.error);
    /* The eight-step answers, kept whole. Nothing reads them today — the coach is
       disconnected while the skeleton is built — and they are what makes reconnecting
       him in production one switch rather than a second intake. */
    if (athleteIntake) {
      const withIntake = await store.updateProgram(
        created.program.programId,
        created.program.version,
        function (draft) {
          draft.athleteIntake = athleteIntake;
          /* An individual is a paying client like any other, and the list totals what
             they pay (owner, 2026-09-03). */
          const amount = Number(body.monthlyAmount);
          draft.monthlyAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
          draft.paymentMethod = String(body.paymentMethod || "").slice(0, 200);
          return draft;
        },
        { actor: "owner" }
      );
      if (withIntake.ok) {
        return res.status(200).json({ ok: true, program: withIntake.program });
      }
    }
    /* Carry the payment terms onto the program so the list can total them. */
    if (intake) {
      const withPay = await store.updateProgram(
        created.program.programId,
        created.program.version,
        function (draft) {
          draft.monthlyAmount = intake.monthlyAmount;
          draft.paymentMethod = intake.paymentMethod;
          return draft;
        },
        { actor: "owner" }
      );
      if (withPay.ok) {
        return res.status(200).json({ ok: true, program: withPay.program, brief: Intake.briefFor(intake) });
      }
    }
    return res.status(200).json({ ok: true, program: created.program });
  }

  const programId = String(body.programId || "").slice(0, 60);
  if (!programId) return bad(res, 400, "NO_PROGRAM", "programId is required");

  if (action === "read") {
    const read = await store.readProgram(programId);
    if (!read.ok) return bad(res, read.code === "NOT_FOUND" ? 404 : 503, read.code, read.error);
    let access = null;
    try {
      access = Access.accessForOwner(await readAccess(programId));
    } catch (e) {}
    /* The owner sees everything on the program — this is their back office. */
    return res.status(200).json({ ok: true, program: read.program, access: access, fromCache: !!read.fromCache });
  }

  /**
   * Freeze or unfreeze a client.
   *
   * Nothing is deleted and no device is unlinked — the client simply cannot open their
   * plan until the owner says otherwise. The flag is written to the program (the truth)
   * and mirrored onto the access row, because the access row is what every client
   * request already reads. Checking the program at the door instead would put a paid
   * read on every single client call.
   */
  if (action === "set_frozen") {
    const frozen = body.frozen === true;
    const result = await store.updateProgram(
      programId,
      Number(body.expectedVersion),
      function (draft) {
        draft.frozen = frozen;
        return draft;
      },
      { actor: "owner" }
    );
    if (!result.ok) {
      const status = result.code === "VERSION_CONFLICT" ? 409 : result.code === "NOT_FOUND" ? 404 : 400;
      return res.status(status).json(Object.assign({ ok: false }, result));
    }
    /* The mirror. If it fails the program is still frozen, so say so rather than
       reporting a success the door does not know about. */
    let doorClosed = true;
    try {
      const row = await readAccess(programId);
      if (row) await writeAccess(programId, Object.assign({}, row, { frozen: frozen }));
      else doorClosed = false;
    } catch (e) {
      doorClosed = false;
    }
    return res.status(200).json({
      ok: true,
      program: result.program,
      version: result.version,
      frozen: frozen,
      doorClosed: doorClosed,
    });
  }

  if (action === "save") {
    const patch = body.program;
    if (!patch || typeof patch !== "object") return bad(res, 400, "NO_PROGRAM_BODY", "program is required");
    const result = await store.updateProgram(
      programId,
      Number(body.expectedVersion),
      function (draft) {
        /* The owner authors freely, but identity and bookkeeping stay server-owned. */
        if (Array.isArray(patch.weeks)) draft.weeks = patch.weeks;
        if (patch.clientName !== undefined) draft.clientName = String(patch.clientName).slice(0, 120);
        if (patch.clientColour !== undefined) {
          const col = String(patch.clientColour || "");
          draft.clientColour = /^#[0-9a-f]{6}$/i.test(col) ? col : "";
        }
        if (patch.clientKind !== undefined) draft.clientKind = patch.clientKind === "athlete" ? "athlete" : "coach";
        if (patch.blockStart !== undefined) draft.blockStart = String(patch.blockStart).slice(0, 10);
        if (patch.paymentMethod !== undefined) draft.paymentMethod = String(patch.paymentMethod).slice(0, 200);
        if (patch.monthlyAmount !== undefined) {
          const n = Number(patch.monthlyAmount);
          draft.monthlyAmount = Number.isFinite(n) && n >= 0 ? n : 0;
        }
        return draft;
      },
      {
        actor: "owner",
        clearUnread: Array.isArray(body.clearUnread) ? body.clearUnread : undefined,
        clearReviewed: Array.isArray(body.clearUnread) ? body.clearUnread : undefined,
      }
    );
    if (!result.ok) {
      const status = result.code === "VERSION_CONFLICT" ? 409 : result.code === "NOT_FOUND" ? 404 : 400;
      return res.status(status).json(Object.assign({ ok: false }, result));
    }
    return res.status(200).json({ ok: true, program: result.program, version: result.version });
  }

  /* The next block. Four more weeks on the same timeline, so the deload cadence carries
   * over the boundary instead of restarting (owner, 2026-09-01). It carries the answers
   * the owner just revised in the mini-intake and his notes for it, and it arrives
   * UNAPPROVED — the client sees nothing of it until it is sent.
   * Empty weeks: this endpoint has no route to a provider and creates no content. */
  if (action === "add_block") {
    /* An individual's month is shaped by the days THEY train, and that is on their own
       answers - not on a rest-days checkbox in a form written for studios. Read from the
       programme, so a new block lands on the same weekdays as the first (owner,
       2026-09-03). */
    let blockIntake =
      body.intake && typeof body.intake === "object" ? Intake.normalizeIntake(body.intake) : null;
    if (blockIntake) {
      const read = await store.readProgram(programId);
      /* The days he answered in THIS mini-intake win over the ones on file: he may have
         just changed them, and the block being created is the one they apply to
         (owner, 2026-09-03). */
      const patchDays = isPlainObject(body.athleteIntake) ? body.athleteIntake.trainingDaysMap : null;
      const days = isPlainObject(patchDays)
        ? patchDays
        : read.ok && isPlainObject(read.program.athleteIntake)
        ? read.program.athleteIntake.trainingDaysMap
        : null;
      if (isPlainObject(days)) {
        const rest = {};
        for (const k of Intake.DAY_KEYS) rest[k] = days[k] !== true;
        const trains = Intake.DAY_KEYS.filter((k) => !rest[k]).length;
        if (trains > 0) {
          /* His own cadence, from this mini-intake or from the file - never the studio
             form's default (owner, 2026-09-03). */
          const storedEvery =
            read.ok && isPlainObject(read.program.athleteIntake)
              ? parseInt(read.program.athleteIntake.deloadEveryWeeks, 10)
              : 0;
          const patchEvery = isPlainObject(body.athleteIntake)
            ? parseInt(body.athleteIntake.deloadEveryWeeks, 10)
            : NaN;
          const every = Number.isFinite(patchEvery) ? patchEvery : storedEvery;
          blockIntake = Intake.normalizeIntake(
            Object.assign({}, blockIntake, {
              scheduleMode: "weekly_schedule",
              includeRestDays: true,
              restDays: rest,
              sessionsPerWeek: trains,
              deloadWeek: every > 0,
              deloadEveryWeeks: every > 0 ? every : 0,
              sessionMinutes:
                (isPlainObject(body.athleteIntake) && parseInt(body.athleteIntake.sessionMinutes, 10)) ||
                blockIntake.sessionMinutes,
            })
          );
        }
      }
    }
    const result = await store.addBlock(programId, Number(body.expectedVersion), {
      intake: blockIntake,
      notes: body.notes,
      /* An individual answers about themselves again for a new block: what they are
         training for, and what has to be worked around. It is a PATCH onto the answers
         already on the programme - a new block must not erase the eight-step packet the
         coach will read (owner, 2026-09-03). */
      athleteIntake: isPlainObject(body.athleteIntake) ? body.athleteIntake : null,
      /* A new block is when a price changes. Undefined means "not asked", which is not
         the same as zero. */
      monthlyAmount: body.monthlyAmount === undefined ? undefined : Number(body.monthlyAmount),
      paymentMethod: body.paymentMethod === undefined ? undefined : String(body.paymentMethod).slice(0, 200),
    });
    if (!result.ok) {
      const status =
        result.code === "VERSION_CONFLICT" ? 409 : result.code === "NOT_FOUND" ? 404 : 400;
      return res.status(status).json(Object.assign({ ok: false }, result));
    }
    return res.status(200).json({
      ok: true,
      program: result.program,
      version: result.version,
      added: result.added,
      blockIndex: result.blockIndex,
    });
  }

  /* Send a block to the client. Block ONE goes through this too: creating a client
   * hands them nothing until the owner presses it. */
  if (action === "approve_block") {
    const result = await store.approveBlock(
      programId,
      Number(body.expectedVersion),
      body.blockIndex
    );
    if (!result.ok) {
      const status =
        result.code === "VERSION_CONFLICT" ? 409 : result.code === "NOT_FOUND" ? 404 : 400;
      return res.status(status).json(Object.assign({ ok: false }, result));
    }
    return res.status(200).json({
      ok: true,
      program: result.program,
      version: result.version,
      approvedBlock: result.approvedBlock,
    });
  }

  /* Opening a changed day is what clears its flag — no extra click (a.2.2). */
  if (action === "mark_read") {
    const tags = Array.isArray(body.days) ? body.days : [];
    if (!tags.length) return bad(res, 400, "NO_DAYS", "days is required");
    const result = await store.updateProgram(
      programId,
      Number(body.expectedVersion),
      function (draft) {
        return draft;
      },
      /* Opening a day is reviewing it: the client's flag and the owner's own
         "not been over this yet" mark come down in the same write. */
      { actor: "owner", clearUnread: tags, clearReviewed: tags }
    );
    if (!result.ok) {
      const status = result.code === "VERSION_CONFLICT" ? 409 : 400;
      return res.status(status).json(Object.assign({ ok: false }, result));
    }
    return res.status(200).json({ ok: true, unreadDays: result.program.unreadDays, version: result.version });
  }

  if (action === "issue_code") {
    const current = await readAccess(programId);
    const issued = Access.issueCode(current, { programId: programId, label: body.label });
    if (!issued.ok) return bad(res, 400, issued.code, issued.error);
    try {
      await writeAccess(programId, issued.access);
    } catch (e) {
      return bad(res, 503, "WRITE_FAILED", String((e && e.message) || e));
    }
    /* Returned once and never stored in the clear. Lose it and issue another. */
    return res.status(200).json({ ok: true, code: issued.code, expiresAt: issued.expiresAt });
  }

  if (action === "revoke_codes") {
    const current = await readAccess(programId);
    const pulled = Access.revokeOpenCodes(current, { programId: programId });
    try {
      await writeAccess(programId, pulled.access);
    } catch (e) {
      return bad(res, 503, "WRITE_FAILED", String((e && e.message) || e));
    }
    return res.status(200).json({ ok: true, revoked: pulled.revoked });
  }

  if (action === "revoke_device") {
    const current = await readAccess(programId);
    const revoked = Access.revokeDevice(current, body.deviceId, { programId: programId });
    if (!revoked.ok) return bad(res, 404, revoked.code, revoked.error);
    try {
      await writeAccess(programId, revoked.access);
    } catch (e) {
      return bad(res, 503, "WRITE_FAILED", String((e && e.message) || e));
    }
    return res.status(200).json({ ok: true, access: Access.accessForOwner(revoked.access) });
  }

  if (action === "delete") {
    const del = await store.deleteProgram(programId);
    if (!del.ok) return bad(res, 503, del.code, del.error);
    try {
      await JsonStore.deleteJson(Access.accessKey(programId));
    } catch (e) {}
    return res.status(200).json({ ok: true });
  }

  return bad(res, 400, "UNKNOWN_ACTION", "unknown owner action");
}

/* ---------------------------------------------------------------------------
 * Client
 * ------------------------------------------------------------------------- */

/**
 * A client signed the B2B terms — the owner is told, exactly as he is told when an
 * athlete finishes intake ("<name> has joined the DUCK'S !", api/coach-feedback.js).
 * The owner asked for one rule across both products (2026-09-01): a signature is the
 * moment somebody actually joined, and it must not pass silently.
 *
 * No client email or phone exists to report — by design (POL-029). What the owner gets
 * is who, which program, which terms, and a link straight into the back office.
 */
/**
 * The reminder the owner asked for: a week before a client's block ends, one mail that
 * says who and points straight at their page. One per block — the stamp lives on the
 * block itself, so opening the clients page ten times sends nothing extra.
 *
 * The scan is driven off the index (which carries each client's block end date), so a
 * page load costs one small read plus a full read only for the clients actually due.
 */
async function runRenewalCheck(store, todayIso, limit) {
  const out = { checked: 0, mailed: 0, failures: [] };
  if (!hasMailProvider()) return Object.assign(out, { skipped: "no_mail_provider" });
  const to = resolveAppMailTo();
  if (!to) return Object.assign(out, { skipped: "no_recipient" });

  const idx = await store.readIndex();
  const rows = (idx && idx.ok && idx.index && idx.index.rows) || [];
  const candidates = rows.filter(function (r) {
    if (!r || r.renewalMailed || !r.blockEndIso) return false;
    const days = Math.round((Date.parse(r.blockEndIso + "T00:00:00Z") - Date.parse(todayIso + "T00:00:00Z")) / 86400000);
    return Number.isFinite(days) && days <= Renewal.NOTICE_DAYS;
  });

  for (const row of candidates.slice(0, limit || 5)) {
    out.checked++;
    const read = await store.readProgram(row.programId);
    if (!read.ok) { out.failures.push(row.programId); continue; }
    const verdict = Renewal.renewalDue(read.program, todayIso);
    if (!verdict.due) continue;
    const mail = Renewal.renewalMail(
      read.program,
      verdict,
      "https://arick-t.github.io/mama-wod/admin.html?program=" +
        encodeURIComponent(read.program.programId)
    );
    try {
      await sendAppMail({ to: to, subject: mail.subject, text: mail.text });
    } catch (e) {
      out.failures.push(row.programId);
      continue;
    }
    /* Stamped only after the mail actually left: a failed send must be retried
       tomorrow, not swallowed. */
    await store.stampRenewalMailed(row.programId, read.program.version, verdict.block.blockIndex);
    out.mailed++;
  }
  return out;
}

async function notifyOwnerOfSignature(program, signature, clientName) {
  if (!hasMailProvider()) return { sent: false, reason: "no_mail_provider" };
  const to = resolveAppMailTo();
  if (!to) return { sent: false, reason: "no_recipient" };
  const who = clientName || "A client";
  const subject = who + " has joined the DUCK'S !";
  const lines = [
    "Type: client_signed",
    "Status: B2B terms signed — the program is now open to them",
    "Client: " + who,
    "Program: " + program.programId,
    "Terms: " + (signature.termsVersion || ""),
    signature.signerName ? "Signed by: " + signature.signerName : null,
    "Signed at: " + (signature.signedAt || ""),
    "",
    "Open it in admin:",
    "https://arick-t.github.io/mama-wod/admin.html?program=" +
      encodeURIComponent(program.programId),
  ].filter(function (x) {
    return x !== null;
  });
  try {
    await sendAppMail({ to: to, subject: subject, text: lines.join("\n") });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: String((e && e.message) || e) };
  }
}

async function notifyOwnerOfEdit(program, touchedDays, clientName) {
  if (!hasMailProvider()) return { sent: false, reason: "no_mail_provider" };
  const to = resolveAppMailTo();
  if (!to) return { sent: false, reason: "no_recipient" };
  const day = touchedDays[0] || "";
  const subject =
    "DUCK-WOD — " + (clientName || "client") + " changed a workout (" + day + ")";
  const lines = [
    (clientName || "A client") + " edited their program.",
    "",
    "Program: " + program.programId,
    "Changed: " + touchedDays.join(", "),
    "At: " + program.updatedAt,
    "",
    "Open it in admin:",
    /* Deep link straight to this client, so the mail is one tap from the change (a.2.4). */
    "https://arick-t.github.io/mama-wod/admin.html?program=" +
      encodeURIComponent(program.programId) +
      "&day=" +
      encodeURIComponent(day),
  ];
  try {
    await sendAppMail({ to: to, subject: subject, text: lines.join("\n") });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: String((e && e.message) || e) };
  }
}

/** True when this day already triggered a mail inside the quiet window. */
function withinQuietWindow(program, tag, atMs) {
  const map = program && program.editMailAt;
  if (!map || typeof map !== "object") return false;
  const last = Date.parse(map[tag] || "");
  if (!Number.isFinite(last)) return false;
  return atMs - last < EDIT_MAIL_QUIET_MS;
}

async function clientHandler(req, res, body) {
  const action = String(body.action || "").toLowerCase();
  const programId = String(body.programId || "").slice(0, 60);
  if (!programId) return bad(res, 400, "NO_PROGRAM", "programId is required");

  /* Redeeming a code is the only unauthenticated action, so it is throttled hard —
     six digits is 10^6 and a slow drip is the only realistic attack. */
  if (action === "claim") {
    const rl = checkRateLimit(req, { name: "client-claim", limit: 8, windowMs: 10 * 60 * 1000, uid: programId });
    if (!rl.ok) return sendRateLimit(res, rl);
    const current = await readAccess(programId);
    if (!current) return bad(res, 404, "NO_ACCESS", "this link is not active");
    const redeemed = Access.redeemCode(current, body.code, {
      programId: programId,
      deviceLabel: String(body.deviceLabel || "").slice(0, 80),
    });
    if (!redeemed.ok) return bad(res, 401, redeemed.code, redeemed.error);
    try {
      await writeAccess(programId, redeemed.access);
    } catch (e) {
      return bad(res, 503, "WRITE_FAILED", String((e && e.message) || e));
    }
    return res.status(200).json({
      ok: true,
      clientToken: redeemed.token,
      deviceId: redeemed.device.id,
      /* Signature is per ACCOUNT — a second device walks straight in (b.3). */
      signed: Access.isSignedForCurrentTerms(redeemed.access),
      termsVersion: Terms.TERMS_VERSION,
    });
  }

  const token = clientTokenFrom(req, body);
  /* Refuse a tokenless caller BEFORE touching storage, so an unauthenticated
     request cannot be used to discover which programIds exist. */
  if (!token) return bad(res, 401, "NO_TOKEN", "missing device token");

  const accessRow = await readAccess(programId);
  /* Past this point the caller holds a token, so telling them the program is gone
     is useful rather than leaky — they already knew it existed. */
  if (!accessRow) return bad(res, 404, "NO_ACCESS", "this link is not active");
  const verified = Access.verifyDeviceToken(accessRow, token, { programId: programId });
  if (!verified.ok) return bad(res, 401, verified.code, verified.error);

  /* Frozen closes the door for every action, signing included — a frozen client being
     asked to sign terms would be a worse experience than being told plainly. The
     device stays linked, so unfreezing needs no new code. */
  if (accessRow.frozen === true) {
    return res.status(403).json({
      ok: false,
      code: "FROZEN",
      error: "your access is paused — please talk to your coach",
    });
  }

  if (action === "sign") {
    /* Read before writing: recordSignature overwrites, and "is this new?" is the only
       thing standing between one join mail and one per device. */
    const previousSignature =
      verified.access && verified.access.signature ? verified.access.signature : null;
    const signed = Access.recordSignature(verified.access, {
      programId: programId,
      accepted: body.accepted === true,
      deviceId: verified.device.id,
      signerName: body.signerName,
      signedAtClient: body.signedAtClient,
      ip: clientIp(req),
      ua: String((req.headers && req.headers["user-agent"]) || "").slice(0, 300),
    });
    if (!signed.ok) return bad(res, 400, signed.code, signed.error);
    try {
      await writeAccess(programId, signed.access);
    } catch (e) {
      return bad(res, 503, "WRITE_FAILED", String((e && e.message) || e));
    }
    /* Mail only when this is genuinely new: a first signature, or a re-signature after
       the terms text changed. Signing is per account, so without this a second device
       would send a second "has joined". Failure to mail never fails the signing — the
       client is already through the door. */
    const wasSigned = !!(previousSignature && previousSignature.accepted);
    const sameTerms =
      wasSigned && previousSignature.termsVersion === signed.signature.termsVersion;
    let joinMail = { sent: false, reason: "already_signed" };
    if (!sameTerms) {
      let name = "";
      try {
        const readForMail = await store.readProgram(programId);
        if (readForMail.ok) name = readForMail.program.clientName || "";
        if (readForMail.ok) {
          joinMail = await notifyOwnerOfSignature(readForMail.program, signed.signature, name);
        }
      } catch (e) {
        joinMail = { sent: false, reason: String((e && e.message) || e) };
      }
    }
    return res.status(200).json({
      ok: true,
      signature: { signedAt: signed.signature.signedAt, termsVersion: signed.signature.termsVersion },
      ownerNotified: joinMail.sent === true,
    });
  }

  /* Everything past here needs a signature on the current terms. */
  if (!verified.signed) {
    return res.status(403).json({
      ok: false,
      code: "TERMS_REQUIRED",
      error: "the B2B terms must be accepted first",
      termsVersion: Terms.TERMS_VERSION,
    });
  }

  /**
   * "Am I still allowed in?" — the cheapest question a client can ask.
   *
   * Everything above this line has already answered it: the token was verified against
   * the access row, and a frozen account was refused there with 403 FROZEN. So this
   * costs the one small read the gate makes anyway, and never touches the programme.
   *
   * It exists because a paused client with the tab open kept reading their month until
   * they happened to reload (owner, 2026-09-02).
   */
  if (action === "ping") {
    return res.status(200).json({ ok: true });
  }

  if (action === "read") {
    const read = await store.readProgram(programId);
    if (!read.ok) return bad(res, read.code === "NOT_FOUND" ? 404 : 503, read.code, read.error);
    try {
      await writeAccess(programId, verified.access);
    } catch (e) {}
    return res.status(200).json({
      ok: true,
      program: Payload.programForClient(read.program),
      /* For the watermark and the print view (b.9 / b.10). */
      watermark: {
        clientName: read.program.clientName || "",
        preparedAt: read.program.updatedAt || "",
      },
      fromCache: !!read.fromCache,
    });
  }

  /* Opening a day the COACH changed is what takes its flag down — the mirror of the
   * owner's mark_read, and the same rule: no extra click (owner, 2026-09-01). */
  if (action === "mark_read") {
    const tags = Array.isArray(body.days) ? body.days : [];
    if (!tags.length) return bad(res, 400, "NO_DAYS", "days is required");
    const result = await store.updateProgram(
      programId,
      Number(body.expectedVersion),
      function (draft) {
        return draft;
      },
      { actor: "client", clearClientUnread: tags }
    );
    if (!result.ok) {
      const status = result.code === "VERSION_CONFLICT" ? 409 : 400;
      return res.status(status).json(Object.assign({ ok: false }, result));
    }
    return res.status(200).json({
      ok: true,
      program: Payload.programForClient(result.program),
      version: result.version,
    });
  }

  if (action === "save") {
    const parsed = Payload.parseClientEdit(body);
    if (!parsed.ok) return bad(res, 400, "BAD_EDIT", parsed.error);
    let touched = [];
    const result = await store.updateProgram(
      programId,
      parsed.expectedVersion,
      function (draft) {
        touched = Payload.applyClientEdit(draft, parsed);
        if (!touched.length) return draft;
        if (!draft.editMailAt || typeof draft.editMailAt !== "object") draft.editMailAt = {};
        return draft;
      },
      { actor: "client", touchedDays: [] }
    );
    if (!result.ok) {
      const status = result.code === "VERSION_CONFLICT" ? 409 : result.code === "NOT_FOUND" ? 404 : 400;
      /* A conflict hands back the live program so the client can see what changed
         rather than losing their typing. */
      const payload = Object.assign({ ok: false }, result);
      if (payload.program) payload.program = Payload.programForClient(payload.program);
      return res.status(status).json(payload);
    }
    if (!touched.length) return bad(res, 400, "NOTHING_CHANGED", "no day matched the edit");

    /* Raise the owner's flag and decide on mail in one further pass, so the flag
       and the quiet-window stamp are stored together. */
    const atMs = Date.now();
    const toMail = touched.filter(function (t) {
      return !withinQuietWindow(result.program, t, atMs);
    });
    const flagged = await store.updateProgram(
      programId,
      result.version,
      function (draft) {
        if (!draft.editMailAt || typeof draft.editMailAt !== "object") draft.editMailAt = {};
        for (const t of toMail) draft.editMailAt[t] = new Date(atMs).toISOString();
        return draft;
      },
      { actor: "client", touchedDays: touched }
    );
    const finalProgram = flagged.ok ? flagged.program : result.program;

    let mail = { sent: false, reason: "quiet_window" };
    if (toMail.length) {
      mail = await notifyOwnerOfEdit(finalProgram, toMail, finalProgram.clientName);
    }

    return res.status(200).json({
      ok: true,
      program: Payload.programForClient(finalProgram),
      version: finalProgram.version,
      changed: touched,
      ownerNotified: mail.sent === true,
    });
  }

  return bad(res, 400, "UNKNOWN_ACTION", "unknown client action");
}

/* ---------------------------------------------------------------------------
 * Entry
 * ------------------------------------------------------------------------- */

async function handler(req, res) {
  corsFor(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET" || req.method === "HEAD") {
    return res.status(200).json({
      ok: true,
      service: "client-program",
      /* Stated in the health payload so it is checkable from outside, not just claimed. */
      aiSurface: "none",
      /* An installed mobile build carries its own bundled copy of index.html and can
         be arbitrarily old. Raise this only when an old bundle would genuinely
         misbehave — it puts an "update the app" bar on every older install. */
      minAppVersion: MIN_APP_VERSION,
      /* Reports WHETHER remember-me can work, never the secret itself. Without this
         a missing or too-short ADMIN_SESSION_SECRET is invisible: the server simply
         mints no session token and every page asks for the password again. */
      rememberMeReady: sessionSecretReady(),
      /* "configured" = a proper ADMIN_SESSION_SECRET is set; "derived" = none was, so
       * the key is derived from an existing strong secret; "none" = no key is possible
       * and every page will ask for the password again. Naming the source is what ends
       * the guessing — twice I sent the owner to change an env var that was not it. */
      sessionSecretSource: sessionSecretSource(),
      sessionSecretMinLength: MIN_SESSION_SECRET_LEN,
      /* WHICH secret salts the client codes — never the secret. "client_secret" is the
         only answer that survives an admin-password change: the other two tie every code
         and every linked device to a value that exists for another purpose. It belongs
         HERE, beside the other configuration facts, and nowhere else: it first shipped by
         mistake on the claim response, which is a client's reply (2026-09-03). */
      clientCodeSalt: Access.saltSource(),
      termsVersion: Terms.TERMS_VERSION,
      deviceCap: Access.MAX_DEVICES,
      storage: JsonStore.storageInfo ? JsonStore.storageInfo() : null,
      hint: "POST with an owner credential, or a client device token from a redeemed code.",
    });
  }
  if (req.method !== "POST") return bad(res, 405, "METHOD", "Method not allowed");

  const body = parseBody(req);
  if (body === null) return bad(res, 400, "BAD_JSON", "Invalid JSON body");

  const rl = checkRateLimit(req, { name: "client-program", limit: 60, windowMs: 60 * 1000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  const isOwner = checkAdminAuth(req);
  const asClient = body.as === "client" || !!clientTokenFrom(req, body) || String(body.action || "") === "claim";

  if (isOwner && !asClient) return ownerHandler(req, res, body);
  if (asClient) return clientHandler(req, res, body);
  return adminAuthDenied(res);
}

/** Any unexpected throw must still reach the caller as JSON, never a raw 500. */
module.exports = async function (req, res) {
  try {
    return await handler(req, res);
  } catch (e) {
    const detail = String((e && e.message) || e).slice(0, 400);
    try {
      console.error("[client-program] unhandled:", detail);
    } catch (eLog) {}
    if (res && res.headersSent) return undefined;
    try {
      return res.status(503).json({
        ok: false,
        code: "UNAVAILABLE",
        error: "Storage is temporarily unavailable — please try again in a moment.",
        detail: detail,
      });
    } catch (eRes) {
      return undefined;
    }
  }
};

module.exports.ownerHandler = ownerHandler;
module.exports.clientHandler = clientHandler;
module.exports.EDIT_MAIL_QUIET_MS = EDIT_MAIL_QUIET_MS;
