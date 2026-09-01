/**
 * admin-clients.html — the owner's back office for client programs.
 * Run: node scripts/admin-clients-page.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "admin-clients.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

/* --- it must parse ------------------------------------------------------- */

const scripts = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(page))) scripts.push(m[1]);
scripts.forEach(function (code, i) {
  let err = null;
  try {
    new vm.Script(code, { filename: "admin-clients.html #" + (i + 1) });
  } catch (e) {
    err = (e && e.message) || String(e);
  }
  ok("inline script " + (i + 1) + " parses", err === null);
});

/* --- reachable from the admin module, sharing its session -------------- */

ok("admin.html links to the client page", /href="admin-clients\.html"/.test(admin));
ok("the link is labelled for the owner", /id="btn-client-programs"/.test(admin));
ok("the page links back to admin", /href="admin\.html"/.test(page));
ok("it reuses admin's session key", /"dw_admin_session"/.test(page));
ok("it reuses admin's remember key", /"dw_admin_remember"/.test(page));
ok("it reads the session token header on login", /X-Admin-Session-Token/.test(page));
ok("it sends the admin token on later calls", /X-Admin-Token/.test(page));
ok("the password is only sent to log in", (page.match(/X-Admin-Password/g) || []).length <= 2);

/* --- the silent password failure becomes visible (a.4.1 / a.4.2) ------- */

ok("the login screen reports remember-me state", /זכור אותי/.test(page));
ok(
  "a missing server secret is named, not shrugged at",
  /ADMIN_SESSION_SECRET/.test(page)
);
ok(
  "logging in without a session token warns the owner",
  /לא הנפיק כרטיס־זיכרון/.test(page)
);

/* --- no AI on this surface either -------------------------------------- */

ok("the page names no AI provider", !/gemini|groq|generativelanguage/i.test(page));
ok("it never calls personal-coach", !/personal-coach/.test(page));
ok(
  "the only endpoint it uses is client-program",
  (page.match(/\/api\/[a-z-]+/g) || []).every(function (u) {
    return u === "/api/client-program";
  })
);

/* --- a.1.1: the owner authors, we never generate ---------------------- */

ok("creating a client makes an EMPTY program", page.indexOf("Created an empty ") >= 0);
ok("the empty program's length comes from the intake", /weeks \+ "-week program/.test(page));
ok("the owner is told to write the training", /Now write the sessions/.test(page));

/* Enumerate what the page can actually ask the server to do, rather than grepping
   for words — a keyword search keeps matching prose in comments, and the set of
   actions is the thing that decides whether this surface can generate content. */
const ACTIONS_ALLOWED = [
  "list",
  "read",
  "create",
  "save",
  "delete",
  "mark_read",
  "issue_code",
  "revoke_codes",
  "revoke_device",
  "rebuild_index",
];
const actionsUsed = Array.from(
  new Set((page.match(/action:\s*"([a-z_]+)"/g) || []).map(function (s) {
    return s.replace(/action:\s*"/, "").replace(/"$/, "");
  }))
).sort();
ok("every action the page sends is a known one", actionsUsed.every(function (a) {
  return ACTIONS_ALLOWED.indexOf(a) >= 0;
}));
ok(
  "none of them generates or revises training content",
  !actionsUsed.some(function (a) {
    return /^(generate|revise|finish_micro_bias|chat)/.test(a);
  })
);
ok("the page really does use several of them", actionsUsed.length >= 8);

/* --- shared rendering, one design ------------------------------------- */

ok("it loads the shared display library", /src="lib\/pprog-display\.js"/.test(page));
ok("days are rendered by the shared library", /D\.renderDayPartsHtml\(/.test(page));
ok("it uses the app's tokens", /--brand:#E8451A/.test(page) && /--coach:#9b6bb8/.test(page));
ok("it uses the app's fonts", /family=Heebo/.test(page) && /Oswald/.test(page));
ok("the page is right-to-left like admin", /dir="rtl"/.test(page));

/* --- codes and devices ------------------------------------------------ */

ok("the owner can issue a code", /action: "issue_code"/.test(page));
ok("the code is shown once and not stored", /לא יוצג שוב/.test(page));
ok("the owner is told to pass it by WhatsApp", /בוואטסאפ/.test(page));
ok("open codes can be revoked", /action: "revoke_codes"/.test(page));
ok("a device can be revoked", /action: "revoke_device"/.test(page));
ok("revoking a device asks first", /confirm\("לבטל את המכשיר/.test(page));
ok("the device cap is shown", /deviceCap/.test(page));
ok("the signature state is shown", /טרם חתם|חתם על/.test(page));
ok("the client link is copyable", /data-copylink/.test(page));

/* --- unread flag: state, and cleared by opening ---------------------- */

ok("unread days are highlighted", /\.day\.unread/.test(page));
ok("one dot per client, not a count", /class="dot"/.test(page));
ok("opening a day marks it read", /action: "mark_read"/.test(page));
ok("marking read happens on edit, with no extra click", /markRead\(tag\)\.then/.test(page));
ok("a client-changed day is labelled", /שונה ע"י הלקוח/.test(page));

/* --- payment fields are owner-only --------------------------------- */

ok("there is a monthly amount field", /id="fAmount"/.test(page));
ok("the amount is a number so it can be totalled", /id="fAmount" type="number"/.test(page));
ok("there is a free-text payment method", /id="fMethod" type="text"/.test(page));
ok("a monthly total is shown", /monthlyTotal/.test(page));
ok("the owner is reminded the client cannot see this", /הלקוח לא רואה אותם/.test(page));

/* --- rename (a.3.3) ------------------------------------------------- */

ok("there is a pencil to rename", /data-rename/.test(page));
ok("renaming saves clientName", /program: \{ clientName: name \}/.test(page));

/* --- the label is 'client', not 'athlete' (a.3.2) ------------------ */

ok("the page speaks about clients", page.indexOf("New coach / studio client") >= 0);
ok("the heading is the owner's clients", /הלקוחות שלי/.test(page));

/* --- the cross-cutting intake, in English (checklist 2.b) ---------- */

ok("the page loads the shared intake definition", /src="lib\/client-intake\.js"/.test(page));
ok("the tabs come from that definition", /CLIENT_INTAKE.*TABS/.test(page));

/* Six panes, one per tab, in the owner's order. */
const paneIds = (page.match(/data-pane="([a-z]+)"/g) || []).map(function (s) {
  return s.replace('data-pane="', "").replace('"', "");
});
ok("there are six intake panes", paneIds.length === 6);
ok(
  "the panes are in the owner's order",
  JSON.stringify(paneIds) ===
    JSON.stringify(["profile", "equipment", "schedule", "deload", "population", "goals"])
);

/* Tab 1 */
ok("tab 1 asks for the client name", /id="inName"/.test(page));
ok("tab 1 takes the monthly amount as a number", /id="inAmount" type="number"/.test(page));
ok("tab 1 takes the payment method as text", /id="inMethod" type="text"/.test(page));
ok("tab 1 says the client cannot see the price", /client never sees them/i.test(page));

/* Tab 2 — exactly two options, OTHER reveals a box */
ok("equipment has the well-equipped option", /Well-equipped functional training gym/.test(page));
ok("equipment is a checkbox, not a dropdown", /id="inEquipFull" type="checkbox" checked/.test(page));
ok("the default is ticked — the well-equipped gym", /id="inEquipFull" type="checkbox" checked/.test(page));
ok("the owner is told what unticking means", /Untick if the place has something else/.test(page));
/* Plain string search: a regex here needs escaping for ? and " and the escaping is
   what keeps going wrong, not the assertion. */
ok(
  "ticked maps to the well-equipped gym, unticked to OTHER",
  page.indexOf('checked ? "functional_gym" : "other"') >= 0
);
ok(
  "unticking reveals the description box",
  /id="inEquipOtherWrap"/.test(page) &&
    page.indexOf('el("inEquipOtherWrap").hidden = el("inEquipFull").checked') >= 0
);
ok("the box is hidden by default", /id="inEquipOtherWrap" hidden/.test(page));
ok("there is no equipment dropdown left", page.indexOf('id="inEquip"') < 0);
ok("no select element survives on the equipment tab", !/<select id="inEquip/.test(page));

/* Tab 3 — a checkbox picks the mode, and each mode reveals its own follow-ups */
ok("the mode is a checkbox, ticked by default", /id="inSchedCount" type="checkbox" checked/.test(page));
ok("there is no schedule dropdown left", !/<select id="inSchedMode/.test(page));
ok("the session count sits next to it", /id="inSessions" type="number" min="1" max="14"/.test(page));
ok("the count box is inline with the checkbox", /class="inline-num"/.test(page));
ok("the count is disabled in weekly mode", page.indexOf('el("inSessions").disabled = !byCount') >= 0);
ok("the owner is told the coach picks the days", /delivers them whenever/i.test(page));

/* session_count → do the sessions differ? */
ok("there is a 'sessions differ' checkbox", /id="inSessionsDiffer" type="checkbox"/.test(page));
ok("it is unticked by default — uniform sessions", !/id="inSessionsDiffer" type="checkbox" checked/.test(page));
ok("uniform is described as standard CrossFit", /a standard CrossFit week/.test(page));
ok("differing sessions get one box each, laid out horizontally", /class="sess-grid"/.test(page) && /display:flex/.test(page));
ok("the boxes are built from the session count", /function buildSessionBoxes/.test(page));
ok("changing the count rebuilds the boxes", page.indexOf('el("inSessions").addEventListener("input"') >= 0);
ok("existing text is carried over on rebuild", /prev\[j\]/.test(page));
ok("the follow-up is hidden in weekly mode", page.indexOf('el("inDifferWrap").hidden = !byCount') >= 0);

/* weekly_schedule → rest days, then standing per-day emphases */
ok("there is a rest-days checkbox", /id="inRestDays" type="checkbox"/.test(page));
ok("rest days are OFF by default", !/id="inRestDays" type="checkbox" checked/.test(page));
ok("off reads as the coach's call", /Rest days are not planned — the coach decides/.test(page));
ok("there is a standing-emphasis checkbox", /id="inEmphasis" type="checkbox"/.test(page));
ok("emphases are described as repeating weekly", /repeats every\s*\n?\s*week/.test(page));
ok("the owner's own example is used", /partner workouts/.test(page));
ok("ticking a day reveals its note", /function syncEmphasisRow/.test(page));
ok("the note input starts hidden", /id="inEmTxt-' \+ k \+ '" type="text" hidden/.test(page));
ok("the day rows are delegated, since they are rebuilt", /data-emph/.test(page));
ok("the days come from the shared definition", /CI\.DAY_KEYS/.test(page) && /CI\.DAY_LABELS/.test(page));
/* An unticked day with leftover text must not quietly become an emphasis. */
ok("only a ticked day contributes a note", /box && box\.checked && txt/.test(page));

/* Tab 4 — the consequence is spelled out, because it changes 5 weeks to 4 */
ok("deload is a checkbox", /id="inDeload" type="checkbox"/.test(page));
ok("with a deload it says 5 weeks", /5 weeks: four build weeks and a deload/.test(page));
ok("without one it says 4 weeks back to back", /next 4-week block follows straight after/.test(page));
ok("no deload is the stated default", /\(Default\.\)/.test(page));

/* Tabs 5 & 6 */
ok("tab 5 asks about the place and the people", /id="inPopulation"/.test(page));
ok("tab 6 asks for goals", /id="inGoals"/.test(page));

/* 2.c — no individual capability anywhere on this form */
[
  "inAge", "inBodyweight", "inLifts", "inSkills", "inInjuries", "inExperience", "inGender",
].forEach(function (id) {
  ok('the form has no individual field "' + id + '"', page.indexOf('id="' + id + '"') < 0);
});

/* English, on the owner's instruction — check the tab and field text, not comments */
const intakeCard = (page.match(/<div class="card" id="intakeCard"[\s\S]*?<\/div>\s*<div class="card">/) || [""])[0];
ok("the intake card exists", intakeCard.length > 200);
ok("the intake card is left-to-right", /id="intakeCard" dir="ltr"/.test(page));
ok(
  "no Hebrew in the intake form itself",
  !/[֐-׿]/.test(intakeCard.replace(/<!--[\s\S]*?-->/g, ""))
);

/* Validation runs before anything is created */
ok("the form validates before creating", /validateIntake\(form\)/.test(page));
ok("problems are shown to the owner", /problems\.join\(" "\)/.test(page));
ok("create sends the intake, not a week count", /clientKind: "coach", intake: form/.test(page));

/* --- index rebuild is available (0.5) ----------------------------- */

ok("the index can be rebuilt from the UI", /action: "rebuild_index"/.test(page));

/* --- conflicts are honest ---------------------------------------- */

ok("a 409 reloads rather than overwriting", /status === 409/.test(page));
ok("the conflict message names the client", /הלקוח שינה את התוכנית/.test(page));

/* --- deep link from the alert email ------------------------------ */

ok("a ?program= deep link opens that client", /get\("program"\)/.test(page));

/* --- destructive actions ask ------------------------------------ */

ok("delete asks for confirmation", /confirm\("למחוק את התוכנית/.test(page));
ok("delete is styled as dangerous", /class="danger sm"/.test(page));

/* --- phone reality ---------------------------------------------- */

ok("inputs are 16px so iOS does not zoom", /font-size:16px/.test(page));
ok("touch targets are 44px", /min-height:44px/.test(page));
ok("safe-area insets are honoured", /env\(safe-area-inset-top/.test(page));
ok("there is a small-screen breakpoint", /@media \(max-width:600px\)/.test(page));
ok("the page is not indexed", /noindex/.test(page));

console.log("All admin clients page checks passed.");
