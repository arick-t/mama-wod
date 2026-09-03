/**
 * The coach's book, drawn.
 *
 * Pure rendering: every function takes data and returns HTML, so the same code runs in
 * the admin page and in a test that reads the markup. No fetch, no document, no state —
 * the page owns all three.
 *
 * The month view is the only view. The owner was explicit: browsing back opens another
 * month, never a year or a week grid (owner, 2026-09-03).
 */
(function (root, factory) {
  const api = factory(
    typeof require === "function" ? require("./coach-ledger.js") : root.CoachLedger
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AdminLedgerView = api;
})(typeof self !== "undefined" ? self : this, function (Ledger) {
  "use strict";

  const MONTHS_HE = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];
  const DAYS_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** ₪ with agorot only when there are any — "₪250", not "₪250.00". */
  function shekel(n) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    const s = Math.abs(v % 1) < 0.005 ? String(Math.round(v)) : v.toFixed(2);
    return "₪" + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function monthLabel(monthKey) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ""));
    if (!m) return String(monthKey || "");
    return MONTHS_HE[Number(m[2]) - 1] + " " + m[1];
  }

  /**
   * The month, its total, and the way back.
   *
   * The total sits in the header because that is where he asked for it, and it is the
   * month's own sum — nothing carries over, so there is no balance to reset.
   */
  function headerHtml(monthKey, total) {
    return (
      '<div class="led-head">' +
      '<button type="button" class="led-nav" data-led-month="prev" title="חודש קודם">‹</button>' +
      '<div class="led-title"><span class="led-month">' + esc(monthLabel(monthKey)) + "</span>" +
      '<span class="led-total" title="סך כל השירותים בחודש זה">' + esc(shekel(total)) + "</span></div>" +
      '<button type="button" class="led-nav" data-led-month="next" title="חודש הבא">›</button>' +
      "</div>"
    );
  }

  /**
   * The squares.
   *
   * Every day is a button — the owner asked for "each day clickable" — and a day that
   * earned something says how much, so the month can be read without opening anything.
   */
  function calendarHtml(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const month = String(o.month || "");
    const totals = o.totalsByDay && typeof o.totalsByDay === "object" ? o.totalsByDay : {};
    const today = String(o.today || "");
    const selected = String(o.selected || "");
    const days = Ledger.daysInMonth(month);
    if (!days.length) return '<div class="led-cal"></div>';

    let html = '<div class="led-dow">' +
      DAYS_HE.map(function (d) {
        return "<span>" + esc(d) + "</span>";
      }).join("") +
      "</div>";
    html += '<div class="led-cal">';
    /* Blank squares so the first of the month lands on its own weekday. */
    const lead = Ledger.weekdayOf(days[0]);
    for (let i = 0; i < lead; i++) html += '<span class="led-day led-blank"></span>';
    days.forEach(function (iso) {
      const sum = Number(totals[iso]) || 0;
      const cls =
        "led-day" +
        (iso === today ? " is-today" : "") +
        (iso === selected ? " is-open" : "") +
        (sum > 0 ? " has-deals" : "");
      html +=
        '<button type="button" class="' + cls + '" data-led-day="' + esc(iso) + '">' +
        '<span class="led-num">' + esc(Number(iso.slice(8, 10))) + "</span>" +
        (sum > 0 ? '<span class="led-sum">' + esc(shekel(sum)) + "</span>" : "") +
        '<span class="led-plus" aria-hidden="true">+</span>' +
        "</button>";
    });
    html += "</div>";
    return html;
  }

  /** One deal, as it sits under an open day: what it was, and a way to fix it. */
  function dayDealsHtml(deals) {
    const rows = Array.isArray(deals) ? deals : [];
    if (!rows.length) return '<p class="led-empty">אין עסקאות ביום הזה.</p>';
    return (
      '<div class="led-day-rows">' +
      rows
        .map(function (d) {
          return (
            '<div class="led-row" data-led-deal="' + esc(d.id) + '">' +
            '<span class="led-cell led-name">' + esc(d.name) + "</span>" +
            '<span class="led-cell led-service">' + esc(d.service || "—") + "</span>" +
            '<span class="led-cell led-price">' + esc(shekel(d.price)) + "</span>" +
            '<button type="button" class="led-mini" data-led-edit="' + esc(d.id) + '" title="עריכה">✎</button>' +
            '<button type="button" class="led-mini led-danger" data-led-del="' + esc(d.id) + '" title="מחיקה">🗑</button>' +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  /**
   * The entry line: place, service, price.
   *
   * The place field is a button, not a text box, because the first thing it does is
   * offer the five he trained at last. Typing a new one happens inside that panel.
   */
  function editorHtml(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const deal = o.deal && typeof o.deal === "object" ? o.deal : null;
    const name = deal ? deal.name : String(o.name || "");
    const service = deal ? deal.service : String(o.service || "");
    const price = deal ? deal.price : o.price;
    const priceStr = Number(price) > 0 ? String(price) : "";
    return (
      '<div class="led-editor"' + (deal ? ' data-led-editing="' + esc(deal.id) + '"' : "") + ">" +
      '<button type="button" class="led-field led-pick" id="ledName" data-led-pick="1">' +
      (name ? esc(name) : '<span class="led-hint">שם המקום…</span>') +
      "</button>" +
      '<input class="led-field" id="ledService" maxlength="80" placeholder="שירות" value="' + esc(service) + '">' +
      '<input class="led-field led-num-field" id="ledPrice" type="number" min="1" max="100000" step="1" placeholder="מחיר" value="' + esc(priceStr) + '">' +
      '<button type="button" class="led-save" data-led-save="1">' + (deal ? "עדכן" : "הוסף") + "</button>" +
      '<button type="button" class="led-cancel" data-led-cancel="1">בטל</button>' +
      "</div>"
    );
  }

  /**
   * The five, and a way past them.
   *
   * A place picked here plants its service and its last price; a place typed here is
   * new, and is remembered from the moment the deal is saved.
   */
  function favouritesHtml(places) {
    const rows = Array.isArray(places) ? places : [];
    return (
      '<div class="led-pickpanel" id="ledPickPanel">' +
      (rows.length
        ? '<div class="led-fav-list">' +
          rows
            .map(function (p) {
              return (
                '<button type="button" class="led-fav" data-led-place="' + esc(p.name) + '">' +
                '<span class="led-fav-name">' + esc(p.name) + "</span>" +
                '<span class="led-fav-meta">' + esc(p.service || "—") + " · " + esc(shekel(p.price)) + "</span>" +
                "</button>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="led-empty">עוד לא אימנת בשום מקום — הקלד את הראשון.</p>') +
      '<div class="led-newplace">' +
      '<input id="ledNewPlace" class="led-field" maxlength="80" placeholder="מקום חדש…">' +
      '<button type="button" class="led-save" data-led-place-new="1">בחר</button>' +
      "</div>" +
      "</div>"
    );
  }

  /** The record, newest first, with the sum of whatever is being shown. */
  function tableHtml(rows, total) {
    const list = Array.isArray(rows) ? rows : [];
    let html =
      '<div class="led-table-head">' +
      '<span class="led-cell">שם</span><span class="led-cell">שירות</span>' +
      '<span class="led-cell">מחיר</span><span class="led-cell">תאריך</span>' +
      "</div>";
    if (!list.length) {
      html += '<p class="led-empty">אין עסקאות בטווח הזה.</p>';
      return html;
    }
    html +=
      '<div class="led-table">' +
      list
        .map(function (d) {
          return (
            '<div class="led-row" data-led-deal="' + esc(d.id) + '" data-led-month="' + esc(String(d.day).slice(0, 7)) + '">' +
            '<span class="led-cell led-name">' + esc(d.name) + "</span>" +
            '<span class="led-cell led-service">' + esc(d.service || "—") + "</span>" +
            '<span class="led-cell led-price">' + esc(shekel(d.price)) + "</span>" +
            '<span class="led-cell led-date">' + esc(hebDate(d.day)) + "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>";
    html += '<div class="led-table-total">סה״כ: <strong>' + esc(shekel(total)) + "</strong></div>";
    return html;
  }

  /**
   * Two incomes and their sum — the same three numbers wherever they are shown.
   *
   * They stay separate because they are two different businesses: what the programme
   * clients pay every month, and what he earned on the floor. The total exists because
   * he asked what he makes, and that is the answer (owner, 2026-09-03).
   *
   * Both are THIS month: the programme figure is a monthly rate, so it cannot be shown
   * against a month he is browsing back through without lying about history.
   *
   * @param {{programs?: number, personal?: number, compact?: boolean}} opts
   */
  function incomeBreakdownHtml(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const programs = Math.round((Number(o.programs) || 0) * 100) / 100;
    const personal = Math.round((Number(o.personal) || 0) * 100) / 100;
    const total = Math.round((programs + personal) * 100) / 100;
    if (o.compact) {
      /* One line, for the strip at the top of the page. */
      return (
        '<span class="inc-part">תוכניות: ' + esc(shekel(programs)) + "</span>" +
        '<span class="inc-sep">·</span>' +
        '<span class="inc-part">אישית: ' + esc(shekel(personal)) + "</span>" +
        '<span class="inc-sep">·</span>' +
        '<span class="inc-total">סה״כ: ' + esc(shekel(total)) + "</span>"
      );
    }
    return (
      '<div class="led-income">' +
      '<div class="led-inc"><span class="led-inc-label">הכנסה מתוכניות</span>' +
      '<span class="led-inc-val">' + esc(shekel(programs)) + "</span></div>" +
      '<div class="led-inc"><span class="led-inc-label">הכנסה אישית</span>' +
      '<span class="led-inc-val">' + esc(shekel(personal)) + "</span></div>" +
      '<div class="led-inc is-total"><span class="led-inc-label">סה״כ החודש</span>' +
      '<span class="led-inc-val">' + esc(shekel(total)) + "</span></div>" +
      "</div>"
    );
  }

  /** 03/09/2026 — the way he writes a date. */
  function hebDate(iso) {
    const s = String(iso || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);
  }

  return {
    MONTHS_HE: MONTHS_HE,
    DAYS_HE: DAYS_HE,
    esc: esc,
    shekel: shekel,
    monthLabel: monthLabel,
    incomeBreakdownHtml: incomeBreakdownHtml,
    headerHtml: headerHtml,
    calendarHtml: calendarHtml,
    dayDealsHtml: dayDealsHtml,
    editorHtml: editorHtml,
    favouritesHtml: favouritesHtml,
    tableHtml: tableHtml,
    hebDate: hebDate,
  };
});
