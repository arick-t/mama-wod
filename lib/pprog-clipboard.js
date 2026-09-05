/**
 * One clipboard for everything the owner copies inside a programme.
 *
 * A part, a day, a week, a whole block — all four are the same gesture at four sizes,
 * and the owner asked for all four to cross from one CLIENT to another as well as
 * within one (owner, 2026-09-05). So the clipboard holds CONTENT, not a pointer: once
 * something is copied it no longer matters whether the client it came from is still
 * open, still exists, or is the same kind of client at all.
 *
 * It also holds the one honest definition of "a copy of a part". A copied day used to
 * come back as bare work lines because two different places rebuilt a part out of its
 * title and its lines alone (hotfix 22.3.1). There is one definition here now, and the
 * server's store reads it from this file too — so a copy cannot lose a colour on one
 * path and keep it on another.
 *
 * Browser: <script src="lib/pprog-clipboard.js"></script> → PprogClipboard
 * Node: require("./pprog-clipboard")
 *
 * 0 LLM. No network. It moves objects around and describes them.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PprogClipboard = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const KINDS = ["part", "day", "week", "block"];
  /* Where the browser keeps it. Versioned, so a shape change never has to read an old
     one: an unreadable clipboard is simply an empty clipboard. */
  const STORE_KEY = "dw_pprog_clip_v1";

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function str(v, max) {
    const s = String(v == null ? "" : v);
    return max ? s.slice(0, max) : s;
  }

  /* ── what a copy of a part IS ─────────────────────────────────────────────
     Everything the part carries travels except its identity and the flags that say
     who last touched it: a fresh copy has not been changed by anyone yet. */

  function copyPart(p, id) {
    const src = isPlainObject(p) ? p : {};
    const out = {
      title: str(src.title, 200),
      lines: (Array.isArray(src.lines) ? src.lines : []).map(function (l) {
        return str(l, 600);
      }),
    };
    if (id !== undefined && id !== null) out.id = String(id);
    const noteLines = parseInt(src.noteLines, 10);
    if (Number.isFinite(noteLines) && noteLines > 0) out.noteLines = noteLines;
    if (src.numbered === true) out.numbered = true;
    if (isPlainObject(src.lineColors)) out.lineColors = Object.assign({}, src.lineColors);
    if (isPlainObject(src.lineNums)) out.lineNums = Object.assign({}, src.lineNums);
    return out;
  }

  /** A whole day: its parts and the name he gave it. Never its "who changed it" flags. */
  function copyDay(day, idPrefix) {
    const src = isPlainObject(day) ? day : {};
    const parts = Array.isArray(src.parts) ? src.parts : [];
    const out = {
      parts: parts.map(function (p, i) {
        return copyPart(p, idPrefix ? idPrefix + i : undefined);
      }),
    };
    const title = str(src.title, 80).trim();
    if (title) out.title = title;
    return out;
  }

  /** The focus line of one day inside a week — this is where "Rest" is written. */
  function focusOf(week, dayKey) {
    const list = isPlainObject(week) && Array.isArray(week.overview) ? week.overview : [];
    for (const o of list) {
      if (o && o.day === dayKey) return str(o.focus, 200);
    }
    return "";
  }

  function setFocus(week, dayKey, focus) {
    if (!isPlainObject(week)) return;
    if (!Array.isArray(week.overview)) week.overview = [];
    for (const o of week.overview) {
      if (o && o.day === dayKey) {
        o.focus = str(focus, 200);
        return;
      }
    }
    week.overview.push({ day: dayKey, focus: str(focus, 200) });
  }

  /* ── what goes on the clipboard ───────────────────────────────────────────── */

  /**
   * @param {string} kind part | day | week | block
   * @param {object} payload the content, already read off the programme
   * @param {{programId?:string, clientName?:string, label?:string}} from where it came from
   */
  function entryFor(kind, payload, from) {
    const k = String(kind || "");
    if (KINDS.indexOf(k) < 0) return null;
    if (!isPlainObject(payload)) return null;
    const f = isPlainObject(from) ? from : {};
    return {
      v: 1,
      kind: k,
      at: new Date().toISOString(),
      from: {
        programId: str(f.programId, 60),
        clientName: str(f.clientName, 80),
        label: str(f.label, 80),
      },
      payload: payload,
    };
  }

  /** A day, read off a programme and ready to travel. */
  function dayPayload(week, dayKey) {
    const days = isPlainObject(week) && isPlainObject(week.days) ? week.days : {};
    const day = copyDay(days[dayKey]);
    day.focus = focusOf(week, dayKey);
    return day;
  }

  /** A week, whole: its days, its focus lines, its theme. */
  function weekPayload(week) {
    const src = isPlainObject(week) ? week : {};
    const out = { days: {}, overview: [], theme: str(src.theme, 200), summaryLine: str(src.summaryLine, 400) };
    for (const d of DAY_KEYS) {
      out.days[d] = copyDay((isPlainObject(src.days) ? src.days : {})[d]);
    }
    out.overview = (Array.isArray(src.overview) ? src.overview : []).map(function (o) {
      return { day: str(o && o.day, 3), focus: str(o && o.focus, 200) };
    });
    return out;
  }

  /** A block: the weeks it covers, in order, each one whole. */
  function blockPayload(weeks) {
    return { weeks: (Array.isArray(weeks) ? weeks : []).map(weekPayload) };
  }

  /* ── putting it back ───────────────────────────────────────────────────────
     Every one of these takes the target's weeks and returns them changed. Nothing is
     ever overwritten that was not the target of the paste: a part is ADDED under the
     last one, which is what the owner asked for in so many words. */

  /**
   * Add one part under the last part of a day.
   * @returns {{ok:boolean, error?:string}}
   */
  function pastePart(weeks, wi, dayKey, part) {
    const week = (Array.isArray(weeks) ? weeks : [])[wi | 0];
    if (!isPlainObject(week)) return { ok: false, error: "השבוע הזה לא קיים אצל הלקוח הזה" };
    if (DAY_KEYS.indexOf(dayKey) < 0) return { ok: false, error: "לא יום בשבוע" };
    if (!isPlainObject(week.days)) week.days = {};
    const day = isPlainObject(week.days[dayKey]) ? week.days[dayKey] : { parts: [] };
    if (!Array.isArray(day.parts)) day.parts = [];
    day.parts.push(copyPart(part, dayKey + "-" + Date.now().toString(36) + "-" + day.parts.length));
    week.days[dayKey] = day;
    /* A day that had "Rest" written on its focus line is not a rest day any more once
       something has been planted in it. */
    if (/^rest\b/i.test(focusOf(week, dayKey))) setFocus(week, dayKey, "");
    return { ok: true };
  }

  /** Replace one day with the one on the clipboard, focus line included. */
  function pasteDay(weeks, wi, dayKey, payload) {
    const week = (Array.isArray(weeks) ? weeks : [])[wi | 0];
    if (!isPlainObject(week)) return { ok: false, error: "השבוע הזה לא קיים אצל הלקוח הזה" };
    if (DAY_KEYS.indexOf(dayKey) < 0) return { ok: false, error: "לא יום בשבוע" };
    if (!isPlainObject(week.days)) week.days = {};
    const src = isPlainObject(payload) ? payload : {};
    week.days[dayKey] = copyDay(src, "w" + (wi + 1) + dayKey);
    setFocus(week, dayKey, str(src.focus, 200));
    return { ok: true };
  }

  /** Replace one week with the one on the clipboard. */
  function pasteWeek(weeks, wi, payload) {
    const week = (Array.isArray(weeks) ? weeks : [])[wi | 0];
    if (!isPlainObject(week)) return { ok: false, error: "השבוע הזה לא קיים אצל הלקוח הזה" };
    const src = isPlainObject(payload) ? payload : {};
    week.days = {};
    for (const d of DAY_KEYS) {
      week.days[d] = copyDay((isPlainObject(src.days) ? src.days : {})[d], "w" + (wi + 1) + d);
    }
    week.overview = (Array.isArray(src.overview) ? src.overview : []).map(function (o) {
      return { day: str(o && o.day, 3), focus: str(o && o.focus, 200) };
    });
    week.theme = str(src.theme, 200);
    week.summaryLine = str(src.summaryLine, 400);
    return { ok: true };
  }

  /* ── saying what is on it ─────────────────────────────────────────────────── */

  const KIND_WORD = { part: "חלק", day: "יום", week: "שבוע", block: "לבנה" };

  /** "יום · מהתוכנית של סטודיו" — what the paste line says it will plant. */
  function describe(entry) {
    if (!isPlainObject(entry) || KINDS.indexOf(String(entry.kind)) < 0) return "";
    const word = KIND_WORD[entry.kind] || "";
    const from = isPlainObject(entry.from) ? entry.from : {};
    const where = from.label || "";
    const who = from.clientName || "";
    const tail = [where, who].filter(Boolean).join(" · ");
    return tail ? word + " · " + tail : word;
  }

  /** Is this entry usable, whatever else has happened since it was copied? */
  function isUsable(entry, kind) {
    if (!isPlainObject(entry)) return false;
    if (KINDS.indexOf(String(entry.kind)) < 0) return false;
    if (kind && entry.kind !== kind) return false;
    return isPlainObject(entry.payload);
  }

  /* ── where the browser keeps it ────────────────────────────────────────────
     localStorage, so it survives switching client and reloading the page — that is
     what makes "copy here, paste over there" possible at all. Every access is wrapped:
     a browser with storage switched off must lose the clipboard, never the page. */

  function makeStore(storage) {
    let memory = null;
    function box() {
      if (storage) return storage;
      try {
        return typeof localStorage !== "undefined" ? localStorage : null;
      } catch (e) {
        return null;
      }
    }
    return {
      write(entry) {
        memory = entry || null;
        const b = box();
        if (!b) return entry;
        try {
          if (entry) b.setItem(STORE_KEY, JSON.stringify(entry));
          else b.removeItem(STORE_KEY);
        } catch (e) {}
        return entry;
      },
      read() {
        const b = box();
        if (b) {
          try {
            const raw = b.getItem(STORE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (isUsable(parsed)) return parsed;
            }
          } catch (e) {}
        }
        return isUsable(memory) ? memory : null;
      },
      clear() {
        memory = null;
        const b = box();
        if (!b) return;
        try {
          b.removeItem(STORE_KEY);
        } catch (e) {}
      },
    };
  }

  return {
    DAY_KEYS,
    KINDS,
    STORE_KEY,
    copyPart,
    copyDay,
    focusOf,
    setFocus,
    entryFor,
    dayPayload,
    weekPayload,
    blockPayload,
    pastePart,
    pasteDay,
    pasteWeek,
    describe,
    isUsable,
    makeStore,
  };
});
