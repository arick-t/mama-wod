/**
 * Shared Personal Coach brick calendar + day-card HTML (admin + app).
 * 0 LLM. Never calls generate_* / revise_* / personal-coach.
 *
 * Browser: <script src="lib/pprog-display.js"></script> → PprogDisplay
 * Node: require("./pprog-display")
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./normalize-pprog-block.js"));
  } else {
    root.PprogDisplay = factory(root.NormalizePprogBlock);
  }
})(typeof self !== "undefined" ? self : this, function (NormalizePprogBlock) {
  "use strict";

  var DAY_KEYS = (NormalizePprogBlock && NormalizePprogBlock.DAY_KEYS) || [
    "sun",
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
  ];
  var DAY_LABELS = (NormalizePprogBlock && NormalizePprogBlock.DAY_LABELS) || {
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
  };
  var DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
  var MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseIso(iso) {
    if (NormalizePprogBlock && NormalizePprogBlock.parseIso) return NormalizePprogBlock.parseIso(iso);
    var s = String(iso || "").slice(0, 10);
    var p = s.split("-");
    if (p.length !== 3) return new Date();
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
  }

  function addDaysIso(iso, n) {
    if (NormalizePprogBlock && NormalizePprogBlock.addDaysIso) return NormalizePprogBlock.addDaysIso(iso, n);
    var dt = parseIso(iso);
    dt.setDate(dt.getDate() + Number(n || 0));
    var yy = dt.getFullYear();
    var mm = String(dt.getMonth() + 1).padStart(2, "0");
    var dd = String(dt.getDate()).padStart(2, "0");
    return yy + "-" + mm + "-" + dd;
  }

  function sundayOfThisWeekIsrael() {
    if (NormalizePprogBlock && NormalizePprogBlock.sundayOfThisWeekIsrael) {
      return NormalizePprogBlock.sundayOfThisWeekIsrael();
    }
    var dt = new Date();
    dt.setDate(dt.getDate() - dt.getDay());
    return addDaysIso(dt.toISOString().slice(0, 10), 0);
  }

  function overviewFocus(week, dayKey) {
    if (NormalizePprogBlock && NormalizePprogBlock.overviewFocus) {
      return NormalizePprogBlock.overviewFocus(week, dayKey);
    }
    return "";
  }

  function isLoggedExtra(dayData) {
    if (NormalizePprogBlock && NormalizePprogBlock.isLoggedExtra) {
      return NormalizePprogBlock.isLoggedExtra(dayData);
    }
    return !!(dayData && dayData.loggedExtraSession);
  }

  function isRestDay(dayKey, dayData, week) {
    if (NormalizePprogBlock && NormalizePprogBlock.isRestDay) {
      return NormalizePprogBlock.isRestDay(dayKey, dayData, week);
    }
    return false;
  }

  function isRestFocus(focus) {
    if (NormalizePprogBlock && NormalizePprogBlock.isRestFocus) {
      return NormalizePprogBlock.isRestFocus(focus);
    }
    return /\brest(\s*day)?\b|מנוחה/i.test(String(focus || ""));
  }

  function weekRangeLabel(weekStart) {
    if (!weekStart) return "";
    var a = parseIso(weekStart);
    var b = parseIso(addDaysIso(weekStart, 6));
    return MONTH_NAMES[a.getMonth()].slice(0, 3) + " " + a.getDate() + "–" + b.getDate();
  }

  function blockSpanLabel(block) {
    var start = (block && block.blockStart) || "";
    if (!start) return "";
    var a = parseIso(start);
    var end = addDaysIso(start, 34);
    var b = parseIso(end);
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return MONTH_NAMES[a.getMonth()] + " " + a.getFullYear();
    }
    return MONTH_NAMES[a.getMonth()] + " – " + MONTH_NAMES[b.getMonth()] + " " + b.getFullYear();
  }

  function weekLooksProgrammedDeload(week) {
    var w = week || {};
    var phase = String(w.phase || "").toLowerCase().trim();
    var theme = String(w.theme || "");
    if (phase === "deload" || phase === "taper") return true;
    if (/\bdeload\b|\btaper\b/i.test(theme)) return true;
    return false;
  }

  function isDeloadWeek(week, weekIndex0, block) {
    var w = week || {};
    var phase = String(w.phase || "").toLowerCase().trim();
    if (phase === "build" || phase === "peak" || phase === "intensify") return false;
    if (weekLooksProgrammedDeload(w)) return true;
    var wi = typeof weekIndex0 === "number" ? weekIndex0 : 0;
    if (wi === 4) {
      var weeks = block && Array.isArray(block.weeks) ? block.weeks : null;
      if (weeks) {
        for (var j = 0; j < weeks.length; j++) {
          if (j === wi) continue;
          if (weekLooksProgrammedDeload(weeks[j])) return false;
        }
      }
      return true;
    }
    return false;
  }

  function phaseShort(week, weekIndex0, block) {
    if (isDeloadWeek(week, weekIndex0, block)) return "Deload";
    var theme = String((week && week.theme) || "").trim();
    if (!theme) return week && week.phase === "build" ? "Build" : "";
    var words = theme.split(/\s+/).filter(Boolean);
    if (words.length <= 2) return words.join(" ").slice(0, 14);
    return words.slice(0, 2).join(" ").slice(0, 14);
  }

  function isActiveRecoveryDay(dayKey, dayData, week, store) {
    if (isRestDay(dayKey, dayData, week)) return false;
    if (isDeloadWeek(week)) return false;
    var focus = overviewFocus(week, dayKey);
    if (/\bactive\s*recovery\b|\bdaily\s*deload\b/i.test(focus)) return true;
    if (store && store.activeRecoveryPref === "yes") {
      var pref = String(store.activeRecoveryDay || "").toLowerCase().slice(0, 3);
      if (pref && pref === String(dayKey || "").slice(0, 3)) return true;
    }
    return false;
  }

  function weekHasDetailedDays(week) {
    if (!week || !week.days) return false;
    var n = 0;
    for (var i = 0; i < DAY_KEYS.length; i++) {
      var k = DAY_KEYS[i];
      var dayData = week.days[k] || {};
      var parts = dayData.parts || [];
      if (isRestDay(k, dayData, week)) continue;
      var hasReal = parts.some(function (p) {
        if (!p || !p.lines || !p.lines.length) return false;
        if (p.id && String(p.id).indexOf("overview-stub") >= 0) return false;
        if (/still loading/i.test(p.lines.join(" "))) return false;
        return true;
      });
      if (hasReal) n++;
    }
    return n >= 1;
  }

  function stubPartsFromOverview(week, dayKey) {
    var focus = overviewFocus(week, dayKey);
    if (!focus || focus === "—" || isRestFocus(focus)) return [];
    return [
      {
        id: dayKey + "-overview-stub",
        title: "Planned focus",
        lines: [focus, "Full session details still loading…"],
      },
    ];
  }

  function dayHasFinishReport(dayData) {
    return !!(dayData && dayData.finishFeedback && dayData.finishFeedback.rating);
  }

  function isFutureTrainingDay(dayIso, todayIso) {
    return String(dayIso || "") > String(todayIso || "");
  }

  function formatPartHeading(partIndex, rawTitle) {
    var letter = String.fromCharCode(65 + (partIndex | 0));
    var t = String(rawTitle || "").trim();
    if (!t) return "Part " + letter;
    if (/^Part\s+[A-Z]\b/i.test(t)) return t;
    return "Part " + letter + " — " + t;
  }

  function normalizePartKind(rawTitle, rawLines) {
    var title = String(rawTitle || "").toLowerCase();
    var lines = Array.isArray(rawLines) ? rawLines.join(" ").toLowerCase() : String(rawLines || "").toLowerCase();
    var t = title + " " + lines;
    if (/(warm[\s-]?up|mobility|activation)/.test(t)) return "warmup";
    if (/(strength|squat|deadlift|press|bench|strict|front squat|back squat)/.test(t)) return "strength";
    if (/(metcon|amrap|emom|for time|chipper|interval|e2mom|tabata)/.test(t)) return "metcon";
    if (/(skill|gymnastics|technique|oly|snatch|clean|jerk)/.test(t)) return "skill";
    if (/(engine|run|row|bike|ski|aero)/.test(t)) return "engine";
    if (/(rest day|rest\b|off day|recovery)/.test(t)) return "rest";
    return "other";
  }

  function isIntentNoteLine(line) {
    var t = String(line || "").trim();
    if (!t) return false;
    if (/^target\s*:/i.test(t)) return true;
    if (/^(target\s+)?duration\s*:/i.test(t)) return true;
    if (/^duration\s*&?\s*intent\s*:/i.test(t)) return true;
    if (/^movement(\s+intent)?\s*:/i.test(t)) return true;
    if (/^(intent|focus|cue|note|goal)\s*[:—-]/i.test(t)) return true;
    return false;
  }

  function isCoachNoteLine(line) {
    var t = String(line || "").trim();
    if (!t) return false;
    if (isIntentNoteLine(t)) return true;
    if (/^(note|cue|coach|tip|reminder|coaching)\s*[:—-]/i.test(t)) return true;
    if (/^rest\b/i.test(t) && /(between|sets?|rounds?)/i.test(t)) return true;
    return false;
  }

  function isFormatHead(head) {
    var t = String(head || "").trim().replace(/:\s*$/, "");
    if (!t || t.length > 100) return false;
    if (/^(AMRAP|EMOM|E2MOM|For\s*Time|Chipper|Tabata|Intervals?\b)/i.test(t)) return true;
    if (/\b(?:AMRAP|EMOM|E2MOM)\b/i.test(t)) return true;
    if (/^\d+\s*(?:sets?|rounds?)\b/i.test(t)) return true;
    if (/sets?\s+for\s+quality/i.test(t)) return true;
    return false;
  }

  function peelEmbeddedFormat(line) {
    var t = String(line || "").trim();
    var m = t.match(/^(.+?):\s+(.+)$/);
    if (!m) return null;
    var headRaw = String(m[1] || "").trim();
    var rest = String(m[2] || "").trim();
    if (!headRaw || !rest) return null;
    if (/^(intent|focus|cue|note|goal|duration|movement|target)\b/i.test(headRaw)) return null;
    if (!isFormatHead(headRaw)) return null;
    return { format: headRaw + ":", workRest: rest };
  }

  function isFormatLine(line) {
    var t = String(line || "").trim();
    if (!t || t.length > 180) return false;
    if (peelEmbeddedFormat(t)) return true;
    if (/:\s*$/.test(t) && isFormatHead(t)) return true;
    return isFormatHead(t);
  }

  function classifyPartLines(rawLines) {
    var lines = Array.isArray(rawLines)
      ? rawLines.map(function (l) {
          return String(l || "").trim();
        }).filter(Boolean)
      : [];
    var notes = [];
    var format = "";
    var work = [];
    var trailingNotes = [];
    var formatIdx = -1;
    var scanMax = Math.min(lines.length, 4);
    var fi;
    for (fi = 0; fi < scanMax; fi++) {
      if (isFormatLine(lines[fi])) {
        formatIdx = fi;
        break;
      }
    }
    var i = 0;
    var embeddedWork = "";
    var peeledFmt;
    if (formatIdx >= 0) {
      for (i = 0; i < formatIdx; i++) notes.push(lines[i]);
      peeledFmt = peelEmbeddedFormat(lines[formatIdx]);
      if (peeledFmt) {
        format = peeledFmt.format;
        embeddedWork = peeledFmt.workRest;
      } else {
        format = lines[formatIdx];
      }
      i = formatIdx + 1;
    } else {
      while (i < lines.length && isCoachNoteLine(lines[i])) {
        notes.push(lines[i]);
        i++;
      }
      if (i < lines.length && isFormatLine(lines[i])) {
        peeledFmt = peelEmbeddedFormat(lines[i]);
        if (peeledFmt) {
          format = peeledFmt.format;
          embeddedWork = peeledFmt.workRest;
        } else {
          format = lines[i];
        }
        i++;
      }
    }
    if (embeddedWork) work.push(embeddedWork);
    while (i < lines.length) {
      work.push(lines[i]);
      i++;
    }
    while (work.length && isCoachNoteLine(work[work.length - 1])) {
      trailingNotes.unshift(work.pop());
    }
    if (!notes.length && !format && !work.length && !trailingNotes.length && lines.length) {
      work = lines.slice();
    }
    return { notes: notes, format: format, work: work, trailingNotes: trailingNotes };
  }

  function hook(opts, name, fallback) {
    var h = (opts && opts.hooks) || {};
    return h[name] || fallback;
  }

  function pick(opts, key, fallback) {
    if (opts && typeof opts[key] === "function") return opts[key];
    return fallback;
  }

  function renderDayPartsHtml(parts, dayData, opts) {
    opts = opts || {};
    var classify = pick(opts, "classifyPartLines", classifyPartLines);
    var headingFn = pick(opts, "formatPartHeading", formatPartHeading);
    var kindFn = pick(opts, "normalizePartKind", normalizePartKind);
    var html = "";
    if (!parts || !parts.length) {
      return '<div class="pprog-empty" style="padding:12px">No parts for this day</div>';
    }
    var modifiedKinds = (dayData && dayData.modifiedPartKinds) || {};
    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi] || {};
      var heading = headingFn(pi, part.title);
      var kind = kindFn(part.title, part.lines);
      var modified = !!modifiedKinds[kind];
      var classified = classify(part.lines) || { notes: [], format: "", work: [], trailingNotes: [] };
      html += '<div class="section">';
      html += '<div class="section-title-row">';
      html +=
        '<div class="section-title">' +
        esc(heading) +
        (modified ? '<span class="pprog-modified-flag">MODIFIED</span>' : "") +
        "</div>";
      html += "</div>";
      var ni;
      for (ni = 0; ni < (classified.notes || []).length; ni++) {
        html += '<div class="pprog-part-note">' + esc(classified.notes[ni]) + "</div>";
      }
      if (classified.format) {
        html += '<div class="pprog-part-format">' + esc(classified.format) + "</div>";
      }
      html += '<ul class="section-lines">';
      var work = classified.work || [];
      var trailing = classified.trailingNotes || [];
      if (!work.length && !(classified.notes || []).length && !classified.format && !trailing.length) {
        work = part.lines || [];
      }
      for (var li = 0; li < work.length; li++) {
        html += "<li>" + esc(work[li]) + "</li>";
      }
      html += "</ul>";
      for (var ti = 0; ti < trailing.length; ti++) {
        html += '<div class="pprog-part-note">' + esc(trailing[ti]) + "</div>";
      }
      html += "</div>";
    }
    return html;
  }

  function renderDayFooter(dayKey, dayData, opts) {
    if (opts && opts.showFooter === false) return "";
    var saveFn = hook(opts, "savePre", "savePprogDayField");
    var sendFn = hook(opts, "sendPre", "submitPprogDayPreTalk");
    var label = DAY_LABELS[dayKey] || dayKey;
    var preReply = (dayData && (dayData.lastPreReply || dayData.lastDebriefReply)) || "";
    return (
      '<div class="pprog-day-footer" dir="ltr">' +
      '<div class="pprog-session-box">' +
      "<label>This workout only · " +
      esc(label) +
      "</label>" +
      '<span class="pprog-session-scope">Edits this day only. For the full brick, schedule, or goals — tap the coach button.</span>' +
      '<textarea id="pprog-pre-ta-' +
      dayKey +
      '" maxlength="2000" dir="ltr" placeholder="e.g. no dumbbells today · shorter metcon · knees felt rough after squats…" onchange="' +
      saveFn +
      "('" +
      dayKey +
      "', 'preTalk', this.value)\">" +
      esc((dayData && dayData.preTalk) || "") +
      "</textarea>" +
      '<div class="pprog-day-actions">' +
      '<button type="button" class="btn btn-find pprog-talk-btn" onclick="' +
      sendFn +
      "('" +
      dayKey +
      "')\">Send</button>" +
      "</div>" +
      '<div class="pprog-part-reply" id="pprog-day-reply-' +
      dayKey +
      '"' +
      (preReply ? "" : ' style="display:none"') +
      ">" +
      esc(preReply) +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderCalHtml(block, activeWi, activeDay, opts) {
    opts = opts || {};
    var restFn = pick(opts, "isRestDay", isRestDay);
    var loggedFn = pick(opts, "isLoggedExtra", isLoggedExtra);
    var focusFn = pick(opts, "overviewFocus", overviewFocus);
    var deloadFn = pick(opts, "isDeloadWeek", isDeloadWeek);
    var arFn = pick(opts, "isActiveRecoveryDay", isActiveRecoveryDay);
    var detailedFn = pick(opts, "weekHasDetailedDays", weekHasDetailedDays);
    var phaseFn = pick(opts, "phaseShort", phaseShort);
    var calMode = opts.calMode || "week";
    var store = opts.store || null;
    var start = (block && block.blockStart) || sundayOfThisWeekIsrael();
    var spanLabel = blockSpanLabel(block) || "";
    var shiftFn = hook(opts, "shift", "pprogCalShift");
    var toggleFn = hook(opts, "toggleMode", "togglePprogCalMode");
    var todayFn = hook(opts, "jumpToday", "jumpPprogToToday");
    var setDayFn = hook(opts, "setDay", "setPprogCalDay");

    var html =
      '<div class="pprog-cal-head">' +
      '<button type="button" class="pprog-cal-nav" onclick="' +
      shiftFn +
      '(-1)" aria-label="Previous week">‹</button>' +
      '<button type="button" class="pprog-cal-month-btn" onclick="' +
      toggleFn +
      '()" title="Toggle week / full block view">' +
      esc(spanLabel) +
      "</button>" +
      '<button type="button" class="pprog-cal-nav" onclick="' +
      shiftFn +
      '(1)" aria-label="Next week">›</button>' +
      "</div>" +
      '<div class="pprog-cal-today-row">' +
      '<button type="button" class="pprog-cal-today" onclick="' +
      todayFn +
      '()" title="Jump to today (Asia/Jerusalem)">Today</button>' +
      "</div>";

    function cellHtml(weekIndex0, dayIndex, iso) {
      var dayKey = DAY_KEYS[dayIndex];
      var week = (block.weeks && block.weeks[weekIndex0]) || {};
      var dayData = (week.days && week.days[dayKey]) || {};
      var rest = restFn(dayKey, dayData, week);
      var logged = loggedFn(dayData);
      var focus = focusFn(week, dayKey);
      var has = !rest && ((dayData.parts && dayData.parts.length) || (focus && focus !== "—"));
      var isActive = weekIndex0 === activeWi && dayKey === activeDay;
      var deload = deloadFn(week, weekIndex0, block);
      var ar = arFn(dayKey, dayData, week, store);
      var cls = "pprog-cal-cell";
      if (isActive) cls += " active";
      if (has) cls += " has-wod";
      if (logged) cls += " logged-extra";
      if (rest) cls += " muted";
      if (deload) cls += " deload-week";
      else if (ar) cls += " active-recovery";
      var dateNum = String(parseIso(iso).getDate());
      return (
        '<button type="button" class="' +
        cls +
        '" onclick="' +
        setDayFn +
        "(" +
        weekIndex0 +
        ", '" +
        dayKey +
        "')\">" +
        dateNum +
        "</button>"
      );
    }

    function generalBtn(weekIndex0) {
      var week = (block.weeks && block.weeks[weekIndex0]) || {};
      var deload = deloadFn(week, weekIndex0, block);
      var cls =
        "pprog-cal-general" +
        (weekIndex0 === activeWi && activeDay === "general" ? " active" : "") +
        (deload ? " deload-week" : "");
      return (
        '<button type="button" class="' +
        cls +
        '" onclick="' +
        setDayFn +
        "(" +
        weekIndex0 +
        ", 'general')\">" +
        (deload ? "Deload" : "General") +
        "</button>"
      );
    }

    function weekColBtn(weekIndex0) {
      var w = (block.weeks && block.weeks[weekIndex0]) || {};
      var deload = deloadFn(w, weekIndex0, block);
      var phase = phaseFn(w, weekIndex0, block);
      var loading = !detailedFn(w);
      var cls =
        "pprog-cal-week-col" +
        (weekIndex0 === activeWi && activeDay === "general" ? " active" : "") +
        (loading ? " loading" : "") +
        (deload ? " deload-week" : "");
      return (
        '<button type="button" class="' +
        cls +
        '" onclick="' +
        setDayFn +
        "(" +
        weekIndex0 +
        ", 'general')\" title=\"Week " +
        (weekIndex0 + 1) +
        (phase ? " · " + phase : "") +
        '">' +
        '<span class="pprog-cal-week-num">W' +
        (weekIndex0 + 1) +
        "</span>" +
        (phase ? '<span class="pprog-cal-week-phase">' + esc(phase) + "</span>" : "") +
        "</button>"
      );
    }

    if (calMode === "month") {
      html += '<div class="pprog-cal-dow"><span></span>';
      for (var d = 0; d < 7; d++) html += "<span>" + DOW_LETTERS[d] + "</span>";
      html += "</div>";
      html += '<div class="pprog-cal-month-grid">';
      var weekCount = Math.max(5, (block.weeks && block.weeks.length) || 0);
      for (var wi = 0; wi < weekCount; wi++) {
        var rowDeload = deloadFn((block.weeks && block.weeks[wi]) || {}, wi, block);
        html += '<div class="pprog-cal-row' + (rowDeload ? " deload-week" : "") + '">' + weekColBtn(wi);
        for (var di = 0; di < 7; di++) {
          html += cellHtml(wi, di, addDaysIso(start, wi * 7 + di));
        }
        html += "</div>";
      }
      html += "</div>";
      html += '<div class="pprog-cal-block-hint">Full 5-week brick · tap a date · ‹ › moves active week</div>';
    } else {
      var activeStart =
        (block.weeks && block.weeks[activeWi] && block.weeks[activeWi].weekStart) ||
        addDaysIso(start, activeWi * 7);
      html +=
        '<div class="pprog-cal-week-label" style="text-align:center;margin:0 0 6px">Week ' +
        (activeWi + 1) +
        " · " +
        esc(weekRangeLabel(activeStart)) +
        "</div>";
      html += '<div class="pprog-cal-dow"><span></span>';
      for (var d2 = 0; d2 < 7; d2++) html += "<span>" + DOW_LETTERS[d2] + "</span>";
      html += "</div>";
      html += '<div class="pprog-cal-row">' + generalBtn(activeWi);
      for (var di2 = 0; di2 < 7; di2++) {
        html += cellHtml(activeWi, di2, addDaysIso(start, activeWi * 7 + di2));
      }
      html += "</div>";
      html += '<div class="pprog-cal-block-hint">Tap month title for full 5-week brick</div>';
    }
    return html;
  }

  function renderDayCardHtml(block, week, activeWi, day, opts) {
    opts = opts || {};
    var restFn = pick(opts, "isRestDay", isRestDay);
    var loggedFn = pick(opts, "isLoggedExtra", isLoggedExtra);
    var focusFn = pick(opts, "overviewFocus", overviewFocus);
    var detailedFn = pick(opts, "weekHasDetailedDays", weekHasDetailedDays);
    var stubFn = pick(opts, "stubPartsFromOverview", stubPartsFromOverview);
    var todayIso = opts.israelTodayIso || "";
    var showActions = opts.showActions !== false;
    var readOnly = opts.readOnly === true;
    var shareFn = hook(opts, "share", "sharePprogDayWhatsApp");
    var finishFn = hook(opts, "finish", "openPprogFinishFeedback");
    var retryFn = hook(opts, "retryFill", "retryPprogFillFailures");
    var dayData = (week && week.days && week.days[day]) || { parts: [], preTalk: "", debrief: "" };
    var dayIso = addDaysIso(block.blockStart, activeWi * 7 + DAY_KEYS.indexOf(day));
    var dateLabel =
      (DAY_LABELS[day] || day) +
      " · " +
      parseIso(dayIso).getDate() +
      " " +
      MONTH_NAMES[parseIso(dayIso).getMonth()];
    var detailed = detailedFn(week);
    var html = "";
    var fillErrors = opts.fillErrors || {};
    var fillAttempts = opts.fillAttempts || {};
    if (!detailed && !readOnly) {
      if (fillErrors[activeWi] && (fillAttempts[activeWi] || 0) >= 3) {
        html +=
          '<div class="pprog-fill-status err" style="padding:8px">' +
          esc(fillErrors[activeWi] || "Could not load this week's workouts.") +
          ' <button type="button" class="btn btn-find" style="padding:4px 10px;font-size:.75em" onclick="' +
          retryFn +
          '()">Retry fill</button></div>';
      } else {
        html += '<div class="pprog-empty" style="padding:12px 8px">Loading this week\'s workouts…</div>';
        if (typeof opts.onNeedFill === "function") opts.onNeedFill(activeWi);
      }
    }
    html += '<div class="pprog-day-card" dir="ltr">';
    var focus = focusFn(week, day);
    var restDay = restFn(day, dayData, week);
    var loggedExtra = loggedFn(dayData);
    var finishReported = dayHasFinishReport(dayData);
    var finishFuture = todayIso ? isFutureTrainingDay(dayIso, todayIso) : false;
    var shareBtn = "";
    if (showActions && !readOnly) {
      shareBtn =
        '<button type="button" class="pprog-share-wa" onclick="' +
        shareFn +
        "('" +
        day +
        '\')" title="Share workout on WhatsApp" aria-label="Share workout on WhatsApp">' +
        (opts.shareIcon || "WA") +
        "</button>";
    }
    var finishBtn = "";
    if (!restDay && !finishFuture) {
      if (finishReported) {
        finishBtn =
          '<span class="pprog-finish-reported' +
          (opts.finishJustLockedKey === day ? " lock-pop" : "") +
          '" role="status" title="Report saved for this day" aria-label="Reported — check-in saved">Reported ✓</span>';
      } else if (showActions && !readOnly) {
        finishBtn =
          '<button type="button" class="pprog-finish-btn" onclick="' +
          finishFn +
          "('" +
          day +
          '\')" title="Mark workout done" aria-label="Done">' +
          (opts.finishIcon || "Done") +
          "Done</button>";
      }
    }
    html +=
      '<div class="card-header">' +
      '<div class="source-name">' +
      esc(dateLabel) +
      (loggedExtra
        ? '<span class="pprog-logged-extra-flag" title="Extra session logged — counted in the plan">LOGGED</span>'
        : "") +
      "</div>" +
      '<div class="pprog-day-actions">' +
      finishBtn +
      shareBtn +
      "</div>" +
      "</div>";
    if (loggedExtra && focus) {
      html +=
        '<div class="pprog-logged-extra-banner" role="status">' +
        esc(focus) +
        " · counted toward remaining week load</div>";
    }
    if (restDay) {
      html +=
        '<div class="pprog-rest-day">' +
        '<div class="pprog-rest-day-title">REST DAY</div>' +
        '<img class="pprog-rest-day-img" src="assets/rest-day-duck.png" alt="Rest day" width="260" height="260" loading="lazy">' +
        "</div>";
      html += renderDayFooter(day, dayData, opts);
    } else {
      var parts = dayData.parts || [];
      if ((!parts.length || !parts.some(function (p) { return p.lines && p.lines.length; })) && focus && focus !== "—") {
        parts = stubFn(week, day);
      }
      var hasRealParts = !!(
        parts.length &&
        parts.some(function (p) {
          return p && ((p.lines && p.lines.length) || p.title);
        })
      );
      if (!hasRealParts && focus && focus !== "—") {
        html += '<div class="pprog-summary" style="margin-bottom:10px;font-size:.88em">' + esc(focus) + "</div>";
      }
      if (!parts.length && !detailed) {
        html +=
          '<div class="pprog-day-stub"><strong>Session pending</strong>Overview is ready; full parts are still being generated for this week.</div>';
      } else {
        html += renderDayPartsHtml(parts, dayData, opts);
      }
      html += renderDayFooter(day, dayData, opts);
    }
    html += "</div>";
    return html;
  }

  function renderBrickView(opts) {
    opts = opts || {};
    var block = opts.block;
    if (!block || !block.weeks || !block.weeks.length) {
      return '<div class="ath-muted">אין בלוק פעיל</div>';
    }
    var wi = opts.activeWeekIndex | 0;
    if (wi < 0) wi = 0;
    if (wi > 4) wi = 4;
    var day = opts.activeDay || "sun";
    var week = block.weeks[wi] || {};
    var cal = renderCalHtml(block, wi, day, opts);
    var card = "";
    if (day !== "general" && DAY_KEYS.indexOf(day) >= 0) {
      card = renderDayCardHtml(block, week, wi, day, opts);
    } else {
      card =
        '<div class="pprog-empty" style="padding:16px 8px">Full block · tap a date to open the workout</div>';
    }
    return (
      '<div class="pprog-cal" id="pprogCal">' +
      cal +
      "</div>" +
      '<div class="pprog-week-panes">' +
      card +
      "</div>"
    );
  }

  return {
    DAY_KEYS: DAY_KEYS,
    DAY_LABELS: DAY_LABELS,
    esc: esc,
    classifyPartLines: classifyPartLines,
    formatPartHeading: formatPartHeading,
    renderDayPartsHtml: renderDayPartsHtml,
    renderCalHtml: renderCalHtml,
    renderDayCardHtml: renderDayCardHtml,
    renderBrickView: renderBrickView,
    weekHasDetailedDays: weekHasDetailedDays,
    isDeloadWeek: isDeloadWeek,
  };
});
