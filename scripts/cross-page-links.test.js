/**
 * Links between our pages, and admin auth on coach calls.
 * Run: node scripts/cross-page-links.test.js
 *
 * Three bugs the owner found by clicking, pinned here so they cannot come back:
 *
 *  1. Vercel can serve a page at "/admin.html/" — WITH A TRAILING SLASH. Every
 *     relative link then resolves one level too deep, which turned a redirect into
 *     /admin.html/admin-clients.html and a 404.
 *  2. The same arithmetic built the client link, so the URL handed to a paying
 *     client would have been .../admin-clients.html/client.html — a dead link.
 *  3. Two of the three /api/personal-coach calls in admin.html sent no auth header,
 *     so the server saw an anonymous caller and demanded the athlete Terms
 *     signature — which the owner cannot give from the admin module.
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
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const clients = fs.readFileSync(path.join(root, "admin-clients.html"), "utf8");

/* --- 1 · no relative redirect between pages --------------------------- */

ok(
  "the coach/studio choice redirects absolutely",
  /pagesAbsoluteUrl\("\/admin-clients\.html\?new=coach"\)/.test(admin)
);
ok(
  "no bare relative redirect is left",
  !/location\.href = "admin-clients\.html/.test(admin)
);
ok("the reason is recorded", /resolves against the\s*\n?\s*current path/.test(admin));

/* The path resolver must survive the trailing slash that caused the 404. */
const basePathSrc = (admin.match(/function getPagesBasePath\(\)[\s\S]*?\n\}/) || [""])[0];
ok("the base-path resolver exists", basePathSrc.length > 50);
ok("it strips a trailing slash after .html", /\\\.html\\\/\$/.test(basePathSrc) || /\.html\\\/\$/.test(basePathSrc));

const box = { location: { pathname: "/admin.html/" } };
vm.createContext(box);
vm.runInContext(basePathSrc + "\nthis.f = getPagesBasePath;", box);
const basePath = box.f;

ok('"/admin.html" gives an empty base', (box.location.pathname = "/admin.html", basePath()) === "");
ok('"/admin.html/" — the trailing slash case — also gives an empty base', (box.location.pathname = "/admin.html/", basePath()) === "");
ok('"/admin-clients.html" gives an empty base', (box.location.pathname = "/admin-clients.html", basePath()) === "");
ok('"/admin-clients.html/" gives an empty base', (box.location.pathname = "/admin-clients.html/", basePath()) === "");
ok('"/client.html" gives an empty base', (box.location.pathname = "/client.html", basePath()) === "");
/* GitHub Pages serves the site under a project subpath — that must survive too. */
ok('"/mama-wod/admin.html" keeps the project subpath', (box.location.pathname = "/mama-wod/admin.html", basePath()) === "/mama-wod");
ok('"/mama-wod/admin.html/" keeps it with a trailing slash', (box.location.pathname = "/mama-wod/admin.html/", basePath()) === "/mama-wod");
ok('"/mama-wod/admin-clients.html" keeps it', (box.location.pathname = "/mama-wod/admin-clients.html", basePath()) === "/mama-wod");

/* --- 2 · the client link is the one that must never be wrong --------- */

ok("the client link no longer trims location.href", !/location\.href\.replace\(\/\\\/\[\^\/\]\*\$\//.test(clients));
ok("the client link is built from the origin", /location\.origin \+ sitePath\(\)/.test(clients));

const linkSrc = (clients.match(/function sitePath\(\)[\s\S]*?\n  \}/) || [""])[0];
ok("the client page has its own path resolver", linkSrc.length > 50);
const box2 = { location: { pathname: "/admin-clients.html", origin: "https://x.test" } };
vm.createContext(box2);
vm.runInContext(linkSrc + "\nthis.f = sitePath;", box2);
const sitePath = box2.f;

ok("from /admin-clients.html the client link sits at the root", (box2.location.pathname = "/admin-clients.html", sitePath()) === "");
ok(
  "from the trailing-slash form it STILL sits at the root",
  (box2.location.pathname = "/admin-clients.html/", sitePath()) === ""
);
ok(
  "under the Pages project subpath it keeps it",
  (box2.location.pathname = "/mama-wod/admin-clients.html", sitePath()) === "/mama-wod"
);
ok(
  "and with a trailing slash under the subpath",
  (box2.location.pathname = "/mama-wod/admin-clients.html/", sitePath()) === "/mama-wod"
);

/* --- 3 · every coach call from admin carries auth ------------------- */

/* Scan by index rather than by regex. A brace-matching pattern kept silently
   skipping a call whose body had no closing brace inside the window — which is
   exactly the sort of miss that let this bug reach the owner in the first place. */
const NEEDLE = 'fetch(adminApiUrl("/api/personal-coach")';
const coachCalls = [];
let at = admin.indexOf(NEEDLE);
while (at >= 0) {
  /* Enough to cover method + headers + the first body lines. */
  coachCalls.push(admin.slice(at, at + 320));
  at = admin.indexOf(NEEDLE, at + NEEDLE.length);
}
ok("every coach call from admin is found", coachCalls.length >= 4);

const postCalls = coachCalls.filter(function (body) {
  return body.indexOf('method: "POST"') >= 0;
});
ok("three of them are POSTs", postCalls.length === 3);
postCalls.forEach(function (body, i) {
  const action = (body.match(/action:\s*"([a-z_]+)"/) || [])[1] || "(unknown)";
  ok(
    'POST coach call for action "' + action + '" sends admin auth',
    body.indexOf("headers: adminAuthHeaders(") >= 0
  );
});
/* And none of them sends only a content-type — the exact shape of the bug. */
coachCalls.forEach(function (body, i) {
  if (body.indexOf('method: "POST"') < 0) return;
  ok(
    "POST coach call " + (i + 1) + " does not send a bare content-type",
    !/headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\}/.test(body)
  );
});

/* The helper itself must actually send something. */
const authSrc = (admin.match(/function adminAuthHeaders\(extra\)[\s\S]*?\n\}/) || [""])[0];
ok("the auth helper sends a token when it has one", /X-Admin-Token/.test(authSrc));
ok("the auth helper falls back to the password", /X-Admin-Password/.test(authSrc));

/* --- 4 · the API base must be same-origin on a Vercel host --------- */

/* Hardcoding the production host made a PREVIEW page call PRODUCTION, where the new
 * endpoint does not exist yet. The 404 came back with no CORS headers, the browser
 * blocked it, and the fetch rejected — which is why the login button sat on
 * "מתחבר…" forever. Same-origin is both correct and what makes a preview testable. */
const client = fs.readFileSync(path.join(root, "client.html"), "utf8");

[
  ["admin-clients.html", clients],
  ["client.html", client],
].forEach(function (pair) {
  const name = pair[0];
  const src = pair[1];
  const baseSrc = (src.match(/var API_BASE = \(function \(\)[\s\S]*?\}\)\(\);/) || [""])[0];
  ok(name + " resolves its API base in one place", baseSrc.length > 40);
  ok(name + " uses same-origin on any *.vercel.app host", /\\\.vercel\\\.app\$\/i\.test\(/.test(baseSrc));
  ok(name + " still falls back to production for GitHub Pages", /mama-wod\.vercel\.app/.test(baseSrc));

  const b = { location: { hostname: "" } };
  vm.createContext(b);
  vm.runInContext("var location = this.location;\n" + baseSrc + "\nthis.base = API_BASE;", b);
  /* Re-evaluate per hostname — the IIFE runs once, so build it fresh each time. */
  function baseFor(hostname) {
    const ctx = { location: { hostname: hostname } };
    vm.createContext(ctx);
    vm.runInContext("var location = this.location;\n" + baseSrc + "\nthis.base = API_BASE;", ctx);
    return ctx.base;
  }
  ok(name + " · production Vercel → same origin", baseFor("mama-wod.vercel.app") === "");
  ok(name + " · branch preview → same origin", baseFor("mama-wod-git-feature-client-view-arick-ts-projects.vercel.app") === "");
  ok(name + " · per-deploy preview → same origin", baseFor("mama-87eyxz2wy-arick-ts-projects.vercel.app") === "");
  ok(name + " · localhost → same origin", baseFor("localhost") === "");
  ok(name + " · GitHub Pages → production Vercel", baseFor("arick-t.github.io") === "https://mama-wod.vercel.app");
});

/* --- 5 · a failed request must never hang the UI ------------------- */

ok(
  "the clients login handles a rejected fetch",
  /\.catch\(function \(e\) \{[\s\S]{0,200}pwErr/.test(clients)
);
ok("the reason is recorded", /never reaches \.then/.test(clients));

/* --- 6 · choosing "end athlete" goes straight into the intake ------ */

ok("choosing the athlete kind starts the intake immediately", /openIntakeWorkspace\(\);\s*\n\s*try \{\s*\n\s*startIntakeChat\(\);/.test(admin));
ok("a failed start still tells the owner", /לא הצלחתי להתחיל תחקור/.test(admin));
ok("the start bar is still there to retry with", /id="intake-start-bar"/.test(admin));

/* --- the two screens are one view now ------------------------------
 *
 * The static "go to the other page" links are gone. The owner's instruction on
 * 2026-09-01: this is ONE view of everyone who uses his services — studios, individual
 * athletes, all of them — so the strip IS the navigation and a chip opens that client
 * from whichever file the browser happens to be on. Both crossings must still be
 * absolute, because a relative one breaks under the trailing slash Vercel can serve.
 */
ok("no header link announcing another page", !/id="btn-client-programs"/.test(admin));
ok("a programme chip crosses absolutely", /pagesAbsoluteUrl\("\/admin-clients\.html\?program=/.test(admin));
ok("an athlete chip crosses absolutely", /location\.origin \+ sitePath\(\) \+ "\/admin\.html\?athlete=/.test(clients));
ok("neither crossing is a bare relative href", !/location\.href = "admin-clients\.html/.test(admin) && !/location\.href = "admin\.html/.test(clients));

console.log("All cross-page link checks passed.");
