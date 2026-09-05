/**
 * Deterministic post-checks on a returned brick. No model call, no cost, no retry.
 *
 * DOSAGE IS THE DESIGN (owner, 2026-09-05): "שלא יהיה דבר מציק ומתיש של אזהרות ושל שיח הלוך חזור".
 * These flags never reject a brick and never trigger a regeneration. They are a short list the
 * back office can show the owner, capped at MAX_FLAGS, and they only cover violations a machine
 * can be certain about. Anything needing judgement is deliberately absent: a warning that is
 * sometimes wrong teaches people to ignore the ones that are right.
 */
const MAX_FLAGS = 6;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/* A part is a warm-up when it LEADS with a warm-up word, or when it is short AND named as
 * preparation. Matching the word anywhere was wrong: "Snatch Complex & Technical Primer" is a
 * working snatch complex, and excluding it hid a genuine three-part session. */
function isWarmUpPart(part) {
  const t = String((part && part.title) || "").replace(/^part\s+[a-z]\s*[-–]\s*/i, "");
  if (/^(dynamic\s+)?(warm.?up|movement prep|mobility|activation)/i.test(t)) return true;
  const mins = parseInt(
    (((part && part.lines) || []).join(" ").match(/Duration:?\s*(\d+)/i) || [])[1],
    10
  );
  return mins > 0 && mins <= 12 && /(prep|activation|mobility|warm.?up)/i.test(t);
}

function isRestPart(part) {
  const t = String((part && part.title) || "");
  return /rest day/i.test(t);
}

function partsText(part) {
  return (
    String((part && part.title) || "") + " " + (((part && part.lines) || []).join(" "))
  );
}

/**
 * @param {object} block   the BLOCK_JSON as returned
 * @param {object} profile the athlete profile, for the reported-lifts check
 * @returns {string[]} at most MAX_FLAGS short English lines
 */
function brickFlags(block, profile) {
  const flags = [];
  if (!block || !Array.isArray(block.weeks)) return flags;

  if (block.weeks.length > 4) {
    flags.push("Brick has " + block.weeks.length + " weeks; a brick is four.");
  }

  const lifts = profile && typeof profile.lifts === "object" ? profile.lifts : {};
  let reported = 0;
  Object.keys(lifts || {}).forEach(function (k) {
    if (parseFloat(lifts[k]) > 0) reported++;
  });

  const thickDays = [];
  let sawPercent = false;
  let sawImperial = false;

  block.weeks.forEach(function (w, wi) {
    const idx = w.weekIndex || w.weekNumber || wi + 1;
    const days = (w && w.days) || {};
    DAY_KEYS.forEach(function (d) {
      const parts = (days[d] || {}).parts || [];
      const working = parts.filter(function (p) {
        return !isWarmUpPart(p) && !isRestPart(p);
      });
      if (working.length >= 3) thickDays.push("W" + idx + " " + d);
      parts.forEach(function (p) {
        const t = partsText(p);
        if (reported === 0 && /%\s*1RM|@\s*\d+\s*%/i.test(t)) sawPercent = true;
        if (/\b\d+\s*(inch|inches|ft|foot|feet|lb|lbs)\b/i.test(t)) sawImperial = true;
      });
    });
  });

  if (thickDays.length) {
    flags.push(
      "Three or more working parts on " +
        thickDays.length +
        " session(s): " +
        thickDays.slice(0, 5).join(", ") +
        "."
    );
  }
  if (sawPercent) {
    flags.push("Percentage loads written for an athlete who reported no 1RM.");
  }
  if (sawImperial) {
    flags.push("Imperial units in the workout text.");
  }

  return flags.slice(0, MAX_FLAGS);
}

module.exports = { brickFlags: brickFlags, MAX_FLAGS: MAX_FLAGS };
