/**
 * Personal Coach feedback → email owner (Beta 1.0)
 * POST { type, athleteId?, userId?, displayName?, day?, partId?, partTitle?, text, weekStart?,
 *        athleteFeedback?, coachReply?, parts?: [{title, lines:[]}] }
 * Sends via Brevo (BREVO_API_KEY) or Resend fallback. Never opens mailto — silent admin log only.
 * See RESEND_SECRETS.md (mail ops; Brevo preferred).
 */
const { sendAppMail, hasMailProvider } = require("../lib/send-app-mail");
const { checkRateLimit, sendRateLimit } = require("./rate-limit.js");
const { scrubPiiText } = require("./sanitize-pii.js");
const { resolveAppMailTo } = require("../lib/app-mail.js");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function parseRequestJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (Buffer.isBuffer(req.body)) {
    const s = req.body.toString("utf8");
    try {
      return s ? JSON.parse(s) : {};
    } catch (e) {
      throw new Error("Invalid JSON body");
    }
  }
  if (typeof req.body === "string") {
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch (e) {
      throw new Error("Invalid JSON body");
    }
  }
  return {};
}

function feedbackTo() {
  return resolveAppMailTo({
    COACH_FEEDBACK_TO: process.env.COACH_FEEDBACK_TO,
    APP_MAIL_TO: process.env.APP_MAIL_TO,
    ANALYTICS_REPORT_TO: process.env.ANALYTICS_REPORT_TO,
  });
}

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeParts(body) {
  const raw = body.parts;
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 8)
    .map(function (p, i) {
      const title = String((p && (p.title || p.id)) || "Part " + String.fromCharCode(65 + i)).slice(0, 120);
      const lines = Array.isArray(p && p.lines)
        ? p.lines.map(function (l) {
            return String(l || "").slice(0, 400);
          }).filter(Boolean).slice(0, 12)
        : [];
      return { title: title, lines: lines };
    })
    .filter(function (p) {
      return p.title || p.lines.length;
    });
}

function classifyPartLinesForMail(rawLines) {
  const lines = Array.isArray(rawLines)
    ? rawLines.map(function (l) { return String(l || "").trim(); }).filter(Boolean)
    : [];
  const notes = [];
  let format = "";
  const work = [];
  let i = 0;
  function isNote(t) {
    if (/^(target\s+)?duration\s*:/i.test(t)) return true;
    if (/^movement(\s+intent)?\s*:/i.test(t)) return true;
    return /duration\s*:/i.test(t) && /movement/i.test(t);
  }
  function isFormat(t) {
    if (!t || t.length > 100) return false;
    if (/:\s*$/.test(t)) return true;
    return /^(AMRAP|EMOM|E2MOM|For\s*Time|Chipper|Tabata|Intervals?\b|Every\s+\d|\d+\s*sets?\b|sets?\s+for\s+quality)/i.test(
      t
    );
  }
  while (i < lines.length && isNote(lines[i])) {
    notes.push(lines[i]);
    i++;
  }
  if (i < lines.length && isFormat(lines[i])) {
    format = lines[i];
    i++;
  }
  while (i < lines.length) {
    work.push(lines[i]);
    i++;
  }
  if (!notes.length && !format && !work.length && lines.length) return { notes: [], format: "", work: lines.slice() };
  return { notes: notes, format: format, work: work };
}

function buildWorkoutTextCard(parts) {
  if (!parts.length) return "(no workout parts)";
  return parts
    .map(function (p) {
      const c = classifyPartLinesForMail(p.lines);
      const bits = [p.title];
      c.notes.forEach(function (n) {
        bits.push("  · " + n);
      });
      if (c.format) bits.push("  " + c.format);
      (c.work.length ? c.work : ["—"]).forEach(function (l) {
        bits.push("  • " + l);
      });
      return bits.join("\n");
    })
    .join("\n\n");
}

function buildWorkoutHtmlCard(parts) {
  if (!parts.length) {
    return '<p style="color:#999;font-size:14px">(no workout parts)</p>';
  }
  return parts
    .map(function (p) {
      const c = classifyPartLinesForMail(p.lines);
      const notesHtml = c.notes
        .map(function (n) {
          return (
            '<div style="margin:0 0 6px;color:#2a6f7c;font-size:13px;font-style:italic;line-height:1.4">' +
            escHtml(n) +
            "</div>"
          );
        })
        .join("");
      const formatHtml = c.format
        ? '<div style="margin:0 0 8px;font-weight:700;font-size:14px;color:#222">' + escHtml(c.format) + "</div>"
        : "";
      const work = c.work.length ? c.work : !c.notes.length && !c.format ? p.lines : [];
      const lis = work.length
        ? work
            .map(function (l) {
              return '<li style="margin:0 0 6px;line-height:1.4;color:#222">' + escHtml(l) + "</li>";
            })
            .join("")
        : '<li style="color:#999">—</li>';
      return (
        '<div style="margin:0 0 14px;padding:12px 14px;background:#f7f5f2;border:1px solid #e2ddd4;border-radius:10px">' +
        '<div style="font-weight:700;font-size:15px;color:#E8451A;margin:0 0 8px">' +
        escHtml(p.title) +
        "</div>" +
        notesHtml +
        formatHtml +
        '<ul style="margin:0;padding:0 0 0 18px">' +
        lis +
        "</ul></div>"
      );
    })
    .join("");
}

function buildMail(body) {
  const type = String(body.type || "debrief").slice(0, 64);
  const userId = String(body.userId || body.athleteId || "unknown").slice(0, 80);
  const displayName = String(body.displayName || "").trim().slice(0, 80);
  const day = String(body.day || "").slice(0, 16);
  const dayLabel = String(body.dayLabel || body.day || "").slice(0, 24);
  const partTitle = String(body.partTitle || body.partId || "").slice(0, 120);
  const weekStart = String(body.weekStart || "").slice(0, 32);
  const athleteFeedback = String(body.athleteFeedback || "").trim().slice(0, 2000);
  const coachReply = String(body.coachReply || "").trim().slice(0, 2000);
  const legacyText = String(body.text || "").trim().slice(0, 4000);
  const parts = normalizeParts(body);
  const who = displayName ? displayName + " (" + userId + ")" : userId;
  const gender = String(body.gender || "").trim().slice(0, 16);
  const preferredLanguage = String(body.preferredLanguage || "").trim().slice(0, 8);
  const skillsSummary = String(body.skillsSummary || "").trim().slice(0, 400);
  const blockStart = String(body.blockStart || "").slice(0, 32);
  const blockSummary = String(body.blockSummary || "").trim().slice(0, 240);
  const completedAt = String(body.completedAt || "").slice(0, 40);

  if (type === "intake_complete") {
    const nick = displayName || userId || "Athlete";
    const subject = nick + " has joined the DUCK'S !";
    const textBody = [
      "Type: intake_complete",
      "Status: Intake finished — training plan ready",
      "Athlete: " + who,
      "User ID: " + userId,
      displayName ? "Nickname: " + displayName : null,
      gender ? "Gender: " + gender : null,
      preferredLanguage ? "Language: " + preferredLanguage : null,
      skillsSummary ? "Skills: " + skillsSummary : null,
      blockStart ? "Block start: " + blockStart : null,
      blockSummary ? "Plan: " + blockSummary : null,
      completedAt ? "Completed at: " + completedAt : null,
      "",
      athleteFeedback || legacyText || "",
    ]
      .filter(function (x) {
        return x !== null;
      })
      .join("\n");
    const row = function (label, value) {
      if (!value) return "";
      return (
        '<p style="margin:0 0 8px;font-size:14px"><strong>' +
        escHtml(label) +
        ":</strong> " +
        escHtml(value) +
        "</p>"
      );
    };
    const htmlBody =
      '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">' +
      '<div style="padding:16px 18px;background:#111;border-radius:12px 12px 0 0">' +
      '<div style="color:#E8451A;font-weight:800;letter-spacing:.04em;font-size:18px">DUCK-WOD</div>' +
      '<div style="color:#ccc;font-size:13px;margin-top:4px">Personal Coach · New athlete ready</div></div>' +
      '<div style="padding:16px 18px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;background:#fff">' +
      '<p style="margin:0 0 14px;padding:10px 12px;background:#e8f7f4;border:1px solid #b7e0d6;border-radius:8px;font-size:14px">' +
      "<strong>Intake complete</strong> — training plan delivered.</p>" +
      row("Athlete", who) +
      row("Nickname", displayName) +
      row("User ID", userId) +
      row("Gender", gender) +
      row("Language", preferredLanguage) +
      row("Skills", skillsSummary) +
      row("Block start", blockStart) +
      row("Plan", blockSummary) +
      row("Completed at", completedAt) +
      "</div></div>";
    return { subject: subject, body: textBody, html: htmlBody };
  }

  const subject =
    "[DUCK-WOD Coach] " +
    type +
    (displayName ? " · " + displayName : "") +
    (dayLabel || day ? " · " + (dayLabel || day) : "") +
    (partTitle ? " · " + partTitle : "");

  const debriefBody = athleteFeedback || (parts.length ? "(empty)" : legacyText) || "(empty)";
  const textBody = [
    "Type: " + type,
    "Athlete: " + who,
    "User ID: " + userId,
    displayName ? "Display name: " + displayName : null,
    weekStart ? "Week start: " + weekStart : null,
    dayLabel || day ? "Day: " + (dayLabel || day) : null,
    "",
    "— Workout (as in app) —",
    buildWorkoutTextCard(parts),
    "",
    "— Athlete debrief —",
    debriefBody,
    "",
    "— Coach reply —",
    coachReply || "(none)",
  ]
    .filter(function (x) {
      return x !== null;
    })
    .join("\n");

  const htmlBody =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">' +
    '<div style="padding:16px 18px;background:#111;border-radius:12px 12px 0 0">' +
    '<div style="color:#E8451A;font-weight:800;letter-spacing:.04em;font-size:18px">DUCK-WOD</div>' +
    '<div style="color:#ccc;font-size:13px;margin-top:4px">Personal Coach · ' +
    escHtml(type) +
    "</div></div>" +
    '<div style="padding:16px 18px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;background:#fff">' +
    '<p style="margin:0 0 10px;font-size:14px"><strong>Athlete:</strong> ' +
    escHtml(who) +
    "</p>" +
    (weekStart
      ? '<p style="margin:0 0 6px;font-size:13px;color:#555"><strong>Week start:</strong> ' +
        escHtml(weekStart) +
        "</p>"
      : "") +
    (dayLabel || day
      ? '<p style="margin:0 0 14px;font-size:13px;color:#555"><strong>Day:</strong> ' +
        escHtml(dayLabel || day) +
        "</p>"
      : "") +
    '<h3 style="margin:0 0 10px;font-size:15px;color:#333">Workout</h3>' +
    buildWorkoutHtmlCard(parts) +
    '<h3 style="margin:18px 0 8px;font-size:15px;color:#333">Athlete debrief</h3>' +
    '<div style="padding:12px 14px;background:#fff8f0;border:1px solid #f0d9c0;border-radius:10px;white-space:pre-wrap;line-height:1.45;font-size:14px">' +
    escHtml(debriefBody) +
    "</div>" +
    '<h3 style="margin:18px 0 8px;font-size:15px;color:#333">Coach reply</h3>' +
    '<div style="padding:12px 14px;background:#f3eef8;border:1px solid #dccfea;border-radius:10px;white-space:pre-wrap;line-height:1.45;font-size:14px">' +
    escHtml(coachReply || "(none)") +
    "</div>" +
    "</div></div>";

  return { subject: subject, body: textBody, html: htmlBody };
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).json({});
  if (req.method === "GET" || req.method === "HEAD") {
    return res.status(200).json({
      ok: true,
      service: "coach-feedback",
      to: feedbackTo(),
      hasMail: hasMailProvider(),
      hasBrevo: !!String(process.env.BREVO_API_KEY || "").trim(),
      hasResend: !!(process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_conmail),
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = await parseRequestJson(req);
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const uid = String(body.userId || body.athleteId || "").slice(0, 80);
  const isIntakeCompleteMail = String(body.type || "") === "intake_complete";
  /* Intake-complete admin mail must not compete with debrief spam limits. */
  if (!isIntakeCompleteMail) {
    const rl = checkRateLimit(req, {
      name: "coach-feedback",
      limit: 5,
      windowMs: 60 * 60 * 1000,
      uid: uid,
    });
    if (!rl.ok) return sendRateLimit(res, rl);
  } else {
    const rlIntake = checkRateLimit(req, {
      name: "coach-feedback-intake",
      limit: 12,
      windowMs: 60 * 60 * 1000,
      uid: uid,
    });
    if (!rlIntake.ok) return sendRateLimit(res, rlIntake);
  }

  /* Soft size guard — block oversized spam payloads */
  try {
    const approx = JSON.stringify(body).length;
    if (approx > 50000) {
      return res.status(413).json({ error: "Payload too large" });
    }
  } catch (eSize) {}

  if (body.text) body.text = scrubPiiText(String(body.text).slice(0, 4000));
  if (body.athleteFeedback) body.athleteFeedback = scrubPiiText(String(body.athleteFeedback).slice(0, 2000));
  if (body.coachReply) body.coachReply = scrubPiiText(String(body.coachReply).slice(0, 2000));

  const hasContent =
    String(body.type || "") === "intake_complete" ||
    String(body.text || "").trim() ||
    String(body.athleteFeedback || "").trim() ||
    (Array.isArray(body.parts) && body.parts.length);
  if (!hasContent) return res.status(400).json({ error: "Missing text" });

  const mail = buildMail(body);
  const to = feedbackTo();

  let resend;
  try {
    resend = await sendAppMail({
      to: to,
      subject: mail.subject,
      text: mail.body,
      html: mail.html,
    });
  } catch (e) {
    resend = { sent: false, reason: "mail_throw", detail: String(e.message || e) };
  }

  if (!resend.sent) {
    console.warn(
      "[coach-feedback] email not sent:",
      resend.reason || "unknown",
      resend.detail ? String(resend.detail).slice(0, 200) : "",
      "| to=",
      to
    );
  } else {
    console.log("[coach-feedback] emailed ok →", to, resend.id || "");
  }

  return res.status(200).json({
    ok: true,
    emailed: !!resend.sent,
    resend: resend,
    to: to,
  });
};
