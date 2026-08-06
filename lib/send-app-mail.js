/**
 * Operational mail for DUCK-WOD.
 * Prefers Brevo (no custom domain required once sender is verified).
 * Falls back to Resend if BREVO_API_KEY is missing.
 */
const { APP_MAIL_TO } = require("./app-mail");

function parseFromAddress(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) {
    return {
      name: m[1].replace(/^["']|["']$/g, "").trim() || "DUCK-WOD",
      email: m[2].trim(),
    };
  }
  if (s.includes("@")) return { name: "DUCK-WOD", email: s };
  return null;
}

function resolveSender() {
  const email = String(
    process.env.BREVO_SENDER_EMAIL || process.env.APP_MAIL_FROM_EMAIL || ""
  ).trim();
  const name = String(process.env.BREVO_SENDER_NAME || "DUCK-WOD").trim() || "DUCK-WOD";
  if (email) return { name, email };

  const fromParsed =
    parseFromAddress(process.env.RESEND_FROM) ||
    parseFromAddress(process.env.BREVO_FROM);
  if (fromParsed) return fromParsed;

  return { name: "DUCK-WOD", email: APP_MAIL_TO };
}

async function sendViaBrevo({ to, subject, text, html }) {
  const key = String(process.env.BREVO_API_KEY || "").trim();
  if (!key) return null;

  const sender = resolveSender();
  const payload = {
    sender,
    to: [{ email: to }],
    subject,
    textContent: text || "",
  };
  if (html) payload.htmlContent = html;

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": key,
    },
    body: JSON.stringify(payload),
  });
  const raw = await r.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (e) {
    data = { raw: raw.slice(0, 400) };
  }
  if (!r.ok) {
    return {
      sent: false,
      provider: "brevo",
      reason: "brevo_error",
      detail: (data && (data.message || data.error)) || raw.slice(0, 400),
    };
  }
  return {
    sent: true,
    provider: "brevo",
    id: data && (data.messageId || data.id),
  };
}

async function sendViaResend({ to, subject, text, html }) {
  const key = String(process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_conmail || "").trim();
  if (!key) return null;

  const from =
    String(process.env.RESEND_FROM || "").trim() ||
    `DUCK-WOD <${resolveSender().email}>`;
  const payload = {
    from,
    to: [to],
    subject,
    text: text || "",
  };
  if (html) payload.html = html;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await r.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (e) {
    data = { raw: raw.slice(0, 400) };
  }
  if (!r.ok) {
    return {
      sent: false,
      provider: "resend",
      reason: "resend_error",
      detail: (data && data.message) || raw.slice(0, 400),
    };
  }
  return { sent: true, provider: "resend", id: data && data.id };
}

function hasMailProvider() {
  return !!(
    String(process.env.BREVO_API_KEY || "").trim() ||
    String(process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_conmail || "").trim()
  );
}

/**
 * @param {{ to: string, subject: string, text?: string, html?: string }} opts
 */
async function sendAppMail(opts) {
  const to = String((opts && opts.to) || "").trim();
  const subject = String((opts && opts.subject) || "").trim();
  if (!to || !subject) {
    return { sent: false, reason: "missing_to_or_subject" };
  }
  const text = opts.text != null ? String(opts.text) : "";
  const html = opts.html ? String(opts.html) : "";

  const brevo = await sendViaBrevo({ to, subject, text, html });
  if (brevo) return brevo;

  const resend = await sendViaResend({ to, subject, text, html });
  if (resend) return resend;

  return { sent: false, reason: "no_mail_provider_key" };
}

module.exports = {
  sendAppMail,
  hasMailProvider,
  resolveSender,
  parseFromAddress,
};
