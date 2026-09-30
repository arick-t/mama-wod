/**
 * A brick, as a spreadsheet.
 *
 * The owner wanted his month in a Google Sheet, laid out the way he already reads it:
 * a date in a cell and the whole session in the cell beneath it, week above week
 * (owner, 2026-09-30). Not one row per exercise — that is a database, and he does not
 * read a month as a database.
 *
 * WHAT GOES IN IT is exactly what the CLIENT would see on opening his brick, in the
 * language it was written in. No hidden English, no admin fields, no ids. If it is not
 * on the client's screen it is not in the sheet.
 *
 * Pure: no DOM, no network, no clipboard. It turns a programme into a grid, and the
 * grid into the two things a spreadsheet understands — an HTML table (which is what
 * both Google Sheets and Excel paste from the clipboard, multi-line cells and all) and
 * a CSV file. The page does the pressing.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BrickExport = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function text(v) {
    return String(v === undefined || v === null ? "" : v).trim();
  }

  /** "2026-09-27" + n days, staying on plain dates — no clocks, no zones. */
  function addDays(iso, n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return "";
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    d.setUTCDate(d.getUTCDate() + (Number(n) || 0));
    return d.toISOString().slice(0, 10);
  }

  /** 27/09/26 — the way a date is written in Israel, and the way the book writes it. */
  function heDate(iso) {
    const v = String(iso || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
    return v.slice(8, 10) + "/" + v.slice(5, 7) + "/" + v.slice(2, 4);
  }

  /**
   * One day, as the client reads it.
   *
   * A part is its title and then its lines, and a blank line between parts — the same
   * shape as the card on his screen. A day with nothing in it comes back empty rather
   * than as a dash: an empty cell in a sheet already says "nothing here".
   */
  function dayText(day) {
    const parts = isPlainObject(day) && Array.isArray(day.parts) ? day.parts : [];
    const blocks = [];
    parts.forEach(function (part) {
      if (!isPlainObject(part)) return;
      const title = text(part.title);
      const lines = (Array.isArray(part.lines) ? part.lines : [])
        .map(text)
        .filter(Boolean);
      if (!title && !lines.length) return;
      blocks.push([title].concat(lines).filter(Boolean).join("\n"));
    });
    return blocks.join("\n\n");
  }

  /** Which weeks belong to the block he is looking at. */
  function weeksOfBlock(programme, blockIndex) {
    const weeks = Array.isArray(programme && programme.weeks) ? programme.weeks : [];
    const blocks = Array.isArray(programme && programme.blocks) ? programme.blocks : [];
    const wanted = Number(blockIndex);
    const block = blocks.filter(function (b) {
      return Number(b && b.blockIndex) === wanted;
    })[0] || blocks[0] || null;
    if (!block) return { from: 0, weeks: weeks, block: null };
    /* startWeek is 1-based in the programme; the array is not. */
    const from = Math.max(0, (Number(block.startWeek) || 1) - 1);
    const count = Math.max(1, Number(block.weekCount) || weeks.length - from);
    return { from: from, weeks: weeks.slice(from, from + count), block: block };
  }

  /** "אימון 2" or "שלישי" — what the column is called in each of the two shapes. */
  function columnLabels(programme) {
    const intake = isPlainObject(programme && programme.intake) ? programme.intake : {};
    const byCount = String(intake.scheduleMode || "") === "session_count";
    if (!byCount) return { byCount: false, labels: DAY_LABELS.slice(), keys: DAY_KEYS.slice() };
    const n = Math.max(1, Math.min(7, Number(intake.sessionsPerWeek) || 0));
    const labels = [];
    for (let i = 0; i < n; i += 1) labels.push("אימון " + (i + 1));
    return { byCount: true, labels: labels, keys: DAY_KEYS.slice(0, n) };
  }

  /**
   * The grid, week above week.
   *
   * Row shapes, in the order they come out:
   *   "title"  — the client's name and which block this is, once, at the top
   *   "week"   — the week's own line ("שבוע 2 — בנייה"), spanning the sheet
   *   "head"   — the dates, or "אימון 1 · אימון 2 …"
   *   "body"   — one cell per column, each holding a whole session
   *   "gap"    — a blank line between weeks, so the eye can find them
   */
  function grid(programme, blockIndex) {
    const p = isPlainObject(programme) ? programme : {};
    const picked = weeksOfBlock(p, blockIndex);
    const cols = columnLabels(p);
    const start = text(p.blockStart);
    const rows = [];
    const width = cols.labels.length;

    const blockName = picked.block && text(picked.block.name);
    rows.push({
      kind: "title",
      cells: [
        [text(p.clientName) || "לקוח", blockName || ("לבנה " + ((picked.block && picked.block.blockIndex) || 1))]
          .filter(Boolean)
          .join(" · "),
      ],
    });

    picked.weeks.forEach(function (week, i) {
      const weekNo = picked.from + i + 1;
      const line = text(week && week.summaryLine);
      rows.push({ kind: "week", cells: [line || "שבוע " + weekNo] });

      /* The heading of a week: real dates when the week has them, and the session's
         own name when the client is on "so many sessions a week" and days mean
         nothing to him (owner, 2026-09-30). */
      const head = cols.labels.map(function (label, ci) {
        if (cols.byCount) return label + " · שבוע " + weekNo;
        const iso = start ? addDays(start, (picked.from + i) * 7 + ci) : "";
        return iso ? heDate(iso) + " · " + label : label;
      });
      rows.push({ kind: "head", cells: head });

      const days = isPlainObject(week && week.days) ? week.days : {};
      rows.push({
        kind: "body",
        cells: cols.keys.map(function (key) {
          return dayText(days[key]);
        }),
      });
      rows.push({ kind: "gap", cells: [] });
    });

    return { rows: rows, width: width, columns: cols.labels.slice() };
  }

  function escHtml(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * The grid as a real table.
   *
   * This is what goes on the clipboard. Both Google Sheets and Excel read `text/html`
   * from the clipboard and build cells from it — which is the only way a session with
   * eight lines lands in ONE cell instead of spilling down eight rows.
   */
  function html(g) {
    const rows = (g && g.rows) || [];
    const width = Math.max(1, (g && g.width) || 1);
    let out = '<table dir="rtl">';
    rows.forEach(function (row) {
      if (row.kind === "gap") {
        out += "<tr><td colspan=\"" + width + "\"></td></tr>";
        return;
      }
      if (row.kind === "title" || row.kind === "week") {
        out +=
          '<tr><td colspan="' + width + '" style="font-weight:bold">' +
          escHtml(row.cells[0] || "") + "</td></tr>";
        return;
      }
      const bold = row.kind === "head" ? ' style="font-weight:bold"' : ' style="vertical-align:top"';
      out += "<tr>";
      for (let i = 0; i < width; i += 1) {
        const cell = row.cells[i] === undefined ? "" : String(row.cells[i]);
        out += "<td" + bold + ">" + escHtml(cell).replace(/\n/g, "<br>") + "</td>";
      }
      out += "</tr>";
    });
    return out + "</table>";
  }

  function csvCell(v) {
    const s = String(v === undefined || v === null ? "" : v);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  /**
   * The grid as a CSV file.
   *
   * A cell holding several lines is quoted, which is how both Excel and Sheets keep it
   * as one cell. The byte order mark at the front is what stops Excel opening Hebrew
   * as mojibake — Sheets does not need it and does not mind it.
   */
  function csv(g, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const rows = (g && g.rows) || [];
    const width = Math.max(1, (g && g.width) || 1);
    const lines = rows.map(function (row) {
      const cells = [];
      for (let i = 0; i < width; i += 1) {
        cells.push(csvCell(row.cells[i] === undefined ? "" : row.cells[i]));
      }
      return cells.join(",");
    });
    const body = lines.join("\r\n");
    return o.bom === false ? body : "﻿" + body;
  }

  /** "עודד מכינה · לבנה 1.csv" — a name he will recognise in a downloads folder. */
  function fileName(programme, blockIndex) {
    const name = text(programme && programme.clientName) || "לקוח";
    const n = Number(blockIndex) || 1;
    return (name + " · לבנה " + n + ".csv").replace(/[\\/:*?"<>|]/g, "-");
  }

  return {
    grid: grid,
    html: html,
    csv: csv,
    dayText: dayText,
    heDate: heDate,
    addDays: addDays,
    fileName: fileName,
    columnLabels: columnLabels,
    weeksOfBlock: weeksOfBlock,
  };
});
