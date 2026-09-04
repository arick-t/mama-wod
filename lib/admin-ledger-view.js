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
  /* The record's columns, in the order they are shown. Each one is a button: it sorts
     by the direction that column naturally reads, and again turns it round. */
  const COLUMNS = [
    { key: "name", label: "שם" },
    { key: "service", label: "שירות" },
    { key: "price", label: "מחיר" },
    { key: "day", label: "תאריך" },
    { key: "invoiced", label: "חשבונית" },
  ];

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
    /* What a closed square says: WHO he trained, in the order he entered them — not
       what he earned. The money is in the header and in the table; a square is for
       reading the month (owner, 2026-09-04). */
    const byDay = o.dealsByDay && typeof o.dealsByDay === "object" ? o.dealsByDay : {};
    const colours = o.colours && typeof o.colours === "object" ? o.colours : {};
    const LINES = 2;
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
      const rows = Array.isArray(byDay[iso]) ? byDay[iso] : [];
      const cls =
        "led-day" +
        (iso === today ? " is-today" : "") +
        (iso === selected ? " is-open" : "") +
        (rows.length || sum > 0 ? " has-deals" : "");
      const lines = rows.slice(0, LINES).map(function (d) {
        const hex = String(colours[d.name] || "");
        /* The WHOLE line in his colour, not a dot beside it — he asked for the text
           itself (owner, 2026-09-04). */
        const style = /^#[0-9a-f]{6}$/i.test(hex) ? ' style="color:' + hex + '"' : "";
        /* Place and service together: "מ1 - אימון קבוצתי" is what makes a square
           readable without opening it. */
        const label = d.service ? d.name + " - " + d.service : d.name;
        return '<span class="led-line"' + style + ">" + esc(label) + "</span>";
      });
      /* More than fits: he asked for the ellipsis, so he knows to open the day. */
      if (rows.length > LINES) lines.push('<span class="led-more">…</span>');
      html +=
        '<button type="button" class="' + cls + '" data-led-day="' + esc(iso) + '">' +
        '<span class="led-num">' + esc(Number(iso.slice(8, 10))) + "</span>" +
        lines.join("") +
        "</button>";
    });
    html += "</div>";
    return html;
  }

  /** His colour for a place, as an inline style on a row. Validated, never trusted. */
  function colourStyle(colours, name) {
    const map = colours && typeof colours === "object" ? colours : {};
    const hex = String(map[String(name)] || "");
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "";
    return ' style="border-inline-start:3px solid ' + hex + '"';
  }

  /** One deal, as it sits under an open day: what it was, and a way to fix it. */
  function dayDealsHtml(deals, colours) {
    const rows = Array.isArray(deals) ? deals : [];
    if (!rows.length) return '<p class="led-empty">אין עסקאות ביום הזה.</p>';
    return (
      '<div class="led-day-rows">' +
      rows
        .map(function (d) {
          return (
            '<div class="led-row" data-led-deal="' + esc(d.id) + '"' + colourStyle(colours, d.name) + ">" +
            '<span class="led-cell led-name">' + esc(d.name) + "</span>" +
            '<span class="led-cell led-service">' + esc(d.service || "—") + "</span>" +
            '<span class="led-cell led-price">' + esc(shekel(d.price)) + "</span>" +
            /* One group, one row: three separate grid cells wrapped, and the delete
               dropped to a line of its own — which read as a second session
               (owner, 2026-09-04). */
            '<span class="led-rowacts">' +
            '<button type="button" class="led-mini" data-led-edit="' + esc(d.id) + '" title="עריכה">✎</button>' +
            /* The same session again — usually on another day, which is why the copy
               opens with a date field (owner, 2026-09-04). */
            '<button type="button" class="led-mini" data-led-copy="' + esc(d.id) + '" title="הכפל">⧉</button>' +
            '<button type="button" class="led-mini led-danger" data-led-del="' + esc(d.id) + '" title="מחיקה">🗑</button>' +
            "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  /**
   * The day, opened.
   *
   * Clicking a square opens what is written on that day. A new line is added with the
   * plus in the corner and not before: the entry row standing open under every day was
   * asking a question he had not asked (owner, 2026-09-03).
   *
   * @param {{day: string, deals: object[], editorHtml?: string}} opts
   */
  function dayPanelHtml(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const deals = Array.isArray(o.deals) ? o.deals : [];
    const editor = String(o.editorHtml || "");
    return (
      '<div class="led-daybox led-pop">' +
      '<button type="button" class="led-popclose" data-led-dayclose="1" aria-label="סגור">×</button>' +
      '<div class="led-daybox-head"><h3>' + esc(hebDate(o.day)) + "</h3>" +
      '<span class="led-daysum">' + esc(shekel(deals.reduce(function (s, d) { return s + (Number(d.price) || 0); }, 0))) + "</span>" +
      "</div>" +
      dayDealsHtml(deals, o.colours) +
      editor +
      (editor
        ? ""
        : '<div class="led-daybox-foot">' +
          '<button type="button" class="led-add" data-led-add="1" title="עסקה חדשה" aria-label="עסקה חדשה">+</button>' +
          "</div>") +
      "</div>"
    );
  }

  /* The services he gives. A fixed short list, and a way out of it — he does not want
     to retype "אימון קבוצתי" forty times, and he does not want a dropdown that cannot
     say what he actually did (owner, 2026-09-04). */
  const SERVICES = ["אימון אישי", "אימון קבוצתי"];
  const SERVICE_OTHER = "אחר";

  /** The saved places, offered as the browser's own autocomplete under the name field. */
  function placeListHtml(names) {
    const list = Array.isArray(names) ? names : [];
    return (
      '<datalist id="ledPlaceList">' +
      list
        .map(function (n) {
          return '<option value="' + esc(n) + '"></option>';
        })
        .join("") +
      "</datalist>"
    );
  }

  /**
   * The service field: two known ones, and a free line behind "other".
   *
   * A service that is neither opens as "other" with what it actually says, so editing
   * an old row never quietly rewrites it.
   */
  function serviceFieldHtml(ids, value) {
    const v = String(value || "");
    const known = SERVICES.indexOf(v) >= 0;
    const isOther = !!v && !known;
    return (
      '<select class="led-field" id="' + esc(ids.select) + '" data-led-service="1">' +
      '<option value=""' + (v ? "" : " selected") + ">שירות…</option>" +
      SERVICES.map(function (o) {
        return '<option value="' + esc(o) + '"' + (v === o ? " selected" : "") + ">" + esc(o) + "</option>";
      }).join("") +
      '<option value="' + esc(SERVICE_OTHER) + '"' + (isOther ? " selected" : "") + ">" + esc(SERVICE_OTHER) + "</option>" +
      "</select>" +
      '<input class="led-field led-other" id="' + esc(ids.other) + '" maxlength="80" placeholder="איזה שירות?" value="' +
      esc(isOther ? v : "") + '"' + (isOther ? "" : " hidden") + ">"
    );
  }

  /**
   * The entry line: place, service, price.
   *
   * The place is TYPED, with the saved places offered as autocomplete — pressing the
   * plus should put the cursor in a field, not open another panel with another button
   * in it (owner, 2026-09-04). A name that matches a saved place fills the other two; a
   * new one is simply typed, and is remembered once the deal is saved.
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
      '<input class="led-field" id="ledName" list="ledPlaceList" maxlength="80" autocomplete="off"' +
      ' placeholder="שם המקום…" value="' + esc(name) + '" data-led-name="1">' +
      serviceFieldHtml({ select: "ledService", other: "ledServiceOther" }, service) +
      /* A price is a number, and on a phone that means the number pad. */
      '<input class="led-field led-num-field" id="ledPrice" type="number" inputmode="numeric" pattern="[0-9]*"' +
      ' min="1" max="100000" step="1" placeholder="מחיר" value="' + esc(priceStr) + '">' +
      /* A copy lands wherever he says — the day it came from is only the default. */
      (o.date
        ? '<input class="led-field" id="ledDate" type="date" value="' + esc(o.date) + '" title="תאריך">'
        : "") +
      '<button type="button" class="led-save" data-led-save="1">' +
      (deal ? "עדכן" : o.date ? "הכפל" : "הוסף") +
      "</button>" +
      '<button type="button" class="led-cancel" data-led-cancel="1">בטל</button>' +
      "</div>"
    );
  }

  /**
   * "Add a session" — the same fields, plus the day they belong to.
   *
   * The calendar is for the day he is looking at; this is for the one he is thinking
   * about. A row added here lands on its own square (owner, 2026-09-03).
   */
  function manualFormHtml(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const priceStr = Number(o.price) > 0 ? String(o.price) : "";
    return (
      '<div class="led-manual">' +
      '<input class="led-field" id="ledMName" list="ledPlaceList" maxlength="80" autocomplete="off"' +
      ' placeholder="שם המקום…" value="' + esc(o.name || "") + '" data-led-name="1">' +
      serviceFieldHtml({ select: "ledMService", other: "ledMServiceOther" }, o.service) +
      '<input class="led-field led-num-field" id="ledMPrice" type="number" inputmode="numeric" pattern="[0-9]*"' +
      ' min="1" max="100000" step="1" placeholder="מחיר" value="' + esc(priceStr) + '">' +
      '<input class="led-field" id="ledMDate" type="date" value="' + esc(o.date || "") + '" title="תאריך">' +
      '<button type="button" class="led-save" data-led-manual-save="1">הוסף</button>' +
      "</div>"
    );
  }

  /** The record, newest first, with the sum of whatever is being shown. */
  function tableHtml(rows, total, colours, sort) {
    const list = Array.isArray(rows) ? rows : [];
    const by = (sort && sort.by) || "day";
    const dir = sort && Number(sort.dir) === -1 ? -1 : 1;
    let html =
      '<div class="led-table-head">' +
      COLUMNS.map(function (c) {
        const on = c.key === by;
        return (
          '<button type="button" class="led-th' + (on ? " on" : "") +
          '" data-led-sort="' + esc(c.key) + '">' + esc(c.label) +
          (on ? '<span class="led-arrow">' + (dir === 1 ? "▾" : "▴") + "</span>" : "") +
          "</button>"
        );
      }).join("") +
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
            '<div class="led-row" data-led-deal="' + esc(d.id) + '" data-led-month="' +
            esc(String(d.day).slice(0, 7)) + '"' + colourStyle(colours, d.name) + ">" +
            '<span class="led-cell led-name">' + esc(d.name) + "</span>" +
            '<span class="led-cell led-service">' + esc(d.service || "—") + "</span>" +
            '<span class="led-cell led-price">' + esc(shekel(d.price)) + "</span>" +
            '<span class="led-cell led-date">' + esc(hebDate(d.day)) + "</span>" +
            '<span class="led-cell led-inv">' +
            '<input type="checkbox" data-led-invoiced="' + esc(d.id) + '" data-led-month="' +
            esc(String(d.day).slice(0, 7)) + '"' + (d.invoiced ? " checked" : "") +
            ' aria-label="הופקה חשבונית"></span>' +
            "</div>"
          );
        })
        .join("") +
      "</div>";
    html += '<div class="led-table-total">סה״כ: <strong>' + esc(shekel(total)) + "</strong></div>";
    return html;
  }

  /**
   * The filter bar: three ranges, one he sets himself, and two lists.
   *
   * Choosing anything filters at once — the owner removed the "filter" button, and he
   * is right: a button that repeats what the field already said is a second click for
   * one intent (owner, 2026-09-04).
   */
  function filtersHtml(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const range = String(o.range || "month");
    const names = Array.isArray(o.names) ? o.names : [];
    const services = Array.isArray(o.services) ? o.services : [];
    const chip = function (key, label) {
      return (
        '<button type="button" class="led-chip' + (range === key ? " on" : "") +
        '" data-led-range="' + esc(key) + '">' + esc(label) + "</button>"
      );
    };
    return (
      chip("week", "השבוע") +
      chip("month", "החודש") +
      chip("year", "השנה") +
      chip("custom", "טווח תאריכים") +
      '<select class="led-field" id="ledFName" data-led-filter="name">' +
      '<option value="">כל המקומות</option>' +
      names
        .map(function (n) {
          return '<option value="' + esc(n) + '"' + (o.name === n ? " selected" : "") + ">" + esc(n) + "</option>";
        })
        .join("") +
      "</select>" +
      '<select class="led-field" id="ledFService" data-led-filter="service">' +
      '<option value="">כל השירותים</option>' +
      services
        .map(function (n) {
          return '<option value="' + esc(n) + '"' + (o.service === n ? " selected" : "") + ">" + esc(n) + "</option>";
        })
        .join("") +
      "</select>" +
      /* The two dates appear only behind their own button. */
      '<span class="led-dates"' + (range === "custom" ? "" : " hidden") + ">" +
      '<input class="led-field" id="ledFFrom" type="date" value="' + esc(o.from || "") + '" title="מתאריך">' +
      '<input class="led-field" id="ledFTo" type="date" value="' + esc(o.to || "") + '" title="עד תאריך">' +
      "</span>" +
      '<button type="button" class="led-chip" data-led-clear="1">נקה</button>'
    );
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

  /**
   * "Favourites" — everyone he works for, busiest first.
   *
   * Folded away by default: it is a reference, not a working surface. The pencil is the
   * only thing in it that does anything — a name he can correct, and a colour that then
   * marks every row that place appears in (owner, 2026-09-03).
   *
   * @param {{places: object[], open?: boolean, editing?: string, colours?: string[]}} opts
   */
  function favouritesBoxHtml(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const places = Array.isArray(o.places) ? o.places : [];
    const swatches = Array.isArray(o.colours) && o.colours.length ? o.colours : DEFAULT_COLOURS;
    let html =
      '<button type="button" class="led-fold" data-led-fav-toggle="1" aria-expanded="' +
      (o.open ? "true" : "false") +
      '"><span class="led-fold-caret">' + (o.open ? "▾" : "▸") + "</span>" +
      '<span>מועדפים</span><span class="led-fold-count">' + esc(places.length) + "</span></button>";
    if (!o.open) return html;
    if (!places.length) {
      html += '<p class="led-empty">עוד לא נתת שירות לאף אחד.</p>';
      return html;
    }
    html +=
      '<div class="led-fav-rows">' +
      places
        .map(function (p) {
          const editing = o.editing && placeSame(o.editing, p.name);
          if (editing) {
            return (
              '<div class="led-fav-row is-editing" data-led-fav="' + esc(p.name) + '">' +
              '<input class="led-field" id="ledFavName" maxlength="80" value="' + esc(p.name) + '">' +
              '<div class="led-swatches">' +
              swatches
                .map(function (c) {
                  return (
                    '<button type="button" class="led-swatch' + (p.colour === c ? " on" : "") +
                    '" data-led-fav-colour="' + esc(c) + '" style="background:' + esc(c) + '" aria-label="' + esc(c) + '"></button>'
                  );
                })
                .join("") +
              '<button type="button" class="led-swatch led-swatch-none' + (p.colour ? "" : " on") +
              '" data-led-fav-colour="" title="ללא צבע">∅</button>' +
              "</div>" +
              '<button type="button" class="led-save" data-led-fav-save="1">שמור</button>' +
              '<button type="button" class="led-cancel" data-led-fav-cancel="1">בטל</button>' +
              "</div>"
            );
          }
          return (
            '<div class="led-fav-row" data-led-fav="' + esc(p.name) + '"' + colourStyle({ x: p.colour }, "x") + ">" +
            '<span class="led-fav-name">' + esc(p.name) + "</span>" +
            '<span class="led-fav-uses">' + esc(p.uses) + " פעמים</span>" +
            '<span class="led-fav-meta">' + esc(p.service || "—") + " · " + esc(shekel(p.price)) + "</span>" +
            '<button type="button" class="led-mini" data-led-fav-edit="' + esc(p.name) + '" title="שם וצבע">✎</button>' +
            "</div>"
          );
        })
        .join("") +
      "</div>";
    return html;
  }

  function placeSame(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  }

  /* The palette the rest of the module already uses for clients. */
  const DEFAULT_COLOURS = ["#E8451A", "#F5C518", "#4CAF70", "#1A9B8A", "#7eb8c9", "#9b6bb8", "#d47ba8", "#b0aaa0"];

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
    dayPanelHtml: dayPanelHtml,
    editorHtml: editorHtml,
    manualFormHtml: manualFormHtml,
    placeListHtml: placeListHtml,
    serviceFieldHtml: serviceFieldHtml,
    SERVICES: SERVICES,
    SERVICE_OTHER: SERVICE_OTHER,
    favouritesBoxHtml: favouritesBoxHtml,
    colourStyle: colourStyle,
    DEFAULT_COLOURS: DEFAULT_COLOURS,
    tableHtml: tableHtml,
    filtersHtml: filtersHtml,
    COLUMNS: COLUMNS,
    hebDate: hebDate,
  };
});
