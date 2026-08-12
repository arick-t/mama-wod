/**
 * Admin-created athlete → same intake_complete join email as phone path.
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
    "Status: Intake finished — training plan ready (admin create)",
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
    '<div style="color:#ccc;font-size:13px;margin-top:4px">Personal Coach · New athlete ready (admin)</div></div>' +
    '<div style="padding:16px 18px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;background:#fff">' +
    '<p style="margin:0 0 14px;padding:10px 12px;background:#e8f7f4;border:1px solid #b7e0d6;border-radius:8px;font-size:14px">' +
    "<strong>Intake complete</strong> — training plan delivered.</p>" +
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
 * @param {object} snapshot — athlete admin snapshot after create
 * @returns {Promise<{sent: boolean, skipped?: string, error?: string}>}
 */
async function sendAdminIntakeCompleteMail(snapshot) {
  if (!snapshot || snapshot.intakeNotifySent) {
    return { sent: false, skipped: "already_sent" };
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
  sendAdminIntakeCompleteMail: sendAdminIntakeCompleteMail,
};
