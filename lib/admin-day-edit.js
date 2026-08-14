/**
 * T4 — human admin day edit → device (0 LLM).
 * Snapshot is the bridge. Device pulls via athlete_pull_push_offer.
 *
 * Browser: <script src="lib/admin-day-edit.js"></script> → AdminDayEdit
 * Node: require("./admin-day-edit")
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./normalize-pprog-block.js"),
      require("./pprog-display.js")
    );
  } else {
    root.AdminDayEdit = factory(root.NormalizePprogBlock, root.PprogDisplay);
  }
})(typeof self !== "undefined" ? self : this, function (NormalizePprogBlock, PprogDisplay) {
  "use strict";

  var DAY_KEYS =
    (NormalizePprogBlock && NormalizePprogBlock.DAY_KEYS) || [
      "sun",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
    ];

  var COACH_UPDATED_HE = "המאמן עדכן את האימון";

  var SAVE_MSG = {
    rest: "לא נשמר — יום מנוחה",
    past: "לא נשמר — היום כבר עבר",
    done: "לא נשמר — היום דווח / LOGGED",
    logged: "לא נשמר — היום דווח / LOGGED",
    debrief: "לא נשמר — היום דווח / LOGGED",
    empty: "לא נשמר — אין חלק עם תוכן",
    orphan: "לא נשמר — חלק בלי תוכן",
  };

  var APPLY_MSG = {
    rest: "לא הוחל — יום מנוחה",
    past: "לא הוחל — היום כבר עבר",
    done: "לא הוחל — היום דווח / LOGGED",
    logged: "לא הוחל — היום דווח / LOGGED",
    debrief: "לא הוחל — היום דווח / LOGGED",
    athlete_updated: "לא הוחל — המתאמן עדכן אחרי",
    empty: "לא הוחל — אין חלק עם תוכן",
  };

  function classifyPartLines(lines) {
    if (PprogDisplay && typeof PprogDisplay.classifyPartLines === "function") {
      return PprogDisplay.classifyPartLines(lines);
    }
    return { notes: [], format: "", work: Array.isArray(lines) ? lines : [], trailingNotes: [] };
  }

  function israelTodayIso() {
    try {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jerusalem",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      var y, m, d;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "year") y = parts[i].value;
        if (parts[i].type === "month") m = parts[i].value;
        if (parts[i].type === "day") d = parts[i].value;
      }
      if (y && m && d) return y + "-" + m + "-" + d;
    } catch (e) {}
    return new Date().toISOString().slice(0, 10);
  }

  function addDaysIso(iso, n) {
    if (NormalizePprogBlock && NormalizePprogBlock.addDaysIso) {
      return NormalizePprogBlock.addDaysIso(iso, n);
    }
    var s = String(iso || "").slice(0, 10);
    var p = s.split("-");
    var dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
    dt.setDate(dt.getDate() + Number(n || 0));
    var yy = dt.getFullYear();
    var mm = String(dt.getMonth() + 1).padStart(2, "0");
    var dd = String(dt.getDate()).padStart(2, "0");
    return yy + "-" + mm + "-" + dd;
  }

  function dayIsoFromBlock(block, weekIndex0, dayKey) {
    var di = DAY_KEYS.indexOf(String(dayKey || "").slice(0, 3));
    if (di < 0) return "";
    var start = (block && block.blockStart) || "";
    if (!start) return "";
    return addDaysIso(start, (weekIndex0 | 0) * 7 + di);
  }

  function isRestDay(dayKey, dayData, week) {
    if (NormalizePprogBlock && typeof NormalizePprogBlock.isRestDay === "function") {
      return NormalizePprogBlock.isRestDay(dayKey, dayData, week);
    }
    return false;
  }

  function isLoggedExtra(dayData) {
    if (NormalizePprogBlock && typeof NormalizePprogBlock.isLoggedExtra === "function") {
      return NormalizePprogBlock.isLoggedExtra(dayData);
    }
    return !!(dayData && dayData.loggedExtraSession);
  }

  function hasFinishOrDebrief(dayData) {
    if (!dayData) return false;
    if (dayData.finishFeedback) return true;
    if (String(dayData.debrief || "").trim()) return true;
    return false;
  }

  function nonempty(s) {
    return !!String(s || "").trim();
  }

  function partHasRealContent(part) {
    if (!part || typeof part !== "object") return false;
    if (!nonempty(part.title)) return false;
    if (nonempty(part.format)) return true;
    if (Array.isArray(part.work) && part.work.some(nonempty)) return true;
    var lines = Array.isArray(part.lines) ? part.lines : [];
    var c = classifyPartLines(lines);
    if (nonempty(c.format)) return true;
    if ((c.work || []).some(nonempty)) return true;
    return false;
  }

  function partsAreSaveable(parts) {
    if (!Array.isArray(parts) || !parts.length) {
      return { ok: false, error: "empty", message: SAVE_MSG.empty };
    }
    for (var i = 0; i < parts.length; i++) {
      if (!partHasRealContent(parts[i])) {
        return { ok: false, error: "orphan", message: SAVE_MSG.orphan };
      }
    }
    return { ok: true };
  }

  function lockReason(dayKey, dayData, week, dayIso, todayIso, phase) {
    var apply = phase === "apply";
    var msg = apply ? APPLY_MSG : SAVE_MSG;
    if (isRestDay(dayKey, dayData, week)) {
      return { code: "rest", message: msg.rest };
    }
    if (isLoggedExtra(dayData)) {
      return { code: "logged", message: msg.logged };
    }
    if (hasFinishOrDebrief(dayData)) {
      return { code: "done", message: msg.done };
    }
    var iso = String(dayIso || "").slice(0, 10);
    var today = String(todayIso || "").slice(0, 10);
    if (iso && today && iso < today) {
      return { code: "past", message: msg.past };
    }
    return null;
  }

  function canEditDay(dayKey, dayData, week, dayIso, todayIso) {
    return !lockReason(dayKey, dayData, week, dayIso, todayIso, "save");
  }

  function collectLines(p) {
    var lines = [];
    if (Array.isArray(p && p.lines)) {
      return p.lines
        .map(function (l) {
          return String(l || "").trim().slice(0, 400);
        })
        .filter(Boolean)
        .slice(0, 24);
    }
    (Array.isArray(p && p.notes) ? p.notes : []).forEach(function (n) {
      var t = String(n || "").trim().slice(0, 400);
      if (t) lines.push(t);
    });
    var fmt = String((p && p.format) || "").trim().slice(0, 200);
    if (fmt) lines.push(fmt);
    (Array.isArray(p && p.work) ? p.work : []).forEach(function (w) {
      var t = String(w || "").trim().slice(0, 400);
      if (t) lines.push(t);
    });
    return lines.slice(0, 24);
  }

  function sanitizeParts(rawParts, prevParts, dayKey) {
    var src = Array.isArray(rawParts) ? rawParts.slice(0, 12) : [];
    var prev = Array.isArray(prevParts) ? prevParts : [];
    var out = [];
    for (var i = 0; i < src.length; i++) {
      var p = src[i] || {};
      var title = String(p.title || "").trim().slice(0, 160);
      var lines = collectLines(p);
      var id = String(p.id || (prev[i] && prev[i].id) || (dayKey || "day") + "-" + i).slice(0, 80);
      out.push({ id: id, title: title, lines: lines });
    }
    return out;
  }

  function normalizePartKind(rawTitle, rawLines) {
    var title = String(rawTitle || "").toLowerCase();
    var lines = Array.isArray(rawLines)
      ? rawLines.join(" ").toLowerCase()
      : String(rawLines || "").toLowerCase();
    var t = title + " " + lines;
    if (/(warm[\s-]?up|mobility|activation)/.test(t)) return "warmup";
    if (/(strength|squat|deadlift|press|bench|strict|front squat|back squat)/.test(t)) return "strength";
    if (/(metcon|amrap|emom|for time|chipper|interval|e2mom|tabata)/.test(t)) return "metcon";
    if (/(skill|gymnastics|technique|oly|snatch|clean|jerk)/.test(t)) return "skill";
    if (/(accessory|bodybuilding|hypertrophy|core|carry|prehab)/.test(t)) return "accessory";
    if (/(engine|run|row|bike|ski|aero)/.test(t)) return "engine";
    if (/(rest day|rest\b|off day|recovery)/.test(t)) return "rest";
    return "other";
  }

  function partSignature(part) {
    if (!part) return "";
    var title = String(part.title || "").trim().toLowerCase();
    var lines = Array.isArray(part.lines)
      ? part.lines
          .map(function (x) {
            return String(x || "").trim().toLowerCase();
          })
          .join(" | ")
      : "";
    return title + "::" + lines;
  }

  function detectModifiedPartKinds(prevParts, nextParts) {
    var prevKinds = {};
    var nextKinds = {};
    var arr;
    var i;
    var k;
    arr = Array.isArray(prevParts) ? prevParts : [];
    for (i = 0; i < arr.length; i++) {
      k = normalizePartKind(arr[i] && arr[i].title, arr[i] && arr[i].lines);
      if (!prevKinds[k]) prevKinds[k] = [];
      prevKinds[k].push(partSignature(arr[i]));
    }
    arr = Array.isArray(nextParts) ? nextParts : [];
    for (i = 0; i < arr.length; i++) {
      k = normalizePartKind(arr[i] && arr[i].title, arr[i] && arr[i].lines);
      if (!nextKinds[k]) nextKinds[k] = [];
      nextKinds[k].push(partSignature(arr[i]));
    }
    var out = {};
    var keys = {};
    for (k in prevKinds) if (Object.prototype.hasOwnProperty.call(prevKinds, k)) keys[k] = true;
    for (k in nextKinds) if (Object.prototype.hasOwnProperty.call(nextKinds, k)) keys[k] = true;
    for (k in keys) {
      if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
      var a = (prevKinds[k] || []).join("||");
      var b = (nextKinds[k] || []).join("||");
      if (a !== b) out[k] = true;
    }
    return out;
  }

  function mergeModifiedKinds(prev, next) {
    var out = {};
    var k;
    if (prev && typeof prev === "object") {
      for (k in prev) if (Object.prototype.hasOwnProperty.call(prev, k) && prev[k]) out[k] = true;
    }
    if (next && typeof next === "object") {
      for (k in next) if (Object.prototype.hasOwnProperty.call(next, k) && next[k]) out[k] = true;
    }
    return out;
  }

  function makeEditId() {
    return (
      "ade_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function buildPending(fields) {
    var f = fields || {};
    return {
      id: String(f.id || makeEditId()).slice(0, 40),
      athleteId: String(f.athleteId || "").slice(0, 80),
      weekIndex: f.weekIndex | 0,
      dayKey: String(f.dayKey || "").slice(0, 3),
      dayIso: String(f.dayIso || "").slice(0, 10),
      parts: Array.isArray(f.parts) ? f.parts : [],
      modifiedPartKinds: f.modifiedPartKinds && typeof f.modifiedPartKinds === "object" ? f.modifiedPartKinds : {},
      at: String(f.at || new Date().toISOString()).slice(0, 40),
      status: "pending",
    };
  }

  function publicPending(pending) {
    if (!pending || pending.status !== "pending") return null;
    return {
      id: pending.id,
      athleteId: pending.athleteId,
      weekIndex: pending.weekIndex | 0,
      dayKey: pending.dayKey,
      dayIso: pending.dayIso,
      parts: pending.parts,
      modifiedPartKinds: pending.modifiedPartKinds || {},
      at: pending.at,
      status: "pending",
    };
  }

  function applyPendingToDay(dayData, pending, ctx) {
    ctx = ctx || {};
    var dayKey = (pending && pending.dayKey) || ctx.dayKey;
    var lock = lockReason(
      dayKey,
      dayData,
      ctx.week,
      (pending && pending.dayIso) || ctx.dayIso,
      ctx.todayIso || israelTodayIso(),
      "apply"
    );
    if (lock) return { ok: false, reason: lock.code, message: lock.message };
    var athleteAt = Date.parse((dayData && dayData.athleteDayUpdatedAt) || "") || 0;
    var pendingAt = Date.parse((pending && pending.at) || "") || 0;
    if (athleteAt && pendingAt && athleteAt > pendingAt) {
      return { ok: false, reason: "athlete_updated", message: APPLY_MSG.athlete_updated };
    }
    var quality = partsAreSaveable((pending && pending.parts) || []);
    if (!quality.ok) {
      return { ok: false, reason: quality.error, message: APPLY_MSG.empty };
    }
    var next = Object.assign({}, dayData || {});
    next.parts = (pending.parts || []).map(function (p, idx) {
      return {
        id: String((p && p.id) || dayKey + "-" + idx),
        title: String((p && p.title) || "").trim(),
        lines: Array.isArray(p && p.lines) ? p.lines.map(String) : [],
      };
    });
    // Human coach rewrite is the programmed day — never a MODIFIED badge.
    next.modifiedPartKinds = {};
    next.coachUpdatedNotice = COACH_UPDATED_HE;
    next.coachUpdatedAt = String((pending && pending.at) || new Date().toISOString()).slice(0, 40);
    return { ok: true, day: next };
  }

  function protectPendingDayParts(existingBlock, incomingBlock, pending) {
    if (!pending || (pending.status !== "pending" && pending.status !== "failed")) {
      return incomingBlock;
    }
    if (!existingBlock || !incomingBlock) return incomingBlock;
    var wi = pending.weekIndex | 0;
    var dayKey = String(pending.dayKey || "").slice(0, 3);
    var exWeeks = existingBlock.weeks;
    var inWeeks = incomingBlock.weeks;
    if (!Array.isArray(exWeeks) || !Array.isArray(inWeeks) || !exWeeks[wi] || !inWeeks[wi]) {
      return incomingBlock;
    }
    var exDay = (exWeeks[wi].days || {})[dayKey];
    if (!exDay || !Array.isArray(exDay.parts)) return incomingBlock;
    var next = Object.assign({}, incomingBlock);
    next.weeks = inWeeks.slice();
    var week = Object.assign({}, inWeeks[wi]);
    week.days = Object.assign({}, week.days || {});
    var clientDay = week.days[dayKey] || {};
    week.days[dayKey] = Object.assign({}, clientDay, {
      parts: exDay.parts,
      modifiedPartKinds: {},
    });
    next.weeks[wi] = week;
    return next;
  }

  function statusMessage(pending) {
    if (!pending) return "";
    if (pending.message) return String(pending.message);
    if (pending.status === "pending") return "סונכרן";
    if (pending.status === "applied") return "סונכרן";
    var code = String(pending.reason || "");
    if (APPLY_MSG[code]) return APPLY_MSG[code];
    if (SAVE_MSG[code]) return SAVE_MSG[code];
    return String(pending.reason || "לא הוחל");
  }

  return {
    COACH_UPDATED_HE: COACH_UPDATED_HE,
    SAVE_MSG: SAVE_MSG,
    APPLY_MSG: APPLY_MSG,
    israelTodayIso: israelTodayIso,
    dayIsoFromBlock: dayIsoFromBlock,
    lockReason: lockReason,
    canEditDay: canEditDay,
    partHasRealContent: partHasRealContent,
    partsAreSaveable: partsAreSaveable,
    sanitizeParts: sanitizeParts,
    detectModifiedPartKinds: detectModifiedPartKinds,
    mergeModifiedKinds: mergeModifiedKinds,
    buildPending: buildPending,
    publicPending: publicPending,
    applyPendingToDay: applyPendingToDay,
    protectPendingDayParts: protectPendingDayParts,
    statusMessage: statusMessage,
    makeEditId: makeEditId,
  };
});
