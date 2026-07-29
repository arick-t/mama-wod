/**
 * Light PII scrub before sending user text to Gemini.
 * Keeps nicknames / fitness content; redacts emails, phones, card-like digits.
 */
function scrubPiiText(input) {
  let s = String(input == null ? "" : input);
  if (!s) return s;
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
  s = s.replace(
    /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3}[\s-]?\d{4}\d?/g,
    function (m) {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 9) return m;
      return "[phone]";
    }
  );
  s = s.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[card]");
  return s;
}

function scrubMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map(function (m) {
    if (!m || typeof m !== "object") return m;
    const out = Object.assign({}, m);
    if (out.text != null) out.text = scrubPiiText(out.text);
    return out;
  });
}

function scrubProfile(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const out = Object.assign({}, profile);
  if (out.profileNotes != null) out.profileNotes = scrubPiiText(out.profileNotes);
  if (out.chatSummaryTail != null) out.chatSummaryTail = scrubPiiText(out.chatSummaryTail);
  if (Array.isArray(out.coachPrefs)) {
    out.coachPrefs = out.coachPrefs.map(function (p) {
      return scrubPiiText(p);
    });
  }
  /* Keep displayName (nickname) — only scrub if it looks like email/phone */
  if (out.displayName != null) {
    const d = String(out.displayName);
    if (/@/.test(d) || /\d{7,}/.test(d)) out.displayName = scrubPiiText(d).slice(0, 80);
  }
  return out;
}

module.exports = {
  scrubPiiText,
  scrubMessages,
  scrubProfile,
};
