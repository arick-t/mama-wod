/**
 * The end-athlete intake must actually RUN.
 *
 * Twice now it reached the owner dead — once "Cannot read properties of null" from a
 * field that had been deleted, and once "S is not defined", a local alias used in a
 * function that never declared it. Both were one word wide, both got through every
 * source-text assertion in the suite, and both cost him a testing round: the wizard
 * opened, the questions rendered, and nothing worked.
 *
 * So this test opens the intake against a stand-in browser and walks all eight steps.
 * A missing name throws here instead of on his screen.
 *
 * Run: node scripts/admin-intake-runs.test.js
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
const src = fs.readFileSync(path.join(root, "admin-fixed-intake.js"), "utf8");
const CoachIntakeSync = require("../lib/coach-intake-sync-contract");

/* --- a browser, reduced to what this file touches -------------------------- */

function makeEl(id) {
  const el = {
    id: id,
    style: {},
    dataset: {},
    value: "",
    checked: false,
    disabled: false,
    hidden: false,
    textContent: "",
    innerHTML: "",
    attrs: {},
    classes: {},
  };
  el.classList = {
    add: function (c) { el.classes[c] = true; },
    remove: function (c) { delete el.classes[c]; },
    contains: function (c) { return !!el.classes[c]; },
    toggle: function (c, on) { if (on) el.classes[c] = true; else delete el.classes[c]; },
  };
  el.setAttribute = function (k, v) { el.attrs[k] = String(v); };
  el.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; };
  el.removeAttribute = function (k) { delete el.attrs[k]; };
  el.appendChild = function () {};
  el.addEventListener = function () {};
  el.removeEventListener = function () {};
  el.querySelector = function () { return null; };
  /* Real enough to be worth something: the wizard finds its fields by attribute, so
     the stand-in answers by attribute too. */
  el.querySelectorAll = function (sel) {
    const groups = String(sel).match(/\[data-[a-z-]+\]/g) || [];
    const attr = groups.length ? groups[0].replace(/[\[\]]/g, "") : "";
    if (!attr) return [];
    return Object.keys(els)
      .map(function (k) { return els[k]; })
      .filter(function (e) { return e.getAttribute(attr) !== null; });
  };
  el.closest = function () { return null; };
  el.focus = function () {};
  el.blur = function () {};
  el.scrollIntoView = function () {};
  return el;
}

const els = Object.create(null);
function byId(id) {
  if (!els[id]) els[id] = makeEl(id);
  return els[id];
}

/* The fields as the wizard will look for them. */
function field(id, attr, value) {
  const e = byId(id);
  e.setAttribute(attr, value);
  return e;
}
["display_name", "gender", "age", "bodyweight", "experience"].forEach(function (id) {
  field("adm-fx-" + id, "data-fx-id", id);
});
field("adm-fx-loc-full", "data-fx-location", "functional_gym");
["sun", "mon", "tue", "wed", "thu", "fri", "sat"].forEach(function (d) {
  field("adm-fx-day-" + d, "data-fx-day", d);
});
const skillAll = field("adm-fx-skill-all", "data-skill-id", "all_skills");
skillAll.setAttribute("data-skill-all", "1");

const thrown = [];
const sandbox = {
  console: { log: function () {}, error: function (...a) { thrown.push(a.join(" ")); }, warn: function () {} },
  setTimeout: function (fn) { return 0; },
  clearTimeout: function () {},
  confirm: function () { return true; },
  alert: function () {},
  fetch: function () { return Promise.resolve({ status: 200, json: function () { return Promise.resolve({}); } }); },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = {
  getElementById: byId,
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {},
  createElement: function () { return makeEl("created"); },
  body: makeEl("body"),
};
sandbox.window.CoachIntakeSync = CoachIntakeSync;
sandbox.localStorage = {
  store: {},
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
  setItem: function (k, v) { this.store[k] = String(v); },
  removeItem: function (k) { delete this.store[k]; },
};
/* Things admin.html provides that this file politely checks for. */
sandbox.adminAuthHeaders = function () { return {}; };
sandbox.withAdminPassword = function (o) { return o; };
sandbox.adminApiUrl = function (p) { return "http://localhost" + p; };

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "admin-fixed-intake.js" });

ok("the module loads", typeof sandbox.window.startIntakeChat === "function");

/* --- opening it is the part that kept breaking ----------------------------- */

let err = null;
try {
  sandbox.window.openIntakeWorkspace();
  sandbox.window.startIntakeChat();
} catch (e) {
  err = (e && (e.message || e.name)) || String(e);
}
ok("OPENING THE INTAKE DOES NOT THROW" + (err ? " — got: " + err : ""), err === null);
ok("the first step is rendered", String(byId("intake-fixed").innerHTML).length > 200);
ok("the status line survived the render", /שלב 1\//.test(byId("intake-status").textContent));

/* --- every step must render, not just the first ---------------------------- */

const steps = CoachIntakeSync.FIXED_STEPS;
ok("there are eight steps", steps.length === 8);

/* Answer enough that Next accepts the step; anything the wizard genuinely requires
   is listed here, so a new required field shows up as a failure to advance. */
function answer(step) {
  const key = steps[step];
  if (key === "profile") {
    byId("adm-fx-display_name").value = "Test Athlete";
    byId("adm-fx-gender").value = "male";
    byId("adm-fx-age").value = "34";
    byId("adm-fx-bodyweight").value = "80";
    byId("adm-fx-experience").value = "3 years";
  }
  if (key === "locations" || key === "setup") byId("adm-fx-loc-full").checked = true;
  if (key === "schedule") {
    ["sun", "tue", "thu"].forEach(function (d) { byId("adm-fx-day-" + d).checked = true; });
    byId("adm-fx-minutes").value = "60";
  }
  if (key === "goals") byId("adm-fx-goals").value = "General fitness";
  if (key === "injuries") byId("adm-fx-injuries").value = "None";
  /* A plan cannot be scaled to someone whose skills are unknown, so the step refuses
     to be walked past empty. */
  if (key === "skills") byId("adm-fx-skill-all").checked = true;
}

/** Which step the wizard is actually showing, read off what it drew. */
function stepShown() {
  const m = String(byId("intake-fixed").innerHTML).match(/Step (\d+) \/ (\d+)/i);
  return m ? parseInt(m[1], 10) : -1;
}

/* --- the gate he asked for: skills cannot be skipped -------------------- */

ok("the wizard starts at step 1", stepShown() === 1);
/* Walk to Skills without answering it, and try to leave. */
for (let guard = 0; guard < 20 && steps[stepShown() - 1] !== "skills"; guard++) {
  answer(stepShown() - 1);
  sandbox.window.adminFixedNext();
}
const atSkills = stepShown();
ok("we are standing on Skills", steps[atSkills - 1] === "skills");
sandbox.window.adminFixedNext();
ok("SKILLS CANNOT BE WALKED PAST EMPTY", stepShown() === atSkills);
ok("and it says why", /Mark at least one skill/.test(String(byId("adminFixedErr").textContent || "")));
byId("adm-fx-skill-all").checked = true;
sandbox.window.adminFixedNext();
ok("marking All skills lets it through", stepShown() === atSkills + 1);

/* --- start over for the full walk -------------------------------------- */

sandbox.window.openIntakeWorkspace();
sandbox.window.startIntakeChat();

for (let step = 0; step < steps.length - 1; step++) {
  answer(step);
  let stepErr = null;
  try {
    sandbox.window.adminFixedNext();
  } catch (e) {
    stepErr = (e && (e.message || e.name)) || String(e);
  }
  ok("step " + (step + 1) + " (" + steps[step] + ") advances without throwing" + (stepErr ? " — got: " + stepErr : ""), stepErr === null);
  ok("step " + (step + 1) + " rendered something", String(byId("intake-fixed").innerHTML).length > 100);
}

/* Going back through the whole wizard renders each step again — the render path is
   where both crashes lived. */
for (let back = 0; back < steps.length; back++) {
  let backErr = null;
  try {
    sandbox.window.adminFixedBack();
  } catch (e) {
    backErr = (e && (e.message || e.name)) || String(e);
  }
  ok("going back from step " + (steps.length - back) + " does not throw" + (backErr ? " — got: " + backErr : ""), backErr === null);
}

/* --- the alias that caused it ---------------------------------------------- */

/* `var S = C()` is a LOCAL alias. Using it in a function that does not declare it is
   exactly the bug the owner hit; the file is uniformly indented, so the chunks below
   are its top-level functions. */
const chunks = src.split(/\n(?=  (?:function |window\.))/);
const offenders = chunks
  .filter((c) => /[^A-Za-z0-9_.$"']S\./.test(c) && !/var S = C\(\);/.test(c))
  .map((c) => (c.match(/^  (?:window\.)?(?:function )?([A-Za-z0-9_$]+)/) || [])[1] || "?");
ok("no function uses the S alias without declaring it — found: " + offenders.join(", "), offenders.length === 0);

console.log("admin-intake-runs.test.js passed");
