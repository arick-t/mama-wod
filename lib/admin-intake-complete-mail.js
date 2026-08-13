/**
 * Join email — only after Terms are signed and a training block exists.
 * Never send from create_athlete / before declarationAcceptedAt.
 */
const { sendAppMail } = require("./send-app-mail");
const { resolveAppMailTo } = require("./app-mail");

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function feedbackTo() {
  return resolveAppMailTo({
    COACH_FEEDBACK_TO: process.env.COACH_FEEDBACK_TO,
    APP_MAIL_TO: process.env.APP_MAIL_TO,
    ANALYTICS_REPORT_TO: process.env.ANALYTICS_REPORT_TO,
  });
}

function buildIntakeCompleteMail(snapshot) {
  const athleteId = String(snapshot.athleteId || "").slice(0, 80);
  const displayName = String(snapshot.displayName || "").slice(0, 80);
  const who = displayName ? displayName + " (" + athleteId + ")" : athleteId;
  const gender = String(snapshot.gender || "").slice(0, 16);
  const preferredLanguage = String(snapshot.preferredLanguage || "").slice(0, 8);
  const skillsSummary = String(snapshot.skillsSummary || "").slice(0, 400);
  const block = snapshot.currentBlock || {};
  const blockStart = String(block.blockStart || "").slice(0, 32);
  const blockSummary = String(block.summaryLine || "5-week training block").slice(0, 240);
  const completedAt = String(snapshot.intakeNotifySentAt || snapshot.joinedAt || new Date().toISOString()).slice(
    0,
    40
  );
  const nick = displayName || athleteId || "Athlete";
  const subject = nick + " has joined the DUCK'S !";
  const textBody = [
    "Type: intake_complete",
    "Status: Intake landed — Terms signed and training plan on device",
    "Athlete: " + who,
    "User ID: " + athleteId,
    displayName ? "Nickname: " + displayName : null,
    gender ? "Gender: " + gender : null,
    preferredLanguage ? "Language: " + preferredLanguage : null,
    skillsSummary ? "Skills: " + skillsSummary : null,
    blockStart ? "Block start: " + blockStart : null,
    blockSummary ? "Plan: " + blockSummary : null,
    completedAt ? "Completed at: " + completedAt : null,
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
    '<div style="color:#ccc;font-size:13px;margin-top:4px">Personal Coach · Athlete signed in</div></div>' +
    '<div style="padding:16px 18px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;background:#fff">' +
    '<p style="margin:0 0 14px;padding:10px 12px;background:#e8f7f4;border:1px solid #b7e0d6;border-radius:8px;font-size:14px">' +
    "<strong>Membership landed</strong> — Terms signed, training plan on device.</p>" +
    row("Athlete", who) +
    row("Nickname", displayName) +
    row("User ID", athleteId) +
    row("Gender", gender) +
    row("Language", preferredLanguage) +
    row("Skills", skillsSummary) +
    row("Block start", blockStart) +
    row("Plan", blockSummary) +
    row("Completed at", completedAt) +
    "</div></div>";
  return { subject: subject, body: textBody, html: htmlBody };
}

/**
 * Join mail is due only when the athlete has a real block AND a real Terms timestamp.
 * create_athlete / unsigned claim must not qualify.
 */
function snapshotReadyForJoinMail(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (snapshot.intakeNotifySent) return false;
  if (snapshot.deleted || snapshot.revoked) return false;
  const block = snapshot.currentBlock;
  if (!block || !Array.isArray(block.weeks) || !block.weeks.length) return false;
  const signed = String(snapshot.declarationAcceptedAt || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(signed)) return false;
  return true;
}

/**
 * @param {object} snapshot — athlete admin snapshot after Terms + block
 * @returns {Promise<{sent: boolean, skipped?: string, error?: string}>}
 */
async function sendAdminIntakeCompleteMail(snapshot) {
  if (snapshot && snapshot.intakeNotifySent) {
    return { sent: false, skipped: "already_sent" };
  }
  if (!snapshotReadyForJoinMail(snapshot)) {
    return { sent: false, skipped: "not_landed" };
  }
  const mail = buildIntakeCompleteMail(snapshot);
  const to = feedbackTo();
  if (!to) return { sent: false, skipped: "no_mail_to" };
  try {
    const result = await sendAppMail({
      to: to,
      subject: mail.subject,
      text: mail.body,
      html: mail.html,
    });
    return { sent: !!result.sent, mail: result };
  } catch (e) {
    return { sent: false, error: String((e && e.message) || e).slice(0, 200) };
  }
}

module.exports = {
  buildIntakeCompleteMail: buildIntakeCompleteMail,
  snapshotReadyForJoinMail: snapshotReadyForJoinMail,
  sendAdminIntakeCompleteMail: sendAdminIntakeCompleteMail,
};
