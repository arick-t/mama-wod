#!/usr/bin/env node
/**
 * Weekly Sunday digest: refresh living myleo+Restoration pattern notes from workouts.json,
 * mirror into knowledge-inbox, optionally sync File Search (GATED), email confirmation.
 *
 * Safety:
 *   - Does NOT call coach-sync-brain unless COACH_BRAIN_SYNC_ENABLED=true
 *   - Production File Search stays untouched until you explicitly enable that flag
 *
 * Usage:
 *   node scripts/coach-weekly-patterns-digest.js
 *   npm run coach:weekly-patterns-digest
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveAppMailTo } = require("../lib/app-mail.js");

const ROOT = path.join(__dirname, "..");
const WORKOUTS = path.join(ROOT, "data", "workouts.json");
const LIVING = path.join(
  ROOT,
  "experiments",
  "personal-coach",
  "living-knowledge",
  "source-patterns-digest.md"
);
const INBOX_MIRROR = path.join(
  ROOT,
  "experiments",
  "personal-coach",
  "knowledge-inbox",
  "living-knowledge",
  "source-patterns-digest.md"
);
const ANCHOR = "<!-- WEEKLY_DIGEST_ANCHOR -->";
const SOURCES = ["myleo", "restoration"];

function israelToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(iso, delta) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function loadWorkouts() {
  if (!fs.existsSync(WORKOUTS)) return { workouts: {} };
  return JSON.parse(fs.readFileSync(WORKOUTS, "utf8"));
}

function collectWindow(data, endIso, days) {
  const start = addDaysISO(endIso, -(days - 1));
  const out = [];
  const workouts = data.workouts || {};
  for (const date of Object.keys(workouts).sort()) {
    if (date < start || date > endIso) continue;
    for (const w of workouts[date] || []) {
      if (SOURCES.includes(w.source)) out.push({ date, w });
    }
  }
  return { start, end: endIso, items: out };
}

function analyze(items) {
  const bySrc = { myleo: 0, restoration: 0 };
  const formats = {};
  const sectionTitles = {};
  const loadHints = [];
  const fmtRe =
    /\b(amrap|emom|for time|rounds for time|tabata|every\s+\d|:)\b/gi;
  const loadRe = /(\d+\s*\/\s*\d+\s*kg|\d+\s*%|\d+\/\d+lbs|\d+s\/\d+s)/gi;

  for (const { w } of items) {
    bySrc[w.source] = (bySrc[w.source] || 0) + 1;
    for (const s of w.sections || []) {
      const title = (s.title || "").trim();
      if (title) sectionTitles[title] = (sectionTitles[title] || 0) + 1;
      const blob = [title, ...(s.lines || [])].join("\n");
      const low = blob.toLowerCase();
      for (const key of ["amrap", "emom", "for time", "partner", "zone 2", "stamina"]) {
        if (low.includes(key)) formats[key] = (formats[key] || 0) + 1;
      }
      const loads = blob.match(loadRe);
      if (loads) {
        for (const L of loads.slice(0, 3)) {
          if (loadHints.length < 12) loadHints.push(L);
        }
      }
      void fmtRe;
    }
  }

  const topSections = Object.entries(sectionTitles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t, n]) => `${t} (×${n})`);

  const formatLine = Object.entries(formats)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}:${n}`)
    .join(", ");

  return { bySrc, formatLine, topSections, loadHints };
}

function buildDigestSection(today, window, stats) {
  const lines = [];
  lines.push(`### ${today} — weekly digest`);
  lines.push(
    `- Window: ${window.start} → ${window.end} (Israel calendar; sources: myleo + Restoration only).`
  );
  lines.push(
    `- Sessions seen: myleo=${stats.bySrc.myleo || 0}, restoration=${stats.bySrc.restoration || 0}.`
  );
  if (stats.formatLine) lines.push(`- Format signals: ${stats.formatLine}.`);
  if (stats.topSections.length) {
    lines.push(`- Recurring part titles: ${stats.topSections.join("; ")}.`);
  }
  if (stats.loadHints.length) {
    lines.push(`- Load language samples: ${stats.loadHints.join(", ")}.`);
  }
  lines.push(
    "- Action for coach: strengthen matching principles in sections A–E above if signals confirm; do not append raw WODs."
  );
  lines.push("");
  return lines.join("\n");
}

function upsertLivingDoc(section) {
  let text = fs.readFileSync(LIVING, "utf8");
  if (!text.includes(ANCHOR)) {
    text = text.trimEnd() + "\n\n" + ANCHOR + "\n";
  }
  // Insert new digest immediately after anchor line
  text = text.replace(ANCHOR, ANCHOR + "\n\n" + section);
  fs.writeFileSync(LIVING, text, "utf8");
  fs.mkdirSync(path.dirname(INBOX_MIRROR), { recursive: true });
  fs.copyFileSync(LIVING, INBOX_MIRROR);
}

function maybeSyncBrain() {
  const enabled = String(process.env.COACH_BRAIN_SYNC_ENABLED || "").toLowerCase();
  if (enabled !== "true" && enabled !== "1" && enabled !== "yes") {
    return {
      synced: false,
      reason: "COACH_BRAIN_SYNC_ENABLED not true — production File Search left untouched",
    };
  }
  const r = spawnSync("node", [path.join(ROOT, "scripts", "coach-sync-brain.js")], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  return {
    synced: r.status === 0,
    reason: r.status === 0 ? "coach-sync-brain ok" : `coach-sync-brain failed: ${r.stderr || r.stdout}`,
    status: r.status,
  };
}

async function sendEmail(reportText) {
  const { sendAppMail, hasMailProvider } = require("../lib/send-app-mail");
  if (!hasMailProvider()) {
    console.log("[email] skipped — no BREVO_API_KEY");
    return { sent: false, reason: "no_brevo_api_key" };
  }
  const to = resolveAppMailTo({
    COACH_DIGEST_EMAIL_TO: process.env.COACH_DIGEST_EMAIL_TO,
    APP_MAIL_TO: process.env.APP_MAIL_TO,
    ANALYTICS_REPORT_TO: process.env.ANALYTICS_REPORT_TO,
  });
  const subject = `DUCK-WOD — weekly coach patterns digest (${israelToday()})`;
  const mail = await sendAppMail({ to, subject, text: reportText });
  if (!mail.sent) {
    throw new Error(`brevo failed: ${mail.reason} ${mail.detail || ""}`);
  }
  return { sent: true, to, provider: mail.provider };
}

async function main() {
  const today = israelToday();
  const data = loadWorkouts();
  const window = collectWindow(data, today, 7);
  const stats = analyze(window.items);
  const section = buildDigestSection(today, window, stats);
  upsertLivingDoc(section);
  const brain = maybeSyncBrain();

  const report = [
    "Weekly coach patterns digest — confirmation",
    "",
    `Date (Israel): ${today}`,
    `Window: ${window.start} → ${window.end}`,
    `myleo sessions: ${stats.bySrc.myleo || 0}`,
    `restoration sessions: ${stats.bySrc.restoration || 0}`,
    `Formats: ${stats.formatLine || "(none)"}`,
    "",
    `Living doc updated: ${path.relative(ROOT, LIVING)}`,
    `Inbox mirror updated: ${path.relative(ROOT, INBOX_MIRROR)}`,
    `Brain sync: ${brain.synced ? "YES" : "NO"} (${brain.reason})`,
    "",
    "This email confirms the Sunday digest action ran.",
  ].join("\n");

  console.log(report);
  fs.writeFileSync(path.join(ROOT, "coach-digest-report.txt"), report, "utf8");

  try {
    const mail = await sendEmail(report);
    console.log("[email]", mail);
  } catch (e) {
    console.error("[email] failed:", e.message || e);
    if (process.env.COACH_DIGEST_REQUIRE_EMAIL === "true") process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
