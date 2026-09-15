/**
 * What the brain noticed about the block it just wrote — and what it could not finish.
 *
 * The coach's brain returns two optional fields with a block (coach agent, 2026-09-08):
 *
 *   brickFlags?: string[]     up to six English sentences, one observation each
 *   truncated?: true          the answer was CUT, and
 *   truncatedMarker?: string  which marker never closed — always beside `truncated`
 *
 * The two are opposite kinds of thing, and the brain was explicit about it:
 *
 *  - A FLAG is a note to the owner, not a failure. The block is valid and it is saved.
 *    So: "לתשומת לב", never "שגיאה", never red, and NO fix button — dosage is the
 *    planning, and the owner decides whether to touch it. He approved the mechanism on
 *    exactly that condition.
 *  - TRUNCATED is a failure of delivery, not of judgement: the answer was cut off
 *    rather than refused. There a "try again" is the right button, because trying again
 *    IS the fix.
 *
 * Four real blocks produced between zero and two flags, so this is a note in the
 * corner of a card, not a panel.
 *
 * NOT lib/coach-brick-flags.js — that one is the SERVER's deterministic checker, which
 * PRODUCES these flags. This file only shows them. The two were written on the same day
 * under the same name by the two sides of the same feature; one produces, one displays,
 * and the names now say which is which (2026-09-08).
 *
 * Browser: <script src="lib/coach-brick-flags-view.js"></script> → CoachBrickFlagsView
 * Node: require("./coach-brick-flags-view")
 *
 * 0 LLM. No network. It formats what the brain already said.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CoachBrickFlagsView = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* The brain's own ceiling on how many it will send. Anything beyond it is a bug at
     one end or the other, and the box says only what it was promised. */
  const MAX_FLAGS = 6;
  const MAX_FLAG_CHARS = 300;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /** The flags, as they may be shown: strings, trimmed, at most six. */
  function cleanFlags(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    for (const f of list) {
      const s = String(f == null ? "" : f).replace(/\s+/g, " ").trim().slice(0, MAX_FLAG_CHARS);
      if (s) out.push(s);
      if (out.length >= MAX_FLAGS) break;
    }
    return out;
  }

  /** Was the answer cut off? Only the brain's own `true` counts. */
  function isTruncated(res) {
    return !!(res && res.truncated === true);
  }

  /**
   * The box.
   *
   * @param {{brickFlags?:string[], truncated?:boolean, truncatedMarker?:string}} res
   *        the response as it came back from the brain
   * @param {{retryFn?:string, title?:string, cutTitle?:string}} [opts]
   *        retryFn is the NAME of a page function, called with no arguments, offered
   *        only for a cut answer — a flag has no button by design
   * @returns {string} html, or "" when the brain had nothing to say
   */
  function flagsBoxHtml(res, opts) {
    const o = opts || {};
    const flags = cleanFlags(res && res.brickFlags);
    const cut = isTruncated(res);
    if (!flags.length && !cut) return "";

    let html = '<div class="brick-flags">';
    if (flags.length) {
      html +=
        '<div class="brick-flags-head">' +
        '<span class="brick-flags-mark" aria-hidden="true">i</span>' +
        "<span>" + esc(o.title || "לתשומת לב") + "</span>" +
        '<span class="brick-flags-count">' + flags.length + "</span>" +
        "</div>";
      html += '<ul class="brick-flags-list">';
      for (const f of flags) html += '<li dir="auto">' + esc(f) + "</li>";
      html += "</ul>";
      /* Said once, plainly: this is not a queue of things to fix. */
      html += '<div class="brick-flags-foot">הלבנה תקינה ונשמרה. אלו הערות, לא שגיאות — אתה מחליט אם לגעת.</div>';
    }
    if (cut) {
      const marker = String((res && res.truncatedMarker) || "").slice(0, 40);
      html +=
        '<div class="brick-cut">' +
        '<div class="brick-cut-head">התשובה נקטעה' +
        (marker ? ' <span class="brick-cut-marker">' + esc(marker) + "</span>" : "") +
        "</div>" +
        '<div class="brick-cut-body">זו קטיעה ולא סירוב — התוכנית לא הושלמה עד הסוף. ' +
        "לחיצה על ״נסה שוב״ מבקשת אותה מחדש.</div>" +
        (o.retryFn
          ? '<button type="button" class="brick-cut-retry" onclick="' + esc(o.retryFn) + '()">נסה שוב</button>'
          : "") +
        "</div>";
    }
    return html + "</div>";
  }

  /* Enough to act on, few enough to read — the same ceiling the server caps its list at. */
  const MAX_BLOCKING = 12;

  /** The violations, as they may be shown: strings, trimmed, at most twelve. */
  function cleanBlocking(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    for (const v of list) {
      const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, MAX_FLAG_CHARS);
      if (s) out.push(s);
      if (out.length >= MAX_BLOCKING) break;
    }
    return out;
  }

  /**
   * What happened to the one repair round, in the owner's words.
   *
   * Said out loud in every case, because "there are still five violations" means something
   * different when the coach never got the chance to fix them.
   */
  function repairStory(res) {
    const r = res || {};
    if (r.repairSkipped) return "התיקון האוטומטי לא רץ — " + String(r.repairSkipped) + ".";
    if (r.repairError) return "התיקון האוטומטי נכשל: " + String(r.repairError).slice(0, 160) + ".";
    if (r.repairRejected) return "התיקון האוטומטי " + String(r.repairRejected) + " — נשמרה הגרסה המקורית.";
    if (r.repairAttempted && r.repairFixed > 0) {
      return "המאמן תיקן " + r.repairFixed + " — אלה מה שנשאר.";
    }
    if (r.repairAttempted) return "המאמן קיבל את הרשימה וניסה שוב, ואלה נשארו.";
    return "";
  }

  /**
   * The box for what a machine is CERTAIN about.
   *
   * Not the same thing as a flag, and it must not look like one. A flag is a note and the
   * owner decides; this is a movement whose implement does not exist in that room, or a
   * load above a ceiling he typed himself. The brick was still SAVED — it lands
   * unapproved, and nothing reaches the client until he sends it — so this is a list of
   * what to fix before he does, not an error screen (owner, 2026-09-15).
   *
   * No button. The coach already had his one repair round; a second one is a paid call
   * and the owner starts it himself, by hand or by generating again.
   *
   * @param {{brickBlocking?:string[], repairAttempted?:boolean, repairFixed?:number,
   *          repairSkipped?:string, repairError?:string, repairRejected?:string}} res
   * @returns {string} html, or "" when nothing was found
   */
  function blockingBoxHtml(res, opts) {
    const o = opts || {};
    const items = cleanBlocking(res && res.brickBlocking);
    if (!items.length) return "";
    const story = repairStory(res);
    let html = '<div class="brick-blocking">';
    html +=
      '<div class="brick-blocking-head">' +
      '<span class="brick-blocking-mark" aria-hidden="true">!</span>' +
      "<span>" + esc(o.title || "נכתב משהו שלא קיים בחדר") + "</span>" +
      '<span class="brick-blocking-count">' + items.length + "</span>" +
      "</div>";
    html += '<ul class="brick-blocking-list">';
    for (const v of items) html += '<li dir="auto">' + esc(v) + "</li>";
    html += "</ul>";
    if (story) html += '<div class="brick-blocking-story">' + esc(story) + "</div>";
    html +=
      '<div class="brick-blocking-foot">אלו עובדות, לא הערות — ציוד שלא קיים או משקל מעל ' +
      "תקרה שהזנת. הלבנה נשמרה ולא אושרה, כלומר הלקוח לא רואה ממנה כלום. תקן ואז אשר.</div>";
    return html + "</div>";
  }

  return {
    MAX_FLAGS,
    MAX_FLAG_CHARS,
    MAX_BLOCKING,
    cleanFlags,
    cleanBlocking,
    isTruncated,
    repairStory,
    flagsBoxHtml,
    blockingBoxHtml,
    esc,
  };
});
