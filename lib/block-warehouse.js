/**
 * The block warehouse — the owner's own shelf of programmes he is happy with.
 *
 * A block he likes is saved under a name and can be planted at any client afterwards
 * (owner, 2026-09-05). It is his library, not a client's: nothing in here belongs to
 * the person it was written for, and nothing about that person travels with it.
 *
 * This file is the SHAPE of a saved block and of the row that describes it. What the
 * block actually contains is lib/pprog-clipboard.js's business — the same content a
 * copy carries — so a block can be planted from the warehouse or straight from another
 * client and land identically.
 *
 * Browser: <script src="lib/block-warehouse.js"></script> → BlockWarehouse
 * Node: require("./block-warehouse")
 *
 * 0 LLM. No network.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BlockWarehouse = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* A weekly programme is drawn on seven days, so that is what its row says. A
     programme sold as sessions says how many sessions a week it holds. */
  const WEEKLY = "weekly_schedule";
  const SESSIONS = "session_count";
  const WEEKLY_DAYS = 7;

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function str(v, max) {
    return String(v == null ? "" : v).slice(0, max || 200);
  }

  /** Ids are generated here and end up in URLs and data attributes, so: safe letters. */
  function newId(now, rand) {
    const t = Number(now || Date.now()).toString(36);
    const r = Math.floor((rand === undefined ? Math.random() : rand) * 1e8).toString(36);
    return "blk_" + t + r;
  }

  /** Which shape of programme this block is, as the owner chose it for the client. */
  function kindOf(intake) {
    const mode = str(intake && intake.scheduleMode, 40);
    return mode === SESSIONS ? SESSIONS : WEEKLY;
  }

  /**
   * How many sessions a week the row shows.
   *
   * Seven for a weekly programme — that is what the calendar draws — and the number he
   * sold for a programme counted in sessions.
   */
  function sessionsPerWeekOf(intake) {
    if (kindOf(intake) !== SESSIONS) return WEEKLY_DAYS;
    const n = parseInt(intake && intake.sessionsPerWeek, 10);
    return n >= 1 && n <= 7 ? n : WEEKLY_DAYS;
  }

  /**
   * One saved block, ready to be written down.
   *
   * @param {object} o {id, name, description, createdAt, intake, weeks, sourceName}
   */
  function entryFor(o) {
    const src = isPlainObject(o) ? o : {};
    const name = str(src.name, 80).trim();
    if (!name) return null;
    const weeks = Array.isArray(src.weeks) ? src.weeks : [];
    if (!weeks.length) return null;
    const intake = isPlainObject(src.intake) ? src.intake : {};
    return {
      v: 1,
      id: str(src.id, 60) || newId(),
      name: name,
      description: str(src.description, 400).trim(),
      createdAt: str(src.createdAt, 40) || new Date().toISOString(),
      kind: kindOf(intake),
      sessionsPerWeek: sessionsPerWeekOf(intake),
      weekCount: weeks.length,
      /* Where it came from, for his own memory only — a name, never the client's id or
         anything else about them. */
      sourceName: str(src.sourceName, 80),
      weeks: weeks,
    };
  }

  /** The line the warehouse table shows. The weeks themselves stay on the shelf. */
  function rowFor(entry) {
    if (!isPlainObject(entry)) return null;
    return {
      id: str(entry.id, 60),
      name: str(entry.name, 80),
      description: str(entry.description, 400),
      createdAt: str(entry.createdAt, 40),
      kind: entry.kind === SESSIONS ? SESSIONS : WEEKLY,
      sessionsPerWeek: sessionsPerWeekOf({
        scheduleMode: entry.kind,
        sessionsPerWeek: entry.sessionsPerWeek,
      }),
      weekCount: Math.max(0, parseInt(entry.weekCount, 10) || 0),
      sourceName: str(entry.sourceName, 80),
    };
  }

  /** Newest first: the last thing he saved is the thing he is most likely to want. */
  function sortRows(rows) {
    return (Array.isArray(rows) ? rows.slice() : []).sort(function (a, b) {
      return String((b && b.createdAt) || "").localeCompare(String((a && a.createdAt) || ""));
    });
  }

  /** "שבועית" / "מספר אימונים" — his words, in the table. */
  function kindLabel(kind) {
    return kind === SESSIONS ? "מספר אימונים" : "שבועית";
  }

  return {
    WEEKLY,
    SESSIONS,
    WEEKLY_DAYS,
    newId,
    kindOf,
    sessionsPerWeekOf,
    entryFor,
    rowFor,
    sortRows,
    kindLabel,
  };
});
