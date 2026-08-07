/**
 * Operational mail for DUCK-WOD via Brevo only.
 * Requires BREVO_API_KEY; sender must be verified in Brevo (contact.duckwod@gmail.com).
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

  const fromParsed = parseFromAddress(process.env.BREVO_FROM);
  if (fromParsed) return fromParsed;

  return { name: "DUCK-WOD", email: APP_MAIL_TO };
}

function hasMailProvider() {
  return !!String(process.env.BREVO_API_KEY || "").trim();
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

  const key = String(process.env.BREVO_API_KEY || "").trim();
  if (!key) {
    return { sent: false, provider: "brevo", reason: "no_brevo_api_key" };
  }

  const text = opts.text != null ? String(opts.text) : "";
  const html = opts.html ? String(opts.html) : "";
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

module.exports = {
  sendAppMail,
  hasMailProvider,
  resolveSender,
  parseFromAddress,
};
