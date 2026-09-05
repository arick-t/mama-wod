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
            /* The same colour the service wears in the record: one service, one colour,
               wherever it is written (owner, 2026-09-04). */
            '<span class="led-cell led-service" style="color:' + serviceColour(d.service) + '">' +
            esc(d.service || "—") + "</span>" +
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

  /**
   * A colour per service, so the column can be read without reading it.
   *
   * Personal is pale blue, group is purple, anything he typed himself is orange, and
   * "mixed" — a place with more than one — is white, like "all services"
   * (owner, 2026-09-04).
   */
  const SERVICE_COLOURS = {
    personal: "#7DD3F0",
    group: "#B57BE8",
    other: "#F0913E",
    neutral: "#E8E4D8",
  };

  function serviceColour(service) {
    const v = String(service || "").trim();
    if (!v) return SERVICE_COLOURS.neutral;
    if (v === SERVICES[0]) return SERVICE_COLOURS.personal;
    if (v === SERVICES[1]) return SERVICE_COLOURS.group;
    return SERVICE_COLOURS.other;
  }

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
      (o.date ? dateFieldHtml("ledDate", o.date, "תאריך") : "") +
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
      dateFieldHtml("ledMDate", o.date || "", "תאריך") +
      '<button type="button" class="led-save" data-led-manual-save="1">הוסף</button>' +
      "</div>"
    );
  }

  /** The record, newest first, with the sum of whatever is being shown. */
  function tableHtml(rows, total, colours, sort, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const list = Array.isArray(rows) ? rows : [];
    const grouped = o.grouped === true;
    const by = (sort && sort.by) || (grouped ? "price" : "day");
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
          if (!grouped) return dealRowHtml(d, colours);
          const row = groupRowHtml(d, colours, o);
          if (!o.expanded || o.expanded !== d.name) return row;
          /* Opened: this place's own sessions, and what they came to. */
          const kids = (Array.isArray(o.expandedRows) ? o.expandedRows : []).filter(function (x) {
            return x.name === d.name;
          });
          if (!kids.length) {
            return row + '<div class="led-sub-empty">אין אימונים להציג.</div>';
          }
          /* No sum under the sessions: the place's own line above them already carries
             it, and saying it twice is noise (owner, 2026-09-04). */
          return (
            row +
            '<div class="led-sub">' +
            kids
              .map(function (x) {
                return dealRowHtml(x, colours);
              })
              .join("") +
            "</div>"
          );
        })
        .join("") +
      "</div>";
    html += '<div class="led-table-total">סה״כ: <strong>' + esc(shekel(total)) + "</strong></div>";
    return html;
  }

  /** One session. */
  function dealRowHtml(d, colours) {
    return (
      '<div class="led-row" data-led-deal="' + esc(d.id) + '" data-led-month="' +
      esc(String(d.day).slice(0, 7)) + '"' + colourStyle(colours, d.name) + ">" +
      '<span class="led-cell led-name">' + esc(d.name) + "</span>" +
      '<span class="led-cell led-service" style="color:' + serviceColour(d.service) + '">' +
      esc(d.service || "—") + "</span>" +
      '<span class="led-cell led-price">' + esc(shekel(d.price)) + "</span>" +
      '<span class="led-cell led-date">' + esc(hebDate(d.day)) + "</span>" +
      '<span class="led-cell led-inv">' +
      '<input type="checkbox" data-led-invoiced="' + esc(d.id) + '" data-led-month="' +
      esc(String(d.day).slice(0, 7)) + '"' + (d.invoiced ? " checked" : "") +
      ' aria-label="הופקה חשבונית"></span>' +
      "</div>"
    );
  }

  /**
   * One place: how many, how much, what for, over which range.
   *
   * The tick covers every session at that place in the range — and it is only ticked
   * when every one of them is, because a place with one session left unbilled is not
   * invoiced (owner, 2026-09-04).
   */
  function groupRowHtml(g, colours, o) {
    return (
      '<div class="led-row is-group" data-led-group="' + esc(g.name) + '"' +
      colourStyle(colours, g.name) + ">" +
      '<span class="led-cell led-name">' +
      /* The chevron opens THIS place under its own line — the same detail as "full
         detail", for one place, without leaving the grouped answer
         (owner, 2026-09-04). */
      '<button type="button" class="led-expand" data-led-expand="' + esc(g.name) + '" ' +
      'aria-expanded="' + (o && o.expanded === g.name ? "true" : "false") + '">' +
      (o && o.expanded === g.name ? "▾" : "◂") + "</button>" +
      esc(g.name) +
      ' <span class="led-count">(' + esc(g.count) + ")</span></span>" +
      '<span class="led-cell led-service' + (g.mixed ? " is-mixed" : "") +
      '" style="color:' + (g.mixed ? SERVICE_COLOURS.neutral : serviceColour(g.service)) + '">' +
      esc(g.mixed ? "מגוון" : g.service || "—") + "</span>" +
      '<span class="led-cell led-price">' + esc(shekel(g.total)) + "</span>" +
      '<span class="led-cell led-date">' + esc((o && o.rangeLabel) || "") + "</span>" +
      '<span class="led-cell led-inv">' +
      '<input type="checkbox" data-led-invoice-place="' + esc(g.name) + '"' +
      (g.invoiced ? " checked" : "") + ' aria-label="הופקה חשבונית לכל האימונים במקום הזה">' +
      "</span>" +
      "</div>"
    );
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
      '<select class="led-field" id="ledFService" data-led-filter="service" style="color:' +
      (o.service ? serviceColour(o.service) : SERVICE_COLOURS.neutral) + '">' +
      '<option value="" style="color:' + SERVICE_COLOURS.neutral + '">כל השירותים</option>' +
      services
        .map(function (n) {
          return (
            '<option value="' + esc(n) + '"' + (o.service === n ? " selected" : "") +
            ' style="color:' + serviceColour(n) + '">' + esc(n) + "</option>"
          );
        })
        .join("") +
      "</select>" +
      /* The two dates appear only behind their own button. */
      '<span class="led-dates"' + (range === "custom" ? "" : " hidden") + ">" +
      dateFieldHtml("ledFFrom", o.from || "", "מתאריך") +
      dateFieldHtml("ledFTo", o.to || "", "עד תאריך") +
      "</span>" +
      '<button type="button" class="led-chip' + (o.detail ? " on" : "") +
      '" data-led-detail="1">פירוט מלא</button>' +
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
  /**
   * The block warehouse: one row per saved block.
   *
   * It sits on the management screen because that is the screen that is HIS rather
   * than any client's — the coach's own book, and now his own shelf of programming
   * (owner, 2026-09-05).
   *
   * @param {{rows: object[], busy?: string}} opts
   */
  function blocksBoxHtml(opts) {
    var o = opts || {};
    var rows = Array.isArray(o.rows) ? o.rows : [];
    var html = '<div class="row" style="margin-bottom:10px"><h2 style="margin:0">מחסן לבנות</h2>' +
      '<span class="led-sub">' + rows.length + " לבנות שמורות</span></div>";
    if (!rows.length) {
      return html +
        '<p class="muted" style="margin:0">אין עדיין לבנות במחסן. לחץ ימני על כותרת של לבנה אצל לקוח ובחר ' +
        '״הוסף למועדפים״ כדי לשמור אותה כאן.</p>';
    }
    html += '<div class="led-table-wrap"><table class="led-table blocks-table"><thead><tr>' +
      "<th>שם לבנה</th><th>תיאור</th><th>נוצרה</th><th>סוג</th><th>אימונים בשבוע</th><th>שבועות</th><th></th>" +
      "</tr></thead><tbody>";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      html +=
        '<tr data-block-row="' + esc(r.id) + '">' +
        "<td><strong>" + esc(r.name) + "</strong>" +
        (r.sourceName ? '<span class="blk-source">' + esc(r.sourceName) + "</span>" : "") +
        "</td>" +
        "<td>" + esc(r.description || "—") + "</td>" +
        "<td>" + esc(hebDate(String(r.createdAt || "").slice(0, 10))) + "</td>" +
        "<td>" + esc(kindLabel(r.kind)) + "</td>" +
        "<td>" + (parseInt(r.sessionsPerWeek, 10) || 7) + "</td>" +
        "<td>" + (parseInt(r.weekCount, 10) || 0) + "</td>" +
        '<td class="blk-actions">' +
        '<button type="button" class="btn btn-mini" data-block-take="' + esc(r.id) + '">העתק לבנה</button>' +
        '<button type="button" class="led-bin" data-block-drop="' + esc(r.id) + '" title="מחק מהמחסן" aria-label="מחק מהמחסן">🗑</button>' +
        "</td></tr>";
    }
    return html + "</tbody></table></div>";
  }

  /** "שבועית" / "מספר אימונים" — the same words the warehouse library uses. */
  function kindLabel(kind) {
    return kind === "session_count" ? "מספר אימונים" : "שבועית";
  }

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
            '<span class="led-fav-uses">' +
            esc(Number(p.uses) === 1 ? "פעם אחת" : p.uses + " פעמים") + "</span>" +
            '<span class="led-fav-meta">' + esc(p.service || "—") + " · " + esc(shekel(p.price)) + "</span>" +
            '<span class="led-rowacts">' +
            '<button type="button" class="led-mini" data-led-fav-edit="' + esc(p.name) + '" title="שם וצבע">✎</button>' +
            /* A place he will never use again — a typo, or somewhere he stopped going.
               The sessions done there stay (owner, 2026-09-04). */
            '<button type="button" class="led-mini led-danger" data-led-fav-del="' + esc(p.name) + '" title="הסר מהרשימה">🗑</button>' +
            "</span>" +
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

  /**
   * 04/09/26 — day, month, year, the way a date is written in Israel.
   *
   * The browser's own date field renders in the BROWSER's locale, which showed him
   * 09/04/2026 for the fourth of September. So the ledger writes and reads its dates
   * itself, and the native picker is kept behind a button (owner, 2026-09-04).
   */
  function hebDate(iso) {
    const v = String(iso || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return v.slice(8, 10) + "/" + v.slice(5, 7) + "/" + v.slice(2, 4);
  }

  /**
   * "4/9/26", "04/09/2026", "040926" → "2026-09-04". Anything else → "".
   *
   * Two digits of year mean this century: he is not logging sessions from 1998.
   */
  function parseHeDate(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const digits = raw.replace(/[^\d]/g, "");
    let d;
    let m;
    let y;
    const parts = raw.split(/[^\d]+/).filter(Boolean);
    if (parts.length === 3) {
      d = parts[0];
      m = parts[1];
      y = parts[2];
    } else if (digits.length === 6) {
      d = digits.slice(0, 2);
      m = digits.slice(2, 4);
      y = digits.slice(4, 6);
    } else if (digits.length === 8) {
      d = digits.slice(0, 2);
      m = digits.slice(2, 4);
      y = digits.slice(4, 8);
    } else {
      return "";
    }
    const dd = parseInt(d, 10);
    const mm = parseInt(m, 10);
    let yy = parseInt(y, 10);
    if (!(dd >= 1 && dd <= 31) || !(mm >= 1 && mm <= 12) || !Number.isFinite(yy)) return "";
    if (String(y).length <= 2) yy = 2000 + yy;
    if (yy < 2000 || yy > 2099) return "";
    const iso =
      String(yy) + "-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
    /* A real day: 31/09 is a typo, not a date. */
    const back = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(back.getTime()) || back.toISOString().slice(0, 10) !== iso) return "";
    return iso;
  }

  /**
   * A date the way he types it, with the browser's picker still one tap away.
   *
   * The text field is ours — dd/mm/yy, and it is what gets read. The native field
   * beside it exists only to open the calendar; whatever it returns is written back
   * into the text field in his format.
   */
  function dateFieldHtml(id, iso, title) {
    const shown = /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? hebDate(iso) : "";
    return (
      '<span class="led-datefield">' +
      '<input class="led-field led-date-in" id="' + esc(id) + '" data-led-datefield="1" ' +
      'inputmode="numeric" maxlength="10" placeholder="dd/mm/yy" autocomplete="off" ' +
      'value="' + esc(shown) + '" title="' + esc(title || "תאריך") + '">' +
      '<input type="date" class="led-date-native" id="' + esc(id) + 'Native" ' +
      'data-led-datepick="' + esc(id) + '" value="' + esc(iso || "") + '" tabindex="-1" aria-hidden="true">' +
      '<button type="button" class="led-datebtn" data-led-dateopen="' + esc(id) + '" ' +
      'aria-label="פתח לוח שנה">📅</button>' +
      "</span>"
    );
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
    SERVICE_COLOURS: SERVICE_COLOURS,
    serviceColour: serviceColour,
    SERVICE_OTHER: SERVICE_OTHER,
    favouritesBoxHtml: favouritesBoxHtml,
    blocksBoxHtml: blocksBoxHtml,
    colourStyle: colourStyle,
    DEFAULT_COLOURS: DEFAULT_COLOURS,
    tableHtml: tableHtml,
    groupRowHtml: groupRowHtml,
    dealRowHtml: dealRowHtml,
    filtersHtml: filtersHtml,
    COLUMNS: COLUMNS,
    hebDate: hebDate,
    parseHeDate: parseHeDate,
    dateFieldHtml: dateFieldHtml,
  };
});
