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
    return applyOrder(out, o.order);
  }

  /* ══════════════════════════════════════════════════════════════════════
     THE ORDER HE PUT THEM IN.

     The strip is muscle memory, so it never sorts itself — but the owner may drag a
     chip to where he wants it, and that order is his (owner, 2026-09-05).

     It is kept as a plain list of ids. A client who is not in the list yet — someone
     added since the last drag — keeps their natural place at the end rather than
     jumping to the front, and an id in the list who is gone is simply ignored. So a
     saved order never has to be repaired when the people change.

     "ניהול כללי" is pinned: it is the screen the module opens on, and it is first
     whatever the list says.
     ══════════════════════════════════════════════════════════════════════ */

  /** The ids in a strip, in the order they are drawn, without the pinned screen. */
  function orderOf(list) {
    return (Array.isArray(list) ? list : [])
      .filter(function (r) {
        return r && !r.pinned;
      })
      .map(function (r) {
        return String(r.id);
      });
  }

  /**
   * Draw these rows in the order he saved.
   *
   * @param {object[]} list rows as they came off the two sources
   * @param {string[]} order the ids, in his order; anything else keeps its own place
   */
  function applyOrder(list, order) {
    const rowsIn = Array.isArray(list) ? list.slice() : [];
    const wanted = Array.isArray(order) ? order : null;
    if (!wanted || !wanted.length) return rowsIn;
    const at = {};
    for (let i = 0; i < wanted.length; i++) {
      const key = String(wanted[i]);
      if (at[key] === undefined) at[key] = i;
    }
    /* Stable: two rows he never dragged keep the order the sources gave them. */
    return rowsIn
      .map(function (r, i) {
        const known = r && !r.pinned && at[String(r.id)] !== undefined;
        return { r: r, i: i, rank: r && r.pinned ? -1 : known ? at[String(r.id)] : Infinity };
      })
      .sort(function (a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.i - b.i;
      })
      .map(function (x) {
        return x.r;
      });
  }

  /**
   * Move one id to where it was dropped.
   *
   * `beforeId` is the chip it was dropped in front of; null means "to the end". The
   * result is a complete order of everything in `ids`, so what comes back can be saved
   * as it is.
   */
  function moveId(ids, movedId, beforeId) {
    const list = (Array.isArray(ids) ? ids : []).map(String);
    const moved = String(movedId);
    const from = list.indexOf(moved);
    if (from < 0) return list;
    list.splice(from, 1);
    if (beforeId === null || beforeId === undefined || String(beforeId) === moved) {
      list.push(moved);
      return list;
    }
    const to = list.indexOf(String(beforeId));
    if (to < 0) list.push(moved);
    else list.splice(to, 0, moved);
    return list;
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

  /* The mark on the management tab. Inline so it inherits currentColor. */
  const DUMBBELL =
    '<svg class="tab-mark" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" ' +
    'focusable="false"><path fill="currentColor" d="M3 9h2v6H3zM6 6.5h2.4v11H6zM15.6 6.5H18v11h-2.4z' +
    'M19 9h2v6h-2zM8.4 11h7.2v2H8.4z"/></svg>';

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
          '"' +
          /* The pinned screen cannot be dragged and nothing can be dropped in front of
             it — it is first, always (owner, 2026-09-05). */
          (r.pinned ? ' data-pinned="1"' : ' data-drag="1"') +
          ">" +
          (r.unread ? '<span class="dot" title="יש שינוי שלא ראית"></span>' : "") +
          /* A mark, not an emoji: the strip is Hebrew text and a picture in it reads as
             a client's avatar. */
          /* A dumbbell, drawn rather than an emoji: it takes the chip's own colour and
             sits on the text baseline, which no emoji does. This screen is the coaching
             business, not a sum of the clients beside it (owner, 2026-09-04). */
          (r.kind === "ledger" ? DUMBBELL : "") +
          esc(r.name) +
          "</button>"
        );
      })
      .join("");
  }

  return { rows: rows, html: html, esc: esc, applyOrder: applyOrder, moveId: moveId, orderOf: orderOf };
});
