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
 * Is outbound mail switched off right now, and why?
 *
 * A PREVIEW deployment sends nothing. The owner rehearses joining, editing and renewal
 * on the preview URL, and every rehearsal was burning the Brevo quota on mail he had
 * already verified works (owner, 2026-09-02).
 *
 * Production is deliberately NOT affected: the join mail is how he learns that a client
 * signed, and a code-level default of "off" is exactly the kind of switch that ships to
 * production and is discovered a week later. APP_MAIL_ENABLED forces the answer either
 * way from the environment if it is ever needed.
 *
 * @returns {string} "" when mail may be sent, otherwise the reason it may not
 */
function mailSuppressedReason() {
  const forced = String(process.env.APP_MAIL_ENABLED || "").trim();
  if (forced === "1" || /^(true|yes|on)$/i.test(forced)) return "";
  if (forced === "0" || /^(false|no|off)$/i.test(forced)) return "mail_disabled_by_env";
  if (String(process.env.VERCEL_ENV || "").trim().toLowerCase() === "preview") {
    return "preview_deploy_no_mail";
  }
  return "";
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

  /* Checked before the provider, so a suppressed send is reported as suppressed rather
     than as a missing key — the two mean very different things. */
  const suppressed = mailSuppressedReason();
  if (suppressed) {
    return { sent: false, suppressed: true, reason: suppressed, to: to, subject: subject };
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
  mailSuppressedReason,
  hasMailProvider,
  resolveSender,
  parseFromAddress,
};
