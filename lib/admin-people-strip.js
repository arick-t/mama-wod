/**
 * The one strip of people the owner manages.
 *
 * There is ONE admin module — his span of management — and it has two screens only
 * because admin.html is a 201KB hand-written monolith. That is an implementation
 * detail, and the owner's instruction on 2026-09-01 is that it must not surface: he
 * wants one unified view of his clients, and clicking any of them opens them wherever
 * he happens to be standing.
 *
 * So both screens draw their strip from HERE. Same people, same order, same markup —
 * which is what makes the seam between the two files invisible. Two hand-written strips
 * would drift apart within a week and the seam would be all he could see.
 *
 * Browser: <script src="lib/admin-people-strip.js"></script> → AdminPeopleStrip
 * Node: require("./admin-people-strip")
 *
 * 0 LLM. No network. It formats a list; it does not fetch one.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AdminPeopleStrip = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  /**
   * One list from the two sources.
   *
   * Athletes first, then the programmes written for coaches and studios. The order is
   * fixed rather than sorted by name or date on purpose: the strip is muscle memory,
   * and a strip that reorders itself is a strip he has to read every time.
   *
   * @param {{athletes?: object[], programs?: object[]}} src
   * @returns {{kind:string,id:string,name:string,test:boolean,unread:boolean}[]}
   */
  function rows(src) {
    const o = isPlainObject(src) ? src : {};
    const out = [];
    (Array.isArray(o.athletes) ? o.athletes : []).forEach(function (a) {
      if (!a || !a.athleteId) return;
      out.push({
        kind: "athlete",
        id: String(a.athleteId),
        name: String(a.displayName || a.athleteId),
        test: false,
        unread: false,
      });
    });
    (Array.isArray(o.programs) ? o.programs : []).forEach(function (p) {
      if (!p || !p.programId) return;
      out.push({
        kind: "program",
        id: String(p.programId),
        name: String(p.clientName || "(ללא שם)"),
        test: p.isTest === true,
        /* State, not a counter: five saves to one day are still one thing to look at. */
        unread: !!(Number(p.unreadCount) > 0),
      });
    });
    return out;
  }

  /**
   * The strip's markup. Each screen binds its own click handler to data-kind/data-id,
   * because what a click DOES differs: one of them already has the person on screen,
   * the other has to travel to them.
   */
  function html(list, activeId) {
    const items = Array.isArray(list) ? list : [];
    if (!items.length) return '<div class="empty-tabs">אין עדיין לקוחות — לחץ ״+ לקוח״</div>';
    return items
      .map(function (r) {
        return (
          '<button type="button" class="athlete-tab' +
          (r.id === activeId ? " active" : "") +
          '" data-kind="' +
          esc(r.kind) +
          '" data-id="' +
          esc(r.id) +
          '">' +
          (r.unread ? '<span class="dot" title="יש שינוי שלא ראית"></span>' : "") +
          esc(r.name) +
          /* A test programme must never be mistaken for someone who is paying. */
          (r.test ? '<span class="badge test">בדיקה</span>' : "") +
          "</button>"
        );
      })
      .join("");
  }

  return { rows: rows, html: html, esc: esc };
});
