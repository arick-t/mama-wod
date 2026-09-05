/**
 * Client program store — the brick becomes server-owned (POL-029).
 *
 * Until 21.6 the athlete's device held the plan and the Blob was a mirror, with a
 * one-day patch-back trick. Two people editing a mirror lose each other's work, so
 * for client programs the Blob is the source of truth.
 *
 * Two problems this module exists to solve:
 *
 * 1. VERCEL BLOB HAS NO CONDITIONAL WRITE. putJson is a blind overwrite — there is
 *    no ETag / If-Match. So "the owner and the coach both save Tuesday" silently
 *    loses one of them. Fixed with a version field checked inside a short lock,
 *    built on putJsonExclusive (create-only, the one atomic primitive available).
 *
 * 2. listJson FETCHES EVERY OBJECT IN FULL, sequentially, to draw a list. At ~50
 *    programs the admin list stops being usable. Fixed with one small index object
 *    holding only the headlines.
 *
 * Storage is injected so this is testable without a Blob: see
 * scripts/client-program-store.test.js, which drives two concurrent editors.
 *
 * 0 LLM. This module never calls a provider.
 */

"use strict";

const Clipboard = require("./pprog-clipboard.js");
const Intake = require("./client-intake.js");
const Renewal = require("./client-renewal.js");

const PROGRAM_PREFIX = "client-programs/";
const INDEX_KEY = "client-programs/_index.json";
/* The order the owner dragged his strip into. Its own tiny object, not a field on the
   index: the index is rewritten by every save, and a preference must not ride on
   something that busy (owner, 2026-09-05). */
const STRIP_ORDER_KEY = "client-programs/_strip-order.json";
const LOCK_SUFFIX = ".lock.json";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** A lock older than this is treated as abandoned — a crashed save must not wedge a program forever. */
const LOCK_TTL_MS = 20 * 1000;
const LOCK_RETRY_MS = 60;
const LOCK_MAX_TRIES = 12;

/* Studio/coach, individual athlete, and the blank client who answers four questions. */
const KINDS = ["coach", "athlete", "blank"];

/* A year of programming. The cap exists because one Blob object holds the whole
   timeline and MAX_PROGRAM_BYTES is the real ceiling — better a clear refusal at a
   round number than a save that fails on byte count halfway through a season. */
const MAX_WEEKS = 52;

const MAX_PROGRAM_BYTES = 512 * 1024;
const MAX_INDEX_ROWS = 5000;

/** The day object a "w<i>:<day>" tag points at, or null. */
function dayByTag(program, tag) {
  const m = /^w(\d+):([a-z]{3})$/.exec(String(tag || ""));
  if (!m) return null;
  const week = Array.isArray(program && program.weeks) ? program.weeks[Number(m[1]) - 1] : null;
  if (!isPlainObject(week) || !isPlainObject(week.days)) return null;
  const day = week.days[m[2]];
  return isPlainObject(day) ? day : null;
}

/** Both halves of "the client has seen the coach's change" come down together. */
function clearCoachFlag(program, tag) {
  const t = String(tag || "").slice(0, 20);
  if (isPlainObject(program.clientUnreadDays)) delete program.clientUnreadDays[t];
  const day = dayByTag(program, t);
  if (day) delete day.coachModified;
}

function nowMs(clock) {
  return typeof clock === "function" ? clock() : Date.now();
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function safeId(raw) {
  return String(raw || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 60);
}

function programKey(programId) {
  return PROGRAM_PREFIX + safeId(programId) + ".json";
}

function lockKey(programId) {
  return PROGRAM_PREFIX + safeId(programId) + LOCK_SUFFIX;
}

function newProgramId(clock) {
  const stamp = nowMs(clock).toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return "p_" + stamp + rand;
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Empty program skeleton. The OWNER writes the training content — this only
 * establishes the shape it lives in (a.1.1: we build the capability, not the plan).
 */
/**
 * One empty week at an ABSOLUTE index — week 1 is the first week the client ever
 * trained, and the count keeps running across month boundaries. That is what lets a
 * new month open on a deload (owner, 2026-09-01).
 *
 * @param {number} absoluteWeekIndex 1-based, continuous
 * @param {object|null} intake the cross-cutting questionnaire, when there is one
 */
/** Is this weekday a rest day under this intake? Only the weekly plan pins weekdays. */
function isRestWeekday(intake, dayKey) {
  if (!isPlainObject(intake)) return false;
  if (intake.scheduleMode !== "weekly_schedule" || intake.includeRestDays !== true) return false;
  return !!(isPlainObject(intake.restDays) && intake.restDays[dayKey] === true);
}

function emptyWeek(absoluteWeekIndex, intake, legacyLastWeek, deloadSince) {
  const days = {};
  for (let i = 0; i < DAY_KEYS.length; i++) {
    /* A new block arrives as the owner's own to-do list: every training day in it is
       marked "I have not been over this" until he opens it (owner, 2026-09-01). Rest
       days are not on that list — there is nothing to write on them. */
    const day = { parts: [] };
    if (!isRestWeekday(intake, DAY_KEYS[i])) day.ownerUnreviewed = true;
    days[DAY_KEYS[i]] = day;
  }
  /* With an intake, the deload is a cadence read off the absolute index. Without one
     (the legacy athlete path) the old rule stands — the last week of the block — so
     that path keeps behaving exactly as it did. */
  const deload = isPlainObject(intake)
    ? Intake.isDeloadWeek(intake, absoluteWeekIndex, deloadSince)
    : legacyLastWeek === true;
  return {
    weekIndex: absoluteWeekIndex,
    phase: deload ? "deload" : "build",
    theme: "",
    summaryLine: "",
    overview: DAY_KEYS.map(function (d) {
      return { day: d, focus: "" };
    }),
    days: days,
  };
}

/** One block record. The block is what the owner plans, approves and sends. */
function newBlock(opts) {
  const o = isPlainObject(opts) ? opts : {};
  return {
    blockIndex: Math.max(1, parseInt(o.blockIndex, 10) || 1),
    startWeek: Math.max(1, parseInt(o.startWeek, 10) || 1),
    weekCount: Math.max(1, parseInt(o.weekCount, 10) || 4),
    createdAt: String(o.createdAt || ""),
    /* Nothing in a block reaches the client until this is set. Block ONE included —
       creating a client hands them nothing until the owner presses approve. */
    approvedAt: o.approvedAt || null,
    /* The owner's notes for this block: what he wanted different from the last one. */
    notes: String(o.notes || "").slice(0, 4000),
    /* The questionnaire AS IT STOOD for this block. Equipment and a schedule change
       between blocks, and a block must keep the answers it was built from. */
    intake: isPlainObject(o.intake) ? o.intake : null,
    /* One reminder per block, a week before it ends. */
    renewalMailedAt: o.renewalMailedAt || null,
  };
}

function emptyProgram(opts) {
  const o = isPlainObject(opts) ? opts : {};
  const weeks = [];
  const weekCount = Math.max(1, Math.min(12, parseInt(o.weekCount, 10) || 5));
  const intake = isPlainObject(o.intake) ? o.intake : null;
  for (let w = 1; w <= weekCount; w++) {
    weeks.push(emptyWeek(w, intake, w === weekCount));
  }
  return {
    programId: safeId(o.programId) || newProgramId(o.clock),
    clientName: String(o.clientName || "").slice(0, 120),
    /* The owner's own label for this person in the strip — never sent to the client. */
    clientColour: /^#[0-9a-f]{6}$/i.test(String(o.clientColour || "")) ? String(o.clientColour) : "",
    /* A client who stopped paying is frozen, not deleted: the plan and the history
       stay, the door closes (owner, 2026-09-02). */
    frozen: false,
    /* Three kinds now. A "blank" client answers four questions and gets an empty
       month — no training days, no rest days, nothing but squares for the owner to
       write in. Everything else about them is a client like any other: a link, a
       code, terms, approval, renewal (owner, 2026-09-04). */
    clientKind: KINDS.indexOf(o.clientKind) >= 0 ? o.clientKind : "coach",
    /* Asked once, on the short form, and never sent to the client. */
    clientGender: String(o.clientGender || "").slice(0, 20),
    blockStart: String(o.blockStart || "").slice(0, 10),
    /* The cross-cutting questionnaire (lib/client-intake.js). Owner-only — the client
     * never receives it, because it holds their price. It is also what decides the
     * block's shape: 4 weeks without a deload, 5 with. */
    intake: isPlainObject(o.intake) ? o.intake : null,
    /* Monotonic. Every accepted write increments it; a stale write is refused. */
    version: 1,
    createdAt: new Date(nowMs(o.clock)).toISOString(),
    updatedAt: new Date(nowMs(o.clock)).toISOString(),
    updatedBy: "owner",
    weeks: weeks,
    /* The blocks, in order. Block one is created with the program and is NOT approved:
       a new client sees nothing at all until the owner sends it (owner, 2026-09-01). */
    blocks: [
      newBlock({
        blockIndex: 1,
        startWeek: 1,
        weekCount: weekCount,
        createdAt: new Date(nowMs(o.clock)).toISOString(),
        intake: intake,
      }),
    ],
    /* Set of "w<i>:<dayKey>" the client changed and the owner has not opened yet. */
    unreadDays: {},
    /* The mirror, and the owner asked for it on 2026-09-01: the days the OWNER rewrote
       that the client has not opened yet. Without it a client can be handed a changed
       week and never know — they would have to re-read the whole month to find it. */
    clientUnreadDays: {},
  };
}

/**
 * Which days actually changed between two versions of a program, as "w<i>:<day>" tags.
 *
 * The owner's save replaces the weeks wholesale, so there is no per-day report to
 * trust — the comparison IS the report. Comparing the rendered content rather than the
 * whole day object keeps bookkeeping fields (the flags themselves) from counting as a
 * change, which would flag every day on every save.
 */
function changedDayTags(before, after) {
  const out = [];
  const aWeeks = Array.isArray(before && before.weeks) ? before.weeks : [];
  const bWeeks = Array.isArray(after && after.weeks) ? after.weeks : [];
  for (let i = 0; i < bWeeks.length; i++) {
    const aw = aWeeks[i];
    const bw = bWeeks[i];
    if (!isPlainObject(bw)) continue;
    for (const d of DAY_KEYS) {
      const av = contentOfDay(aw, d);
      const bv = contentOfDay(bw, d);
      if (av !== bv) out.push("w" + (i + 1) + ":" + d);
    }
  }
  return out;
}

/** What a day says to whoever reads it: its parts, and whether it reads as rest. */
function contentOfDay(week, dayKey) {
  if (!isPlainObject(week)) return "";
  const day = isPlainObject(week.days) ? week.days[dayKey] : null;
  const parts = isPlainObject(day) && Array.isArray(day.parts) ? day.parts : [];
  let focus = "";
  const overview = Array.isArray(week.overview) ? week.overview : [];
  for (const o of overview) {
    if (isPlainObject(o) && o.day === dayKey) focus = String(o.focus || "");
  }
  /* A day with nothing in it reads the same as a day that does not exist yet, and it
     must: selling another month appends four weeks of empty days, and without this
     every one of them would arrive at the client flagged as a change. */
  if (!parts.length && !focus) return "";
  try {
    return JSON.stringify([focus, parts.map(function (p) {
      return [String((p && p.title) || ""), (p && p.lines) || []];
    })]);
  } catch (e) {
    return "";
  }
}

/**
 * Programs written before blocks existed get one, covering everything they hold, and
 * it is APPROVED — those clients are already reading them, and a migration that makes
 * a live program vanish is not a migration, it is an outage.
 *
 * Applied on read, so nothing has to be rewritten in storage to be correct.
 */
function normalizeBlocks(program) {
  if (!isPlainObject(program)) return program;
  const weeks = Array.isArray(program.weeks) ? program.weeks : [];
  if (!Array.isArray(program.blocks) || !program.blocks.length) {
    program.blocks = [
      newBlock({
        blockIndex: 1,
        startWeek: 1,
        weekCount: weeks.length || 1,
        createdAt: program.createdAt || "",
        approvedAt: program.createdAt || new Date().toISOString(),
        intake: program.intake || null,
      }),
    ];
    return program;
  }
  program.blocks = program.blocks.map(function (b, i) {
    return newBlock(Object.assign({}, b, { blockIndex: parseInt(b && b.blockIndex, 10) || i + 1 }));
  });
  return program;
}

/** How many weeks, from the first, the client is allowed to see. */
function approvedWeekCount(program) {
  /* No blocks at all means a program from before blocks existed — everything in it is
     already with the client, and this must never be the thing that hides it. Programs
     read through readProgram are normalised first, so this is the belt to that brace. */
  if (!Array.isArray(program && program.blocks)) {
    return Array.isArray(program && program.weeks) ? program.weeks.length : 0;
  }
  const blocks = program.blocks;
  let last = 0;
  for (const b of blocks) {
    if (!b || !b.approvedAt) continue;
    const end = (parseInt(b.startWeek, 10) || 1) - 1 + (parseInt(b.weekCount, 10) || 0);
    if (end > last) last = end;
  }
  return last;
}

/** The block a 1-based week index belongs to, or null. */
function blockOfWeek(program, weekIndex1) {
  const blocks = Array.isArray(program && program.blocks) ? program.blocks : [];
  for (const b of blocks) {
    const start = parseInt(b.startWeek, 10) || 1;
    const end = start - 1 + (parseInt(b.weekCount, 10) || 0);
    if (weekIndex1 >= start && weekIndex1 <= end) return b;
  }
  return null;
}

/** Structural integrity (0.8 / b.8) — free editing of content, never a corrupt object. */
function validateProgram(program) {
  if (!isPlainObject(program)) return "program must be an object";
  if (!safeId(program.programId)) return "programId missing or unusable";
  if (!Number.isFinite(Number(program.version)) || Number(program.version) < 1) {
    return "version must be a positive number";
  }
  if (!Array.isArray(program.weeks) || !program.weeks.length) return "weeks must be a non-empty array";
  for (let i = 0; i < program.weeks.length; i++) {
    const w = program.weeks[i];
    if (!isPlainObject(w)) return "week " + (i + 1) + " is not an object";
    if (!isPlainObject(w.days)) return "week " + (i + 1) + " has no days object";
    for (let d = 0; d < DAY_KEYS.length; d++) {
      const day = w.days[DAY_KEYS[d]];
      if (day === undefined) return "week " + (i + 1) + " is missing day " + DAY_KEYS[d];
      if (!isPlainObject(day)) return "week " + (i + 1) + " day " + DAY_KEYS[d] + " is not an object";
      if (!Array.isArray(day.parts)) return "week " + (i + 1) + " day " + DAY_KEYS[d] + " has no parts array";
    }
  }
  let size;
  try {
    size = JSON.stringify(program).length;
  } catch (e) {
    return "program is not serializable";
  }
  if (size > MAX_PROGRAM_BYTES) return "program too large (" + size + " bytes)";
  return null;
}

/** Only the headlines the admin list needs — never the training content. */
function indexRowFor(program) {
  /* When the client's current block ends, and whether the reminder for it has gone.
     Carried on the row so the daily check can find who is due without reading every
     program in full — which is the whole reason this index exists. */
  const current = Renewal.lastApprovedBlock(program);
  return {
    programId: program.programId,
    clientName: program.clientName || "",
    /* On the row so the strip can colour itself and show who is frozen without reading
       a single program in full. */
    clientColour: program.clientColour || "",
    frozen: program.frozen === true,
    clientKind: program.clientKind || "coach",
    clientGender: program.clientGender || "",
    version: Number(program.version) || 1,
    updatedAt: program.updatedAt || "",
    updatedBy: program.updatedBy || "",
    unreadCount: Object.keys(isPlainObject(program.unreadDays) ? program.unreadDays : {}).length,
    blockEndIso: current ? Renewal.blockEndIso(program, current) : "",
    renewalMailed: !!(current && current.renewalMailedAt),
  };
}

function emptyIndex() {
  return { version: 1, updatedAt: "", rows: [] };
}

/**
 * @param {{
 *   getJson: (key: string) => Promise<any>,
 *   putJson: (key: string, data: any) => Promise<any>,
 *   putJsonExclusive: (key: string, data: any) => Promise<any>,
 *   deleteJson: (key: string) => Promise<any>,
 *   listJson?: (prefix: string) => Promise<Array<{pathname: string, data: any}>>,
 *   now?: () => number,
 *   cache?: { get: (k: string) => any, set: (k: string, v: any) => void },
 * }} io
 */
function createProgramStore(io) {
  const store = isPlainObject(io) ? io : {};
  const clock = store.now;
  /* 0.6 — last-known copy so a failed read still shows the workout. */
  const cache = isPlainObject(store.cache) ? store.cache : new Map();
  const cacheGet = typeof cache.get === "function" ? cache.get.bind(cache) : function () {};
  const cacheSet = typeof cache.set === "function" ? cache.set.bind(cache) : function () {};

  async function readProgram(programId, opts) {
    /* Blocks are normalised on every read (see normalizeBlocks) — a program written
       before they existed must behave as though it always had one. */
    const o = isPlainObject(opts) ? opts : {};
    const key = programKey(programId);
    if (!safeId(programId)) return { ok: false, code: "BAD_ID", error: "programId missing" };
    let row = null;
    let readFailed = null;
    try {
      row = await store.getJson(key);
    } catch (e) {
      readFailed = String((e && e.message) || e);
    }
    if (row && isPlainObject(row)) {
      normalizeBlocks(row);
      cacheSet(key, row);
      return { ok: true, program: row, fromCache: false };
    }
    /* Network or Blob hiccup — serve the last copy we saw rather than nothing.
       A missing object (no error) is a genuine 404 and must not read as cached. */
    if (readFailed && o.allowCache !== false) {
      const cached = cacheGet(key);
      if (cached) return { ok: true, program: normalizeBlocks(cached), fromCache: true, readError: readFailed };
    }
    if (readFailed) return { ok: false, code: "READ_FAILED", error: readFailed };
    return { ok: false, code: "NOT_FOUND", error: "program not found" };
  }

  async function acquireLock(programId) {
    const key = lockKey(programId);
    for (let attempt = 0; attempt < LOCK_MAX_TRIES; attempt++) {
      try {
        await store.putJsonExclusive(key, { at: nowMs(clock) });
        return { ok: true, key: key };
      } catch (e) {
        /* Held by someone else — or abandoned by a crashed save. */
        let held = null;
        try {
          held = await store.getJson(key);
        } catch (eRead) {}
        const heldAt = held && Number(held.at);
        if (!held || !Number.isFinite(heldAt) || nowMs(clock) - heldAt > LOCK_TTL_MS) {
          try {
            await store.deleteJson(key);
          } catch (eDel) {}
          continue;
        }
        await sleep(LOCK_RETRY_MS);
      }
    }
    return { ok: false, code: "LOCKED", error: "program is being saved by someone else" };
  }

  async function releaseLock(programId) {
    try {
      await store.deleteJson(lockKey(programId));
    } catch (e) {}
  }

  async function upsertIndexRow(program) {
    let idx = null;
    try {
      idx = await store.getJson(INDEX_KEY);
    } catch (e) {}
    if (!isPlainObject(idx) || !Array.isArray(idx.rows)) idx = emptyIndex();
    const row = indexRowFor(program);
    let found = false;
    for (let i = 0; i < idx.rows.length; i++) {
      if (idx.rows[i] && idx.rows[i].programId === row.programId) {
        idx.rows[i] = row;
        found = true;
        break;
      }
    }
    if (!found) idx.rows.unshift(row);
    if (idx.rows.length > MAX_INDEX_ROWS) idx.rows.length = MAX_INDEX_ROWS;
    idx.updatedAt = new Date(nowMs(clock)).toISOString();
    try {
      await store.putJson(INDEX_KEY, idx);
      return true;
    } catch (e) {
      /* The index is derived, never the truth. A failed index write must not fail
         the save — "rebuild index" repairs it. */
      return false;
    }
  }

  async function readIndex() {
    let idx = null;
    try {
      idx = await store.getJson(INDEX_KEY);
    } catch (e) {
      return { ok: false, code: "READ_FAILED", error: String((e && e.message) || e) };
    }
    if (!isPlainObject(idx) || !Array.isArray(idx.rows)) return { ok: true, index: emptyIndex() };
    return { ok: true, index: idx };
  }

  /**
   * The order of the chips in the owner's strip, as a plain list of ids.
   *
   * Ids only — athletes and clients together — so it costs one small object and no
   * repair when people come and go: an id that is gone is ignored when the strip is
   * drawn, and someone new simply is not in the list yet.
   */
  async function readStripOrder() {
    let doc = null;
    try {
      doc = await store.getJson(STRIP_ORDER_KEY);
    } catch (e) {
      return { ok: false, code: "READ_FAILED", error: String((e && e.message) || e) };
    }
    const ids = isPlainObject(doc) && Array.isArray(doc.ids) ? doc.ids : [];
    return { ok: true, ids: ids.map(String).slice(0, 400) };
  }

  async function writeStripOrder(ids) {
    const clean = [];
    const seen = {};
    for (const raw of Array.isArray(ids) ? ids : []) {
      const id = String(raw == null ? "" : raw).trim().slice(0, 60);
      /* The same shape every id in this system has. A strip order is written straight
         into a data attribute, so it is checked here as well as where it is drawn. */
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || seen[id]) continue;
      seen[id] = true;
      clean.push(id);
      if (clean.length >= 400) break;
    }
    try {
      await store.putJson(STRIP_ORDER_KEY, { version: 1, updatedAt: new Date().toISOString(), ids: clean });
    } catch (e) {
      return { ok: false, code: "WRITE_FAILED", error: String((e && e.message) || e) };
    }
    return { ok: true, ids: clean };
  }

  /** Safety valve: the index is derived, so it can always be recomputed from truth. */
  async function rebuildIndex() {
    if (typeof store.listJson !== "function") {
      return { ok: false, code: "NO_LIST", error: "storage cannot list" };
    }
    let rows;
    try {
      rows = await store.listJson(PROGRAM_PREFIX);
    } catch (e) {
      return { ok: false, code: "LIST_FAILED", error: String((e && e.message) || e) };
    }
    const out = [];
    for (const entry of rows || []) {
      const path = (entry && entry.pathname) || "";
      /* Skip the index itself and any stray lock files. */
      if (path === INDEX_KEY) continue;
      if (path.indexOf(LOCK_SUFFIX) >= 0) continue;
      const data = entry && entry.data;
      if (!isPlainObject(data) || !data.programId) continue;
      out.push(indexRowFor(data));
    }
    out.sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    const idx = { version: 1, updatedAt: new Date(nowMs(clock)).toISOString(), rows: out };
    try {
      await store.putJson(INDEX_KEY, idx);
    } catch (e) {
      return { ok: false, code: "WRITE_FAILED", error: String((e && e.message) || e) };
    }
    return { ok: true, index: idx, count: out.length };
  }

  async function createProgram(opts) {
    const program = emptyProgram(Object.assign({}, opts, { clock: clock }));
    const bad = validateProgram(program);
    if (bad) return { ok: false, code: "INVALID", error: bad };
    try {
      await store.putJsonExclusive(programKey(program.programId), program);
    } catch (e) {
      return { ok: false, code: "EXISTS", error: String((e && e.message) || e) };
    }
    cacheSet(programKey(program.programId), program);
    await upsertIndexRow(program);
    return { ok: true, program: program };
  }

  /**
   * The only way a program changes.
   *
   * @param {string} programId
   * @param {number} expectedVersion Version the editor was looking at.
   * @param {(draft: object) => object|void} mutate Applied to a deep copy.
   * @param {{ actor?: "owner"|"client", touchedDays?: string[], clearUnread?: string[] }} [meta]
   */
  async function updateProgram(programId, expectedVersion, mutate, meta) {
    const m = isPlainObject(meta) ? meta : {};
    const actor = m.actor === "client" ? "client" : "owner";
    if (!safeId(programId)) return { ok: false, code: "BAD_ID", error: "programId missing" };
    if (typeof mutate !== "function") return { ok: false, code: "BAD_MUTATE", error: "mutate must be a function" };

    const lock = await acquireLock(programId);
    if (!lock.ok) return lock;
    try {
      const current = await readProgram(programId, { allowCache: false });
      if (!current.ok) return current;
      const live = current.program;
      const liveVersion = Number(live.version) || 1;
      const expected = Number(expectedVersion);

      /* THE POINT OF THIS MODULE. Someone edited since this editor loaded the page —
         refuse rather than overwrite, and hand back the live copy to merge from. */
      if (Number.isFinite(expected) && expected !== liveVersion) {
        return {
          ok: false,
          code: "VERSION_CONFLICT",
          error: "program changed since you opened it",
          expectedVersion: expected,
          currentVersion: liveVersion,
          program: live,
        };
      }

      let draft;
      try {
        draft = JSON.parse(JSON.stringify(live));
      } catch (e) {
        return { ok: false, code: "UNREADABLE", error: "stored program is not valid JSON" };
      }
      let next;
      try {
        next = mutate(draft) || draft;
      } catch (e) {
        return { ok: false, code: "MUTATE_FAILED", error: String((e && e.message) || e) };
      }

      next.programId = live.programId;
      next.version = liveVersion + 1;
      next.updatedAt = new Date(nowMs(clock)).toISOString();
      next.updatedBy = actor;
      next.createdAt = live.createdAt || next.updatedAt;

      if (!isPlainObject(next.unreadDays)) next.unreadDays = {};
      if (!isPlainObject(next.clientUnreadDays)) next.clientUnreadDays = {};

      /* The owner rewrote a day → raise the CLIENT's flag on exactly the days whose
         content moved. The owner's own queue is untouched by his own edit, and the
         client's is untouched by the client's. */
      if (actor === "owner") {
        for (const tag of changedDayTags(live, next)) {
          next.clientUnreadDays[tag] = next.updatedAt;
          const marked = dayByTag(next, tag);
          if (marked) marked.coachModified = true;
        }
      }
      /* A client edit is what the owner needs to notice; the owner's own edit never
         flags itself. State, not a counter — five saves to one day stay one flag. */
      if (actor === "client" && Array.isArray(m.touchedDays)) {
        for (const tag of m.touchedDays) {
          const t = String(tag || "").slice(0, 20);
          if (t) next.unreadDays[t] = next.updatedAt;
        }
      }
      /* A client editing a day has plainly seen it, so their own flag on it comes
         down in the same write — no second round trip to clear what they just read. */
      if (actor === "client" && Array.isArray(m.touchedDays)) {
        for (const tag of m.touchedDays) clearCoachFlag(next, tag);
      }
      if (Array.isArray(m.clearUnread)) {
        for (const tag of m.clearUnread) delete next.unreadDays[String(tag || "").slice(0, 20)];
      }
      /* The owner opened the day, so it is reviewed — his own "not been over this"
         mark comes down with the same write that clears the client flag. */
      if (Array.isArray(m.clearReviewed)) {
        for (const tag of m.clearReviewed) {
          const day = dayByTag(next, String(tag || "").slice(0, 20));
          if (day) delete day.ownerUnreviewed;
        }
      }
      if (Array.isArray(m.clearClientUnread)) {
        for (const tag of m.clearClientUnread) clearCoachFlag(next, tag);
      }

      const bad = validateProgram(next);
      if (bad) return { ok: false, code: "INVALID", error: bad, program: live };

      try {
        await store.putJson(programKey(programId), next);
      } catch (e) {
        return { ok: false, code: "WRITE_FAILED", error: String((e && e.message) || e) };
      }
      cacheSet(programKey(programId), next);
      const indexed = await upsertIndexRow(next);
      return { ok: true, program: next, version: next.version, indexed: indexed };
    } finally {
      await releaseLock(programId);
    }
  }

  async function deleteProgram(programId) {
    if (!safeId(programId)) return { ok: false, code: "BAD_ID", error: "programId missing" };
    try {
      await store.deleteJson(programKey(programId));
    } catch (e) {
      return { ok: false, code: "DELETE_FAILED", error: String((e && e.message) || e) };
    }
    try {
      const idx = await store.getJson(INDEX_KEY);
      if (isPlainObject(idx) && Array.isArray(idx.rows)) {
        idx.rows = idx.rows.filter(function (r) {
          return !r || r.programId !== safeId(programId);
        });
        idx.updatedAt = new Date(nowMs(clock)).toISOString();
        await store.putJson(INDEX_KEY, idx);
      }
    } catch (e) {}
    return { ok: true };
  }

  /**
   * The next block. Four more empty weeks appended to the SAME timeline, keeping the
   * absolute numbering — so a five-week deload cadence lands the deload where the count
   * says rather than restarting (owner, 2026-09-01). The block carries the answers it
   * was built from and the owner's notes for it, and it is NOT approved: nothing in it
   * reaches the client until he sends it.
   *
   * The previous block is never touched. It stays where it is, in the client's hands.
   */
  async function addBlock(programId, expectedVersion, opts) {
    const o = isPlainObject(opts) ? opts : {};
    let added = 0;
    let blockIndex = 0;
    const r = await updateProgram(
      programId,
      expectedVersion,
      function (draft) {
        normalizeBlocks(draft);
        const weeks = Array.isArray(draft.weeks) ? draft.weeks : [];
        const last = weeks.length
          ? parseInt(weeks[weeks.length - 1].weekIndex, 10) || weeks.length
          : 0;
        /* Where the cadence is counted from: the last week that really was a deload. A
           new block may carry a different cadence, and starting it over from week one is
           what put two deloads side by side (owner, 2026-09-03). */
        let deloadSince = 0;
        for (const w of weeks) {
          const wi = parseInt(w && w.weekIndex, 10) || 0;
          if (String((w && w.phase) || "") === "deload" && wi > deloadSince) deloadSince = wi;
        }
        /* Four, unless a blank client asked for another length — the API only passes
           this for that kind, so every other client still gets exactly what it got
           before (owner, 2026-09-04). */
        const asked = parseInt(o.weekCount, 10);
        const want = Number.isFinite(asked) && asked >= 1 ? Math.min(12, asked) : Intake.weekCountFor();
        const room = Math.max(0, MAX_WEEKS - weeks.length);
        added = Math.min(want, room);
        if (!added) return draft;
        /* The block's own answers: what the owner changed in the mini-intake, over the
           answers the program already had. */
        const intake = isPlainObject(o.intake) ? o.intake : draft.intake;
        for (let i = 1; i <= added; i++) weeks.push(emptyWeek(last + i, intake, false, deloadSince));
        draft.weeks = weeks;
        blockIndex = draft.blocks.length + 1;
        draft.blocks.push(
          newBlock({
            blockIndex: blockIndex,
            startWeek: last + 1,
            weekCount: added,
            createdAt: new Date(nowMs(clock)).toISOString(),
            notes: o.notes,
            intake: intake,
          })
        );
        /* The program's current answers follow the newest block: the next mini-intake
           opens on what is true now, not on what was true a season ago. */
        if (isPlainObject(o.intake)) draft.intake = o.intake;
        /* An individual answers about THEMSELVES again for a new block - goals, what to
           work around, session length. Merged, never replaced: the eight-step packet the
           coach will read must survive a new block (owner, 2026-09-03). */
        if (isPlainObject(o.athleteIntake)) {
          draft.athleteIntake = Object.assign({}, draft.athleteIntake || {}, o.athleteIntake);
        }
        /* A new block is when a price changes. Undefined means the question was not
           asked; zero is a real answer (owner, 2026-09-03). */
        if (o.monthlyAmount !== undefined && Number.isFinite(Number(o.monthlyAmount))) {
          draft.monthlyAmount = Math.max(0, Number(o.monthlyAmount));
        }
        if (o.paymentMethod !== undefined) {
          draft.paymentMethod = String(o.paymentMethod).slice(0, 200);
        }
        return draft;
      },
      { actor: "owner" }
    );
    if (!r.ok) return r;
    if (!added) {
      return { ok: false, code: "MAX_WEEKS", error: "This program is already " + MAX_WEEKS + " weeks long." };
    }
    return Object.assign({ added: added, blockIndex: blockIndex }, r);
  }

  /**
   * Send a block to the client. Until this, its weeks do not exist as far as the client
   * is concerned — not "coming soon", not an empty calendar: absent (owner, 2026-09-01).
   * After it, the block lives by every normal rule: two-way editing, flags both ways.
   */
  /**
   * Copy a whole week onto another week.
   *
   * Everything the owner wrote — the sessions, the day focuses, the theme and the
   * summary — with fresh part ids so nothing is shared between two weeks by reference.
   *
   * What it deliberately does NOT copy is `phase`: that is where a deload is recorded,
   * and moving it would move a rest week the calendar placed by cadence. The owner
   * asked to copy a week of TRAINING, not to re-plan the block (owner, 2026-09-04).
   */
  /**
   * One part, copied whole.
   *
   * A copied day came back as bare work lines: the notes, the format line, the colours
   * and the numbering were all dropped, because this used to rebuild a part out of its
   * title and its lines alone (owner, 2026-09-05). A copy must be the day he copied.
   *
   * Everything the part carries travels except its identity and the flags that say who
   * touched it — a fresh copy has not been changed by anyone yet.
   */
  /* One definition, read from lib/pprog-clipboard.js — the same one the page uses when
     the owner copies by hand. Two definitions is how a copy loses a colour on one path
     and keeps it on the other, which is exactly the bug this replaced. */
  function copiedDay(srcDay, weekNumber, dayKey) {
    return Clipboard.copyDay(srcDay, "w" + weekNumber + dayKey);
  }

  async function copyWeek(programId, expectedVersion, fromWeek, toWeek) {
    const from = parseInt(fromWeek, 10);
    const to = parseInt(toWeek, 10);
    if (!(from >= 1) || !(to >= 1)) {
      return { ok: false, code: "BAD_WEEK", error: "week numbers are 1-based" };
    }
    if (from === to) return { ok: false, code: "SAME_WEEK", error: "that is the same week" };
    let copiedDays = 0;
    const r = await updateProgram(
      programId,
      expectedVersion,
      function (draft) {
        const weeks = Array.isArray(draft.weeks) ? draft.weeks : [];
        const src = weeks[from - 1];
        const dst = weeks[to - 1];
        if (!isPlainObject(src) || !isPlainObject(dst)) throw new Error("no such week");
        for (const d of DAY_KEYS) {
          const srcDay = isPlainObject(src.days) ? src.days[d] : null;
          if (!isPlainObject(dst.days)) dst.days = {};
          const parts = Array.isArray(srcDay && srcDay.parts) ? srcDay.parts : [];
          dst.days[d] = copiedDay(srcDay, to, d);
          if (parts.length) copiedDays += 1;
        }
        dst.overview = Array.isArray(src.overview)
          ? src.overview.map(function (o) {
              return { day: String((o && o.day) || ""), focus: String((o && o.focus) || "") };
            })
          : dst.overview;
        dst.theme = String(src.theme || "");
        dst.summaryLine = String(src.summaryLine || "");
        return draft;
      },
      { actor: "owner" }
    );
    if (!r.ok) return r;
    return Object.assign({ copiedDays: copiedDays, fromWeek: from, toWeek: to }, r);
  }

  /**
   * Copy one day onto another day.
   *
   * The sessions AND the day's focus travel together: a rest day is a rest day because
   * of what the week's overview says about it, so copying only the parts would move an
   * empty day without moving the fact that it is a rest day (owner, 2026-09-04).
   *
   * Fresh part ids, so the two days share nothing by reference.
   */
  async function copyDay(programId, expectedVersion, from, to) {
    const f = isPlainObject(from) ? from : {};
    const t = isPlainObject(to) ? to : {};
    const fw = parseInt(f.week, 10);
    const tw = parseInt(t.week, 10);
    const fd = String(f.day || "");
    const td = String(t.day || "");
    if (!(fw >= 1) || !(tw >= 1)) return { ok: false, code: "BAD_WEEK", error: "week numbers are 1-based" };
    if (DAY_KEYS.indexOf(fd) < 0 || DAY_KEYS.indexOf(td) < 0) {
      return { ok: false, code: "BAD_DAY", error: "not a weekday" };
    }
    if (fw === tw && fd === td) return { ok: false, code: "SAME_DAY", error: "that is the same day" };
    let copiedParts = 0;
    const r = await updateProgram(
      programId,
      expectedVersion,
      function (draft) {
        const weeks = Array.isArray(draft.weeks) ? draft.weeks : [];
        const src = weeks[fw - 1];
        const dst = weeks[tw - 1];
        if (!isPlainObject(src) || !isPlainObject(dst)) throw new Error("no such week");
        const srcDay = isPlainObject(src.days) ? src.days[fd] : null;
        if (!isPlainObject(dst.days)) dst.days = {};
        const parts = Array.isArray(srcDay && srcDay.parts) ? srcDay.parts : [];
        copiedParts = parts.length;
        dst.days[td] = copiedDay(srcDay, tw, td);
        /* The focus line, which is where "Rest" is written. */
        const srcFocus = (Array.isArray(src.overview) ? src.overview : []).filter(function (o) {
          return o && o.day === fd;
        })[0];
        if (!Array.isArray(dst.overview)) dst.overview = [];
        const hit = dst.overview.filter(function (o) {
          return o && o.day === td;
        })[0];
        const focus = String((srcFocus && srcFocus.focus) || "");
        if (hit) hit.focus = focus;
        else dst.overview.push({ day: td, focus: focus });
        return draft;
      },
      { actor: "owner" }
    );
    if (!r.ok) return r;
    return Object.assign({ copiedParts: copiedParts }, r);
  }

  /** Stamp the reminder so it goes out once per block, never once per page load. */
  async function stampRenewalMailed(programId, expectedVersion, blockIndex) {
    return updateProgram(
      programId,
      expectedVersion,
      function (draft) {
        normalizeBlocks(draft);
        for (const b of draft.blocks) {
          if (b.blockIndex === blockIndex) b.renewalMailedAt = new Date(nowMs(clock)).toISOString();
        }
        return draft;
      },
      { actor: "owner" }
    );
  }

  async function approveBlock(programId, expectedVersion, blockIndex) {
    /* Look before writing. updateProgram always increments the version, so an approve
       with nothing to approve used to bump it anyway — and the page still holding the
       old number was then refused on its NEXT, real save. A refusal must cost nothing. */
    const current = await readProgram(programId, { allowCache: false });
    if (!current.ok) return current;
    normalizeBlocks(current.program);
    const wantedIndex = parseInt(blockIndex, 10) || 0;
    const pending = (current.program.blocks || []).filter(function (b) {
      return b && !b.approvedAt && (!wantedIndex || b.blockIndex === wantedIndex);
    });
    if (!pending.length) {
      return { ok: false, code: "NOTHING_TO_APPROVE", error: "that block is already with the client" };
    }

    let approved = null;
    const r = await updateProgram(
      programId,
      expectedVersion,
      function (draft) {
        normalizeBlocks(draft);
        const wanted = parseInt(blockIndex, 10) || 0;
        for (const b of draft.blocks) {
          if (wanted && b.blockIndex !== wanted) continue;
          if (b.approvedAt) continue;
          b.approvedAt = new Date(nowMs(clock)).toISOString();
          approved = b.blockIndex;
          /* A block arriving at the client is entirely new to them, so the whole of it
             is flagged until they have been through it — the mirror of the owner's own
             "I have not been over this" list (owner, 2026-09-01). Rest days carry no
             flag: there is nothing on them to read. */
          const start = parseInt(b.startWeek, 10) || 1;
          const end = start - 1 + (parseInt(b.weekCount, 10) || 0);
          for (let w = start; w <= end; w++) {
            const week = draft.weeks[w - 1];
            if (!isPlainObject(week) || !isPlainObject(week.days)) continue;
            for (const d of DAY_KEYS) {
              if (isRestWeekday(b.intake || draft.intake, d)) continue;
              const day = week.days[d];
              if (!isPlainObject(day)) continue;
              day.coachModified = true;
              draft.clientUnreadDays["w" + w + ":" + d] = new Date(nowMs(clock)).toISOString();
            }
          }
          if (wanted) break;
        }
        return draft;
      },
      { actor: "owner" }
    );
    if (!r.ok) return r;
    if (!approved) {
      return { ok: false, code: "NOTHING_TO_APPROVE", error: "that block is already with the client" };
    }
    return Object.assign({ approvedBlock: approved }, r);
  }

  return {
    createProgram,
    readProgram,
    updateProgram,
    addBlock,
    approveBlock,
    copyWeek,
    copyDay,
    stampRenewalMailed,
    deleteProgram,
    readIndex,
    readStripOrder,
    writeStripOrder,
    rebuildIndex,
  };
}

module.exports = {
  createProgramStore,
  emptyProgram,
  emptyWeek,
  newBlock,
  normalizeBlocks,
  approvedWeekCount,
  blockOfWeek,
  changedDayTags,
  validateProgram,
  indexRowFor,
  newProgramId,
  programKey,
  lockKey,
  emptyIndex,
  DAY_KEYS,
  INDEX_KEY,
  PROGRAM_PREFIX,
  LOCK_TTL_MS,
  MAX_WEEKS,
  MAX_PROGRAM_BYTES,
};
