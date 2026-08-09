/**
 * POL-026 Budget gates — pure helpers for whole-brick extra-session harden.
 */
const POL026_EXPLICIT_CONFIRM_RE =
  /^(yes|yep|yeah|ok|okay|sure|confirm|do it|go ahead|כן|בטח|אשר|תבצע|יאללה)[.!\s]*$/i;

const POL026_DEFAULT_CONFIRM =
  "Schedule: keep today’s session logged, rest tomorrow, ease squat/hinge/engine later this week. Confirm?";

function isExplicitPol026Confirm(text) {
  return POL026_EXPLICIT_CONFIRM_RE.test(String(text || "").trim());
}

function textLooksLikePol026ExtraSession(text) {
  const t = String(text || "");
  if (
    !/\b(instead\s*of\s*(a\s*)?rest|skipped\s*rest|unplanned|spontaneous|i\s*(already\s*)?(did|trained|performed))\b|במקום\s*יום\s*מנוחה|דילג(תי)?\s*על\s*(יום\s*)?מנוחה|ביצעתי\s*אימון|האימון\s*שביצעתי/i.test(
      t
    )
  ) {
    return false;
  }
  return (
    /\b(squat|deadlift|amrap|emom|pull-?up|run|row|bike|press|clean|snatch|\d+\s*x\s*\d+|\d+\s*kg)\b|סקוואט|דדליפט|משיכות|ריצה|ק"?ג|קילו/i.test(
      t
    ) || /במקום\s*יום\s*מנוחה|דילג(תי)?\s*על\s*(יום\s*)?מנוחה/i.test(t)
  );
}

function messagesLookLikePol026ExtraSession(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0 && i >= list.length - 8; i--) {
    const m = list[i];
    if (!m || m.role !== "user") continue;
    const t = String(m.text || "").trim();
    if (!t || isExplicitPol026Confirm(t)) continue;
    if (textLooksLikePol026ExtraSession(t)) return true;
  }
  return false;
}

function stripAllProgrammingJsonMarkers(text) {
  return String(text || "")
    .replace(/<<<\s*BLOCK_JSON[\s\S]*?(?:BLOCK_JSON>>>|$)/gi, "")
    .replace(/<<<\s*WEEK_JSON[\s\S]*?(?:WEEK_JSON>>>|$)/gi, "")
    .replace(/<<<\s*DAY_JSON[\s\S]*?(?:DAY_JSON>>>|$)/gi, "")
    .replace(/<<<\s*PART_JSON[\s\S]*?(?:PART_JSON>>>|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripBlockJsonMarkers(text) {
  return String(text || "")
    .replace(/<<<\s*BLOCK_JSON[\s\S]*?(?:BLOCK_JSON>>>|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Budget-approved POL-026 gates on brick-chat model text:
 * - pre-confirm: no plan JSON; short Confirm? only; strip false injury disclaimer
 * - post-confirm: WEEK/DAY only — never full BLOCK_JSON
 */
function enforcePol026BrickChatResponse(text, opts) {
  const confirmed = !!(opts && opts.confirmed);
  let t = String(text || "");
  t = t
    .replace(
      /I am an AI engine and cannot evaluate physical risks or injuries\.[\s\S]{0,320}/gi,
      ""
    )
    .trim();
  if (!confirmed) {
    t = stripAllProgrammingJsonMarkers(t);
    if (!t || t.length > 320 || !/confirm\?/i.test(t)) {
      return POL026_DEFAULT_CONFIRM;
    }
    if (t.length > 320) {
      const mFirst = t.match(/^([\s\S]+?[.!?])(?:\s|$)/);
      t = String(mFirst ? mFirst[1] : t)
        .slice(0, 280)
        .replace(/[.!?]?$/, "");
      if (!/confirm\?/i.test(t)) t += ". Confirm?";
    }
    return t;
  }
  return stripBlockJsonMarkers(t) || "Done.";
}

module.exports = {
  POL026_DEFAULT_CONFIRM,
  isExplicitPol026Confirm,
  textLooksLikePol026ExtraSession,
  messagesLookLikePol026ExtraSession,
  stripAllProgrammingJsonMarkers,
  stripBlockJsonMarkers,
  enforcePol026BrickChatResponse,
};
