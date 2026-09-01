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

const Intake = require("./client-intake.js");

const PROGRAM_PREFIX = "client-programs/";
const INDEX_KEY = "client-programs/_index.json";
const LOCK_SUFFIX = ".lock.json";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** A lock older than this is treated as abandoned — a crashed save must not wedge a program forever. */
const LOCK_TTL_MS = 20 * 1000;
const LOCK_RETRY_MS = 60;
const LOCK_MAX_TRIES = 12;

/* A year of programming. The cap exists because one Blob object holds the whole
   timeline and MAX_PROGRAM_BYTES is the real ceiling — better a clear refusal at a
   round number than a save that fails on byte count halfway through a season. */
const MAX_WEEKS = 52;

const MAX_PROGRAM_BYTES = 512 * 1024;
const MAX_INDEX_ROWS = 5000;

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
function emptyWeek(absoluteWeekIndex, intake, legacyLastWeek) {
  const days = {};
  for (let i = 0; i < DAY_KEYS.length; i++) days[DAY_KEYS[i]] = { parts: [] };
  /* With an intake, the deload is a cadence read off the absolute index. Without one
     (the legacy athlete path) the old rule stands — the last week of the block — so
     that path keeps behaving exactly as it did. */
  const deload = isPlainObject(intake)
    ? Intake.isDeloadWeek(intake, absoluteWeekIndex)
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
    clientKind: o.clientKind === "athlete" ? "athlete" : "coach",
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
    /* Set of "w<i>:<dayKey>" the client changed and the owner has not opened yet. */
    unreadDays: {},
    isTest: o.isTest === true,
  };
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
  return {
    programId: program.programId,
    clientName: program.clientName || "",
    clientKind: program.clientKind || "coach",
    version: Number(program.version) || 1,
    updatedAt: program.updatedAt || "",
    updatedBy: program.updatedBy || "",
    unreadCount: Object.keys(isPlainObject(program.unreadDays) ? program.unreadDays : {}).length,
    isTest: program.isTest === true,
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
      cacheSet(key, row);
      return { ok: true, program: row, fromCache: false };
    }
    /* Network or Blob hiccup — serve the last copy we saw rather than nothing.
       A missing object (no error) is a genuine 404 and must not read as cached. */
    if (readFailed && o.allowCache !== false) {
      const cached = cacheGet(key);
      if (cached) return { ok: true, program: cached, fromCache: true, readError: readFailed };
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
      /* A client edit is what the owner needs to notice; the owner's own edit never
         flags itself. State, not a counter — five saves to one day stay one flag. */
      if (actor === "client" && Array.isArray(m.touchedDays)) {
        for (const tag of m.touchedDays) {
          const t = String(tag || "").slice(0, 20);
          if (t) next.unreadDays[t] = next.updatedAt;
        }
      }
      if (Array.isArray(m.clearUnread)) {
        for (const tag of m.clearUnread) delete next.unreadDays[String(tag || "").slice(0, 20)];
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
   * Sell another month. Four more empty weeks appended to the SAME timeline, keeping
   * the absolute numbering — so a five-week deload cadence lands the deload on the
   * first week of the new month rather than restarting the count (owner, 2026-09-01).
   * The weeks come out empty, like everything else here: the owner writes them.
   */
  async function addMonth(programId, expectedVersion) {
    let added = 0;
    const r = await updateProgram(
      programId,
      expectedVersion,
      function (draft) {
        const weeks = Array.isArray(draft.weeks) ? draft.weeks : [];
        const last = weeks.length
          ? parseInt(weeks[weeks.length - 1].weekIndex, 10) || weeks.length
          : 0;
        const want = Intake.weekCountFor();
        const room = Math.max(0, MAX_WEEKS - weeks.length);
        added = Math.min(want, room);
        for (let i = 1; i <= added; i++) {
          weeks.push(emptyWeek(last + i, draft.intake, false));
        }
        draft.weeks = weeks;
      },
      { actor: "owner" }
    );
    if (!r.ok) return r;
    if (!added) {
      return { ok: false, code: "MAX_WEEKS", error: "This program is already " + MAX_WEEKS + " weeks long." };
    }
    return Object.assign({ added: added }, r);
  }

  return {
    createProgram,
    readProgram,
    updateProgram,
    addMonth,
    deleteProgram,
    readIndex,
    rebuildIndex,
  };
}

module.exports = {
  createProgramStore,
  emptyProgram,
  emptyWeek,
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
