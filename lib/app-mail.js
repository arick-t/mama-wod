/**
 * Canonical destination for all DUCK-WOD operational mail.
 * Override order in callers: feature-specific env → APP_MAIL_TO / ANALYTICS_REPORT_TO → this default.
 */
const APP_MAIL_TO = "contact.duckwod@gmail.com";

function resolveAppMailTo(overrides) {
  const o = overrides && typeof overrides === "object" ? overrides : {};
  for (const key of Object.keys(o)) {
    const v = String(o[key] == null ? "" : o[key]).trim();
    if (v) return v;
  }
  return (
    String(process.env.APP_MAIL_TO || process.env.ANALYTICS_REPORT_TO || "").trim() ||
    APP_MAIL_TO
  );
}

module.exports = { APP_MAIL_TO, resolveAppMailTo };
