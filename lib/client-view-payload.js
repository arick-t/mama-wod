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

const RestToggle = require("./day-rest-toggle.js");
/* Only for approvedWeekCount: which weeks the owner has actually sent. The block
   records themselves never cross this boundary. */
const Store = require("./client-program-store.js");

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
/* "noteLines" says how many of the leading lines were written as notes — without it
   a note in Hebrew comes back as a work line (owner, 2026-09-05).
   "lineColors" and "numbered" are how the coach marked the lines of this part: they are
   part of the plan the client was sent, and the client — who is a coach too — may send
   them back. */
const PART_FIELDS = ["id", "title", "lines", "modified", "noteLines", "lineColors", "numbered"];

/* The colours a line may be written in. The names are stored, never the hex — see
   lib/pprog-display.js, which draws them; the two lists are checked against each other
   by scripts/pprog-line-colour.test.js. */
const LINE_COLOURS = ["red", "orange", "yellow", "green", "blue", "purple"];

/**
 * A part's colours, as they are allowed to be stored: an object keyed by the position
 * of the WORK line, valued with a colour NAME from the list above. Anything else is
 * dropped rather than rejected — a colour is decoration, and losing one must never cost
 * a client their save.
 */
function cleanLineColours(raw, lineCount) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  let any = false;
  for (const key of Object.keys(raw).slice(0, 60)) {
    const idx = parseInt(key, 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= lineCount) continue;
    const name = String(raw[key] || "");
    if (LINE_COLOURS.indexOf(name) < 0) continue;
    out[String(idx)] = name;
    any = true;
  }
  return any ? out : null;
}

/** Day fields a client may see or send. */
/* "title" is the name the owner gave the day; it is part of the plan they were sent,
   so it travels with it (owner, 2026-09-05). */
const DAY_FIELDS = ["parts", "modified", "coachModified", "title"];

/** Week fields a client may see. */
const WEEK_OUT = ["weekIndex", "phase", "theme", "summaryLine", "overview", "days"];

/**
 * Never leaves the server toward a client. Listed explicitly so the intent is
 * readable and so the test can assert each one by name.
 */
const NEVER_TO_CLIENT = [
  /* The whole cross-cutting questionnaire is owner-only: it carries the price and
     the owner-facing description of the client's own population. */
  "intake",
  /* The eight-step end-athlete questionnaire. Same rule as the studio one: it is the
     owner's record of this person, not something to hand back to them. */
  "athleteIntake",
  "monthlyAmount",
  "paymentMethod",
  "paymentNotes",
  /* How the owner files this person: the colour he picks them out by, and whether he
     has frozen them. Both are his notes about a client, not the client's own data. */
  "clientColour",
  "frozen",
  /* The OWNER's queue. The client's own flags ride on the days themselves. */
  "unreadDays",
  "clientUnreadDays",
  /* The block records: what he planned, what he has not sent yet, what he wrote to
     himself about the next one, and when the reminder went out. A client asking "what
     is coming" is asking the coach, not the server. */
  "blocks",
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
  const noteLines = parseInt(out.noteLines, 10);
  if (Number.isFinite(noteLines) && noteLines > 0) out.noteLines = Math.min(noteLines, out.lines.length);
  else delete out.noteLines;
  const colours = cleanLineColours(out.lineColors, out.lines.length);
  if (colours) out.lineColors = colours;
  else delete out.lineColors;
  if (out.numbered === true) out.numbered = true;
  else delete out.numbered;
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
  /* The coach rewrote this day and the client has not opened it since. It crosses to
     the client because it is FOR the client — a change they were never told about is a
     change they will not do (owner, 2026-09-01). The client cannot set it: an inbound
     edit is rebuilt from parseClientEdit, never from this shape. */
  if (src.coachModified === true) out.coachModified = true;
  /* The name the day was given — "אימון תחנות". It is part of the plan they were sent,
     so it goes with it; the automatic count stays beside it in their view, drawn by the
     display library rather than carried in the data (owner, 2026-09-05). */
  const dayTitle = typeof src.title === "string" ? src.title.trim().slice(0, 80) : "";
  if (dayTitle) out.title = dayTitle;
  return out;
}

/**
 * Program → what the client's browser receives. Allowlist, field by field.
 *
 * A block the owner has not approved does not reach here AT ALL — not as an empty
 * calendar, not as "coming soon": its weeks are simply absent (owner, 2026-09-01). The
 * cut is made here, at the boundary, rather than in the page, because this is the only
 * place where the promise is worth anything: someone calling the endpoint directly gets
 * the same answer as the page does.
 */
function programForClient(program) {
  if (!isPlainObject(program)) return null;
  const out = pick(program, PROGRAM_OUT);
  out.weeks = [];
  const visible = Store.approvedWeekCount(program);
  const weeks = (Array.isArray(program.weeks) ? program.weeks : []).slice(0, visible);
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
  /* Where one month ends and the next begins — and NOT the blocks themselves, which
     carry what the owner has not sent yet (see NEVER_TO_CLIENT). Two numbers per block,
     clipped to what the client can actually see, so their calendar separates months the
     same way his does (owner, 2026-09-02). */
  /* How many sessions a week this client bought — a single number, derived from the
     questionnaire and NOT the questionnaire itself (which carries their price). Without
     it their calendar drew a seven-day week for a programme sold as three, while the
     owner's screen drew three (owner, 2026-09-02). */
  out.sessionColumns = 0;
  if (isPlainObject(program.intake) && program.intake.scheduleMode === "session_count") {
    const n = parseInt(program.intake.sessionsPerWeek, 10);
    out.sessionColumns = Number.isFinite(n) && n >= 1 && n <= 7 ? n : 0;
  }
  out.blockGroups = [];
  const blocks = Array.isArray(program.blocks) ? program.blocks : [];
  for (const b of blocks) {
    if (!isPlainObject(b) || !b.approvedAt) continue;
    const startWeek = parseInt(b.startWeek, 10) || 0;
    const weekCount = parseInt(b.weekCount, 10) || 0;
    if (startWeek < 1 || weekCount < 1 || startWeek > visible) continue;
    out.blockGroups.push({
      startWeek: startWeek,
      weekCount: Math.min(weekCount, visible - startWeek + 1),
    });
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
    var wantsRest = e.rest === true;
    /* A name for the day — "אימון תחנות". Undefined means "not part of this edit";
       an empty string means "take the name off" (owner, 2026-09-05). */
    var title = e.title === undefined ? undefined : String(e.title || "").trim().slice(0, 80);
    if (!wantsRest && !Array.isArray(e.parts)) return { ok: false, error: "edit must carry a parts array" };
    if (wantsRest) {
      edits.push({ weekIndex: weekIndex, dayKey: dayKey, rest: true, parts: [], title: title });
      continue;
    }
    if (e.parts.length > 12) return { ok: false, error: "too many parts in one day" };
    const parts = [];
    for (const p of e.parts) {
      const cp = cleanPart(p);
      if (!cp) return { ok: false, error: "edit has an unusable part" };
      parts.push(cp);
    }
    edits.push({ weekIndex: weekIndex, dayKey: dayKey, parts: parts, title: title });
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
    if (!isPlainObject(week)) continue;
    if (!isPlainObject(week.days)) week.days = {};

    /* Both directions go through lib/day-rest-toggle.js, because a day is REST by
       its overview focus first — writing parts alone leaves a session that still
       renders as rest, and vice versa. */
    if (edit.rest === true) {
      RestToggle.makeRest(week, edit.dayKey);
    } else {
      RestToggle.makeSession(
        week,
        edit.dayKey,
        edit.parts.map(function (p) {
          return Object.assign({}, p, { modified: true });
        })
      );
    }
    const day = week.days[edit.dayKey];
    if (isPlainObject(day)) {
      day.modified = true;
      /* The toggles carry a name that was already there; this is the one being SET. */
      if (edit.title !== undefined) {
        if (edit.title) day.title = edit.title;
        else delete day.title;
      }
    }
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
  LINE_COLOURS,
  DAY_FIELDS,
  WEEK_OUT,
  NEVER_TO_CLIENT,
  DAY_KEYS,
};
