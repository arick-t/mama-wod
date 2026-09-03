#!/usr/bin/env node
/**
 * The one strip of people the owner manages.
 *
 * His instruction on 2026-09-01, said twice and then sharpened: there is ONE admin
 * module — "מוטת הניהול שלי" — and this is his personal view of everyone who uses his
 * services, studios and individual athletes alike. That it lives in two files is an
 * accident of a 201KB monolith and must never show, which is why both screens build
 * their strip from this module rather than each writing its own.
 *
 * 0 LLM. No network.
 */

"use strict";

const assert = require("assert");
const Strip = require("../lib/admin-people-strip.js");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok — " + name);
  passed++;
}

const athletes = [
  { athleteId: "u_1", displayName: "אריק" },
  { athleteId: "u_2", displayName: "עדי" },
];
/* isTest is written here on purpose: it is a marker some rows saved during the test
   phase still carry, and from 22.0 nothing may render it. A "test client" badge on a
   strip that only ever holds paying people is a leftover, not information. */
const programs = [
  { programId: "p_a", clientName: "סטודיו א", isTest: false, unreadCount: 0 },
  { programId: "p_b", clientName: "בדיקה 7", isTest: true, unreadCount: 3 },
];

const rows = Strip.rows({ athletes: athletes, programs: programs, ledger: false });
ok("everyone is in one list", rows.length === 4);
ok("athletes first, then the programmes", rows.map(function (r) { return r.kind; }).join(",") === "athlete,athlete,program,program");
ok("each row knows which kind it is", rows[0].kind === "athlete" && rows[3].kind === "program");
ok("names come across", rows[2].name === "סטודיו א");
ok("no row carries a test marker any more", rows[3].test === undefined && rows[2].test === undefined);
ok("and no chip renders a test badge", Strip.html(rows, "p_b").indexOf("badge test") < 0);
/* State, not a count: five saves to one day are still one thing to look at. */
ok("unread is a flag, not a number", rows[3].unread === true && rows[2].unread === false);

/* The order is deliberately fixed. A strip is muscle memory; one that re-sorts itself
   by name or by date is a strip he has to read every time. */
const reordered = Strip.rows({
  ledger: false,
  athletes: [{ athleteId: "u_9", displayName: "בבב" }, { athleteId: "u_8", displayName: "understand" }],
  programs: [],
});
ok("the given order is kept, not sorted", reordered[0].id === "u_9" && reordered[1].id === "u_8");

ok("nameless rows are skipped, not rendered blank", Strip.rows({ athletes: [{}, { athleteId: "u_3" }], ledger: false }).length === 1);
ok("a programme with no name still reads", Strip.rows({ programs: [{ programId: "p_x" }], ledger: false })[0].name === "(ללא שם)");
ok("nothing in, nothing out", Strip.rows({ ledger: false }).length === 0);

/* --- the markup both screens paint ---------------------------------- */

const html = Strip.html(rows, "p_b");
ok("every row becomes a chip", (html.match(/class="athlete-tab/g) || []).length === 4);
ok("the chips are admin's own class", /class="athlete-tab/.test(html));
ok("the active one is marked", /class="athlete-tab active" data-kind="program" data-id="p_b"/.test(html));
ok("only one is active", (html.match(/athlete-tab active/g) || []).length === 1);
ok("each chip says what it is and who", /data-kind="athlete" data-id="u_1"/.test(html));
ok("no chip carries a test badge", !/badge test">בדיקה/.test(html));
ok("an unread programme carries the dot", /class="dot" title="יש שינוי שלא ראית"/.test(html));
ok("a quiet one does not", (html.match(/class="dot"/g) || []).length === 1);
ok("an empty strip says what to do", /אין עדיין לקוחות/.test(Strip.html([], "")));

/* A client's name is theirs, not ours — it must never be able to close a tag. */
const nasty = Strip.html(Strip.rows({ programs: [{ programId: "p_1", clientName: '<img src=x onerror="alert(1)">' }], ledger: false }), "");
ok("a name cannot break out of the chip", nasty.indexOf("<img") < 0 && /&lt;img/.test(nasty));

/* --- the owner's own colour for a client ----------------------------
 *
 * He picks twenty clients out of one strip, so each can carry a colour he chose
 * (2026-09-02). It lands inside a style attribute, which is the whole reason it is
 * validated twice — once when the row is built and once when the chip is written.
 */
const coloured = Strip.rows({
  ledger: false,
  athletes: [
    { athleteId: "u_c", displayName: "עדי", clientColour: "#E8451A" },
    { athleteId: "u_n", displayName: "ללא", clientColour: "" },
    { athleteId: "u_x", displayName: "רע", clientColour: "red; background:url(x)" },
    { athleteId: "u_y", displayName: "גם רע", clientColour: "javascript:alert(1)" },
  ],
});
ok("a real colour survives", coloured[0].colour === "#E8451A");
ok("no colour is no colour", coloured[1].colour === "");
ok("a colour name is not a colour here", coloured[2].colour === "");
ok("and neither is anything that smells like code", coloured[3].colour === "");

const colouredHtml = Strip.html(coloured, "u_c");
/* The colour IS the chip since 2026-09-02 — a 4px line down the edge did not let him
   pick a client out of twenty at a glance. */
ok("the chosen colour paints the whole chip", /background:rgba\(232,69,26,/.test(colouredHtml));
ok("and outlines it", /border-color:#E8451A/.test(colouredHtml));
ok("the active chip is the same colour, stronger", /rgba\(232,69,26,\.42\)/.test(colouredHtml));
ok("a chip with no colour is left alone", (colouredHtml.match(/style="/g) || []).length === 1);
/* rgba, not colour-mix: this ships inside a Capacitor WebView. */
ok("no modern colour function that an old WebView would drop", !/color-mix/.test(colouredHtml));
ok("nothing that was refused can appear", colouredHtml.indexOf("javascript") < 0 && colouredHtml.indexOf("url(") < 0);

const src = require("fs").readFileSync(
  require("path").join(__dirname, "..", "lib", "admin-people-strip.js"),
  "utf8"
);
ok("the strip fetches nothing itself", !/\bfetch\s*\(/.test(src));
ok("and names no AI provider", !/gemini|groq|generativelanguage/i.test(src));


/* --- the same rows produce the same markup -------------------------
 * A click is mousedown and mouseup on the same element. If the strip is rewritten
 * between the two the browser fires no click, and the owner presses twice — which is
 * exactly what he reported on 2026-09-02. The page skips the rewrite when the markup is
 * unchanged, and that only works if the markup is genuinely stable for stable input.
 */
const stableRows = Strip.rows({
  ledger: false,
  athletes: [{ athleteId: "u_a", displayName: "A", clientColour: "#E8451A" }],
  programs: [{ programId: "p_b", clientName: "B", unreadCount: 2, isTest: true }],
});
ok(
  "identical input renders identical markup",
  Strip.html(stableRows, "p_b") === Strip.html(Strip.rows({
    ledger: false,
    athletes: [{ athleteId: "u_a", displayName: "A", clientColour: "#E8451A" }],
    programs: [{ programId: "p_b", clientName: "B", unreadCount: 2, isTest: true }],
  }), "p_b")
);
ok(
  "and a different active chip does not",
  Strip.html(stableRows, "p_b") !== Strip.html(stableRows, "u_a")
);

console.log("All admin people strip checks passed (" + passed + " assertions).");

/* --- the summary tab is the first chip, and it is not a person ------------
 * The coach's own book: what he earned coaching, beside the clients he writes plans
 * for. It opens on every entry to the module, and it cannot be removed — so it is
 * pinned here rather than left to whoever renders the strip (owner, 2026-09-03).
 * ------------------------------------------------------------------------- */
const withLedger = Strip.rows({ athletes: athletes, programs: programs });
ok("it is there without being asked for", withLedger[0].kind === "ledger");
ok("it is first, before every person", withLedger.length === 5 && withLedger[1].kind === "athlete");
ok("it is pinned", withLedger[0].pinned === true);
ok("it carries no unread dot and no colour", withLedger[0].unread === false && !withLedger[0].colour);
ok("it renders as a chip", Strip.html(withLedger, "ledger").indexOf('data-id="ledger"') >= 0);
ok("and a screen that wants only people can leave it out", Strip.rows({ athletes: athletes, ledger: false }).length === 2);
