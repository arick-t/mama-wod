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
/* ------------------------------------------------------------------------
 * The client screen lives INSIDE admin.html now.
 *
 * The owner's instruction, 2026-09-02: one management page, no seam, no combinations.
 * Everything this file asserts about the screen is unchanged — the screen moved, it was
 * not rewritten — so "page" simply points at where it lives. admin-clients.html is a
 * redirect and is checked as one at the bottom.
 * --------------------------------------------------------------------- */
const page = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const admin = page;
const redirect = fs.readFileSync(path.join(root, "admin-clients.html"), "utf8");

/* The client screen's own code, sliced out of the page it now shares with the athlete
   side. The athlete side IS an AI surface; the client screen must not be, and after the
   merge the only honest way to say that is to look at the screen itself rather than at
   the file around it. */
const SCREEN_MARK = "THE CLIENT SCREEN — moved here whole";
const screenAt = page.indexOf(SCREEN_MARK);
ok("the client screen is identifiable in the page", screenAt > 0);
const screen = page.slice(screenAt);
/* The chips both screens draw are built here, so assertions about a chip belong here. */
const strip = fs.readFileSync(path.join(root, "lib", "admin-people-strip.js"), "utf8");

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

/* ------------------------------------------------------------------------
 * ONE page.
 *
 * 2026-09-01 he said there is no such thing as a clients module; 2026-09-02 he said to
 * finish the job: "תגרום לזה להיות באמת ובתמים דף ניהול אחד ויחיד בלי קומבינות". So the
 * client screen is in this file, beside the athlete side, and the two take turns in the
 * content area. Nothing travels anywhere.
 * --------------------------------------------------------------------- */
ok("one strip, built by the shared builder", /lib\/admin-people-strip\.js/.test(page));
ok("the page draws it", /function renderPeopleStrip/.test(page));
ok("the client screen has a home in this page", /id="clientScreen"/.test(page));
ok("it takes turns with the athlete side", /athleteSide\.hidden = mine/.test(page));
ok("a programme chip opens in place", /window\.ClientScreen\.open\(id\)/.test(page));
ok("an athlete chip hands the area back", /window\.ClientScreen\.close\(\)/.test(page));
ok("nothing navigates to the old page", !/location\.href = pagesAbsoluteUrl\("\/admin-clients/.test(page));
/* The old address still resolves: mails and bookmarks are already out in the world. */
ok("the old address is a redirect", /location\.replace\(target\)/.test(redirect));
ok("it carries the query across", /"admin\.html" \+ String\(location\.search/.test(redirect));
ok("and holds no screen of its own any more", redirect.length < 4000 && !/renderBrickView/.test(redirect));
ok("it reuses admin's session key", /"dw_admin_session"/.test(page));
ok("it reuses admin's remember key", /"dw_admin_remember"/.test(page));
ok("it reads the session token header on login", /X-Admin-Session-Token/.test(page));
ok("it sends the admin token on later calls", /X-Admin-Token/.test(page));
/* Both halves of the page attach the credential in one place each — admin's own
   adminAuthHeaders(), and the client screen's authHeaders(). Anything beyond that is
   the password being sprayed around a 5,000-line file. */
ok("the password is attached in few, named places", (page.match(/X-Admin-Password/g) || []).length <= 6);

/* --- one login on the page, and it is admin's ------------------------
 *
 * The client screen used to carry its own password box, its own remember-me report and
 * its own session handling — all of which belonged to being a page. It has none of them
 * now: a dead session goes to admin's forceAdminLogout, which is the one place that
 * knows how to end a session on this page.
 */
ok("the screen brought no second login with it", !/id="pwBtn"/.test(screen) && !/id="rememberState"/.test(screen));
ok("a dead session reaches admin's own handler", /window\.forceAdminLogout/.test(screen));
ok("admin still owns a login screen", /id="login-screen"/.test(page));

/* --- no AI on this surface either -------------------------------------- */

ok("the client screen names no AI provider", !/gemini|groq|generativelanguage/i.test(screen));
ok("it never calls personal-coach", !/personal-coach/.test(screen));
/* One endpoint, and it is the one with no route to a provider in it (POL-029). */
ok(
  "it talks to no endpoint that could generate anything",
  (screen.match(/\/api\/[a-z-]+/g) || []).every(function (u) {
    return u === "/api/client-program";
  })
);
/* The guarantee that actually protects a paying client is on the server, not here. */
ok(
  "and the endpoint it uses says so about itself",
  /aiSurface: "none"/.test(fs.readFileSync(path.join(root, "api", "client-program.js"), "utf8"))
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
  /* Another month sold: four more empty weeks on the same timeline. It creates no
     content — the owner writes it — so it does not make this a generating surface. */
  "add_block",
  "approve_block",
  "renewal_check",
  /* A TEST program only: fills a block with one labelled sample session so a whole
     month of the calendar can be judged at once. The server refuses it on any real
     client, so it cannot become a way to produce programming (POL-029). */
  "seed_test_block",
  /* The athlete list, for the other half of the shared strip. It reads; it makes
     nothing. */
  "admin_list",
  /* Freeze: the client keeps their plan, their history and their linked devices, and
     simply cannot open the door until the owner unfreezes them (2026-09-02). */
  "set_frozen",
  /* "Has any client changed anything?" — one small read of the index, on the page's
     own timer, so the owner sees a client's edit without reloading the page. */
  "list_stamp",
  /* "Am I still allowed in?" — the client's cheapest question, so a paused account
     stops reading the plan without waiting for a reload. */
  "ping",
  /* One call that empties the list, with a receipt. */
  "purge_all",
];
const actionsUsed = Array.from(
  new Set((screen.match(/action:\s*"([a-z_]+)"/g) || []).map(function (s) {
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
ok("the program is rendered by the shared library", /D\.renderBrickView\(/.test(page));
/* THE point of this change: the same calendar + day card the admin module shows,
   from the same function — not a second hand-written Sun→Sat list beside it. */
ok("it is the familiar brick view", /renderBrickView\(brickOpts\(\)\)/.test(page));
/* This file IS the source the shared stylesheet is cut from, so it carries the brick
   rules inline rather than linking the copy of itself. */
ok("the brick view is styled here", /\.pprog-day-card/.test(page));
ok("the old hand-written day list is gone", !/function renderAdminDays\(\) \{[\s\S]{0,400}day-head/.test(page));
/* The calendar carries its own W1…W5 rail, so a second week selector above it only
   competed with it. */
ok("there is no separate week bar left", !/data-week=/.test(page));
/* The wide horizontal spread the owner values: tapping a weekday letter opens that
   day in every week, side by side. */
ok("a weekday letter spreads that day across the weeks", /cvSelectDow/.test(page) && /selectedDays/.test(page));
ok("the spread can be cleared", /cvClearSelection/.test(page));
/* No AI on this page. The athlete's pre-talk footer must never appear (POL-029). */
ok("the athlete footer is switched off", /showFooter:\s*false/.test(page));
/* A session-count program has no weekdays; the calendar still shows the week and
   the intake's count is stated while writing. */
ok("a session-count program says how many sessions the week owes", /sessionCountLimit/.test(page));
/* Both directions, on the owner's explicit instruction. */
ok("a rest day opens with an empty draft rather than being refused", /rest \? \[\] :/.test(page));
ok("a written day can go back to rest", /data-makerest/.test(page) && /cvMakeRest/.test(page));
ok("turning a day to rest asks first", /confirm\("להפוך את היום ליום מנוחה/.test(page));
ok("both directions go through the shared toggle", /RT\.makeRest/.test(page) && /RT\.makeSession/.test(page));
/* The bug that made every save throw: RT was declared inside the renderer and read
   from the save path. One declaration, at module scope. */
ok("the rest toggle is read once, at module scope", (page.match(/\bvar RT\b/g) || []).length === 1);
/* An anchored block start, or the calendar's dates drift every time it is opened. */
ok("a new program is anchored to a real week", /blockStart: israelSundayIso\(\)/.test(page));
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
/* The card is the athlete's card now, so the signature reads where the health
   declaration reads on theirs: same row, same question. */
ok("the signature state is shown", /טרם נחתם|נחתם/.test(page));
ok("it sits where the declaration sits", /תנאי שימוש:/.test(page));

/* --- the summary box, as he laid it out on 2026-09-02 ---------------
 * The terms line answers one question — is this signature in force — and a signature is
 * good for a year. The version string and the date were the answer to a question nobody
 * asks at a glance, so they moved behind a chevron with the id. */
ok("the terms line is about validity, not paperwork", /terms\.valid \? "בתוקף" : "לא בתוקף · יש לחדש"/.test(page));
ok("a year old is not in force", /ageDays <= 365/.test(page));
ok("an unsigned client says so plainly", /terms\.label = "טרם נחתם"/.test(page));
ok("there is a chevron for the details", /data-termsmore="1"/.test(page));
ok("and behind it are the date and the id", /terms-uid">UID: /.test(page) && /נחתם " \+ esc\(new Date\(a\.signature\.signedAt\)/.test(page));
/* Access states itself on its own heading — one word did not need a row of its own. */
ok("the access state rides on the heading", /class="access-state /.test(page));
ok("green when they are in, orange when they are not", /access-state\.in\{color:#4CAF70/.test(page) && /access-state\.out\{color:#E8451A/.test(page));
/* The device list is separated from the words above it. */
ok("the devices heading is a heading", /devices-head/.test(page) && /devices-head\{padding-bottom:8px;margin-bottom:8px;border-bottom/.test(page));
ok("the card is built from the athlete card", /ath-fact-label">תאריך הצטרפות:/.test(page));
ok("the client link is copyable once it exists", /data-copylink/.test(page));

/* --- the layout he set on 2026-09-02 -------------------------------- */

ok("joining date is called that", /תאריך הצטרפות:/.test(page));
ok("tenure is gone from both cards", !/וותק/.test(page) && !/formatTenure/.test(page));
ok("the name carries the colour he picked", /class="ath-name" style="color:' \+ esc\(clientColour\(p\)\)/.test(page));
ok("the pencil opens the name-and-colour panel, not a browser prompt",
  /data-identity="1" title="שם וצבע"/.test(page) && !/window\.prompt\("שם הלקוח/.test(page));
ok("there is a chevron beside the name", /data-clientmore="1"/.test(page));
ok("what is behind it is his business alone", /function renderClientMorePop/.test(page));
ok("the money moved behind the chevron", /renderClientMorePop[\s\S]{0,900}id="fAmount"/.test(page));
ok("delete moved there too", /renderClientMorePop[\s\S]{0,1400}data-del="1"/.test(page));
ok("the note about the client not seeing it is gone", !/הלקוח לא רואה אותם/.test(page));
ok("and so is the save button — the fields commit on blur", !/data-savemeta/.test(page) && /data-metafield/.test(page));

/* Freeze: he asked for the athlete's control, on a client. */
ok("a client can be frozen", /data-freeze="/.test(page) && /הקפא משתמש/.test(page));
ok("freezing asks first, and says nothing is deleted", /שום דבר לא נמחק/.test(page));
ok("the state reads active or frozen", /frozen \? "מוקפא" : "פעיל"/.test(page));
ok("a failed door is reported rather than claimed", /doorClosed === false/.test(page));

/* Access: empty until issued, then one click for link and code together. */
ok("the link is hidden until it is issued", /linkShown \? "" : ' style="display:none"'/.test(page));
ok("one button issues both", /data-oneclick="1"/.test(page) && /צור לינק חד פעמי/.test(page));
ok("the code appears under the link", /liveCode[\s\S]{0,200}code-out/.test(page));
/* A code is spent when a device comes in, not when the screen redraws. It used to
   vanish while he was still copying it into WhatsApp (owner, 2026-09-02). */
ok("the code survives a redraw", /S\.issuedCode = \{ programId/.test(page));
ok("and goes only when a device has arrived", /S\.issuedCode\.programId === p\.programId && !devices/.test(page));
ok("the owner is told it will not survive a reload", /לא אחרי רענון דף/.test(page));
ok("delete has a bin, in the page's own font", /trashIconSvg\(\)/.test(page) && /btn-delete-client/.test(page));
ok("a link belongs to the client it was issued for", /S\.linkShown = ""/.test(page));
ok("linked devices are numbered", /מכשירים מקושרים/.test(page) && /\(i \+ 1\) \+ "\. "/.test(page));

/* --- unread flag: state, and cleared by opening ---------------------- */

/* The unread mark rides the calendar now, not the old day wrapper: the client list
   still carries one dot per client, and opening a day is what clears its flag. */
/* The dot moved into the shared strip builder with everything else about a chip. */
ok("one dot per client, not a count", /class="dot"/.test(strip));
/* A click is mousedown and mouseup on the same element; rewriting the strip between
   them eats the click and the owner has to press twice (owner, 2026-09-02). */
ok("the strip is only rewritten when it changed", /if \(sb\.innerHTML !== nextHtml\) sb\.innerHTML = nextHtml;/.test(page));
ok("unread days are passed to the view", /unreadDays/.test(page));
ok("opening a day marks it read", /action: "mark_read"/.test(page));
ok("marking read happens on opening a day, with no extra click", /markRead\(tag, unreviewed\)\.then/.test(page));
/* Two marks live on a day and they mean different things. Only the client's was ever
   reported, so on a fresh block — where every training day carries the owner's own
   "not been over this" — the badge never came down (owner, 2026-09-02). */
ok("opening a day clears the owner's own mark too", /var unreviewed = dayData\.ownerUnreviewed === true;/.test(page));
ok("and the badge goes from the copy on screen", /delete dd\.ownerUnreviewed;/.test(page));
ok("that goes through one place", /function openDayTag/.test(page));
ok("a client-changed day is labelled", /שונה ע"י הלקוח/.test(page));

/* --- payment fields are owner-only --------------------------------- */

ok("there is a monthly amount field", /id="fAmount"/.test(page));
ok("the amount is a number so it can be totalled", /id="fAmount" class="ath-fact-input" type="number"/.test(page));
ok("there is a free-text payment method", /id="fMethod" class="ath-fact-input" type="text"/.test(page));
ok("a monthly total is shown", /monthlyTotal/.test(page));
/* The reminder was removed on 2026-09-02: the fields are behind the chevron now, and a
   line explaining that his own back office is his own was noise. */
ok("the payment fields are still owner-only in the payload", true);

/* --- rename (a.3.3) ------------------------------------------------- */

ok("there is a pencil to rename", /data-identity/.test(page));
ok("renaming saves the name and the colour together", /program: \{ clientName: name, clientColour: colour \}/.test(page));

/* --- the label is 'client', not 'athlete' (a.3.2) ------------------ */

ok("the page speaks about clients", page.indexOf("New coach / studio client") >= 0);
/* The heading moved into the header bar when the page took admin.html's frame — a card
   titled "הלקוחות שלי" above a strip of clients was saying twice what the strip says
   once. And the tagline reads "Admin" on both screens, because there is one module. */
ok("and counts them where admin counts athletes", /id="athlete-count"/.test(page));

/* --- the cross-cutting intake, in English (checklist 2.b) ---------- */

ok("the page loads the shared intake definition", /src="lib\/client-intake\.js"/.test(page));
ok("the tabs come from that definition", /CLIENT_INTAKE.*TABS/.test(page));

/* The panes, in the owner's order. Population and Goals became ONE tab on 2026-09-01 —
   two tabs were describing the same room twice — and a pane for "additions & changes"
   joined them, shown only when the next block is being planned. */
const paneIds = (page.match(/data-pane="([a-z]+)"/g) || []).map(function (s) {
  return s.replace('data-pane="', "").replace('"', "");
});
ok(
  "the panes are in the owner's order",
  JSON.stringify(paneIds) ===
    JSON.stringify(["profile", "equipment", "schedule", "changes", "population"])
);
ok("goals is no longer a tab of its own", paneIds.indexOf("goals") < 0);
ok("nor a field of its own", !/id="inGoals"/.test(page));

/* One tab: how long a session is, then one box for the room and what it is for. */
ok("the merged tab asks how long a session is", /id="inMinutes" type="number" min="20" max="120"/.test(page));
ok("it says the warm-up is inside that number", /warm-up is inside this number/.test(page));
ok("the free box asks for the goals too", /what they are training for/.test(page));
ok("the session length is sent", /sessionMinutes: Number\(el\("inMinutes"\)\.value\)/.test(page));

/* Tab 1 */
ok("tab 1 asks for the client name", /id="inName"/.test(page));
ok("tab 1 takes the monthly amount as a number", /id="inAmount" type="number"/.test(page));
ok("tab 1 takes the payment method as text", /id="inMethod" type="text"/.test(page));
ok("tab 1 says the client cannot see the price", /client never sees them/i.test(page));

/* Tab 2 — exactly two options, OTHER reveals a box */
ok("equipment has the well-equipped option", /Well-equipped functional training gym/.test(page));
/* Two checkboxes side by side, not one being unticked (owner, 2026-09-01). */
ok("equipment is a checkbox, not a dropdown", /id="inEquipFull" type="checkbox" data-pick="equip" checked/.test(page));
ok("the default is ticked — the well-equipped gym", /id="inEquipFull" type="checkbox" data-pick="equip" checked/.test(page));
ok("OTHER sits beside it as its own checkbox", /id="inEquipOtherOn" type="checkbox" data-pick="equip">/.test(page));
ok("OTHER is unticked by default", !/id="inEquipOtherOn" type="checkbox" data-pick="equip" checked/.test(page));
ok("the two sit side by side", /class="pick-row"/.test(page) && /\.pick-row\{display:flex/.test(page));
/* Plain string search: a regex here needs escaping for ? and " and the escaping is
   what keeps going wrong, not the assertion. */
ok(
  "OTHER maps to other, anything else to the well-equipped gym",
  page.indexOf('el("inEquipOtherOn").checked ? "other" : "functional_gym"') >= 0
);
ok(
  "only OTHER reveals the description box",
  /id="inEquipOtherWrap"/.test(page) &&
    page.indexOf('el("inEquipOtherWrap").hidden = !equipOther') >= 0
);
ok("the box is hidden by default", /id="inEquipOtherWrap" hidden/.test(page));
/* The old copy told the owner to untick; there is nothing to untick now. */
ok("the stale untick instruction is gone", !/Untick if the place has something else/.test(page));
ok("there is no equipment dropdown left", page.indexOf('id="inEquip"') < 0);
ok("no select element survives on the equipment tab", !/<select id="inEquip/.test(page));

/* Tab 3 — a checkbox picks the mode, and each mode reveals its own follow-ups */
/* NOTHING is pre-ticked on this tab (owner, 2026-09-01): landing on it should present a
   decision, not an answer already filled in. */
ok("the session-count mode is a checkbox", /id="inSchedCount" type="checkbox" data-pick="sched">/.test(page));
ok("the full weekly plan is its own checkbox", /id="inSchedWeekly" type="checkbox" data-pick="sched">/.test(page));
ok("neither schedule mode is pre-ticked", !/data-pick="sched" checked/.test(page));
ok("the deload is the third top-level choice", /id="inDeload" type="checkbox">/.test(page));
ok("the deload is not pre-ticked either", !/id="inDeload" type="checkbox" checked/.test(page));
/* A mode the owner did not choose must never be inferred. */
ok(
  "no schedule mode is invented when neither is ticked",
  page.indexOf('el("inSchedWeekly").checked') >= 0 && /:\s*"",/.test(page)
);

/* HIERARCHY: each follow-up is indented under the choice it belongs to, and hidden
   until that choice is made. Flat, they read as four unrelated questions. */
ok("follow-ups are visually indented", /class="sub-branch"/.test(page));
ok("the indent is a real rule, not whitespace", /\.sub-branch\{[^}]*border-inline-start/.test(page));
ok(
  "'the sessions differ' is a sub-question of the session count",
  /id="inDifferWrap" class="sub-branch" hidden/.test(page)
);
ok(
  "the weekly follow-ups are sub-questions of the weekly plan",
  /id="inWeeklyWrap" class="sub-branch" hidden/.test(page)
);
ok(
  "the weekday rows are a sub-question of the emphases",
  /id="inWeekDays" class="sub-branch" hidden/.test(page)
);
/* ------------------------------------------------------------------------
 * A programme sold by the SESSION is drawn as sessions, not as a week.
 *
 * Three sessions a week with no fixed weekdays was being drawn as a Sun–Sat calendar,
 * which offered seven places to write where the owner had sold three. His report,
 * 2026-09-02: "המתבקש בתרחיש זה — הצגת 3 אימונים וזהו". Each session still lives on a
 * weekday key behind the scenes, so nothing already written moved.
 * --------------------------------------------------------------------- */
/* Settled on 2026-09-02, fourth attempt — and the answer was there all along: there is
   ONE calendar in this product, and a programme sold as "four sessions a week" is that
   calendar with four circles instead of seven. Not a weekday grid (seven places to
   write where four were sold), not a stack of cards, not a matrix of dashed boxes. His
   words: "באותו עיצוב בדיוק כמו התצוגה החודשית עם העיגולים המאושרת". */
ok("there is no second layout", !/function renderSessionsMatrix/.test(page) && !/sess-cell/.test(page));
ok("the programme is always the calendar", /host\.innerHTML = D\.renderBrickView\(brickOpts\(\)\)/.test(page));
ok("the calendar is told how many sessions were sold", /sessionColumns: sessions \|\| 0/.test(page));
ok("days beyond the sessions sold are not writable", /DAY_KEYS_LOCAL\.indexOf\(dayKey\) >= sessions/.test(page));
ok("the card names the session and the week", /"אימון " \+ \(activeIndex \+ 1\) \+ " · שבוע "/.test(page));
/* A brick is a month: opening on one week hid three quarters of what he sold. */
ok("the month opens whole", /S\.calMode = "month"/.test(page));

/* The calendar's own side of that bargain. */
const calSrc = fs.readFileSync(path.join(root, "lib", "pprog-display.js"), "utf8");
ok("the shared calendar takes a column count", /opts\.sessionColumns > 0 \? Math\.min\(7, opts\.sessionColumns \| 0\) : 7/.test(calSrc));
ok("a session column is numbered, not named", /if \(bySession\) \{\s*for \(d = 0; d < cols; d\+\+\) row \+= "<span>" \+ \(d \+ 1\)/.test(calSrc));
ok("the circle carries the session number", /var dateNum = bySession/.test(calSrc));
ok("and the weekday calendar is unchanged when nobody asks", /: 7;/.test(calSrc));

/* Rest days say WHICH days, in the same row of seven the emphases use. */
ok("ticking rest days opens a week", /id="inRestDaysWrap" class="sub-branch" hidden/.test(page));
ok("it is the same seven-column row", /id="inRestDayRow" class="emph-days"/.test(page));
ok("it appears only when rest days are on", page.indexOf('el("inRestDaysWrap").hidden = !restOn') >= 0);
ok("the days are read back from the form", /function restDaysFromForm/.test(page));
ok("and sent with the intake", /restDays: restDaysFromForm\(\)/.test(page));
ok("the owner is asked which days", /Tick the days that are rest days/.test(page));

/* The owner's order, 2026-09-01: the shape of the week first, the rest day under it.
   Reading the source positions is the only way to pin an order. */
ok(
  "the emphases come before the rest days",
  page.indexOf('id="inEmphasis"') < page.indexOf('id="inRestDays"')
);
/* Seven columns of equal width — a week should look like a week, not seven stacked
   rows the height of a screen. */
ok("the week is one row of seven", /\.emph-days\{display:grid;grid-template-columns:repeat\(7,1fr\)/.test(page));
ok("the day chips are a grid cell each", /class="emph-day"/.test(page));
ok("there are no tall day rows left", !/class="emph-row"/.test(page));
/* A note box one seventh of a screen wide cannot be written in, so it opens under the
   row and carries its day's name. */
ok("the note opens under the row", /id="inEmRow-/.test(page));
ok("the note is named by its day", /\.emph-note\{display:grid;grid-template-columns:54px 1fr/.test(page));
ok("ticking a day reveals its note", page.indexOf("row.hidden = !box.checked") >= 0);
/* On a phone seven columns are unreadable. */
/* The screen's rules are scoped under #clientScreen now, so it can share a file with
   the athlete side without restyling it. */
ok("the phone gets four columns", /#clientScreen \.emph-days\{grid-template-columns:repeat\(4,1fr\)/.test(page));
ok("neither branch shows before a mode is picked", page.indexOf('el("inDifferWrap").hidden = !byCount') >= 0);
ok("the weekly branch needs the weekly box", page.indexOf('el("inWeeklyWrap").hidden = !byWeek') >= 0);
ok("with no mode picked the owner is told to pick", /Pick how the place trains/.test(page));
ok("there is no schedule dropdown left", !/<select id="inSchedMode/.test(page));
ok("the session count sits next to it", /id="inSessions" type="number" min="1" max="7"/.test(page));
/* Empty on purpose — the owner types the number, nothing is guessed for a client. */
ok("the count box starts empty", /id="inSessions" type="number" min="1" max="7" value=""/.test(page));
ok("the count box is inline with the checkbox", /class="inline-num"/.test(page));
ok("the count disappears in weekly mode", page.indexOf('el("inSessions").hidden = !byCount') >= 0);
/* Beside its label, not shoved to the far edge, and big enough for two digits. */
ok("the count box sits next to its label", /\.inline-num\{[^}]*margin-inline-start:14px/.test(page));
ok("the count box is enlarged", /\.inline-num\{[^}]*font-size:19px/.test(page));
ok("it fits two digits", /\.inline-num\{[^}]*width:82px/.test(page));
/* The session descriptions are real sentences and will be read by the brain later. */
/* Equal columns across the full width. A flex basis stretched whatever landed on the
   last line, so five sessions came out three wide and two narrow — the owner's
   objection on 2026-09-01. A grid track is the same width on every row. */
/* Equal columns, and four times as wide as they were: the descriptions are whole
   sentences and about thirty characters of one were visible (owner, 2026-09-01). */
ok(
  "the session boxes share the width in equal columns",
  /\.sess-grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,420px\),1fr\)\)/.test(page)
);
ok("no session box carries a fixed basis any more", !/\.sess-box\{flex:/.test(page));
ok("no session count is ever invented", page.indexOf('parseInt(el("inSessions").value, 10) || 0') >= 0);
ok("an empty count draws no session boxes", /Fill in the number of sessions first/.test(page));
ok("the owner is told the coach picks the days", /delivers them whenever/i.test(page));

/* The two checkboxes are one exclusive choice, and it can never end up empty. */
ok("the pairs are bound as an exclusive choice", /function bindPickPair/.test(page));
ok("equipment is one such pair", page.indexOf('bindPickPair("equip")') >= 0);
ok("the schedule is the other", page.indexOf('bindPickPair("sched")') >= 0);
ok("re-clicking the active box keeps it ticked", /box\.checked = true;/.test(page));
ok("ticking one unticks its partner", /if \(other !== box\) other\.checked = false;/.test(page));

/* session_count → do the sessions differ? */
ok("there is a 'sessions differ' checkbox", /id="inSessionsDiffer" type="checkbox"/.test(page));
ok("it is unticked by default — uniform sessions", !/id="inSessionsDiffer" type="checkbox" checked/.test(page));
ok("uniform is described as standard CrossFit", /a standard CrossFit week/.test(page));
ok("differing sessions get one box each, laid out horizontally", /class="sess-grid"/.test(page) && /\.sess-grid\{display:grid/.test(page));
/* The boxes appear ONLY once "the sessions differ" is ticked. They were leaking into
   view because label.fld / .sess-grid display rules beat the `hidden` attribute. */
ok("the session boxes start hidden", /id="inSessionTypes" class="sess-grid" hidden/.test(page));
ok("only 'sessions differ' reveals them", page.indexOf('el("inSessionTypes").hidden = !differ') >= 0);
ok("the hidden attribute actually hides, whatever the display rule", /\[hidden\]\{display:none!important\}/.test(page));
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
ok("the note row starts hidden", /id="inEmRow-' \+ k \+ '" hidden/.test(page));
ok("the day rows are delegated, since they are rebuilt", /data-emph/.test(page));
ok("the days come from the shared definition", /CI\.DAY_KEYS/.test(page) && /CI\.DAY_LABELS/.test(page));
/* An unticked day with leftover text must not quietly become an emphasis. */
ok("only a ticked day contributes a note", /box && box\.checked && txt/.test(page));

/* The deload lives inside the schedule tab now — one checkbox never warranted a step
   of its own, and it is part of the schedule either way (owner, 2026-09-01). */
ok("deload is a checkbox", /id="inDeload" type="checkbox"/.test(page));
ok("there is no deload pane left", !/data-pane="deload"/.test(page));
ok("the deload sits under the schedule pane", page.indexOf('class="sched-sep"') >= 0);
ok(
  "the deload checkbox is inside the schedule pane",
  page.indexOf('data-pane="schedule"') < page.indexOf('id="inDeload"') &&
    page.indexOf('id="inDeload"') < page.indexOf('data-pane="population"')
);
/* The deload is a CADENCE over a monthly product, not a fifth week bolted onto this
   month. The owner sells by the month; setting 5 means month TWO opens on the deload
   (2026-09-01). The wizard has to say that, because "5-week block" is the wrong story
   and it is the one we told first. */
ok("there is a week number to fill in", /id="inDeloadAt" type="number" min="4" max="12"/.test(page));
ok("the number is a sub-question of the deload", /id="inDeloadWrap" class="sub-branch" hidden/.test(page));
ok("it appears only once the deload is ticked", page.indexOf('el("inDeloadWrap").hidden = !deloadOn') >= 0);
ok("the number is sent to the server", /deloadEveryWeeks: Number\(el\("inDeloadAt"\)\.value\)/.test(page));
ok("the owner is told a new month can open on it", /next month opens on the deload/.test(page));
ok("the cadence is spelled out once he types", /then every " \+ every \+ " weeks/.test(page));
ok("below four he is told why not", /leanest cycle that works/.test(page));
ok("no deload is the stated default", /\(Default\.\)/.test(page));
ok("nothing claims a five-week block any more", !/5 weeks: four build weeks/.test(page));

/* ------------------------------------------------------------------------
 * The next block, and the gate in front of it.
 *
 * A block is what the owner plans, approves and SENDS. Nothing in it reaches the
 * client until he presses approve — block one included (owner, 2026-09-01) — so the
 * page has to make "planned but not sent" impossible to miss.
 * --------------------------------------------------------------------- */
ok("there is a way to plan the next block", /data-nextblock="1"/.test(page));
ok("the old add-a-month button is gone", !/data-addmonth/.test(page));
ok("planning it opens the questionnaire again", /function startNextBlock/.test(page));
ok("it is the SAME questionnaire, filtered", /function intakeDefs/.test(page) && /keep\.indexOf\(t\.id\) >= 0/.test(page));
ok("payment is not asked again", /keep = \["equipment", "schedule", "population"\]/.test(page));
ok("but equipment is — a rig arrives, a rower breaks", /equipment/.test(page));
ok("it opens on what the client already answered", /function fillIntakeForm/.test(page));
ok("including the schedule they are on", /el\("inRestDays"\)\.checked = v\.includeRestDays/.test(page));
ok("a goals answer from before the merge is not lost", /mergedPopulation/.test(page));
ok("the notes pane is only for the next block", /data-pane="changes"/.test(page));
ok("the block is created with those answers", /action: "add_block"/.test(page));
ok("a concurrent save is handled, not clobbered", page.indexOf("r.status === 409") >= 0);

ok("an unsent block is shown as unsent", /טרם נשלחה ללקוח/.test(page));
ok("and can be sent", /data-approve=/.test(page) && /action: "approve_block"/.test(page));
ok("sending it asks first", /confirm\("לשלוח את לבנה/.test(page));
ok("the owner is told what sending means", /מרגע זה הוא רואה אותה ויכול לערוך/.test(page));

/* The new block arrives as the owner's own to-do list, in its own visual channel —
   the red dot already means "the client changed something". */
ok("the days he has not been over are marked", /reviewDays: reviewTags\(\)/.test(page));
ok("the mark is read off the days themselves", /function reviewTags/.test(page));
ok("it is a different flag from the client's", /extraDayFlagField: "ownerUnreviewed"/.test(page));
ok("worded for him", /לא עברת על זה/.test(page));

ok("the owner sees how long the program is", /function weeksLabel/.test(page));
ok("and where the deload sits", /דילואד כל /.test(page));

/* "Make it a rest day" sits beside the date while the day is edited — the same place
   and the same shape as the client's own page. One control, one corner. */
ok("the rest control is handed to the card header", /editHeaderActionsHtml: restToggleHeaderHtml\(\)/.test(page));
ok("it only exists while the day is edited", /function restToggleHeaderHtml/.test(page) && /if \(!S\.edit\) return "";/.test(page));
ok("the old footer row is gone", !/restToggleRowHtml/.test(page));
ok("it is styled like the client's", /\.rest-inline\{/.test(page));

/* ------------------------------------------------------------------------
 * One frame, because there is one page.
 *
 * 2026-09-01 the instruction was not to reinvent the admin module; 2026-09-02 it was to
 * stop pretending there were two of anything. The client screen has no frame at all
 * now — it renders inside admin's, and its own rules are scoped so that sharing a file
 * restyles nothing.
 * --------------------------------------------------------------------- */
ok("the client screen brought no frame of its own", !/#clientScreen header\{/.test(page) && !/#clientScreen \.tabs-bar\{/.test(page));
ok("its rules are all scoped", (page.match(/\n#clientScreen /g) || []).length > 40);
ok("the app frame is admin's", /<div id="app">/.test(page) && /class="tabs-bar"/.test(page));
ok("it opens by admin's own class", /app\.classList\.add\("is-open"\)/.test(page));
ok("the header carries the counters", /id="athlete-count"/.test(page) && /class="count-wrap"/.test(page));
ok("adding a client is one button", /id="btn-add-athlete"/.test(page) && /function chooseClientKind/.test(page));
/* The count names both halves. When the owner reported "all my athletes disappeared"
   there was no way to tell from the screen whether that half had answered empty or had
   not answered at all — so now the screen says which. */
ok("the count is everyone he manages", /rows\.length \+ " לקוחות · "/.test(page));
ok("and it says which half is which", / מתאמנים · /.test(page) && / תוכניות/.test(page));

/* ------------------------------------------------------------------------
 * The header the owner specified on 2026-09-01, item by item.
 *
 * He read the production header out loud and said what survives: the logo, the
 * versions, how many clients, and the one button he presses. Everything else was a
 * control he never uses — including a logout, because he is the only person who ever
 * opens this and there is no scenario in which he logs out.
 * --------------------------------------------------------------------- */
ok("no logout", !/id="logoutBtn"/.test(page));
ok("no rebuild button in the header", !/id="rebuildBtn"/.test(page));
/* The index rebuild is a repair, not a working control. It stays reachable. */
ok("but the repair itself is still reachable", /rebuild_index/.test(page) && /ev\.altKey/.test(page));
ok("the version is shown", /id="admin-ver-badge"/.test(page));
ok(
  "and it is the SAME version admin shows",
  (page.match(/var ADMIN_UI_VERSION = "([\d.]+)"/) || [])[1] ===
    (admin.match(/var ADMIN_UI_VERSION = "([\d.]+)"/) || [])[1]
);
/* An empty pill reads as a control that lost its label. */
/* The second page's own counters went with the second page. What the client screen
   still computes, it hands to the strip through adminOnClientRows. */
ok("the screen reports its totals rather than painting a header", /window\.adminOnClientRows\(S\.rows, total, data\.unreadTotal/.test(screen));
ok("and it guards the header cells it no longer owns", /if \(el\("monthlyTotal"\)\)/.test(screen));

/* The wizard used to sit under the tab strip on the first paint, as though a client
   were being added: it had no hidden attribute and relied on a wrapper that the admin
   frame replaced. */
ok("the wizard starts hidden", /id="intakeCard"[^>]*hidden/.test(page));
ok("no hand-copied strip values are left", !/\.crow\{display:inline-flex/.test(page));
ok("a test client still says so", /badge test">בדיקה/.test(strip));
ok("the unread dot survives the move", /class="dot" title="יש שינוי שלא ראית"/.test(strip));

/* Several days on screen at once — Ctrl-click and drag, as in the admin module. */
ok("the calendar hands the click event over", /passCalEvent: true/.test(page));
ok("ctrl or cmd makes the click additive", /toggleSelected\(nextWi, nextDay\);/.test(page));
/* Adding a day to a comparison is not "I have been over this". Reporting it as read
   fired a write per click, and two quick picks raced on the same version — which is why
   picking 1→2→3 behaved differently from 3→2→1 (owner, 2026-09-02). */
ok("an additive pick does not report the day as read", /toggleSelected\(nextWi, nextDay\);[\s\S]{0,80}renderAdminDays\(\);[\s\S]{0,20}return;/.test(page));
ok("dragging across the calendar takes the run", /function bindCalGestures/.test(page));
/* Straight down a column is a column — every Thursday of the block, not the whole run
   of days between them. */
ok("a vertical drag selects the column", /function applyColumn/.test(page));
ok("and only when the drag stays in one column", /if \(to\.day === cvCalDrag\.startDay && to\.wi !== cvCalDrag\.startWi\)/.test(page));

/* --- three ways to read one programme ------------------------------- */
ok("the page offers all blocks, this block, this week", /window\.cvSetView = function/.test(page));
/* One row, one kind of button: the three views wear Today's clothes, and the whole bar
   is in English like every other label on the calendar (owner, 2026-09-02). */
const calLib = fs.readFileSync(path.join(root, "lib", "pprog-display.js"), "utf8");
ok("the views are named in English", /All blocks<\/button>/.test(calLib) && /This block<\/button>/.test(calLib) && /This week<\/button>/.test(calLib));
ok("so is the block heading", /"pprog-cal-block-title">Block /.test(calLib));
ok("and the sessions label", /cols \+ " sessions a week"/.test(calLib));
ok("no Hebrew is left on the calendar bar", !/כל הלבנות|לבנה נוכחית|השבוע<|אימונים בשבוע/.test(calLib));
ok("they are the same shape as Today", /\.pprog-cal-view\{appearance:none;background:transparent[^}]*min-height:34px\}/.test(page));
/* Today is an ACTION, the views are a STATE. Both solid yellow made Today read as
   permanently pressed (owner, 2026-09-02). */
ok("the current view is orange, not yellow", /\.pprog-cal-view\.on\{background:var\(--brand\)/.test(page));
ok("and Today keeps the yellow to itself", /\.pprog-cal-today\{appearance:none;background:#F5C518/.test(page));
ok("and hands the hook to the calendar", /setView: "cvSetView"/.test(page));
ok("the calendar is told where the blocks divide", /blockGroups: \(\(S\.program && S\.program\.blocks\)/.test(page));
ok("tapping a week opens that week, not its general note", /for \(var i = 0; i < limit; i\+\+\) out\.push\(\{ wi: w, day: DAY_KEYS_LOCAL\[i\] \}\);/.test(page));
/* The selection maths lives beside the calendar that draws it, in the display library,
   so this page and the client's page share one definition of "which days are picked" —
   without either of them loading the admin module's debrief helper for three
   functions. */
ok("the selection maths is not copied", /D\.selId \? D : null/.test(page) && !/function rangeBetween/.test(page));
/* admin.html loads the debrief helper for the ATHLETE side; what matters is that the
   client screen does not reach for it. */
ok("and the client screen does not reach for the debrief helper", !/AdminDoneDebrief/.test(screen));
/* Picked in any order, held in date order — over a month that stops being a nicety. */
ok("the selection is kept in date order", /function sortSel/.test(page) && /sortSelectedDays/.test(page));
/* A hand that moves a pixel between press and release must not turn "add this day"
   into "take the run from here to there". */
ok("a ctrl-click never starts a drag", /if \(ev\.ctrlKey \|\| ev\.metaKey\) \{ cvCalDrag = null; return; \}/.test(page));
ok("a drag does not end in a click that clears it", page.indexOf("cvIgnoreNextClick = true") >= 0);
ok("dragging paints instead of re-rendering", /function paintCalSelection/.test(page));

/* The last tab: the room, its limits, and what it is training for — one box. */
ok("the last tab asks about the place and the people", /id="inPopulation"/.test(page));

/* 2.c — no individual capability anywhere on this form */
[
  "inAge", "inBodyweight", "inLifts", "inSkills", "inInjuries", "inExperience", "inGender",
].forEach(function (id) {
  ok('the form has no individual field "' + id + '"', page.indexOf('id="' + id + '"') < 0);
});

/* English, on the owner's instruction — check the tab and field text, not comments */
/* Slice on the NEXT identified view rather than a bare <div class="card">: a bare
   boundary stopped matching once before and silently emptied this slice instead of
   failing loudly on its content. The list card is gone (the header's strip replaced
   it), so the open-client view is now what follows the wizard. */
const intakeStart = page.indexOf('<div class="card" id="intakeCard"');
const intakeEnd = page.indexOf('id="detail" hidden');
const intakeCard = intakeStart >= 0 && intakeEnd > intakeStart ? page.slice(intakeStart, intakeEnd) : "";
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
/* Behind the chevron since 2026-09-02, with a bin and the page's own font — it was
   rendering as a bare browser button in the middle of the panel. */
ok("delete is styled as dangerous", /class="btn-delete-client" data-del="1"/.test(page));

/* --- phone reality ---------------------------------------------- */

ok("inputs are 16px so iOS does not zoom", /font-size:16px/.test(page));
ok("touch targets are 44px", /min-height:44px/.test(page));
ok("safe-area insets are honoured", /env\(safe-area-inset-top/.test(page));
ok("there is a small-screen breakpoint", /@media \(max-width:600px\)/.test(page));
ok("the page is not indexed", /noindex/.test(page));

console.log("All admin clients page checks passed.");
