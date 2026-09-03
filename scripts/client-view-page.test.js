/**
 * client.html — the delivery surface.
 * Run: node scripts/client-view-page.test.js
 *
 * Checks the page keeps the promises made to the owner, and the handful of
 * cross-platform details that decide whether this is usable on a phone at all.
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
const html = fs.readFileSync(path.join(root, "client.html"), "utf8");

/* --- the JS must parse; a syntax error here is a blank page for the client --- */

const scripts = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html))) scripts.push(m[1]);
ok("the page has inline script", scripts.length >= 1);
scripts.forEach(function (code, i) {
  let err = null;
  try {
    new vm.Script(code, { filename: "client.html block#" + (i + 1) });
  } catch (e) {
    err = (e && e.message) || String(e);
  }
  ok("inline script block " + (i + 1) + " parses", err === null);
});

/* --- NO AI, anywhere ---------------------------------------------------- */

ok("the page never calls personal-coach", !/personal-coach/.test(html));
ok("the page never calls generate-workout", !/generate-workout/.test(html));
ok("the page names no AI provider", !/gemini|groq|generativelanguage/i.test(html));
ok(
  "the only endpoint the page talks to is client-program",
  (html.match(/\/api\/[a-z-]+/g) || []).every(function (u) {
    return u === "/api/client-program";
  })
);

/* --- the credential is a header, never a URL --------------------------- */

ok("the token is sent as a header", /X-Client-Token/.test(html));
ok("the token is not put in the query string", !/clientToken=/.test(html));
ok("the token is stored per program", /dw_client_token_/.test(html));
ok("localStorage access is wrapped in try/catch", /try\s*\{\s*return localStorage/.test(html));
ok("a revoked device clears its token", /clearToken\(\);\s*openAuth/.test(html));

/* --- shared code, not a lookalike ------------------------------------- */

ok("the page loads the shared display library", /src="lib\/pprog-display\.js"/.test(html));
ok("the page loads the shared block normaliser", /src="lib\/normalize-pprog-block\.js"/.test(html));
ok("the page takes the shared library from the global", /window\.PprogDisplay/.test(html));
ok("the program is rendered by the shared library", /\bD\.renderBrickView\(/.test(html));
/* The familiar view, not a second hand-written list: the same calendar + day card
   the owner sees in the admin module, from the same function. */
ok("it is the same brick view the admin module shows", /renderBrickView\(brickOpts\(\)\)/.test(html));
ok("it links the shared brick stylesheet", /styles\/pprog-display\.css/.test(html));
ok("day keys come from the shared library too", /PprogDisplay && window\.PprogDisplay\.DAY_KEYS/.test(html));
/* No AI on this page at all, so no athlete pre-talk footer. */
ok("the athlete footer is switched off", /showFooter:\s*false/.test(html));
ok("the page uses the app's design tokens", /--brand:#E8451A/.test(html) && /--coach:#9b6bb8/.test(html));
ok("the page uses the app's fonts", /family=Heebo/.test(html) && /Oswald/.test(html));

/* --- the terms come from the one source of truth ---------------------- */

ok("the page loads the terms module itself", /src="lib\/client-terms\.js"/.test(html));
ok("the page reads window.CLIENT_TERMS", /window\.CLIENT_TERMS/.test(html));
/* A second copy of legal wording in the page would be a copy that can drift. */
ok(
  "the legal wording is NOT duplicated into the page",
  !/SCOPE OF SERVICES/.test(html) && !/היקף השירותים/.test(html)
);
ok("English and Hebrew are both rendered", /SECTIONS_EN/.test(html) && /SECTIONS_HE/.test(html));
ok("the Hebrew block is laid out right-to-left", /\.terms-he\{direction:rtl/.test(html));
ok("the agree button is disabled until the box is ticked", /agreeBtn"\)\.disabled = !this\.checked/.test(html));
ok("the checkbox label comes from the terms module", /CONFIRM_LABEL/.test(html));

/* The UMD module must actually expose itself to a browser. */
const termsSrc = fs.readFileSync(path.join(root, "lib", "client-terms.js"), "utf8");
ok("the terms module is UMD", /root\.CLIENT_TERMS = factory\(\)/.test(termsSrc));
const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(termsSrc, sandbox);
ok("the terms module loads in a browser-like global", !!sandbox.self.CLIENT_TERMS);
ok("the browser copy carries the owner's version", sandbox.self.CLIENT_TERMS.TERMS_VERSION === "v3.4-legal");
ok("the browser copy has all five clauses", sandbox.self.CLIENT_TERMS.SECTIONS_EN.length === 5);
/* Same object the server signs against — one file, no drift. */
ok(
  "browser and server read the identical text",
  sandbox.self.CLIENT_TERMS.SECTIONS_EN[0].body === require("../lib/client-terms.js").SECTIONS_EN[0].body
);

/* --- watermark: present, not intrusive -------------------------------- */

ok("a quiet identity line is rendered on screen", /wm-line/.test(html) && /Prepared for /.test(html));
ok(
  "there is NO diagonal wash over the text on screen",
  !/transform:\s*rotate/.test(html) && !/repeating-linear-gradient/.test(html)
);
/* PRINTING IS REFUSED (owner, 2026-09-01). A printed programme is a copy he cannot
   see, cannot revoke and cannot watermark once it is on paper. A page cannot stop a
   browser opening its own print dialog, so it makes the result worthless instead. */
ok("there is no way to print from the page", !/printBtn/.test(html) && !/window\.print\(\)/.test(html));
ok("and the print sheet hides the programme", /@media print\{[\s\S]*body > \*\{display:none!important\}/.test(html));
ok("the printed page says why", /not available in print/.test(html));
ok("no print-only watermark is left to maintain", !/print-mark/.test(html));
ok("copied text carries its origin", /addEventListener\("copy"/.test(html) && /prepared for /.test(html));
ok("a short selection is not tagged", /sel\.length < 40/.test(html));

/* --- print view drops the controls ----------------------------------- */

/* The print view used to be a feature — a clean, watermarked copy for a coach to hand
   to their own athletes. It is refused now (see above), so there is no page layout left
   to protect. */
ok("there is no print layout left to maintain", !/page-break-inside:avoid/.test(html));

/* --- phone reality --------------------------------------------------- */

ok("viewport honours the notch", /viewport-fit=cover/.test(html));
ok("safe-area insets are applied", /env\(safe-area-inset-top/.test(html) && /env\(safe-area-inset-bottom/.test(html));
ok("dvh is used alongside vh for iOS", /min-height:100dvh/.test(html));
/* Under 16px, iOS zooms the page when a field is focused and never zooms back. */
ok("inputs are at least 16px", /font-size:16px/.test(html));
ok("touch targets are at least 44px", /min-height:44px/.test(html));
/* Read the viewport tag itself — a prose mention of these flags in a comment is
   not the same as setting them, and the test should not confuse the two. */
const viewportTag = (html.match(/<meta name="viewport"[^>]*>/i) || [""])[0];
ok("there is a viewport tag", viewportTag.length > 0);
ok("zoom is not blocked", !/maximum-scale/i.test(viewportTag) && !/user-scalable\s*=\s*no/i.test(viewportTag));
ok("the viewport scales to the device", /width=device-width/.test(viewportTag));
ok("there is a small-screen breakpoint", /@media \(max-width:520px\)/.test(html));
ok("no hover-only interaction carries meaning", !/:hover[^{]*\{[^}]*display:/.test(html));
ok("the page is not indexed by search engines", /noindex/.test(html));

/* --- conflict handling is honest ------------------------------------ */

ok("a 409 shows the coach's current version", /status === 409/.test(html));
ok("a conflict explains itself plainly", /changed this program while you had it open/.test(html));
ok("a conflict does not silently discard the save", /please make your change again/i.test(html));
ok("an unstable connection is disclosed", /connection looks unstable/.test(html));

/* --- the pull that keeps the plan current -------------------------- */

ok("the page pulls on returning to the foreground", /visibilitychange/.test(html));
ok("it does not pull while the coach is mid-edit", /if \(!state\.program \|\| state\.edit\) return;/.test(html));
/* Refresh is gone on the owner's instruction (2026-09-01), and it was redundant: the
   page already pulls when it comes back to the foreground and reloads itself after
   every save. A button that repeats what happens anyway reads as a button that is
   needed. */
ok("there is no manual refresh button left", !/refreshBtn/.test(html));

/* --- sharing sits beside the date, as in the athlete's app ---------- */

ok("the share button is switched on", /showShare: true/.test(html));
ok("the icon is the shared WhatsApp mark", /shareIcon: D\.waIconSvg/.test(html));
/* It sits beside the date, where the athlete's app puts it — not stranded at the far
   edge of the header, which is where it landed with no Done button next to it. */
ok("the mark sits beside the date", /shareBesideDate: true/.test(html));
ok("the icon is not a second hand-cut copy", !/viewBox="0 0 24 24"/.test(html));
ok("sharing goes to WhatsApp", /wa\.me/.test(html));
ok("the message is built by the shared library", /D\.dayShareText\(/.test(html));
ok("there is no Print / share button any more", !/Print \/ share/.test(html));
/* Printing went with it. The owner weighed the watermarked copy against a copy he
   cannot revoke, and chose to keep the programme where he can still reach it. */
ok("and no print link either", !/id="printBtn"/.test(html));

/* --- "make it a rest day" belongs beside the date ------------------- */

ok("the rest control is handed to the card header", /editHeaderActionsHtml: restToggleHeaderHtml\(\)/.test(html));
ok("it only exists while the day is edited", /function restToggleHeaderHtml/.test(html) && /if \(!state\.edit\) return "";/.test(html));
ok("the footer row it used to live in is gone", !/restToggleRowHtml/.test(html));
/* A TICK BOX, always there while editing. The button it replaced only appeared once a
   session had been written, so on an empty day — most of a new block — there was no way
   to mark rest at all (owner, 2026-09-01). */
ok("it is a tick box", /class="pprog-rest-check"/.test(html) && /data-restcheck=/.test(html));
/* Corrected 2026-09-02: mirroring the day meant it opened already ticked on every
   empty day, and ticking a ticked box does nothing — the control read as broken. While
   editing it is an intent: empty, and ticking it plants a rest day. */
ok("it opens empty, as an intent", /state\.edit\.restIntent \? " checked" : ""/.test(html));
ok("unticking does not write anything", /if \(!t\.checked\) return;/.test(html));
ok("an empty day can still be marked as rest", !/if \(isRest\) return "";/.test(html));
ok("unticking hands back an empty session", /function setRestChecked/.test(html) && /rest: false,/.test(html));
ok("wiping a written day asks first", /hasContent && !window\.confirm/.test(html));

/* The same gestures the owner has in his own module. */
ok("the client can pick several days too", /function bindCalGestures/.test(html));
/* "This one is on screen, ctrl-click that one" means both, so the open day is seeded
   into an empty selection before the clicked one is added (owner, 2026-09-03). */
ok("ctrl-click adds one", /toggleSelected\(nextWi, nextDay\);/.test(html));
ok("and the day already open joins it", /state\.selected = \[\{ wi: prevWi, day: prevDay \}\];/.test(html));
ok("a ctrl-click never starts a drag", /if \(ev\.ctrlKey \|\| ev\.metaKey\) \{ cvCalDrag = null; return; \}/.test(html));
ok("the selection is held in date order", /function sortSel/.test(html) && /sortSelectedDays/.test(html));

/* --- the coach changed a day: the client has to see it -------------- */

ok("the client's flag reads the coach's field", /dayModifiedField: "coachModified"/.test(html));
ok("it is worded for the client", /COACH UPDATED/.test(html));
ok("the calendar dot is derived from the days themselves", /function coachChangedTags/.test(html));
ok("opening the day takes the flag down", /function markCoachChangeSeen/.test(html));
ok("clearing is sent as mark_read", /action: "mark_read"/.test(html));
ok("a failed clear never costs the client the day", /\.catch\(function \(\) \{\}\)/.test(html));

/* --- editing model -------------------------------------------------- */

/* 21.7: the free-text box gave way to the shared structured editor, so a client's
   day round-trips through the same title / note / format / work-line shape the
   owner writes in. partsFromDraft is the exact inverse of draftFromDayData. */
ok("the day is edited through the shared draft", /draftFromDayData/.test(html));
ok("a save converts the draft back with the shared inverse", /partsFromDraft/.test(html));
ok("the free-text editor is gone", !/function textToParts/.test(html));
ok("an empty draft is refused rather than saved blank", /draftHasContent/.test(html));
/* Both directions, on the owner's explicit instruction. */
ok("a rest day can become a session", /rest \? \[\] :/.test(html));
ok("a session can become a rest day", /data-makerest/.test(html) && /cvMakeRest/.test(html));
ok("turning a day to rest asks first", /confirm\("Make this a rest day/.test(html));
ok("a save sends the version it loaded", /expectedVersion: state\.program\.version/.test(html));
ok("MODIFIED is shown on a changed day", /pprog-modified-flag/.test(html));

/* --- static hosting reality ---------------------------------------- */

ok("api calls go to the Vercel base, not a relative path", /mama-wod\.vercel\.app/.test(html));
ok("localhost still works for dev", /localhost/.test(html));

/* --- reads are money -------------------------------------------------
 * A phone foregrounds a page dozens of times an hour and each pull is a paid read.
 * On 2026-09-02 the Blob store was suspended over exactly this kind of arithmetic. */
/* Fifteen seconds, not sixty: the coach writes, the client flips back, and a minute of
   silence looked like the update never arrived (owner, 2026-09-02). Still one small
   read on return, never a poll. */
ok("but not twice in a few seconds", /FOREGROUND_MIN_GAP_MS = 15000/.test(html) && /Date\.now\(\) - lastProgramLoadMs < FOREGROUND_MIN_GAP_MS/.test(html));
ok("switching windows counts as coming back", /window\.addEventListener\("focus", pullIfStale\)/.test(html));


/* --- autosave, on the client side too (owner, 2026-09-03) ------------ */
ok("there is one place that commits a draft", /function autosaveDraft\(\)/.test(html));
ok("moving to another day saves it", /if \(state\.edit && \(state\.edit\.wi !== nextWi \|\| state\.edit\.day !== nextDay\)\) autosaveDraft\(\)/.test(html));
ok("so does the pencil on another card", /if \(state\.edit && \(state\.edit\.wi !== nextWi \|\| state\.edit\.day !== day\)\) autosaveDraft\(\)/.test(html));
ok("cancel still discards", /window\.cvEditCancel = function \(\) \{\s*state\.edit = null;/.test(html));
ok("an unchanged draft costs no request", /if \(samePartsAsStored\(draft\.wi, draft\.day, parts\)\) return;/.test(html));
ok("the Save button is still there", /window\.cvEditSave = function/.test(html));
/* An autosave must not drag the reader back to the day they just left. */
ok("an autosave does not move them", /var quiet = !!\(opts && opts\.quiet\);/.test(html));

/* --- a paused client stops reading the plan -------------------------
 * Freeze only bit after a manual reload: a client with the tab open kept reading their
 * month (owner, 2026-09-02). Now any refused call takes the plan off the screen, and a
 * visible tab asks the cheapest question there is once a minute. */
ok("a frozen answer is recognised wherever it arrives", /out\.body\.code === "FROZEN"\) showFrozen\(\)/.test(html));
/* Deleting a client left their tab reading the month with a message above it. Freezing
   and deleting differ in whether they can be undone, not in what the reader can see
   meanwhile (owner, 2026-09-03). */
ok("one place takes the plan off the screen", /function lockOut/.test(html));
ok("a deleted programme uses it", /function showGone/.test(html) && /if \(r\.status === 404\) \{ showGone\(\); return; \}/.test(html));
ok("the heartbeat notices a deletion, not only a freeze", /if \(out\.status === 404\) showGone\(\)/.test(html));
ok("and an unauthorised device does not keep it behind the code box", /function openAuth\(msg\) \{[\s\S]{0,200}state\.program = null;/.test(html));
ok("nothing about the plan is kept in local storage", !/localStorage\.setItem\([^)]*program/i.test(html));
ok("the plan comes off the screen, not a banner over it", /function showFrozen/.test(html) && /state\.program = null;/.test(html));
ok("and the client is told nothing was lost", /nothing you have written has been lost/.test(html));
ok("a visible tab keeps asking", /api\(\{ action: "ping" \}\)/.test(html));
ok("but never while hidden", /if \(typeof document !== "undefined" && document\.hidden\) return;/.test(html));

console.log("All client view page checks passed.");
