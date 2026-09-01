/**
 * "This client's block is about to end — come and plan the next one."
 *
 * The owner sells by the block. The moment that matters is not the day it ends, it is
 * the week before, while there is still time to sit down and write the next one. He set
 * that window himself on 2026-09-01: a week, not three days, "כי זה לא מספיק".
 *
 * The decision lives here, away from the mail sending and away from the store, so it
 * can be tested against a fixed clock instead of against a calendar that moves.
 *
 * 0 LLM. No network.
 */

"use strict";

/** How long before a block ends the owner wants to be told. */
const NOTICE_DAYS = 7;

/** A day in milliseconds. */
const DAY_MS = 86400000;

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isoToMs(iso) {
  const t = Date.parse(String(iso || "") + "T00:00:00Z");
  return Number.isFinite(t) ? t : NaN;
}

function addDaysIso(iso, days) {
  const base = isoToMs(iso);
  if (!Number.isFinite(base)) return "";
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The last day of a block, as an ISO date.
 *
 * Weeks are absolute and start at the program's blockStart, so a block that begins at
 * week 5 begins 28 days in. The last day is the seventh day of its last week.
 */
function blockEndIso(program, block) {
  if (!isPlainObject(program) || !isPlainObject(block)) return "";
  const start = String(program.blockStart || "");
  if (!isoToMs(start)) return "";
  const startWeek = Math.max(1, parseInt(block.startWeek, 10) || 1);
  const weeks = Math.max(1, parseInt(block.weekCount, 10) || 1);
  return addDaysIso(start, (startWeek - 1 + weeks) * 7 - 1);
}

/** The block the client is training in now: the last one the owner has sent. */
function lastApprovedBlock(program) {
  const blocks = Array.isArray(program && program.blocks) ? program.blocks : [];
  let best = null;
  for (const b of blocks) {
    if (!b || !b.approvedAt) continue;
    if (!best || (parseInt(b.blockIndex, 10) || 0) > (parseInt(best.blockIndex, 10) || 0)) best = b;
  }
  return best;
}

/**
 * Should a reminder go out for this program today?
 *
 * No when: nothing has been sent to the client yet (there is no block to renew), a
 * later block is already planned (he has done the thing the mail would ask for), the
 * reminder for this block already went out, or the end is further away than the notice
 * window. A block that has already ended still gets one — better late than silent.
 *
 * @param {object} program
 * @param {string} todayIso YYYY-MM-DD
 * @returns {{due: boolean, reason: string, block: object|null, endsOn: string, daysLeft: number}}
 */
function renewalDue(program, todayIso) {
  const blocks = Array.isArray(program && program.blocks) ? program.blocks : [];
  const current = lastApprovedBlock(program);
  if (!current) return { due: false, reason: "nothing_sent_yet", block: null, endsOn: "", daysLeft: 0 };

  const planned = blocks.some(function (b) {
    return b && !b.approvedAt && (parseInt(b.blockIndex, 10) || 0) > (parseInt(current.blockIndex, 10) || 0);
  });
  if (planned) return { due: false, reason: "next_block_already_planned", block: current, endsOn: "", daysLeft: 0 };

  if (current.renewalMailedAt) {
    return { due: false, reason: "already_mailed", block: current, endsOn: "", daysLeft: 0 };
  }

  const endsOn = blockEndIso(program, current);
  const end = isoToMs(endsOn);
  const today = isoToMs(todayIso);
  if (!Number.isFinite(end) || !Number.isFinite(today)) {
    return { due: false, reason: "no_dates", block: current, endsOn: endsOn, daysLeft: 0 };
  }
  const daysLeft = Math.round((end - today) / DAY_MS);
  if (daysLeft > NOTICE_DAYS) {
    return { due: false, reason: "too_early", block: current, endsOn: endsOn, daysLeft: daysLeft };
  }
  return { due: true, reason: "due", block: current, endsOn: endsOn, daysLeft: daysLeft };
}

/** What the owner reads. Plain text — it is a nudge, not a report. */
function renewalMail(program, verdict, adminUrl) {
  const name = (program && program.clientName) || "לקוח";
  const days = verdict.daysLeft;
  const when =
    days < 0 ? "הסתיימה" : days === 0 ? "מסתיימת היום" : "מסתיימת בעוד " + days + " ימים";
  return {
    subject: "לבנת האימון של " + name + " עתידה להסתיים בקרוב",
    text: [
      "לבנת האימון של " + name + " " + when + ".",
      "",
      "לבנה " + (verdict.block.blockIndex || 1) + " · מסתיימת ב-" + verdict.endsOn,
      "",
      "כנס לתכנן לבנה חדשה:",
      adminUrl,
    ].join("\n"),
  };
}

module.exports = {
  NOTICE_DAYS,
  blockEndIso,
  lastApprovedBlock,
  renewalDue,
  renewalMail,
  addDaysIso,
};
