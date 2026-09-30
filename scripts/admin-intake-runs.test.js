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
/* The checklist is drawn from the catalog, and without it the equipment step renders
   nothing at all — which is how a walk through the wizard used to pass while never once
   looking at the question the step exists to ask. */
sandbox.window.EquipmentCatalog = require("../lib/equipment-catalog.js");
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
/* The step number lives in the header now, beside the way out, where the studio card
   keeps it — so this line says the other thing instead (owner, 2026-09-22). */
ok("the status line survived the render", /athlete app/.test(byId("intake-status").textContent));
ok("and the step is named in the header", /Step 1 of 8/.test(byId("athleteIntakeStep").textContent));
ok("with a strip of steps beside it", byId("athleteIntakeTabs").innerHTML.indexOf("Profile") >= 0);
ok("the one he is on is the only one lit", (byId("athleteIntakeTabs").innerHTML.match(/class="on"/g) || []).length === 1);
ok("and the rest are shut until he reaches them",
  (byId("athleteIntakeTabs").innerHTML.match(/disabled/g) || []).length === 7);

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
  /* Equipment answers NOTHING on purpose. "Where do you train — a well-equipped gym or
     home?" was removed on 2026-09-15 as a duplicate of the checklist, and an athlete who
     owns no kit must still be able to walk through the step. */
  if (key === "schedule") {
    ["sun", "tue", "thu"].forEach(function (d) { byId("adm-fx-day-" + d).checked = true; });
    byId("adm-fx-minutes").value = "60";
  }
  /* Nothing to answer here any more: the step opens on "No injuries" and a healthy
     athlete taps Next (owner, 2026-09-15). */
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

/* --- the equipment step asks once, and lets an empty answer through -------
 * Two questions about the same fact could disagree: "well-equipped gym" ticked above a
 * checklist with no rower in it (owner, 2026-09-15). The picker is gone; what it used
 * to protect — that nobody is silently treated as a full gym — is now the packet's job.
 * ------------------------------------------------------------------------- */
{
  sandbox.window.openIntakeWorkspace();
  sandbox.window.startIntakeChat();
  for (let guard = 0; guard < 20 && steps[stepShown() - 1] !== "setup"; guard++) {
    answer(stepShown() - 1);
    sandbox.window.adminFixedNext();
  }
  const atSetup = stepShown();
  ok("the equipment step is step 2", atSetup === 2 && steps[atSetup - 1] === "setup");
  const drawn = String(byId("intake-fixed").innerHTML);
  ok("it no longer asks where the athlete trains", !/Where do you usually train/i.test(drawn));
  ok("nor offers the old well-equipped-gym answer", !/data-fx-location/.test(drawn));
  ok("the step is called Available equipment", /Available equipment/.test(drawn));
  ok("and asks nothing in prose", !/adm-fx-location-other/.test(drawn));
  /* The answer that replaces the whole list is not the list's first line: it stands in a
     picker of its own, above it, and it says what it means (owner, 2026-09-15). */
  ok(
    "a fully equipped gym is its own box above the list",
    /adm-fx-eq-all[\s\S]*?<\/label><\/div><div class="pprog-location-picker">/.test(drawn)
  );
  ok("and it names the running route", /Fully equipped gym — no equipment limits, running route included/.test(drawn));
  /* Two boxes per place — the one answer, then the list — and the second place is
     drawn with the step even while it is hidden. */
  ok("the list follows in a box of its own", (drawn.match(/pprog-location-picker/g) || []).length === 4);
  sandbox.window.adminFixedNext();
  ok("AN ATHLETE WHO TICKS NOTHING STILL GETS THROUGH", stepShown() === atSetup + 1);
}

/* --- a second place is a second list, not a sentence ---------------------
 * It used to be a free-text box and one "heaviest there" number — the shape the first
 * place had just been rescued from, and one no check can measure a brick against
 * (owner, 2026-09-15).
 * ------------------------------------------------------------------------- */
{
  sandbox.window.openIntakeWorkspace();
  sandbox.window.startIntakeChat();
  for (let guard = 0; guard < 20 && steps[stepShown() - 1] !== "setup"; guard++) {
    answer(stepShown() - 1);
    sandbox.window.adminFixedNext();
  }
  const drawn = String(byId("intake-fixed").innerHTML);
  ok("the second place asks the days it owns", /data-fx-second-day/.test(drawn));
  ok("and says the rest of the week belongs to the first", /Every training day you do not mark here/.test(drawn));
  ok("THE SECOND PLACE IS A SECOND CHECKLIST", /data-fx-eq2=/.test(drawn) && /adm-fx-eq2-all/.test(drawn));
  ok("with ceilings of its own", /data-fx-eq2-cap/.test(drawn));
  ok("the paragraph and the single number are gone", !/adm-fx-second-kit/.test(drawn) && !/adm-fx-second-heaviest/.test(drawn));
  ok("and the two lists are not the same inputs", /data-fx-eq=/.test(drawn) && /data-fx-eq2=/.test(drawn));
}

/* --- injuries: the answer almost everyone gives is the one it opens on ----
 * A free-text box under the button asked for a diagnosis the coach is forbidden to
 * reason from, and an athlete who had just tapped "No injuries" was looking at an empty
 * box inviting him to write anyway (owner, 2026-09-15).
 * ------------------------------------------------------------------------- */
{
  sandbox.window.openIntakeWorkspace();
  sandbox.window.startIntakeChat();
  for (let guard = 0; guard < 20 && steps[stepShown() - 1] !== "injuries"; guard++) {
    answer(stepShown() - 1);
    sandbox.window.adminFixedNext();
  }
  const atInj = stepShown();
  ok("injuries is step 7", atInj === 7 && steps[atInj - 1] === "injuries");
  const drawn = String(byId("intake-fixed").innerHTML);
  ok("NO INJURIES IS ON BEFORE ANYTHING IS TOUCHED", /id="adm-fx-no-injuries-btn" aria-pressed="true"/.test(drawn));
  ok("and it reads as pressed", /pprog-fixed-chip active/.test(drawn));
  ok("THE DIAGNOSIS BOX IS GONE", !/id="adm-fx-injuries"/.test(drawn));
  ok("what the coach may act on is still asked as marks", /data-avoid-id/.test(drawn));
  ok("and the note beside them says where anything else goes", /Anything else to program around/.test(drawn));
  sandbox.window.adminFixedNext();
  ok("a healthy athlete walks straight through", stepShown() === atInj + 1);
}

/* --- goals: a checklist, capped, with one answer that replaces the rest ----
 * Free text reached the coach as nothing at all when no word in it was one the router
 * recognised. Two at most, because three pull the month in three directions
 * (owner, 2026-09-15).
 * ------------------------------------------------------------------------- */
{
  sandbox.window.openIntakeWorkspace();
  sandbox.window.startIntakeChat();
  for (let guard = 0; guard < 20 && steps[stepShown() - 1] !== "goals"; guard++) {
    answer(stepShown() - 1);
    sandbox.window.adminFixedNext();
  }
  ok("goals is step 8", steps[stepShown() - 1] === "goals");
  const drawn = String(byId("intake-fixed").innerHTML);
  ok("MAINTAINING A HEALTHY LIFESTYLE LEADS", /data-goal-id="healthy_lifestyle"/.test(drawn));
  ok("and it is the first goal drawn", drawn.indexOf("healthy_lifestyle") < drawn.indexOf("build_muscle"));
  ok("in a box of its own, above the list", /pprog-skills-all[\s\S]*?healthy_lifestyle[\s\S]*?<\/label><\/div>/.test(drawn));
  ok("the cap is stated where it is asked", /Pick at most 2/.test(drawn));
  ok("health and rehabilitation are not on it", !/injury_proofing|mobility|coming_back/.test(drawn));
  ok("nor is a habit goal", !/consistency|build the habit/i.test(drawn));
  ok("the skill picker is hidden until the skill goal is picked", /id="adm-fx-goal-skill-wrap" hidden/.test(drawn));
  ok("nutrition is not asked about", !/adm-fx-deficit/.test(drawn));
  ok("AND THE EMPTY BOX UNDER THE GOALS IS GONE", !/id="adm-fx-goals"/.test(drawn));
  /* The one box that stays: what this place does NOT do. It saves three paid revisions
     apiece, which is why it was put there (coach agent, 2026-09-02). */
  ok("what they do not want is still asked", /id="adm-fx-avoid-program"/.test(drawn));
  ok("the competitor question stays", /id="adm-fx-competitor"/.test(drawn));
}

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
