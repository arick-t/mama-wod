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
   * @returns {{kind:string,id:string,name:string,unread:boolean}[]}
   */
  function rows(src) {
    const o = isPlainObject(src) ? src : {};
    const out = [];
    /* The coach's own book, first and always. It is not a person and it is not a
       client: it is the summary he lands on when he opens the module, it cannot be
       removed, and it carries no colour and no unread dot (owner, 2026-09-03).
       Pass {ledger: false} where the strip is a list of PEOPLE. */
    if (o.ledger !== false) {
      out.push({
        kind: "ledger",
        id: "ledger",
        /* "General management" — it is not a total of anything, it is the screen the
           module opens on (owner, 2026-09-04). */
        name: "ניהול כללי",
        pinned: true,
        unread: false,
      });
    }
    (Array.isArray(o.athletes) ? o.athletes : []).forEach(function (a) {
      if (!a || !a.athleteId) return;
      out.push({
        kind: "athlete",
        id: String(a.athleteId),
        name: String(a.displayName || a.athleteId),
        /* The owner's own colour for this client, so he can pick them out of a strip of
           twenty (2026-09-02). Validated on the way in as well as on the way out: this
           ends up inside a style attribute. */
        colour: /^#[0-9a-f]{6}$/i.test(String(a.clientColour || "")) ? String(a.clientColour) : "",
        unread: false,
      });
    });
    (Array.isArray(o.programs) ? o.programs : []).forEach(function (p) {
      if (!p || !p.programId) return;
      out.push({
        kind: "program",
        id: String(p.programId),
        name: String(p.clientName || "(ללא שם)"),
        /* A client is picked out of the strip the same way an athlete is. */
        colour: /^#[0-9a-f]{6}$/i.test(String(p.clientColour || "")) ? String(p.clientColour) : "",
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
  /**
   * The inline paint for one chip.
   *
   * Written out as rgba rather than a colour-mix so it renders the same in an old
   * WebView as in Chrome — this ships inside a Capacitor app. The active chip is the
   * same colour, stronger, so "which client am I on" survives being coloured.
   */
  function chipStyle(colour, isActive) {
    const hex = String(colour || "");
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const rgb = r + "," + g + "," + b;
    return (
      ' style="background:rgba(' + rgb + (isActive ? ",.42" : ",.20") + ");" +
      "border-color:" + hex + ";color:#fff" +
      (isActive ? ";box-shadow:inset 0 -2px 0 " + hex : "") +
      '"'
    );
  }

  function html(list, activeId) {
    const items = Array.isArray(list) ? list : [];
    if (!items.length) return '<div class="empty-tabs">אין עדיין לקוחות — לחץ ״+ לקוח״</div>';
    return items
      .map(function (r) {
        return (
          '<button type="button" class="athlete-tab' +
          (r.id === activeId ? " active" : "") +
          /* The summary tab is not a client, and it must not look like one: its own
             class carries a shape and a colour that no client can be given — the
             palette in the identity panel does not contain it (owner, 2026-09-04). */
          (r.kind === "ledger" ? " is-ledger" : "") +
          '"' +
          /* The colour IS the chip, not a stripe down its edge: he picks a client out of
             twenty at a glance, and a 4px line does not do that (owner, 2026-09-02).
             Only ever a six-digit hex, checked again here — the value reaches a style
             attribute and a strip is not the place to discover that it did not. */
          chipStyle(r.colour, r.id === activeId) +
          ' data-kind="' +
          esc(r.kind) +
          '" data-id="' +
          esc(r.id) +
          '">' +
          (r.unread ? '<span class="dot" title="יש שינוי שלא ראית"></span>' : "") +
          /* A mark, not an emoji: the strip is Hebrew text and a picture in it reads as
             a client's avatar. */
          /* A panel of squares, not a sigma: a sigma says "sum of", and this screen is
             not a sum of the clients beside it (owner, 2026-09-04). */
          (r.kind === "ledger" ? '<span class="tab-mark" aria-hidden="true">▦</span>' : "") +
          esc(r.name) +
          "</button>"
        );
      })
      .join("");
  }

  return { rows: rows, html: html, esc: esc };
});
