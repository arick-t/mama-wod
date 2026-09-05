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

  function dayHasRealTrainingParts(dayData) {
    var parts = (dayData && dayData.parts) || [];
    var pi;
    for (pi = 0; pi < parts.length; pi++) {
      var p = parts[pi];
      if (!p || !p.lines || !p.lines.length) continue;
      if (p.id && String(p.id).indexOf("overview-stub") >= 0) continue;
      if (/still loading/i.test(p.lines.join(" "))) continue;
      var blob = (String(p.title || "") + " " + p.lines.join(" ")).toLowerCase();
      if (/^(rest(\s*day)?|off(\s*day)?)\b/.test(blob.trim())) continue;
      return true;
    }
    return false;
  }

  function weekHasDetailedDays(week) {
    if (!week || !week.days) return false;
    var training = 0;
    var filled = 0;
    var i;
    for (i = 0; i < DAY_KEYS.length; i++) {
      var k = DAY_KEYS[i];
      var dayData = week.days[k] || {};
      if (isRestDay(k, dayData, week)) continue;
      training++;
      if (dayHasRealTrainingParts(dayData)) filled++;
    }
    if (training === 0) return true;
    return filled >= training;
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

  function isSelectedCell(selectedDays, weekIndex0, dayKey) {
    if (!Array.isArray(selectedDays) || !selectedDays.length) return false;
    var i;
    for (i = 0; i < selectedDays.length; i++) {
      var s = selectedDays[i];
      if (!s) continue;
      if ((s.wi | 0) === (weekIndex0 | 0) && String(s.day || "") === String(dayKey || "")) {
        return true;
      }
    }
    return false;
  }

  function sortSelectedDays(list) {
    var keys = DAY_KEYS;
    return (list || [])
      .slice()
      .sort(function (a, b) {
        var ia = (a.wi | 0) * 7 + keys.indexOf(a.day);
        var ib = (b.wi | 0) * 7 + keys.indexOf(b.day);
        return ia - ib;
      });
  }

  /** A stable id for one selected cell: "3:mon". */
  function selId(wi, day) {
    return (wi | 0) + ":" + String(day || "").slice(0, 3);
  }

  /**
   * Every cell between two, inclusive, whichever was picked first. A month is 28 cells
   * in a straight line here, so "from Wednesday back to Monday" is the same run as
   * "from Monday to Wednesday" (owner, 2026-09-01).
   */
  function rangeBetween(a, b) {
    var ia = (a.wi | 0) * 7 + DAY_KEYS.indexOf(a.day);
    var ib = (b.wi | 0) * 7 + DAY_KEYS.indexOf(b.day);
    if (ia < 0 || ib < 0) return [];
    var lo = Math.min(ia, ib);
    var hi = Math.max(ia, ib);
    var out = [];
    for (var i = lo; i <= hi; i++) out.push({ wi: Math.floor(i / 7), day: DAY_KEYS[i % 7] });
    return out;
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

  /**
   * Which of a part's lines are notes, which is the format, which is the work.
   *
   * The lines are stored as one flat list — that is what the client, the share text and
   * every export read — so the shape has to be worked out again when it is drawn. The
   * rules for that are English: "note:", "cue:", "rest between sets", an intent line.
   * A note written in Hebrew matched none of them, so a note he typed came back as a
   * work line the moment it was saved (owner, 2026-09-05).
   *
   * So a part now remembers HOW MANY of its leading lines he wrote as notes, and that
   * count is believed when it is there. Nothing about the stored lines changes, and a
   * part without the count is classified exactly as before.
   *
   * @param {string[]} rawLines
   * @param {number} [authoredNotes] how many leading lines were written as notes
   * @param {number} [authoredFormat] 1 when the line after the notes is the format line
   */
  function classifyPartLines(rawLines, authoredNotes, authoredFormat) {
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
    /* ── THE SHAPE HE WROTE ────────────────────────────────────────────────
       A part written in the editor records its own shape: how many leading lines are
       notes, and whether the line after them is the format line. Where that is on
       file, nothing is guessed at all — the split is read, not deduced.

       This is what the guessing kept getting wrong. The rules it guesses by are
       English ("note:", "AMRAP", "3 rounds"), and a Hebrew session has none of them —
       so a work line that happened to sit before a line containing "AMRAP" was pulled
       out as a note, and the owner's edit appeared to land in the wrong box or not to
       land at all (owner, 2026-09-05, on production).

       A part that was never written here — anything older, anything the coach's brain
       produced — has no shape on file and is classified exactly as it was before. */
    var authoredFmt = parseInt(authoredFormat, 10);
    if (Number.isFinite(authoredFmt)) {
      var wantNotes = parseInt(authoredNotes, 10);
      if (!Number.isFinite(wantNotes) || wantNotes < 0) wantNotes = 0;
      var take = Math.min(wantNotes, lines.length);
      var restLines = lines.slice(take);
      var fmtLine = authoredFmt === 1 && restLines.length ? restLines.shift() : "";
      return {
        notes: lines.slice(0, take),
        format: fmtLine,
        work: restLines,
        trailingNotes: [],
      };
    }
    /* He said how many notes, but not where the format line is: an older part, from
       before the shape was recorded. Take the notes and guess the rest as before. */
    var authored = parseInt(authoredNotes, 10);
    if (Number.isFinite(authored) && authored > 0) {
      var taken = Math.min(authored, lines.length);
      notes = lines.slice(0, taken);
      var rest = classifyPartLines(lines.slice(taken));
      return {
        notes: notes.concat(rest.notes || []),
        format: rest.format || "",
        work: rest.work || [],
        trailingNotes: rest.trailingNotes || [],
      };
    }
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

  /* ══════════════════════════════════════════════════════════════════════
     A COLOUR FOR A WORK LINE, AND NUMBERING FOR A PART.

     The coach marks a line — "this one is the heavy set" — by colouring it, and can
     number the lines of one part without numbering the others (owner, 2026-09-05).

     What is stored is the NAME of a colour, never the hex: the card is repainted from
     time to time, and a programme written a year ago has to keep reading the way it was
     written. An unknown name is simply no colour.
     ══════════════════════════════════════════════════════════════════════ */
  var WORK_LINE_COLOURS = [
    { key: "red", hex: "#F2867A", label: "Red" },
    { key: "orange", hex: "#F0A44E", label: "Orange" },
    { key: "yellow", hex: "#F5D97A", label: "Yellow" },
    { key: "green", hex: "#7FD1A0", label: "Green" },
    { key: "blue", hex: "#7DD3F0", label: "Blue" },
    { key: "purple", hex: "#B57BE8", label: "Purple" },
  ];

  /** The hex a stored colour name is drawn with, or "" for "the usual text colour". */
  function workLineColour(key) {
    var k = String(key == null ? "" : key);
    for (var i = 0; i < WORK_LINE_COLOURS.length; i++) {
      if (WORK_LINE_COLOURS[i].key === k) return WORK_LINE_COLOURS[i].hex;
    }
    return "";
  }

  /**
   * The numbers a part's work lines are shown with, one slot per WORK line.
   *
   * Empty means "count me": the line takes its position, 1, 2, 3. A number that was
   * typed over that is kept as it was typed, and the lines after it go on counting from
   * where they sit — three lines numbered 1, 1, 3, and the next one added is 4
   * (owner, 2026-09-05).
   */
  function workNumberList(part, count) {
    var out = [];
    var raw = (part && part.lineNums) || null;
    var n = Math.max(0, count | 0);
    for (var i = 0; i < n; i++) out.push("");
    if (!raw || typeof raw !== "object") return out;
    for (var k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      var idx = parseInt(k, 10);
      if (!(idx >= 0) || idx >= n) continue;
      var val = parseInt(raw[k], 10);
      if (Number.isFinite(val) && val >= 0 && val <= 999) out[idx] = val;
    }
    return out;
  }

  /** What this line is numbered: what he typed, or simply where it sits. */
  function lineNumberAt(nums, li) {
    var given = nums && nums[li];
    var n = parseInt(given, 10);
    return Number.isFinite(n) ? n : li + 1;
  }

  /**
   * A part's colours as a plain array, one slot per WORK line.
   *
   * Stored as an object keyed by the line's position ({"0":"red"}) so a part with one
   * coloured line does not carry six empty slots around forever.
   */
  function workColourList(part, count) {
    var out = [];
    var raw = (part && part.lineColors) || null;
    var n = Math.max(0, count | 0);
    for (var i = 0; i < n; i++) out.push("");
    if (!raw || typeof raw !== "object") return out;
    for (var k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      var idx = parseInt(k, 10);
      if (!(idx >= 0) || idx >= n) continue;
      if (workLineColour(raw[k])) out[idx] = String(raw[k]);
    }
    return out;
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
      var classified = classify(part.lines, part.noteLines, part.formatLine) || { notes: [], format: "", work: [], trailingNotes: [] };
      html += '<div class="section">';
      html += '<div class="section-title-row">';
      html +=
        '<div class="section-title" dir="auto">' +
        esc(heading) +
        (modified ? '<span class="pprog-modified-flag">MODIFIED</span>' : "") +
        "</div>";
      html += "</div>";
      var ni;
      for (ni = 0; ni < (classified.notes || []).length; ni++) {
        html += '<div class="pprog-part-note" dir="auto">' + esc(classified.notes[ni]) + "</div>";
      }
      if (classified.format) {
        html += '<div class="pprog-part-format" dir="auto">' + esc(classified.format) + "</div>";
      }
      var work = classified.work || [];
      var trailing = classified.trailingNotes || [];
      if (!work.length && !(classified.notes || []).length && !classified.format && !trailing.length) {
        work = part.lines || [];
      }
      /* Numbering belongs to the PART: one part can be numbered and the next not
         (owner, 2026-09-05). Where it is on, the bullet steps aside for the circle. */
      var numbered = !!(part && part.numbered);
      var colours = workColourList(part, work.length);
      var nums = workNumberList(part, work.length);
      html += '<ul class="section-lines' + (numbered ? " pprog-numbered" : "") + '">';
      for (var li = 0; li < work.length; li++) {
        var hex = workLineColour(colours[li]);
        /* dir="auto" reads the FIRST STRONG letter of this line and nothing else: a
           line that starts in English is laid out exactly as it is today, and one that
           starts in Hebrew reads right-to-left — "יד קדמית 3X15". Per line, so a card
           can hold both (owner, 2026-09-05: English must not change). */
        html +=
          '<li dir="auto"' +
          (numbered ? ' class="pprog-li-numbered"' : "") +
          /* The circle takes the line's colour with it, because it is part of the same
             line — the colour is set here and the badge inherits it. */
          (hex ? ' style="color:' + esc(hex) + '"' : "") +
          ">" +
          (numbered
            ? '<span class="pprog-li-num" aria-hidden="true">' + lineNumberAt(nums, li) + "</span>"
            : "") +
          esc(work[li]) +
          "</li>";
      }
      html += "</ul>";
      for (var ti = 0; ti < trailing.length; ti++) {
        html += '<div class="pprog-part-note" dir="auto">' + esc(trailing[ti]) + "</div>";
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

  /**
   * The blocks a programme is made of, as {index, startWeek, weekCount}.
   *
   * A block is a month — four weeks — so eight weeks are two blocks, not one long stack
   * of rows. The caller may state the real boundaries (a block cut short, a programme
   * written before blocks existed); otherwise they are the natural fours, which is what
   * everything this product builds looks like.
   */
  function blockGroupsFor(declared, totalWeeks) {
    var total = parseInt(totalWeeks, 10) || 0;
    var out = [];
    var i;
    if (Array.isArray(declared) && declared.length) {
      for (i = 0; i < declared.length; i++) {
        var d = declared[i] || {};
        var sw = parseInt(d.startWeek, 10) || 0;
        var wc = parseInt(d.weekCount, 10) || 0;
        if (sw < 1 || wc < 1 || sw > total) continue;
        out.push({ index: out.length + 1, startWeek: sw, weekCount: Math.min(wc, total - sw + 1) });
      }
      /* A week nobody claims is exactly the week that would go missing. */
      var covered = out.length ? out[out.length - 1].startWeek - 1 + out[out.length - 1].weekCount : 0;
      while (covered < total) {
        var len = Math.min(4, total - covered);
        out.push({ index: out.length + 1, startWeek: covered + 1, weekCount: len });
        covered += len;
      }
      if (out.length) return out;
    }
    for (i = 0; i < total; i += 4) {
      out.push({ index: out.length + 1, startWeek: i + 1, weekCount: Math.min(4, total - i) });
    }
    return out;
  }

  /** Which block a 0-based week index falls in. */
  function groupOfWeek(groups, wi) {
    var w = (wi | 0) + 1;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (w >= g.startWeek && w < g.startWeek + g.weekCount) return g;
    }
    return groups.length ? groups[0] : null;
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
    /* How many days of the week this programme actually uses. Seven unless the caller
       sold a number of sessions instead of weekdays — see sessionColumns. */
    var cols = opts.sessionColumns > 0 ? Math.min(7, opts.sessionColumns | 0) : 7;
    var bySession = cols !== 7;
    /* "week" = the active week · "block" = the four weeks being written · "month" =
       the whole programme, block by block. */
    var calMode = opts.calMode || "week";
    var store = opts.store || null;
    var start = (block && block.blockStart) || sundayOfThisWeekIsrael();
    var spanLabel = blockSpanLabel(block) || "";
    var shiftFn = hook(opts, "shift", "pprogCalShift");
    var toggleFn = hook(opts, "toggleMode", "togglePprogCalMode");
    var todayFn = hook(opts, "jumpToday", "jumpPprogToToday");
    var viewFn = opts.hooks && opts.hooks.setView ? hook(opts, "setView", "") : "";
    var setDayFn = hook(opts, "setDay", "setPprogCalDay");
    var weekSelectFn = opts.hooks && opts.hooks.selectWeek ? hook(opts, "selectWeek", "") : "";
    var dowSelectFn = opts.hooks && opts.hooks.selectDow ? hook(opts, "selectDow", "") : "";
    var passCalEvent = !!opts.passCalEvent;
    var selectedDays = Array.isArray(opts.selectedDays) ? opts.selectedDays : [];
    var reviewDays = opts.reviewDays || null;
    var showDoneDots = !!opts.showDoneDots;
    var doneRead = opts.doneDebriefRead && typeof opts.doneDebriefRead === "object" ? opts.doneDebriefRead : {};
    /* Days a CLIENT changed and the owner has not opened yet, keyed "w<1-based>:<day>"
       exactly as lib/client-program-store.js stores them. State, not a counter: one dot
       per day however many times it was saved. Absent for athletes, who have no such
       concept — their equivalent is the done-debrief dot above. */
    var unreadDays = opts.unreadDays && typeof opts.unreadDays === "object" ? opts.unreadDays : null;

    /* A month is four weeks, so a programme of eight weeks is TWO blocks. The caller
       may state the real boundaries; otherwise they are the natural fours. */
    var totalWeeks =
      opts.weekRows > 0 ? (opts.weekRows | 0) : Math.max(5, (block.weeks && block.weeks.length) || 0);
    var groups = blockGroupsFor(opts.blockGroups, totalWeeks);
    var activeGroup = groupOfWeek(groups, activeWi);

    /** The dates one block covers, as "30 Aug – 26 Sep 2026". */
    function groupLabel(g) {
      var from = addDaysIso(start, (g.startWeek - 1) * 7);
      var to = addDaysIso(start, (g.startWeek - 1 + g.weekCount) * 7 - 1);
      var a = parseIso(from);
      var b = parseIso(to);
      return (
        MONTH_NAMES[a.getMonth()].slice(0, 3) + " " + a.getDate() +
        (a.getFullYear() === b.getFullYear() ? "" : " " + a.getFullYear()) +
        " – " +
        MONTH_NAMES[b.getMonth()].slice(0, 3) + " " + b.getDate() + " " + b.getFullYear()
      );
    }

    /* One language on this bar: the calendar is written in English like every other
       label the athlete and the client read (owner, 2026-09-02). */
    if (bySession) spanLabel = cols + " sessions a week";
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
      /* Three ways to read the same programme (owner, 2026-09-02). Rendered only where
         the page provides the hook, so a caller that has not adopted them keeps what it
         already had. */
      (viewFn
        ? '<button type="button" class="pprog-cal-view' + (calMode === "month" ? " on" : "") +
            '" onclick="' + viewFn + "('month')\" title=\"Every block, one under the other\">All blocks</button>" +
          '<button type="button" class="pprog-cal-view' + (calMode === "block" ? " on" : "") +
            '" onclick="' + viewFn + "('block')\" title=\"Only the block you are standing in\">This block</button>" +
          '<button type="button" class="pprog-cal-view' + (calMode === "week" ? " on" : "") +
            '" onclick="' + viewFn + "('week')\" title=\"Only this week\">This week</button>"
        : "") +
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
      else if (isSelectedCell(selectedDays, weekIndex0, dayKey)) cls += " selected";
      if (has) cls += " has-wod";
      if (logged) cls += " logged-extra";
      if (rest) cls += " muted";
      if (deload) cls += " deload-week";
      else if (ar) cls += " active-recovery";
      /* In a sessions programme the circle carries which session it is — the date it
         would otherwise show is meaningless when the client picks their own days. */
      var dateNum = bySession
        ? String(dayIndex + 1)
        : String(parseIso(iso).getDate());
      var doneDot = "";
      if (showDoneDots && dayHasFinishReport(dayData)) {
        var unread = !doneRead[iso];
        cls += unread ? " done-unread" : " done-read";
        doneDot = '<span class="pprog-done-dot" aria-hidden="true"></span>';
      }
      /* "I have not been over this yet" — the owner's own to-do list on a block he has
         just created. Deliberately NOT the unread dot: that one means somebody else
         changed something, and two meanings sharing one mark is how a mark stops
         meaning anything. This one outlines the day instead. */
      if (reviewDays && reviewDays["w" + (weekIndex0 + 1) + ":" + dayKey] !== undefined) {
        cls += " needs-review";
      }
      /* A client's unread change reuses the same dot channel, so the owner has one
         visual language for "something here needs your eyes". */
      if (unreadDays && unreadDays["w" + (weekIndex0 + 1) + ":" + dayKey] !== undefined) {
        cls += " done-unread client-changed";
        if (!doneDot) doneDot = '<span class="pprog-done-dot" aria-hidden="true"></span>';
      }
      var click =
        passCalEvent
          ? setDayFn + "(event," + weekIndex0 + ",'" + dayKey + "')"
          : setDayFn + "(" + weekIndex0 + ", '" + dayKey + "')";
      return (
        '<button type="button" class="' +
        cls +
        '" data-wi="' +
        weekIndex0 +
        '" data-day="' +
        dayKey +
        '" data-iso="' +
        iso +
        '" onclick="' +
        click +
        '">' +
        dateNum +
        doneDot +
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
        (weekIndex0 === activeWi && activeDay === "general" && !selectedDays.length ? " active" : "") +
        (loading ? " loading" : "") +
        (deload ? " deload-week" : "");
      var weekClick = weekSelectFn
        ? weekSelectFn + "(" + weekIndex0 + ")"
        : setDayFn + "(" + weekIndex0 + ", 'general')";
      return (
        '<button type="button" class="' +
        cls +
        /* A handle for the admin's right-click (copy week / paste week). Inert
           everywhere else — the client's page has no such menu. */
        '" data-week="' +
        (weekIndex0 + 1) +
        '" onclick="' +
        weekClick +
        '" title="Week ' +
        (weekIndex0 + 1) +
        (phase ? " · " + phase : "") +
        '">' +
        '<span class="pprog-cal-week-num">W' +
        (weekIndex0 + 1) +
        "</span>" +
        /* The phase word ("Build") sat under every single week and said nothing anyone
           could act on — the deload row is already tinted, and that is the only phase
           that changes what you write (owner, 2026-09-02). It survives in the tooltip. */
        "</button>"
      );
    }

    /* The grid reads its column count from here (styles/pprog-display.css). Seven for a
       week, N for a programme sold as N sessions — and the cells share the whole width
       either way (owner, 2026-09-02). */
    var colStyle = bySession ? ' style="--cal-cols:' + cols + '"' : "";

    function dowRowHtml() {
      var row = '<div class="pprog-cal-dow"' + colStyle + "><span></span>";
      var d;
      /* A session has no weekday, so its column is numbered rather than named. */
      if (bySession) {
        for (d = 0; d < cols; d++) row += "<span>" + (d + 1) + "</span>";
        return row + "</div>";
      }
      for (d = 0; d < 7; d++) {
        if (dowSelectFn) {
          row +=
            '<button type="button" class="pprog-cal-dow-btn" title="' +
            esc(DAY_LABELS[DAY_KEYS[d]] || DOW_LETTERS[d]) +
            '" onclick="' +
            dowSelectFn +
            "(" +
            d +
            ')">' +
            DOW_LETTERS[d] +
            "</button>";
        } else {
          row += "<span>" + DOW_LETTERS[d] + "</span>";
        }
      }
      row += "</div>";
      return row;
    }

    if (calMode === "month" || calMode === "block") {
      /* One block, or all of them. Either way a block is drawn AS a block: its own
         dates above it and air between it and the next. W4 and W5 are not neighbours —
         W5 is a new month, a new invoice, a new conversation (owner, 2026-09-02). */
      var shown = calMode === "block" && activeGroup ? [activeGroup] : groups;
      html += '<div class="pprog-cal-blocks">';
      for (var gi = 0; gi < shown.length; gi++) {
        var g = shown[gi];
        html +=
          '<div class="pprog-cal-block">' +
          '<div class="pprog-cal-block-title">Block ' + g.index + " · " + esc(groupLabel(g)) + "</div>" +
          dowRowHtml() +
          '<div class="pprog-cal-month-grid">';
        for (var wi = g.startWeek - 1; wi < g.startWeek - 1 + g.weekCount; wi++) {
          var rowDeload = deloadFn((block.weeks && block.weeks[wi]) || {}, wi, block);
          html += '<div class="pprog-cal-row' + (rowDeload ? " deload-week" : "") + '"' + colStyle + ">" + weekColBtn(wi);
          for (var di = 0; di < cols; di++) {
            html += cellHtml(wi, di, addDaysIso(start, wi * 7 + di));
          }
          html += "</div>";
        }
        html += "</div></div>";
      }
      html += "</div>";
      html +=
        '<div class="pprog-cal-block-hint">' +
        (bySession
          ? cols + " sessions a week · " + totalWeeks + " weeks · tap a session"
          : (calMode === "block" ? "One block · " : "Every block · ") +
            totalWeeks + " weeks in this programme · tap a date") +
        "</div>";
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
      html += dowRowHtml();
      html += '<div class="pprog-cal-row"' + colStyle + ">" + generalBtn(activeWi);
      for (var di2 = 0; di2 < cols; di2++) {
        html += cellHtml(activeWi, di2, addDaysIso(start, activeWi * 7 + di2));
      }
      html += "</div>";
      html +=
        '<div class="pprog-cal-block-hint">Tap month title for the full ' +
        ((block.weeks && block.weeks.length) || 5) + "-week brick</div>";
    }
    return html;
  }

  var PPROG_PENCIL_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 20h9"/>' +
    '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
    "</svg>";

  function draftFromDayData(dayData, restDay) {
    var parts = (dayData && dayData.parts) || [];
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i] || {};
      var blob = (String(p.title || "") + " " + (p.lines || []).join(" ")).toLowerCase();
      if (restDay && /^(rest(\s*day)?|off(\s*day)?)\b/.test(blob.trim())) continue;
      var c = classifyPartLines(p.lines, p.noteLines, p.formatLine) || { notes: [], format: "", work: [], trailingNotes: [] };
      var work = (c.work || []).slice();
      if (!work.length && !(c.notes || []).length && !c.format && !(c.trailingNotes || []).length) {
        work = (p.lines || []).slice();
      }
      if (!work.length) work = [""];
      out.push({
        id: p.id || "",
        title: formatPartHeading(i, p.title),
        notes: (c.notes || []).concat(c.trailingNotes || []),
        format: c.format || "",
        work: work,
        /* Carried through the edit and back out again, or a colour would be lost the
           first time the day was opened (owner, 2026-09-05). */
        colors: workColourList(p, work.length),
        nums: workNumberList(p, work.length),
        numbered: p.numbered === true,
      });
    }
    return out;
  }

  function nextPartLetter(n) {
    return String.fromCharCode(65 + Math.max(0, n | 0));
  }

  /**
   * The inverse of draftFromDayData: an edit draft back into stored day parts.
   *
   * It lives here, beside its inverse, because the round trip has to agree — a note,
   * the format line and the work lines flatten back into `lines` IN THAT ORDER, which
   * is the order classifyPartLines expects to read them in again. Splitting the two
   * halves across pages is how they drift.
   *
   * (admin.html still has its own adminDraftToParts saying the same thing. It is live
   * and untouched on purpose; folding it onto this one is a follow-up.)
   *
   * @param {{parts?:Array, day?:string}} draft
   * @returns {Array<{id:string,title:string,lines:string[]}>}
   */
  function partsFromDraft(draft) {
    var src = (draft && draft.parts) || [];
    var dayKey = (draft && draft.day) || "day";
    var out = [];
    for (var i = 0; i < src.length; i++) {
      var p = src[i] || {};
      var lines = [];
      var notes = p.notes || [];
      var j;
      for (j = 0; j < notes.length; j++) {
        var n = String(notes[j] == null ? "" : notes[j]).trim();
        if (n) lines.push(n);
      }
      var fmt = String(p.format == null ? "" : p.format).trim();
      if (fmt) lines.push(fmt);
      var work = p.work || [];
      /* An empty work line is dropped, so a colour is re-keyed to where its line
         actually ENDS UP — otherwise deleting line 1 would repaint line 2. */
      var draftColours = p.colors || [];
      var draftNums = p.nums || [];
      var lineColors = {};
      var lineNums = {};
      var keptWork = 0;
      for (j = 0; j < work.length; j++) {
        var w = String(work[j] == null ? "" : work[j]).trim();
        if (!w) continue;
        if (workLineColour(draftColours[j])) lineColors[keptWork] = String(draftColours[j]);
        /* Only a number he actually typed over the count is written down — a line that
           is simply the third line stores nothing. */
        var num = parseInt(draftNums[j], 10);
        if (Number.isFinite(num) && num >= 0 && num <= 999 && num !== keptWork + 1) {
          lineNums[keptWork] = num;
        }
        keptWork++;
        lines.push(w);
      }
      /* The shape of this part, written down rather than guessed later: how many of
         the lines above are notes, and whether the next one is the format line. See
         classifyPartLines (owner, 2026-09-05). */
      var noteCount = 0;
      for (j = 0; j < notes.length; j++) {
        if (String(notes[j] == null ? "" : notes[j]).trim()) noteCount++;
      }
      var formatCount = fmt ? 1 : 0;
      var entry = {
        id: String(p.id || dayKey + "-" + i),
        noteLines: noteCount,
        formatLine: formatCount,
        title: String(p.title == null ? "" : p.title).trim(),
        lines: lines,
      };
      /* Written down only when they were asked for: a part nobody coloured or numbered
         stores exactly what it stored before this existed. */
      if (p.numbered === true) entry.numbered = true;
      for (var ck in lineColors) {
        if (Object.prototype.hasOwnProperty.call(lineColors, ck)) {
          entry.lineColors = lineColors;
          break;
        }
      }
      for (var nk in lineNums) {
        if (Object.prototype.hasOwnProperty.call(lineNums, nk)) {
          entry.lineNums = lineNums;
          break;
        }
      }
      out.push(entry);
    }
    return out;
  }

  /** A part with a title but nothing under it is not a workout — drop it. */
  /**
   * Is there anything in this draft worth saving?
   *
   * It used to count only LINES, so a session whose title the coach had written —
   * "Part A11111", "Strength — heavy singles" — was reported back to him as "nothing
   * typed" and refused to save. He had typed; we were not looking there
   * (owner, 2026-09-02).
   *
   * A generated heading ("Part A", "Part B") is not content: it is what the card puts
   * there before anyone writes anything.
   */
  function draftHasContent(draft) {
    var parts = partsFromDraft(draft);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].lines.length) return true;
      var title = String((parts[i] && parts[i].title) || "").trim();
      if (title && !/^part\s+[a-z]$/i.test(title)) return true;
    }
    return false;
  }

  /**
   * The little box of colours a work line is painted from.
   *
   * Six colours and "no colour" — enough to mark a line without turning the card into a
   * rainbow. The chosen one is ringed, so the box also says what the line is now.
   */
  function colourPaletteHtml(setColourFn, pi, li, current) {
    var html = '<div class="pprog-colour-pop" hidden>';
    html +=
      '<button type="button" class="pprog-swatch pprog-swatch-none' +
      (workLineColour(current) ? "" : " is-on") +
      '" title="ללא צבע" aria-label="No colour" onclick="' +
      setColourFn +
      "(" + pi + "," + li + ",'')\"></button>";
    for (var c = 0; c < WORK_LINE_COLOURS.length; c++) {
      var col = WORK_LINE_COLOURS[c];
      html +=
        '<button type="button" class="pprog-swatch' +
        (current === col.key ? " is-on" : "") +
        '" style="background:' + col.hex + '" title="' + esc(col.label) + '" aria-label="' + esc(col.label) + '" onclick="' +
        setColourFn +
        "(" + pi + "," + li + ",'" + col.key + "')\"></button>";
    }
    return html + "</div>";
  }

  function renderAdminDayEditHtml(opts, restVisual) {
    opts = opts || {};
    var draft = opts.editDraft || { rest: !!restVisual, parts: [] };
    var parts = Array.isArray(draft.parts) ? draft.parts : [];
    var setFn = hook(opts, "editSet", "adminPprogEditSet");
    var addNoteFn = hook(opts, "editAddNote", "adminPprogEditAddNote");
    var addWorkFn = hook(opts, "editAddWork", "adminPprogEditAddWork");
    var addPartFn = hook(opts, "editAddPart", "adminPprogEditAddPart");
    var removeWorkFn = hook(opts, "editRemoveWork", "adminPprogEditRemoveWork");
    /* A note could be added and then never removed — the × existed for a work line and
       not for a note, so a note typed by mistake was permanent (owner, 2026-09-05). */
    var removeNoteFn = hook(opts, "editRemoveNote", "adminPprogEditRemoveNote");
    /* Two more the page owns: which colour a line is written in, and whether this part
       numbers its lines (owner, 2026-09-05). */
    var setColourFn = hook(opts, "editSetColour", "adminPprogEditSetColour");
    var setNumberFn = hook(opts, "editSetNumber", "adminPprogEditSetNumber");
    var numberFn = hook(opts, "editSetNumbering", "adminPprogEditSetNumbering");
    var canPaint = opts.allowLineColour === true;
    var cancelFn = hook(opts, "editCancel", "adminPprogEditCancel");
    var saveFn = hook(opts, "editSave", "adminPprogEditSave");
    var html = "";
    var pi;
    if (restVisual) {
      html +=
        '<div class="pprog-rest-day">' +
        '<div class="pprog-rest-day-title">REST DAY</div>' +
        '<img class="pprog-rest-day-img" src="assets/rest-day-duck.png" alt="Rest day" width="260" height="260" loading="lazy">' +
        "</div>";
    }
    for (pi = 0; pi < parts.length; pi++) {
      var part = parts[pi] || {};
      var notes = Array.isArray(part.notes) ? part.notes : [];
      var work = Array.isArray(part.work) ? part.work : [""];
      html += '<div class="section">';
      html += '<div class="section-title-row">';
      html +=
        '<input class="pprog-edit-title section-title" type="text" value="' +
        esc(part.title || "Part " + nextPartLetter(pi)) +
        '" aria-label="Part title" oninput="' +
        setFn +
        "(" +
        pi +
        ",'title',this.value)\">";
      /* "Add numbering", beside the part's own heading and only while the day is open
         for editing — it is a decision about this part, not about the day.
         Only where the page can store the answer: the older admin editor saves a day
         through a different path that knows nothing about colours, and a control that
         forgets what it was told is worse than no control (owner, 2026-09-05). */
      if (canPaint) html +=
        '<label class="pprog-num-toggle" title="מספור לשורות האימון של החלק הזה">' +
        '<input type="checkbox"' +
        (part.numbered === true ? " checked" : "") +
        ' onchange="' +
        numberFn +
        "(" +
        pi +
        ',this.checked)"><span>Add numbering</span></label>';
      html += "</div>";
      var ni;
      for (ni = 0; ni < notes.length; ni++) {
        html +=
          '<div class="pprog-edit-note-row"><input class="pprog-edit-note pprog-part-note" dir="auto" type="text" value="' +
          esc(notes[ni] || "") +
          '" placeholder="Duration / Intent" aria-label="Part note" oninput="' +
          setFn +
          "(" +
          pi +
          ",'note'," +
          ni +
          ',this.value)">' +
          '<button type="button" class="pprog-edit-del-line" onclick="' +
          removeNoteFn +
          "(" +
          pi +
          "," +
          ni +
          ')" title="Remove note" aria-label="Remove note">×</button></div>';
      }
      html +=
        '<input class="pprog-edit-format pprog-part-format" dir="auto" type="text" value="' +
        esc(part.format || "") +
        '" placeholder="Format (e.g. E2MOM 10 minutes)" aria-label="Part format" oninput="' +
        setFn +
        "(" +
        pi +
        ",'format',this.value)\">";
      var partColours = Array.isArray(part.colors) ? part.colors : [];
      var partNums = Array.isArray(part.nums) ? part.nums : [];
      html +=
        '<ul class="section-lines pprog-edit-lines' +
        (part.numbered === true ? " pprog-numbered" : "") +
        '">';
      var li;
      for (li = 0; li < work.length; li++) {
        var lineHex = workLineColour(partColours[li]);
        html +=
          '<li class="pprog-edit-work-row">' +
          /* The number is a field of its own: the count is only what it starts at, and
             he can write another number over it — digits only (owner, 2026-09-05).
             It does not redraw as he types, so the caret stays where he put it. */
          (part.numbered === true
            ? '<input type="text" class="pprog-li-num pprog-edit-num pprog-num-in" inputmode="numeric"' +
              ' maxlength="3" aria-label="Line number" value="' +
              esc(String(lineNumberAt(partNums, li))) +
              '"' +
              (lineHex ? ' style="color:' + esc(lineHex) + '"' : "") +
              ' oninput="' + setNumberFn + "(" + pi + "," + li + ',this)">'
            : "") +
          '<input type="text" dir="auto"' +
          /* He sees the colour on the line he is typing, not only after saving. */
          (lineHex ? ' style="color:' + esc(lineHex) + '"' : "") +
          ' value="' +
          esc(work[li] || "") +
          '" placeholder="Work line" aria-label="Work line" oninput="' +
          setFn +
          "(" +
          pi +
          ",'work'," +
          li +
          ',this.value)"' +
          /* Enter opens the next line right below this one and puts the caret in it —
             writing a session is a list, and reaching for the mouse between every line
             is the part that slows him down (owner, 2026-09-05). */
          ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();' +
          addWorkFn + "(" + pi + "," + (li + 1) + ');}">' +
          /* The pencil opens the palette that sits next to it. Opening and closing is
             the browser's own job — nothing to keep in the page's state. */
          (canPaint
            ? '<button type="button" class="pprog-colour-btn"' +
              (lineHex ? ' style="color:' + esc(lineHex) + '"' : "") +
              ' title="צבע לשורה" aria-label="Line colour"' +
              ' onclick="var p=this.nextElementSibling;p.hidden=!p.hidden;">' +
              '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>' +
              colourPaletteHtml(setColourFn, pi, li, partColours[li])
            : "") +
          '<button type="button" class="pprog-edit-del-line" onclick="' +
          removeWorkFn +
          "(" +
          pi +
          "," +
          li +
          ')" title="Remove line" aria-label="Remove work line">×</button></li>';
      }
      html += "</ul>";
      html +=
        '<div class="pprog-edit-chips">' +
        '<button type="button" class="pprog-edit-chip note" onclick="' +
        addNoteFn +
        "(" +
        pi +
        ')">＋ Note</button>' +
        '<button type="button" class="pprog-edit-chip work" onclick="' +
        addWorkFn +
        "(" +
        pi +
        ')">＋ Work line</button>' +
        "</div>";
      html += "</div>";
    }
    if (!restVisual) {
      html +=
        '<button type="button" class="pprog-edit-add-part" onclick="' +
        addPartFn +
        '()">＋ Add Part ' +
        nextPartLetter(parts.length) +
        "</button>";
      html +=
        '<div class="pprog-edit-hint">שם ברור (Strength / Metcon / Skill / Accessory). חלק בשם Warm-up / Mobility לא יופיע ב-Done.</div>';
    }
    html +=
      '<div class="pprog-edit-bar">' +
      '<button type="button" class="pprog-edit-cancel" onclick="' +
      cancelFn +
      '()">Cancel</button>' +
      '<button type="button" class="pprog-edit-save" onclick="' +
      saveFn +
      '()">Save</button>' +
      "</div>";
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
    /* A programme sold by the session has no weekdays, so its cards say "אימון 2"
       rather than a date that means nothing to anybody (owner, 2026-09-02). */
    var dateLabel = opts.dateLabelOverride
      ? String(opts.dateLabelOverride)
      : (DAY_LABELS[day] || day) +
        " · " +
        parseIso(dayIso).getDate() +
        " " +
        MONTH_NAMES[parseIso(dayIso).getMonth()];
    /* A day can be given a name of its own — "אימון תחנות" — and then that is the
       heading, with the day it actually is kept beside it in small type so nobody
       loses their place (owner, 2026-09-05). */
    var dayTitle = String((dayData && dayData.title) || "").trim();
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
    html += '<div class="pprog-day-card' +
      (opts.editing ? " is-editing" : "") +
      (opts.cardFocus ? " is-focus" : "") +
      '" dir="ltr" data-wi="' +
      (activeWi | 0) +
      '" data-day="' +
      day +
      '">';
    var focus = focusFn(week, day);
    var restDay = restFn(day, dayData, week);
    var loggedExtra = loggedFn(dayData);
    var allowEdit = opts.allowEdit === true;
    var editing = allowEdit && opts.editing === true;
    var editDraft = opts.editDraft || null;
    var restVisual =
      editing && editDraft
        ? !!editDraft.rest && !(editDraft.parts && editDraft.parts.length)
        : restDay;
    var finishReported = dayHasFinishReport(dayData);
    var finishFuture = todayIso ? isFutureTrainingDay(dayIso, todayIso) : false;
    var shareBtn = "";
    /* The athlete's page hides sharing behind "not editable", which is why the client's
       page — editable by design — had no share button and grew a "Print / share" button
       of its own at the bottom instead. showShare is an explicit opt-in rather than a
       widened condition, so no surface gains the button by accident. It still goes away
       while a day is actually being edited. */
    if (showActions && (opts.showShare === true ? !editing : !readOnly && !allowEdit)) {
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
      } else if (showActions && !readOnly && !allowEdit) {
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
    var finishLocked = finishReported || !!(dayData && dayData.finishFeedback);
    var pastDay = !!(todayIso && dayIso && String(dayIso) < String(todayIso));
    var hasDebrief = !!(dayData && String(dayData.debrief || "").trim());
    /* A rest day is a PLAN, not a fact, so it must be editable — the owner or the
     * client has to be able to delete it and put a session in its place. The old
     * `!restDay` here blocked the pencil on exactly the day people most often want
     * to change (21.7).
     *
     * The other four still block, and for a different reason: they are about a day
     * that has already HAPPENED — an extra session logged, a finish report filed, a
     * debrief written, or a date in the past. Editing those would rewrite history. */
    /* opts.allowPastEdit lifts only the date lock, and only where the calendar is a
       PLAN being written rather than a log of what happened: the owner starts a block
       mid-week and still has to fill its first days, and the owner decided a client
       edits without limit. The three "it already happened" locks stay in force. */
    var canEditDay =
      allowEdit &&
      !loggedExtra &&
      !finishLocked &&
      !hasDebrief &&
      (!pastDay || opts.allowPastEdit === true);
    var editBtn = "";
    if (allowEdit && (canEditDay || editing)) {
      var startEditFn = hook(opts, "startEdit", "adminPprogStartEdit");
      editBtn =
        '<button type="button" class="pprog-edit-btn' +
        (editing ? " is-editing" : "") +
        '" onclick="' +
        startEditFn +
        "(" +
        (activeWi | 0) +
        ",'" +
        day +
        '\')" aria-label="ערוך אימון" title="Edit workout">' +
        PPROG_PENCIL_SVG +
        "</button>";
    }
    /* While the day is open for editing, its heading becomes a field: type a name for
       it, or leave it and keep the automatic one. Only where the page allows it — the
       library does not decide who may rename a day (owner, 2026-09-05). */
    var titleEditor =
      editing && opts.allowTitleEdit === true
        ? '<input type="text" class="pprog-day-title-in" data-day-title="1" maxlength="80" dir="auto"' +
          ' placeholder="' + esc(opts.dayTitlePlaceholder || "כותרת לאימון") + '" value="' + esc(dayTitle) + '"' +
          ' aria-label="כותרת לאימון">'
        : "";
    /* The count and the order — "אימון 1 · שבוע 1" — beside the pencil, and beside the
       Editing flag once the day is open. It is a note, never the field: he typed into
       the heading and the label was sitting in it as a placeholder, which read as if it
       were the value (owner, 2026-09-05). */
    /* Always beside the pencil, named or not — he opened a day he had never touched and
       the note was not there at all (owner, 2026-09-05). Where there is no pencil (a
       read-only render) there is no note either: the label is the heading there, and
       one line should not be printed twice. */
    var whenNote = allowEdit
      ? '<span class="pprog-day-when" title="' + esc(dateLabel) + '">' + esc(dateLabel) + "</span>"
      : "";
    var editingPill = editing ? '<span class="pprog-editing-pill">Editing</span>' : "";
    /* A control that belongs to the day being edited — the owner asked for "make it a
       rest day" to sit beside the date rather than at the far bottom of the card. It is
       the page's HTML, not the library's, because the library must not decide who is
       allowed to delete a session. */
    var editHeaderAction = editing ? String(opts.editHeaderActionsHtml || "") : "";
    /* Day-level change flag. dayData.modified is set by lib/client-program-store.js when
       the CLIENT edits a day; modifiedPartKinds (rendered per part further down) is a
       different thing — which part an athlete changed. Both can be true at once.
       opts.dayModifiedLabel lets the page word it in its own language. */
    /* Who changed it depends on which side is looking: the owner watches
       dayData.modified (the client edited), the client watches dayData.coachModified
       (the owner rewrote the day). One flag, two directions — a page names the field
       it cares about rather than the library guessing. */
    var dayModified = !!(dayData && dayData[opts.dayModifiedField || "modified"]);
    var dayModifiedFlag = dayModified
      ? '<span class="pprog-modified-flag" title="' +
        esc(opts.dayModifiedTitle || "Changed by the client") +
        '">' +
        esc(opts.dayModifiedLabel || "MODIFIED") +
        "</span>"
      : "";
    /* A second flag, for a page that watches two different things about one day: the
       owner watches "the client changed this" AND "I have not written this yet". */
    var extraField = opts.extraDayFlagField || "";
    var extraFlag =
      extraField && dayData && dayData[extraField]
        ? '<span class="pprog-modified-flag needs-review-flag" title="' +
          esc(opts.extraDayFlagTitle || "") +
          '">' +
          esc(opts.extraDayFlagLabel || "TO REVIEW") +
          "</span>"
        : "";
    html +=
      '<div class="card-header">' +
      (allowEdit ? '<div class="pprog-day-head-main">' : "") +
      '<div class="source-name">' +
      /* A day he has not named keeps the automatic label as its heading — the note
         beside the pencil repeats it, it does not replace it (owner, 2026-09-05). */
      (titleEditor ? titleEditor : dayTitle ? esc(dayTitle) : esc(dateLabel)) +
      (loggedExtra
        ? '<span class="pprog-logged-extra-flag" title="Extra session logged — counted in the plan">LOGGED</span>'
        : "") +
      dayModifiedFlag +
      extraFlag +
      "</div>" +
      editBtn +
      /* Beside the pencil when the day is closed; the Editing flag goes in front of it
         when it is open, which is the order he asked for. */
      (editing ? "" : whenNote) +
      (opts.shareBesideDate === true ? shareBtn : "") +
      editingPill +
      (editing ? whenNote : "") +
      editHeaderAction +
      (allowEdit ? "</div>" : "") +
      '<div class="pprog-day-actions">' +
      finishBtn +
      (opts.shareBesideDate === true ? "" : shareBtn) +
      "</div>" +
      "</div>";
    if (editing) {
      html += renderAdminDayEditHtml(opts, restVisual);
      html += "</div>";
      return html;
    }
    var coachNotice = dayData && dayData.coachUpdatedNotice;
    if (!allowEdit && coachNotice) {
      html +=
        '<div class="pprog-coach-updated-banner" role="status">' +
        esc(coachNotice) +
        "</div>";
    }
    var editStatus = opts.adminEditStatus;
    if (
      editStatus &&
      editStatus.dayKey &&
      ((editStatus.weekIndex | 0) !== (activeWi | 0) || String(editStatus.dayKey) !== String(day))
    ) {
      editStatus = null;
    }
    if (allowEdit && editStatus && editStatus.message) {
      html +=
        '<div class="pprog-admin-edit-status' +
        (editStatus.status === "failed" ? " err" : " ok") +
        '" role="status">' +
        esc(editStatus.message) +
        "</div>";
    }
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
        /* The default wording belongs to the ATHLETE app, where a week really is being
           generated in the background. On a client program there is no generation at
           all — the owner writes it by hand — so saying "still being generated" is a
           plain lie to a paying client. opts.emptyDayHtml lets each page say the true
           thing for itself. */
        html +=
          opts.emptyDayHtml ||
          '<div class="pprog-day-stub"><strong>Session pending.</strong> Overview is ready; full parts are still being generated for this week.</div>';
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
    /* A brick used to be five weeks, always, so the ceiling was written as a number.
       A programme is months now — eight weeks is two blocks — and that number silently
       clamped week 6 to week 5 and dropped every selected day past it from the strip
       (owner, 2026-09-03). */
    var maxWi = Math.max(0, ((opts.weekRows > 0 ? opts.weekRows | 0 : (block.weeks || []).length) || 5) - 1);
    var wi = opts.activeWeekIndex | 0;
    if (wi < 0) wi = 0;
    if (wi > maxWi) wi = maxWi;
    var day = opts.activeDay || "sun";
    var week = block.weeks[wi] || {};
    var cal = renderCalHtml(block, wi, day, opts);
    var card = "";
    var selectedDays = Array.isArray(opts.selectedDays) ? sortSelectedDays(opts.selectedDays) : [];
    if (selectedDays.length >= 2) {
      var strip = [];
      var si;
      for (si = 0; si < selectedDays.length; si++) {
        var s = selectedDays[si];
        var swi = s.wi | 0;
        if (swi < 0 || swi > maxWi) continue;
        var sweek = block.weeks[swi] || {};
        var sday = String(s.day || "");
        if (DAY_KEYS.indexOf(sday) < 0) continue;
        var per = Object.assign({}, opts);
        var draft = opts.editDraft;
        var isThisEdit = !!(
          opts.editing &&
          draft &&
          (draft.wi | 0) === swi &&
          String(draft.day || "") === sday
        );
        per.editing = isThisEdit;
        per.editDraft = isThisEdit ? draft : null;
        per.cardFocus = (swi | 0) === (wi | 0) && sday === String(day || "");
        var st = opts.adminEditStatus;
        if (
          st &&
          ((st.weekIndex | 0) !== swi || String(st.dayKey || "") !== sday)
        ) {
          per.adminEditStatus = null;
        }
        strip.push(renderDayCardHtml(block, sweek, swi, sday, per));
      }
      card =
        (opts.widthStatusHtml || "") +
        '<div class="pprog-width-strip">' +
        strip.join("") +
        "</div>";
    } else if (day !== "general" && DAY_KEYS.indexOf(day) >= 0) {
      card = (opts.widthStatusHtml || "") + renderDayCardHtml(block, week, wi, day, opts);
    } else {
      card =
        (opts.widthStatusHtml || "") +
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

  /* The WhatsApp mark, and the text a shared day carries. Both were written for the
     athlete's app and both belong to every surface that shows a day — a second
     hand-cut icon or a second message format is how two products stop looking like
     one. index.html still holds its own copies; folding those in is its own step. */
  function waIconSvg() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M17.5 14.2c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4 0-.1-.2-.2-.5-.3z"/>' +
      '<path fill="currentColor" d="M12.04 2C6.5 2 2 6.48 2 12c0 1.77.46 3.43 1.27 4.87L2 22l5.27-1.38A9.93 9.93 0 0 0 12.04 22C17.56 22 22 17.52 22 12S17.56 2 12.04 2zm0 18.1c-1.63 0-3.15-.48-4.43-1.3l-.32-.19-3.13.82.84-3.05-.21-.33A8.07 8.07 0 0 1 3.9 12c0-4.47 3.65-8.1 8.14-8.1 4.48 0 8.13 3.63 8.13 8.1 0 4.47-3.65 8.1-8.13 8.1z"/>' +
      "</svg>"
    );
  }

  /**
   * One day as plain text, in the shape the athlete's app already sends: a heading,
   * the date, the day's focus, then each part with its notes, its format line and its
   * work bullets.
   */
  function dayShareText(block, weekIndex0, dayKey, opts) {
    var o = opts || {};
    var b = block || {};
    var week = (b.weeks || [])[weekIndex0 | 0];
    if (!week || !week.days) return "";
    var dayData = week.days[dayKey] || {};
    var parts = dayData.parts || [];
    var focus = overviewFocus(week, dayKey);
    var dayIso = addDaysIso(b.blockStart, (weekIndex0 | 0) * 7 + DAY_KEYS.indexOf(dayKey));
    var d = parseIso(dayIso);
    var dateLabel = (DAY_LABELS[dayKey] || dayKey) + " · " + d.getDate() + " " + MONTH_NAMES[d.getMonth()];
    var t = (o.title || "🦆 DUCK-WOD") + "\n" + dateLabel + "\n";
    if (focus && focus !== "—") t += focus + "\n";
    t += "\n";
    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi] || {};
      var c = classifyPartLines(part.lines, part.noteLines, part.formatLine) || { notes: [], format: "", work: [], trailingNotes: [] };
      t += (part.title || "Part " + String.fromCharCode(65 + pi)) + "\n";
      for (var ni = 0; ni < c.notes.length; ni++) t += c.notes[ni] + "\n";
      if (c.format) t += c.format + "\n";
      var work = c.work;
      var trailing = c.trailingNotes || [];
      if (!work.length && !c.notes.length && !c.format && !trailing.length) work = part.lines || [];
      for (var li = 0; li < work.length; li++) t += "• " + work[li] + "\n";
      for (var ti = 0; ti < trailing.length; ti++) t += trailing[ti] + "\n";
      t += "\n";
    }
    if (o.footer) t += o.footer;
    return t.trim();
  }

  return {
    DAY_KEYS: DAY_KEYS,
    DAY_LABELS: DAY_LABELS,
    esc: esc,
    waIconSvg: waIconSvg,
    dayShareText: dayShareText,
    /* Exported because a page holding a selection has to keep it in date order too —
       the owner picks Wednesday before Monday and still expects to read the week
       forwards (2026-09-01). */
    sortSelectedDays: sortSelectedDays,
    selId: selId,
    rangeBetween: rangeBetween,
    classifyPartLines: classifyPartLines,
    formatPartHeading: formatPartHeading,
    renderDayPartsHtml: renderDayPartsHtml,
    renderCalHtml: renderCalHtml,
    renderDayCardHtml: renderDayCardHtml,
    renderBrickView: renderBrickView,
    dayHasRealTrainingParts: dayHasRealTrainingParts,
    weekHasDetailedDays: weekHasDetailedDays,
    isDeloadWeek: isDeloadWeek,
    draftFromDayData: draftFromDayData,
    partsFromDraft: partsFromDraft,
    WORK_LINE_COLOURS: WORK_LINE_COLOURS,
    workLineColour: workLineColour,
    workColourList: workColourList,
    workNumberList: workNumberList,
    lineNumberAt: lineNumberAt,
    draftHasContent: draftHasContent,
    dayHasFinishReport: dayHasFinishReport,
  };
});
