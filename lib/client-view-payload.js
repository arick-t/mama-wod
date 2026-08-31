/**
 * The security boundary of the client view (checklist 0.1).
 *
 * The existing snapshot filter is a DENYLIST — it copies the whole row and deletes
 * two keys. That is safe today only because both of its callers are admin-gated.
 * It is the wrong default for a surface that answers a non-admin party: every field
 * added later would be exposed by accident.
 *
 * So everything crossing to a client is built by ALLOWLIST here. Start from nothing;
 * name what may leave; name what may come back.
 *
 * Two things the owner asked for that this file is what actually enforces:
 *   - Payment terms (monthly amount, method) are the owner's business and must never
 *     reach the person being charged.
 *   - The unread flag is the owner's private queue. The client edits and "feels
 *     nothing" — so the client must not be able to see whether the owner has looked.
 *
 * 0 LLM.
 */

"use strict";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Program fields a client may see. Anything absent here does not travel. */
const PROGRAM_OUT = [
  "programId",
  "clientName",
  "clientKind",
  "blockStart",
  /* Required: the client's browser must send it back so a stale save is refused. */
  "version",
  "updatedAt",
];

/** Part fields a client may see or send. */
const PART_FIELDS = ["id", "title", "lines", "modified"];

/** Day fields a client may see or send. */
const DAY_FIELDS = ["parts", "modified"];

/** Week fields a client may see. */
const WEEK_OUT = ["weekIndex", "phase", "theme", "summaryLine", "overview", "days"];

/**
 * Never leaves the server toward a client. Listed explicitly so the intent is
 * readable and so the test can assert each one by name.
 */
const NEVER_TO_CLIENT = [
  "monthlyAmount",
  "paymentMethod",
  "paymentNotes",
  "unreadDays",
  "isTest",
  "updatedBy",
  "ownerNotes",
  "writeKey",
  "writeKeyHash",
  "accessCode",
  "accessCodeHash",
  "devices",
  "email",
  "createdAt",
];

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pick(src, keys) {
  const out = {};
  if (!isPlainObject(src)) return out;
  for (const k of keys) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

function cleanLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.slice(0, 40).map(function (l) {
    return String(l == null ? "" : l).slice(0, 600);
  });
}

function cleanPart(part) {
  if (!isPlainObject(part)) return null;
  const out = pick(part, PART_FIELDS);
  out.id = String(out.id || "").slice(0, 60);
  out.title = String(out.title || "").slice(0, 200);
  out.lines = cleanLines(out.lines);
  out.modified = out.modified === true ? true : undefined;
  if (out.modified === undefined) delete out.modified;
  return out;
}

function cleanDay(day) {
  const src = isPlainObject(day) ? day : {};
  const out = { parts: [] };
  const parts = Array.isArray(src.parts) ? src.parts : [];
  for (const p of parts.slice(0, 12)) {
    const cp = cleanPart(p);
    if (cp) out.parts.push(cp);
  }
  if (src.modified === true) out.modified = true;
  return out;
}

/** Program → what the client's browser receives. Allowlist, field by field. */
function programForClient(program) {
  if (!isPlainObject(program)) return null;
  const out = pick(program, PROGRAM_OUT);
  out.weeks = [];
  const weeks = Array.isArray(program.weeks) ? program.weeks : [];
  for (const w of weeks) {
    if (!isPlainObject(w)) continue;
    const week = pick(w, WEEK_OUT);
    week.days = {};
    for (const k of DAY_KEYS) {
      week.days[k] = cleanDay(w.days && w.days[k]);
    }
    if (Array.isArray(week.overview)) {
      week.overview = week.overview.slice(0, 7).map(function (o) {
        return {
          day: String((o && o.day) || "").slice(0, 3),
          focus: String((o && o.focus) || "").slice(0, 120),
        };
      });
    }
    out.weeks.push(week);
  }
  return out;
}

/**
 * What the client is allowed to send back.
 *
 * The client may reshape TRAINING CONTENT freely — they are a coach and master of
 * their own program (checklist b.7). They may not touch identity, versioning,
 * payment, or the owner's unread queue: those are set by the server.
 *
 * @returns {{ ok: true, expectedVersion: number, edits: Array }
 *          | { ok: false, error: string }}
 */
function parseClientEdit(body) {
  const b = isPlainObject(body) ? body : {};
  const expected = Number(b.expectedVersion);
  if (!Number.isFinite(expected) || expected < 1) {
    return { ok: false, error: "expectedVersion is required — it is what stops a stale save" };
  }
  const rawEdits = Array.isArray(b.edits) ? b.edits : null;
  if (!rawEdits || !rawEdits.length) return { ok: false, error: "no edits supplied" };
  if (rawEdits.length > 40) return { ok: false, error: "too many edits in one save" };

  const edits = [];
  for (const e of rawEdits) {
    if (!isPlainObject(e)) return { ok: false, error: "edit must be an object" };
    const weekIndex = parseInt(e.weekIndex, 10);
    const dayKey = String(e.dayKey || "").slice(0, 3);
    if (!Number.isFinite(weekIndex) || weekIndex < 1 || weekIndex > 12) {
      return { ok: false, error: "edit has an out-of-range weekIndex" };
    }
    if (DAY_KEYS.indexOf(dayKey) < 0) return { ok: false, error: "edit has an unknown dayKey" };
    if (!Array.isArray(e.parts)) return { ok: false, error: "edit must carry a parts array" };
    if (e.parts.length > 12) return { ok: false, error: "too many parts in one day" };
    const parts = [];
    for (const p of e.parts) {
      const cp = cleanPart(p);
      if (!cp) return { ok: false, error: "edit has an unusable part" };
      parts.push(cp);
    }
    edits.push({ weekIndex: weekIndex, dayKey: dayKey, parts: parts });
  }
  return { ok: true, expectedVersion: expected, edits: edits };
}

/**
 * Apply a parsed client edit to a program draft. Marks touched parts MODIFIED
 * (checklist a.2.5 / b.7) and reports the day tags so the owner's unread flag can
 * be raised by the store.
 */
function applyClientEdit(draft, parsed) {
  const touchedDays = [];
  if (!isPlainObject(draft) || !Array.isArray(draft.weeks)) return touchedDays;
  for (const edit of parsed.edits) {
    const week = draft.weeks[edit.weekIndex - 1];
    if (!isPlainObject(week) || !isPlainObject(week.days)) continue;
    const day = week.days[edit.dayKey];
    if (!isPlainObject(day)) continue;
    day.parts = edit.parts.map(function (p) {
      return Object.assign({}, p, { modified: true });
    });
    day.modified = true;
    touchedDays.push("w" + edit.weekIndex + ":" + edit.dayKey);
  }
  return touchedDays;
}

/** Defence in depth for the existing admin path: strip secrets by name too. */
function stripSensitive(row) {
  if (!isPlainObject(row)) return row;
  const out = Object.assign({}, row);
  for (const k of NEVER_TO_CLIENT) delete out[k];
  return out;
}

module.exports = {
  programForClient,
  parseClientEdit,
  applyClientEdit,
  stripSensitive,
  PROGRAM_OUT,
  PART_FIELDS,
  DAY_FIELDS,
  WEEK_OUT,
  NEVER_TO_CLIENT,
  DAY_KEYS,
};
