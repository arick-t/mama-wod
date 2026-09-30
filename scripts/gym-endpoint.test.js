/**
 * THE GYM ENDPOINT — /api/gym-coach, and the reason it is a file of its own.
 *
 * api/personal-coach.js is 3,700 lines of functional doctrine. Any road that led a gym request
 * through it would have been the leak the owner forbade when the second brain was started, so
 * this endpoint imports nothing from it. What IS shared is infrastructure — the admin door and
 * the cost caps — because those are the product's plumbing whichever brain is writing.
 *
 * Run: node scripts/gym-endpoint.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const api = fs.readFileSync(path.join(root, "api/gym-coach.js"), "utf8");
const code = api.replace(/\/\*[\s\S]*?\*\//g, "");
const screen = fs.readFileSync(path.join(root, "admin-gym-intake.js"), "utf8");
const dev = fs.readFileSync(path.join(root, "scripts/local-dev-server.js"), "utf8");
const handler = require("../api/gym-coach.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

function fakeRes() {
  const out = { code: 0, body: null };
  const res = {
    status(c) { out.code = c; return this; },
    json(j) { out.body = j; return j; },
    setHeader() {},
    headersSent: false,
  };
  return { res, out };
}

/* ── the wall ──────────────────────────────────────────────────────────────── */

ok("the endpoint does not import the functional coach", code.indexOf("personal-coach") < 0);
ok("nor its layers", code.indexOf("coach-layers") < 0);
ok("nor its policy", code.indexOf("coach-policy") < 0);
ok("nor its prompt", code.indexOf("hamamen") < 0);
ok("nor its brief", code.indexOf("foundation-brief") < 0);
ok("it reads the gym brief instead", code.indexOf("gym-brief") >= 0);
ok("and builds with the gym builder", code.indexOf("gym-block-build") >= 0);
ok("and checks with the gym check", code.indexOf("gym-brick-check") >= 0);

/* Infrastructure IS shared, and naming which is the point. */
ok("the admin door is the same door", code.indexOf("admin-auth") >= 0);
ok("and the wallet is the same wallet", code.indexOf("coach-cost-caps") >= 0);

/* ── it refuses before it spends ───────────────────────────────────────────── */

ok("auth is checked before the body is read", api.indexOf("checkAdminAuth") < api.indexOf("readBody(req)"));
ok("and before any provider call", api.indexOf("checkAdminAuth") < api.indexOf("askGemini"));
ok("the cost gate runs before the provider too", api.indexOf("evaluateCostCapGate") < api.indexOf("await askGemini"));

/* ── one call, Gemini only ─────────────────────────────────────────────────── */

ok("there is exactly one provider call in the file", (code.match(/await askGemini/g) || []).length === 1);
ok("it is Gemini", code.indexOf("generativelanguage.googleapis.com") >= 0);
ok("with no backup model anywhere", !/groq|openai|anthropic/i.test(code));
ok("and never the lite model", !/flash-lite/.test(code));
ok("the URL is never echoed back, because it carries the key", /Never echo the URL/.test(api));

/* ── the shape of its answers ──────────────────────────────────────────────── */

async function run(req) {
  const f = fakeRes();
  await handler(req, f.res);
  return f.out;
}

(async function () {
  const get = await run({ method: "GET", headers: {} });
  ok("GET says which brain this is", get.code === 200 && get.body.brain === "gym");
  ok("and how long a block is", get.body.blockWeeks === 6);

  const put = await run({ method: "PUT", headers: {} });
  ok("anything but POST is refused", put.code === 405);

  /* ── the screen calls it ─────────────────────────────────────────────────── */

  ok("the questionnaire posts to the gym endpoint", screen.indexOf("/api/gym-coach") >= 0);
  ok("and never to the functional one", screen.indexOf("/api/personal-coach") < 0);
  ok("it uses the admin headers the rest of the module uses", screen.indexOf("adminAuthHeaders") >= 0);
  ok("the button says what it is doing while it runs", /Building…/.test(screen));
  ok("and comes back either way", (screen.match(/btn\.textContent = "Build the block"/g) || []).length >= 2);
  ok("an error lands in the error row, not an alert", /setErr\(x\.j\.error/.test(screen) && !/alert\(/.test(screen));

  /* ── and the dev server can reach it ─────────────────────────────────────── */

  ok("the local server routes the gym endpoint", dev.indexOf('"/api/gym-coach"') >= 0);
  ok("for GET", /gym-coach"\s*\n?\s*\?\s*"api\/gym-coach\.js"|api\/gym-coach\.js/.test(dev));
  ok("and for POST", /pathname === "\/api\/gym-coach"\)\s*\{\s*\n\s*await loadApiHandler\("api\/gym-coach\.js"\)/.test(dev));

  /* -- it has to be allowed to FINISH ------------------------------------------
   A gym block took 15.4 seconds on the first real generation, and a function with no
   maxDuration of its own gets the platform default — which would kill the request mid-answer,
   after the provider had already been paid for the tokens. The other programming endpoint has
   carried this entry since the day it was written; this one was added without it (2026-09-30). */
const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
ok(
  "the gym endpoint is given time to answer",
  ((vercel.functions || {})["api/gym-coach.js"] || {}).maxDuration >= 60
);

console.log("\nנקודת הקצה של החד\"כ — קריאה אחת, ג'ימיני בלבד, ואפס שורות מהמוח השני.");
})();
