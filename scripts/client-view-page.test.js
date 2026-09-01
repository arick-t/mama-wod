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
ok("the full mark appears in print", /\.print-mark\{display:block!important/.test(html));
ok("the print mark says not for redistribution", /Not for redistribution/.test(html));
ok("copied text carries its origin", /addEventListener\("copy"/.test(html) && /prepared for /.test(html));
ok("a short selection is not tagged", /sel\.length < 40/.test(html));

/* --- print view drops the controls ----------------------------------- */

ok("print hides the buttons and week bar", /@media print[\s\S]{0,400}display:none!important/.test(html));
ok("print avoids splitting a day across pages", /page-break-inside:avoid/.test(html));

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
ok("it does not pull while the coach is mid-edit", /!state\.edit\) loadProgram/.test(html));
ok("there is a manual refresh too", /refreshBtn/.test(html));

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

console.log("All client view page checks passed.");
