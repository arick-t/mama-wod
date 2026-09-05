/**
 * A colour for a work line, and numbering for a part.
 * Run: node scripts/pprog-line-colour.test.js
 *
 * What the owner asked for (2026-09-05): while a day is open for editing, a pencil at
 * the end of every work line opens a small palette, and the line is then written in
 * that colour. Beside the part's own heading — "Part A" — a tick box called "Add
 * numbering" numbers the work lines of THAT part; one part can be numbered and the next
 * not. The number is drawn in a circle, and it takes the colour of its own line.
 *
 * The things worth guarding here are the round trip and the boundary: a colour has to
 * survive being edited, saved, sent to a client's phone and sent back, and a name that
 * was never offered must not be able to cross the wire.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

const D = require("../lib/pprog-display.js");
const Payload = require("../lib/client-view-payload.js");
const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const client = fs.readFileSync(path.join(root, "client.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles", "pprog-display.css"), "utf8");

/* --- one list of colours, in two files ------------------------------------ */

const libKeys = D.WORK_LINE_COLOURS.map(function (c) { return c.key; });
ok("six colours to choose from", libKeys.length === 6);
ok(
  "and the server allows exactly those",
  JSON.stringify(libKeys) === JSON.stringify(Payload.LINE_COLOURS)
);
ok("a name nobody offered has no colour", D.workLineColour("chartreuse") === "");
ok("and neither has 'no colour'", D.workLineColour("") === "");
ok("a real one has a hex", /^#[0-9A-F]{6}$/i.test(D.workLineColour("red")));

/* --- what a day looks like once it is coloured ---------------------------- */

const part = {
  id: "p1",
  title: "Part A",
  lines: ["Duration / Intent", "E2MOM 10", "5 back squat", "10 push-ups"],
  noteLines: 1,
  numbered: true,
  lineColors: { 0: "red", 1: "purple" },
};
const drawn = D.renderDayPartsHtml([part], null, {});
ok("the coloured line is written in its colour", drawn.indexOf('style="color:' + D.workLineColour("red") + '"') >= 0);
ok("and so is the second one", drawn.indexOf('style="color:' + D.workLineColour("purple") + '"') >= 0);
ok("the work lines are numbered", (drawn.match(/class="pprog-li-num"/g) || []).length === 2);
ok("the first circle says 1", />1<\/span>/.test(drawn));
ok("the list drops its bullets where the circles are", drawn.indexOf("section-lines pprog-numbered") >= 0);
/* The colour is set on the LINE and the circle inherits it — that is what makes the
   number take the colour of its line, exactly as he asked. */
ok(
  "the circle sits inside the coloured line",
  /<li dir="auto" class="pprog-li-numbered" style="color:[^"]+"><span class="pprog-li-num"/.test(drawn)
);
ok("the note is still a note", drawn.indexOf('<div class="pprog-part-note" dir="auto">Duration / Intent</div>') >= 0);

const plain = D.renderDayPartsHtml([{ id: "p2", title: "Part B", lines: ["3 rounds", "run 400m"] }], null, {});
ok("a part nobody numbered has no circles", plain.indexOf("pprog-li-num") < 0);
ok("and no colour on its lines", plain.indexOf("style=\"color:") < 0);
ok("so one part can be numbered while the next is not", drawn.indexOf("pprog-li-num") >= 0);

const wrongName = D.renderDayPartsHtml(
  [{ id: "p3", title: "Part C", lines: ["a", "b"], lineColors: { 0: "neon" } }],
  null,
  {}
);
ok("a colour name the library does not know is ignored", wrongName.indexOf("style=\"color:") < 0);

/* --- the editor ----------------------------------------------------------- */

const draft = { day: "sun", parts: D.draftFromDayData({ parts: [part] }, false) };
ok("the draft carries the colours out of the day", draft.parts[0].colors[0] === "purple" || draft.parts[0].colors.indexOf("purple") >= 0);
ok("and remembers the part was numbered", draft.parts[0].numbered === true);

const block = {
  blockStart: "2026-09-06",
  weeks: [{ weekIndex: 1, days: { sun: { parts: [part] } }, overview: [] }],
};
/* The editor as the page actually draws it — through the day card, in edit mode. */
function editorHtml(extra) {
  const opts = {
    allowEdit: true,
    editing: true,
    editDraft: draft,
    readOnly: true,
    showFooter: false,
    israelTodayIso: block.blockStart,
  };
  for (const k in extra || {}) opts[k] = extra[k];
  return D.renderDayCardHtml(block, block.weeks[0], 0, "sun", opts);
}
const editor = editorHtml({ allowLineColour: true });
ok("every work line gets a pencil", (editor.match(/class="pprog-colour-btn"/g) || []).length === draft.parts[0].work.length);
ok("and a palette to open", (editor.match(/class="pprog-colour-pop"/g) || []).length === draft.parts[0].work.length);
ok("with seven choices — six colours and none", (editor.match(/class="pprog-swatch/g) || []).length === 7 * draft.parts[0].work.length);
ok("the part offers 'Add numbering'", editor.indexOf("Add numbering") >= 0);
ok("ticked, because this part is numbered", /<input type="checkbox" checked/.test(editor));
ok("the colour shows on the line he is typing", editor.indexOf('<input type="text" dir="auto" style="color:') >= 0);
ok("picking one calls the page", editor.indexOf("adminPprogEditSetColour") >= 0 || editor.indexOf("SetColour") >= 0);

/* A page that cannot store the answer is not offered the question. */
const oldEditor = editorHtml({});
ok("an editor that cannot save colours shows no pencil", oldEditor.indexOf("pprog-colour-btn") < 0);
ok("and no numbering box either", oldEditor.indexOf("Add numbering") < 0);

/* --- the round trip ------------------------------------------------------- */

const back = D.partsFromDraft(draft);
ok("the colours are written back", back[0].lineColors && Object.keys(back[0].lineColors).length === 2);
ok("on the lines they were on", back[0].lineColors["0"] === "red" && back[0].lineColors["1"] === "purple");
ok("and the part is still numbered", back[0].numbered === true);

/* Deleting a line must not repaint its neighbour. */
const shifted = D.partsFromDraft({
  day: "sun",
  parts: [{ title: "Part A", notes: [], format: "", work: ["", "second"], colors: ["red", "blue"], numbered: false }],
});
ok("a colour follows its line when an empty one above is dropped", shifted[0].lineColors["0"] === "blue");
ok("a part nobody numbered stores nothing extra", shifted[0].numbered === undefined);

const untouched = D.partsFromDraft({
  day: "sun",
  parts: [{ title: "Part A", notes: ["note"], format: "", work: ["5x5"], colors: [], numbered: false }],
});
ok("and a part nobody coloured stores nothing but its shape and its lines",
  JSON.stringify(untouched[0]) ===
    JSON.stringify({ id: "sun-0", noteLines: 1, formatLine: 0, title: "Part A", lines: ["note", "5x5"] }));

/* --- the numbers can be written over (owner, 2026-09-05) ------------------ */

const renumbered = D.renderDayPartsHtml(
  [{ id: "n1", title: "Part A", lines: ["a", "b", "c"], numbered: true, lineNums: { 1: 1 } }],
  null,
  {}
);
const circles = (renumbered.match(/class="pprog-li-num"[^>]*>(\d+)</g) || []).map(function (m) {
  return m.replace(/[^\d]/g, "");
});
/* He asked for exactly this: three lines counting 1, 2, 3; he calls the second one 1;
   it stays 1, and the third goes on being 3. */
ok("a line he renumbered keeps the number he gave it", circles.join(",") === "1,1,3");

const numberedEditor = editorHtml({ allowLineColour: true });
ok("the number is a field while the day is open", /class="pprog-li-num pprog-edit-num pprog-num-in"/.test(numberedEditor));
ok("and it takes digits", /inputmode="numeric"/.test(numberedEditor));
ok("typing in it does not redraw the card", /oninput="[A-Za-z]*SetNumber\(\d+,\d+,this\)"/.test(numberedEditor));

const numsOut = D.partsFromDraft({
  day: "sun",
  parts: [{ title: "Part A", notes: [], format: "", work: ["a", "b", "c"], colors: [], nums: [1, 1, 3], numbered: true }],
});
ok("only the number he wrote over the count is stored", JSON.stringify(numsOut[0].lineNums) === '{"1":1}');

const numsNone = D.partsFromDraft({
  day: "sun",
  parts: [{ title: "Part A", notes: [], format: "", work: ["a", "b"], colors: [], nums: [1, 2], numbered: true }],
});
ok("plain counting stores nothing at all", numsNone[0].lineNums === undefined);

/* --- Enter opens the next line (owner, 2026-09-05) ------------------------ */

ok("Enter inside a work line adds one", /onkeydown="if\(event\.key==='Enter'\)\{event\.preventDefault\(\);[A-Za-z]*AddWork\(0,1\);\}"/.test(numberedEditor));
for (const [label, src] of [["the admin", admin], ["the client page", client]]) {
  ok(label + " can add a line in the middle", /window\.cvEditAddWork = function \(partIndex, atIndex\)/.test(src));
  ok(label + " puts the caret in the new line", src.indexOf("function focusWorkLine(") >= 0);
  ok(label + " has the number handler", src.indexOf("window.cvEditSetNumber = function") >= 0);
  ok(label + " wires it", src.indexOf('editSetNumber: "cvEditSetNumber"') >= 0);
}

/* --- the wire ------------------------------------------------------------- */

const sent = Payload.programForClient({
  weeks: [{ weekIndex: 1, days: { sun: { parts: [part] } } }],
  approvedThroughWeek: 1,
});
const sentPart = sent.weeks[0].days.sun.parts[0];
ok("the client's copy carries the colours", sentPart.lineColors["0"] === "red");
const sentNums = Payload.programForClient({
  weeks: [{ weekIndex: 1, days: { sun: { parts: [{ id: "p", title: "A", lines: ["a", "b"], numbered: true, lineNums: { 1: 1, 5: 9, 0: "x" } }] } } }],
  approvedThroughWeek: 1,
}).weeks[0].days.sun.parts[0];
ok("and the numbers he wrote over the count", JSON.stringify(sentNums.lineNums) === '{"1":1}');
ok("and the numbering", sentPart.numbered === true);

const parsed = Payload.parseClientEdit({
  expectedVersion: 3,
  edits: [
    {
      weekIndex: 1,
      dayKey: "sun",
      parts: [{ id: "p1", title: "Part A", lines: ["a", "b"], numbered: true, lineColors: { 0: "green" } }],
    },
  ],
});
ok("a client may colour a line too — they are coaches", parsed.ok && parsed.edits[0].parts[0].lineColors["0"] === "green");
ok("and number a part", parsed.edits[0].parts[0].numbered === true);

const hostile = Payload.parseClientEdit({
  expectedVersion: 3,
  edits: [
    {
      weekIndex: 1,
      dayKey: "sun",
      parts: [
        {
          id: "p1",
          title: "Part A",
          lines: ["a"],
          numbered: "yes please",
          lineColors: { 0: "javascript:alert(1)", 4: "red", nope: "blue" },
        },
      ],
    },
  ],
});
const hp = hostile.edits[0].parts[0];
ok("a colour that is not a colour never reaches the card", hp.lineColors === undefined);
ok("an index past the end of the part is dropped with it", hp.lineColors === undefined);
ok("and 'numbered' is a yes or it is nothing", hp.numbered === undefined);

/* --- both pages are wired to it ------------------------------------------- */

for (const [label, src] of [["the admin", admin], ["the client page", client]]) {
  ok(label + " asks for the colours", src.indexOf("allowLineColour: true") >= 0);
  ok(label + " names its colour handler", src.indexOf('editSetColour: "cvEditSetColour"') >= 0);
  ok(label + " names its numbering handler", src.indexOf('editSetNumbering: "cvEditSetNumbering"') >= 0);
  ok(label + " has the handler itself", src.indexOf("window.cvEditSetColour = function") >= 0);
  ok(label + " has the numbering one", src.indexOf("window.cvEditSetNumbering = function") >= 0);
  /* The × on a note was calling the OTHER editor on the page and doing nothing. */
  ok(label + " can take a note off again", src.indexOf("window.cvEditRemoveNote = function") >= 0);
  ok(label + " wires that × to itself", src.indexOf('editRemoveNote: "cvEditRemoveNote"') >= 0);
  ok(label + " counts a colour as a change worth saving", /numbered: \(p && p\.numbered\) === true/.test(src));
}

/* --- and it is drawn ------------------------------------------------------ */

ok("the circle is a circle", /\.pprog-li-num\{[^}]*border-radius:50%/.test(css));
ok("it takes the colour of its line", /\.pprog-li-num\{[^}]*border:1\.5px solid currentColor/.test(css));
ok("a numbered list drops its bullets", /\.section-lines\.pprog-numbered\{[^}]*list-style:none/.test(css));
/* Inside the row, never floating: the strip of day cards clips anything that tries
   to hang outside it (owner, 2026-09-05). */
ok("the palette opens inside the row", /\.pprog-colour-pop\{[^}]*flex:0 0 100%/.test(css));
ok("and nothing about it is positioned", /\.pprog-colour-pop\{[^}]*position:/.test(css) === false);
ok("so the row can carry it on a second line", /\.pprog-edit-work-row\{flex-wrap:wrap\}/.test(css));
ok("and the chosen colour is ringed", /\.pprog-swatch\.is-on\{/.test(css));

/* --- a name on a day with nothing written in it (owner, 2026-09-05) -------- */

ok("the admin can save a name alone", admin.indexOf("opts.titleOnly === true") >= 0);
ok("and the autosave asks it to", /saveDay\(wi, dayKey, parts, false, \{ quiet: true, title: title, titleOnly: true \}\)/.test(admin));
ok("no session is invented to hold the name", admin.indexOf("} else if (parts && parts.length) {") >= 0);

console.log("\nAll line-colour and numbering checks passed (" + passed + " assertions).");
