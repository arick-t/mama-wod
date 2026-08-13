/**
 * Personal Coach block normalization (shared admin + app).
 * Ensures blockStart + 5 normalized weeks even when generate_block omits blockStart.
 *
 * Browser: <script src="lib/normalize-pprog-block.js"></script> → NormalizePprogBlock
 * Node: require("./normalize-pprog-block")
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NormalizePprogBlock = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PPROG_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var PPROG_DAY_LABELS = {
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
  };

function sundayOfThisWeekIsrael() {
  var now = new Date();
  try {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    var y, m, d;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === "year") y = parts[i].value;
      if (parts[i].type === "month") m = parts[i].value;
      if (parts[i].type === "day") d = parts[i].value;
    }
    var iso = y + "-" + m + "-" + d;
    var dt = new Date(iso + "T12:00:00");
    var dow = dt.getDay();
    dt.setDate(dt.getDate() - dow);
    var yy = dt.getFullYear();
    var mm = String(dt.getMonth() + 1).padStart(2, "0");
    var dd = String(dt.getDate()).padStart(2, "0");
    return yy + "-" + mm + "-" + dd;
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function pprogParseIso(iso) {
  var s = String(iso || "").slice(0, 10);
  var p = s.split("-");
  if (p.length !== 3) return new Date();
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
}

function pprogFormatIso(dt) {
  var yy = dt.getFullYear();
  var mm = String(dt.getMonth() + 1).padStart(2, "0");
  var dd = String(dt.getDate()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd;
}

function pprogAddDaysIso(iso, n) {
  var dt = pprogParseIso(iso);
  dt.setDate(dt.getDate() + n);
  return pprogFormatIso(dt);
}

function pprogOverviewFocus(week, dayKey) {
  if (!week || !Array.isArray(week.overview)) return "";
  var key = normalizePprogDayKey(dayKey) || dayKey;
  for (var i = 0; i < week.overview.length; i++) {
    var row = week.overview[i];
    if (!row) continue;
    var rd = normalizePprogDayKey(row.day) || String(row.day || "").toLowerCase();
    if (rd === key || row.day === dayKey) {
      return String(row.focus || "");
    }
  }
  return "";
}

function isPprogRestFocus(focus) {
  var focusL = String(focus || "").toLowerCase().trim();
  if (!focusL) return false;
  if (/מנוחה/.test(String(focus || ""))) return true;
  if (/\brest(\s*day)?\b/.test(focusL) || focusL === "off" || /\boff\s*day\b/.test(focusL)) return true;
  return false;
}

function pprogDayIsLoggedExtraSession(dayData) {
  if (!dayData || typeof dayData !== "object") return false;
  if (dayData.loggedExtraSession === true) return true;
  var parts = Array.isArray(dayData.parts) ? dayData.parts : [];
  for (var i = 0; i < parts.length; i++) {
    var title = String((parts[i] && parts[i].title) || "").toLowerCase();
    if (/^logged\s*session\b/.test(title) || /\blogged\s*extra\b/.test(title)) return true;
  }
  return false;
}

function isPprogRestDay(dayKey, dayData, week) {
  /* POL-026: athlete-logged session wins over a stale Rest overview row */
  if (pprogDayIsLoggedExtraSession(dayData)) return false;
  var focus = pprogOverviewFocus(week, dayKey);
  var focusL = focus.toLowerCase().trim();
  var parts = (dayData && dayData.parts) || [];
  if (/^logged\b/i.test(focusL)) return false;
  if (isPprogRestFocus(focus)) return true;
  if (/^(recovery|active\s*recovery|recovery\s*day)$/i.test(focusL) && (!parts.length || parts.length <= 1)) {
    var onlyEmpty =
      !parts.length ||
      parts.every(function (p) {
        return (
          !(p.lines && p.lines.length) ||
          /^(rest|recovery|מנוחה)\b/i.test(String(p.title || "") + " " + (p.lines || []).join(" "))
        );
      });
    if (onlyEmpty && parts.length) return true;
  }
  if (parts.length === 1) {
    var blob = (String(parts[0].title || "") + " " + (parts[0].lines || []).join(" ")).toLowerCase();
    if (/מנוחה/.test(parts[0].title || "") || /מנוחה/.test((parts[0].lines || []).join(" "))) return true;
    if (/^(rest(\s*day)?|off(\s*day)?|recovery)\b/.test(blob.trim()) || blob.trim() === "rest") return true;
    if (
      /\brest\s*day\b/.test(blob) &&
      !(parts[0].lines || []).some(function (ln) {
        return /[0-9]/.test(ln) && !/rest/i.test(ln);
      })
    ) {
      return true;
    }
  }
  return false;
}

function normalizePprogDayKey(raw) {
  if (raw == null) return null;
  if (typeof raw === "number" && raw >= 0 && raw <= 6) return PPROG_DAY_KEYS[raw];
  var s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (PPROG_DAY_KEYS.indexOf(s) >= 0) return s;
  var map = {
    sunday: "sun",
    monday: "mon",
    tuesday: "tue",
    wednesday: "wed",
    thursday: "thu",
    friday: "fri",
    saturday: "sat",
    sun: "sun",
    mon: "mon",
    tue: "tue",
    tues: "tue",
    wed: "wed",
    thu: "thu",
    thur: "thu",
    thurs: "thu",
    fri: "fri",
    sat: "sat",
    "0": "sun",
    "1": "mon",
    "2": "tue",
    "3": "wed",
    "4": "thu",
    "5": "fri",
    "6": "sat",
  };
  if (map[s]) return map[s];
  var three = s.slice(0, 3);
  if (PPROG_DAY_KEYS.indexOf(three) >= 0) return three;
  return null;
}

function normalizePprogParts(rawParts, dayKey) {
  var arr = [];
  if (Array.isArray(rawParts)) arr = rawParts;
  else if (rawParts && typeof rawParts === "object") {
    arr = Object.keys(rawParts).map(function (k) {
      return rawParts[k];
    });
  }
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var p = arr[i];
    if (p == null) continue;
    if (typeof p === "string") {
      var t = p.trim();
      if (!t) continue;
      out.push({
        id: dayKey + "-" + out.length,
        title: "Part " + String.fromCharCode(65 + out.length),
        lines: [t],
      });
      continue;
    }
    if (typeof p !== "object") continue;
    var lines = [];
    if (Array.isArray(p.lines)) lines = p.lines.map(String).filter(Boolean);
    else if (Array.isArray(p.exercises)) lines = p.exercises.map(String).filter(Boolean);
    else if (typeof p.text === "string" && p.text.trim()) lines = [p.text.trim()];
    else if (typeof p.description === "string" && p.description.trim()) lines = [p.description.trim()];
    else if (typeof p.content === "string" && p.content.trim()) lines = [p.content.trim()];
    var title = String(p.title || p.name || p.label || "").trim();
    if (!title && !lines.length) continue;
    if (!title) title = "Part " + String.fromCharCode(65 + out.length);
    out.push({
      id: String(p.id || dayKey + "-" + out.length),
      title: title,
      lines: lines,
    });
  }
  return out;
}

function coercePprogDaysMap(srcDays) {
  var out = {};
  if (!srcDays) return out;
  if (Array.isArray(srcDays)) {
    for (var i = 0; i < srcDays.length && i < 7; i++) {
      var item = srcDays[i] || {};
      var key =
        normalizePprogDayKey(item.day || item.dayKey || item.key || item.name || i) || PPROG_DAY_KEYS[i];
      out[key] = item.parts != null ? item : { parts: item.parts || item.workout || [] };
      if (item.parts == null && (item.title || item.lines || item.exercises)) {
        out[key] = { parts: [item] };
      }
    }
    return out;
  }
  if (typeof srcDays !== "object") return out;
  var keys = Object.keys(srcDays);
  for (var ki = 0; ki < keys.length; ki++) {
    var rawKey = keys[ki];
    var nk = normalizePprogDayKey(rawKey);
    if (!nk) continue;
    out[nk] = srcDays[rawKey];
  }
  return out;
}

function coercePprogOverview(overview) {
  if (!Array.isArray(overview)) return [];
  var out = [];
  for (var i = 0; i < overview.length; i++) {
    var row = overview[i];
    if (!row || typeof row !== "object") continue;
    var day = normalizePprogDayKey(row.day || row.dayKey || row.key || row.label || i);
    if (!day && typeof row.label === "string") day = normalizePprogDayKey(row.label);
    if (!day) continue;
    out.push({
      day: day,
      label: PPROG_DAY_LABELS[day] || String(row.label || day),
      focus: String(row.focus || row.title || row.summary || "—"),
    });
  }
  return out;
}

function pprogMentionsUpcomingDeloadOnly(theme, summary) {
  var blob = String(theme || "") + " " + String(summary || "");
  if (!/\bdeload\b|\btaper\b/i.test(blob)) return false;
  return /\b(before|into|toward|towards|prior to|pre[- ]|ahead of|leading (into|up to)|into the)\s+(the\s+)?(deload|taper)\b/i.test(
    blob
  );
}

function pprogThemeNamesDeloadWeek(theme, summary) {
  var t = String(theme || "").trim();
  var s = String(summary || "").trim();
  if (/^\s*(deload|taper)\b/i.test(t) || /^\s*(deload|taper)\b/i.test(s)) return true;
  if (/\b(deload|taper)\s+week\b/i.test(t) || /\b(deload|taper)\s+week\b/i.test(s)) {
    return !pprogMentionsUpcomingDeloadOnly(theme, summary);
  }
  return false;
}

function pprogIsActiveRecoveryFocus(focus) {
  var f = String(focus || "").toLowerCase().trim();
  if (!f || isPprogRestFocus(focus)) return false;
  if (/\bactive\s*recovery\b/.test(f)) return true;
  if (/\bdaily\s*deload\b/.test(f)) return true;
  if (/\brecovery\s*(\/|and|&)\s*technique\b/.test(f)) return true;
  if (/\b(light|easy)\b/.test(f) && /\b(recovery|deload|technique|mobility)\b/.test(f)) return true;
  return false;
}

function pprogFocusLooksFullTraining(focus) {
  var f = String(focus || "").toLowerCase().trim();
  if (!f || f === "—" || isPprogRestFocus(focus) || pprogIsActiveRecoveryFocus(focus)) return false;
  if (
    /\b(deload|taper|technique|mobility|easy|light|recovery|aerobic|zone\s*2|z2|active\s*recovery)\b/.test(f)
  ) {
    return false;
  }
  return true;
}

function pprogWeekHasFullTrainingLoad(week) {
  var w = week || {};
  var days = w.days || {};
  var trainingDays = 0;
  for (var i = 0; i < PPROG_DAY_KEYS.length; i++) {
    var k = PPROG_DAY_KEYS[i];
    var dayData = days[k] || {};
    if (isPprogRestDay(k, dayData, w)) continue;
    var focus = pprogOverviewFocus(w, k);
    if (!pprogFocusLooksFullTraining(focus)) continue;
    var parts = dayData.parts || [];
    var heavyParts = parts.some(function (p) {
      if (!p) return false;
      var blob = (String(p.title || "") + " " + (p.lines || []).join(" ")).toLowerCase();
      if (/^(rest|recovery)/i.test(String(p.title || ""))) return false;
      if (/\b(deload|easy|technique|zone\s*2|z2|recovery)\b/.test(blob) && !/\b(amrap|for time|heavy|build|rm|%)\b/.test(blob)) {
        return false;
      }
      return !!(p.lines && p.lines.length >= 2);
    });
    if (heavyParts || pprogFocusLooksFullTraining(focus)) trainingDays++;
  }
  return trainingDays >= 3;
}

function pprogWeekLooksProgrammedDeload(week) {
  var w = week || {};
  var phase = String(w.phase || "").toLowerCase().trim();
  var theme = String(w.theme || "");
  var summary = String(w.summaryLine || "");
  if (phase === "build" || phase === "peak" || phase === "intensify") return false;
  if (pprogMentionsUpcomingDeloadOnly(theme, summary)) return false;
  var namedDeload = pprogThemeNamesDeloadWeek(theme, summary);
  var phaseDeload = phase === "deload" || phase === "taper";
  if (!namedDeload && !phaseDeload) return false;
  if (namedDeload) return true;
  /* phase=deload only — drop if the week still has a normal build load. */
  if (pprogWeekHasFullTrainingLoad(w)) return false;
  return true;
}

function pprogIsDeloadWeek(week, weekIndex0, block) {
  var w = week || {};
  var phase = String(w.phase || "").toLowerCase().trim();
  var theme = String(w.theme || "");
  var summary = String(w.summaryLine || "");
  var wi =
    typeof weekIndex0 === "number" && isFinite(weekIndex0)
      ? weekIndex0
      : (parseInt(w.weekIndex, 10) || 0) - 1;

  if (phase === "build" || phase === "peak" || phase === "intensify") return false;
  if (pprogMentionsUpcomingDeloadOnly(theme, summary)) return false;

  if (pprogWeekLooksProgrammedDeload(w)) return true;

  /* Preset: week 5 deload — skipped if coach already placed deload on another week. */
  if (wi === 4 || Number(w.weekIndex) === 5) {
    var weeks = block && Array.isArray(block.weeks) ? block.weeks : null;
    if (weeks) {
      for (var j = 0; j < weeks.length; j++) {
        if (j === wi) continue;
        if (pprogWeekLooksProgrammedDeload(weeks[j])) return false;
      }
    }
    return true;
  }
  return false;
}

function pprogNormalizeFinishFeedback(fb) {
  if (!fb || typeof fb !== "object") return null;
  var rating = String(fb.rating || "").toLowerCase();
  if (
    rating !== "just_right" &&
    rating !== "too_hard" &&
    rating !== "too_easy" &&
    rating !== "other"
  ) {
    return null;
  }
  return {
    rating: rating,
    note: String(fb.note != null ? fb.note : fb.note_short || "").slice(0, 160),
    part_role: String(fb.part_role || "").slice(0, 24),
    part_title: String(fb.part_title || "").slice(0, 80),
    part_index: fb.part_index != null && fb.part_index !== "" ? fb.part_index : null,
    action_allowed: String(fb.action_allowed || "accumulate_only").slice(0, 40),
    safety_flag: !!fb.safety_flag,
    at: String(fb.at || ""),
  };
}

function normalizePprogWeek(week, prevWeek, weekStartOverride, weekMeta) {
  var meta = weekMeta || {};
  var out = {
    weekStart:
      weekStartOverride ||
      (week && week.weekStart) ||
      (prevWeek && prevWeek.weekStart) ||
      sundayOfThisWeekIsrael(),
    weekIndex: meta.weekIndex != null ? meta.weekIndex : (week && week.weekIndex) || (prevWeek && prevWeek.weekIndex) || 1,
    phase: String(meta.phase || (week && week.phase) || (prevWeek && prevWeek.phase) || "build"),
    theme: String(meta.theme || (week && week.theme) || (prevWeek && prevWeek.theme) || ""),
    summaryLine: (week && week.summaryLine) || (prevWeek && prevWeek.summaryLine) || "Training week",
    overview: coercePprogOverview((week && week.overview) || []),
    days: {},
    notesByDay: (prevWeek && prevWeek.notesByDay) || {},
    weekTalk: String((week && week.weekTalk) != null ? week.weekTalk : (prevWeek && prevWeek.weekTalk) || ""),
    lastWeekReply: String((week && week.lastWeekReply) != null ? week.lastWeekReply : (prevWeek && prevWeek.lastWeekReply) || ""),
  };
  var srcDays = coercePprogDaysMap((week && week.days) || {});
  var prevDays = (prevWeek && prevWeek.days) || {};
  for (var i = 0; i < PPROG_DAY_KEYS.length; i++) {
    var k = PPROG_DAY_KEYS[i];
    var day = srcDays[k] || {};
    var prev = prevDays[k] || {};
    var parts = normalizePprogParts(day.parts != null ? day.parts : day.workout || day.sections, k);
    /* POL-026: logged extra session must survive re-normalize / week_detail (same class as finishFeedback) */
    var loggedExtra =
      (day && day.loggedExtraSession === true) ||
      (prev && prev.loggedExtraSession === true) ||
      pprogDayIsLoggedExtraSession(day) ||
      pprogDayIsLoggedExtraSession(prev);
    if (loggedExtra && pprogDayIsLoggedExtraSession(prev)) {
      var newRestish = pprogPartsLookLikeRestOnly(parts);
      if (newRestish || !parts.length) {
        parts = normalizePprogParts(prev.parts != null ? prev.parts : prev.workout || prev.sections, k);
      }
    }
    var dayOut = {
      parts: parts,
      preTalk: String((day && day.preTalk) != null ? day.preTalk : prev.preTalk || ""),
      debrief: String((day && day.debrief) != null ? day.debrief : prev.debrief || ""),
      lastPreReply: String(prev.lastPreReply || ""),
      lastDebriefReply: String(prev.lastDebriefReply || ""),
      modifiedPartKinds:
        day && day.modifiedPartKinds && typeof day.modifiedPartKinds === "object"
          ? day.modifiedPartKinds
          : prev && prev.modifiedPartKinds && typeof prev.modifiedPartKinds === "object"
          ? prev.modifiedPartKinds
          : {},
    };
    /* Keep Done report across re-normalize / week fill — do not strip finishFeedback */
    var ff =
      pprogNormalizeFinishFeedback(day && day.finishFeedback) ||
      pprogNormalizeFinishFeedback(prev && prev.finishFeedback);
    if (ff) dayOut.finishFeedback = ff;
    if (loggedExtra) {
      dayOut.loggedExtraSession = true;
      var noteKeep =
        (day && day.loggedExtraNote) || (prev && prev.loggedExtraNote) || "";
      if (noteKeep) dayOut.loggedExtraNote = String(noteKeep).slice(0, 800);
      var atKeep = (day && day.loggedExtraAt) || (prev && prev.loggedExtraAt) || "";
      if (atKeep) dayOut.loggedExtraAt = String(atKeep);
    }
    out.days[k] = dayOut;
    if (out.notesByDay[k] == null) out.notesByDay[k] = "";
  }
  if (out.notesByDay.week == null) out.notesByDay.week = "";
  if (!out.overview.length) {
    out.overview = PPROG_DAY_KEYS.map(function (k) {
      var titles = (out.days[k].parts || [])
        .map(function (p) {
          return p.title;
        })
        .join(" + ");
      return { day: k, label: PPROG_DAY_LABELS[k], focus: titles || "—" };
    });
  }
  /* POL-026: never leave overview focus as Rest when the day is a logged extra session */
  for (var oiFix = 0; oiFix < PPROG_DAY_KEYS.length; oiFix++) {
    var dkFix = PPROG_DAY_KEYS[oiFix];
    if (!pprogDayIsLoggedExtraSession(out.days[dkFix])) continue;
    var focNow = pprogOverviewFocus(out, dkFix);
    if (!isPprogRestFocus(focNow) && focNow && focNow !== "—" && /^logged\b/i.test(focNow)) continue;
    var prevFoc = pprogOverviewFocus(prevWeek || {}, dkFix);
    var fixFocus = /^logged\b/i.test(prevFoc)
      ? prevFoc
      : ((out.days[dkFix].parts && out.days[dkFix].parts[0] && out.days[dkFix].parts[0].title) ||
          "Logged session");
    if (isPprogRestFocus(fixFocus) || !fixFocus || fixFocus === "—") fixFocus = "Logged session";
    pprogSetOverviewFocus(out, dkFix, fixFocus);
  }
  return out;
}

function pprogPartsLookLikeRestOnly(parts) {
  if (!parts || !parts.length) return true;
  if (parts.length > 2) return false;
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i] || {};
    var blob = (String(p.title || "") + " " + (p.lines || []).join(" ")).toLowerCase().trim();
    if (!blob) continue;
    if (/מנוחה/.test(String(p.title || "") + " " + (p.lines || []).join(" "))) continue;
    if (/^(rest(\s*day)?|off(\s*day)?|recovery|recovery\s*day)\b/.test(blob) || blob === "rest") continue;
    if (/\brest\s*day\b/.test(blob) && !(p.lines || []).some(function (ln) {
      return /[0-9]/.test(ln) && !/rest/i.test(ln);
    })) {
      continue;
    }
    return false;
  }
  return true;
}

function pprogSetOverviewFocus(week, dayKey, focus) {
  if (!week || !dayKey) return;
  if (!Array.isArray(week.overview)) week.overview = [];
  var key = normalizePprogDayKey(dayKey) || dayKey;
  var kept = [];
  var updated = false;
  for (var oi = 0; oi < week.overview.length; oi++) {
    var row = week.overview[oi];
    if (!row) continue;
    var rd = normalizePprogDayKey(row.day) || String(row.day || "").toLowerCase();
    if (rd === key) {
      if (!updated) {
        kept.push({
          day: key,
          label: PPROG_DAY_LABELS[key] || row.label || key,
          focus: focus,
        });
        updated = true;
      }
      /* drop duplicate overview rows for the same day */
      continue;
    }
    kept.push(row);
  }
  if (!updated) {
    kept.push({ day: key, label: PPROG_DAY_LABELS[key] || key, focus: focus });
  }
  week.overview = kept;
}

function emptyStubWeek(weekIndex, weekStart, phase) {
  return normalizePprogWeek(
    {
      weekIndex: weekIndex,
      phase: phase || (weekIndex >= 5 ? "deload" : "build"),
      theme: weekIndex >= 5 ? "Deload" : "Week " + weekIndex,
      summaryLine: "Week " + weekIndex + (weekIndex >= 5 ? " · Deload" : ""),
      overview: [],
      days: {},
    },
    null,
    weekStart,
    { weekIndex: weekIndex, phase: phase || (weekIndex >= 5 ? "deload" : "build") }
  );
}

function normalizePprogBlock(block, prevBlock) {
  var blockStart =
    (block && block.blockStart) ||
    (prevBlock && prevBlock.blockStart) ||
    sundayOfThisWeekIsrael();
  var prevWeeks = (prevBlock && prevBlock.weeks) || [];
  var srcWeeks = Array.isArray(block && block.weeks) ? block.weeks : [];
  /* Legacy: single WEEK_JSON wrapped as block */
  if (!srcWeeks.length && block && block.days) {
    srcWeeks = [block];
  }
  var weeks = [];
  for (var i = 0; i < 5; i++) {
    var src = srcWeeks[i] || null;
    var prev = prevWeeks[i] || null;
    var start = pprogAddDaysIso(blockStart, i * 7);
    if (src) {
      var probeBlock = { weeks: srcWeeks };
      var isDeload = pprogIsDeloadWeek(src, i, probeBlock);
      var srcPhase = String(src.phase || "").toLowerCase().trim();
      /* Keep coach-programmed phase; clear stale deload when detection says this week is not. */
      var resolvedPhase = isDeload
        ? "deload"
        : srcPhase && srcPhase !== "deload" && srcPhase !== "taper"
          ? src.phase
          : "build";
      weeks.push(
        normalizePprogWeek(src, prev, start, {
          weekIndex: i + 1,
          phase: resolvedPhase,
          theme: src.theme || "",
        })
      );
    } else if (prev) {
      weeks.push(normalizePprogWeek(prev, prev, start, { weekIndex: i + 1, phase: prev.phase, theme: prev.theme }));
    } else {
      weeks.push(emptyStubWeek(i + 1, start, i === 4 ? "deload" : "build"));
    }
  }
  return {
    summaryLine: (block && block.summaryLine) || (prevBlock && prevBlock.summaryLine) || "5-week block through first deload",
    blockStart: blockStart,
    weeks: weeks,
  };
}
  return {
    DAY_KEYS: PPROG_DAY_KEYS,
    DAY_LABELS: PPROG_DAY_LABELS,
    sundayOfThisWeekIsrael: sundayOfThisWeekIsrael,
    parseIso: pprogParseIso,
    addDaysIso: pprogAddDaysIso,
    overviewFocus: pprogOverviewFocus,
    isRestFocus: isPprogRestFocus,
    isRestDay: isPprogRestDay,
    isLoggedExtra: pprogDayIsLoggedExtraSession,
    normalizeDayKey: normalizePprogDayKey,
    normalize: normalizePprogBlock,
    normalizeWeek: normalizePprogWeek,
    normalizeFinishFeedback: pprogNormalizeFinishFeedback,
  };
});
