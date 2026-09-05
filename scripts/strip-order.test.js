/**
 * The order the owner drags his strip into.
 * Run: node scripts/strip-order.test.js
 *
 * "ניהול כללי" is first whatever happens; everyone else sits where he put them. The
 * order is a plain list of ids kept on the server, so it follows him from the laptop
 * to the phone (owner, 2026-09-05).
 *
 * The things that actually break a saved order are people coming and going, so those
 * are what is checked hardest: someone added since the last drag must not jump to the
 * front, and someone deleted must not leave a hole.
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

const Strip = require("../lib/admin-people-strip.js");
const Store = require("../lib/client-program-store.js");
const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "client-program.js"), "utf8");

const PEOPLE = {
  athletes: [{ athleteId: "a1", displayName: "עדי" }, { athleteId: "a2", displayName: "אריק" }],
  programs: [
    { programId: "p1", clientName: "סטודיו" },
    { programId: "p2", clientName: "ריק" },
    { programId: "p3", clientName: "אינדיבידואל" },
  ],
};
function ids(rows) {
  return rows.map(function (r) { return r.id; }).join(",");
}

/* --- without an order, nothing changes ------------------------------------ */

const natural = Strip.rows(PEOPLE);
ok("the strip is unchanged when he has never dragged", ids(natural) === "ledger,a1,a2,p1,p2,p3");

/* --- with one ------------------------------------------------------------- */

const dragged = Strip.rows(Object.assign({ order: ["p3", "a2", "p1", "a1", "p2"] }, PEOPLE));
ok("everyone sits where he put them", ids(dragged) === "ledger,p3,a2,p1,a1,p2");
ok("the management screen is still first", dragged[0].kind === "ledger");

/* A client added since the last drag. */
const withNew = Strip.rows(
  Object.assign({}, PEOPLE, {
    programs: PEOPLE.programs.concat([{ programId: "p9", clientName: "חדש" }]),
    order: ["p3", "a2", "p1", "a1", "p2"],
  })
);
ok("someone new keeps their own place rather than jumping to the front", ids(withNew) === "ledger,p3,a2,p1,a1,p2,p9");

/* A client deleted since the last drag. */
const withGone = Strip.rows(
  Object.assign({}, PEOPLE, { programs: [PEOPLE.programs[0]], order: ["p3", "a2", "p1", "a1", "p2"] })
);
ok("an id that is gone leaves no hole", ids(withGone) === "ledger,a2,p1,a1");

/* Rubbish in the order must not throw anything away. */
ok("an empty order is simply ignored", ids(Strip.rows(Object.assign({ order: [] }, PEOPLE))) === ids(natural));
ok("so is one full of strangers", ids(Strip.rows(Object.assign({ order: ["zz", "yy"] }, PEOPLE))) === ids(natural));

/* --- moving one chip ------------------------------------------------------ */

ok("dropped in front of another", Strip.moveId(["a", "b", "c"], "c", "b").join(",") === "a,c,b");
ok("dropped at the end", Strip.moveId(["a", "b", "c"], "a", null).join(",") === "b,c,a");
ok("dropped on itself changes nothing but its place", Strip.moveId(["a", "b"], "a", "a").join(",") === "b,a");
ok("an id that is not there is left alone", Strip.moveId(["a", "b"], "zz", "a").join(",") === "a,b");
ok("the ids of a strip, without the pinned screen", Strip.orderOf(natural).join(",") === "a1,a2,p1,p2,p3");

/* --- the chips say whether they can be dragged ---------------------------- */

const html = Strip.html(natural, "");
ok("the pinned screen says it is pinned", /data-pinned="1"/.test(html));
ok("and only once", (html.match(/data-pinned="1"/g) || []).length === 1);
ok("everyone else can be dragged", (html.match(/data-drag="1"/g) || []).length === 5);

/* --- it is kept on the server -------------------------------------------- */

function fakeStorage() {
  const data = new Map();
  return {
    async getJson(k) { const h = data.get(k); return h === undefined ? null : JSON.parse(JSON.stringify(h)); },
    async putJson(k, v) { data.set(k, JSON.parse(JSON.stringify(v))); return { pathname: k }; },
    async putJsonExclusive(k, v) { if (data.has(k)) { const e = new Error("x"); e.code = "already_exists"; throw e; } data.set(k, v); return { pathname: k }; },
    async deleteJson(k) { data.delete(k); return { pathname: k }; },
    async listJson() { return []; },
    storageInfo() { return { backend: "memory", durable: true }; },
    _data: data,
  };
}

async function main() {
  const storage = fakeStorage();
  const store = Store.createProgramStore(storage);

  const empty = await store.readStripOrder();
  ok("a strip nobody has dragged reads as empty", empty.ok && empty.ids.length === 0);

  const saved = await store.writeStripOrder(["p1", "a1", "p2"]);
  ok("an order can be saved", saved.ok && saved.ids.join(",") === "p1,a1,p2");
  const read = await store.readStripOrder();
  ok("and read back", read.ids.join(",") === "p1,a1,p2");

  /* One small object of its own — never a field on the index, which every save
     rewrites. */
  ok("in one object of its own", storage._data.has("client-programs/_strip-order.json"));
  ok("and it is not the index", JSON.stringify(storage._data.get("client-programs/_index.json") || {}).indexOf("strip") < 0);

  const dirty = await store.writeStripOrder(["p1", "p1", "", "  ", "<script>", "a1", null, "ok_id-9"]);
  ok("a repeated id is kept once", dirty.ids.filter(function (i) { return i === "p1"; }).length === 1);
  ok("and anything that is not an id is dropped", dirty.ids.join(",") === "p1,a1,ok_id-9");

  const huge = [];
  for (let i = 0; i < 900; i++) huge.push("id" + i);
  const capped = await store.writeStripOrder(huge);
  ok("a list that is not a strip is cut short", capped.ids.length === 400);

  /* --- the endpoint ------------------------------------------------------- */

  ok("the order rides on the list he already asks for", /stripOrder: stripOrder/.test(api));
  ok("and a failure there never costs him the list", /catch \(eOrder\) \{[\s\S]{0,80}stripOrder = \[\];/.test(api));
  ok("saving it is its own owner-only action", /action === "set_strip_order"/.test(api));
  ok("which refuses anything that is not a list", /BAD_ORDER/.test(api));
  ok("and anything too long to be a strip", /TOO_MANY/.test(api));

  /* --- the page ----------------------------------------------------------- */

  ok("the strip is drawn in his order", /AdminPeopleStrip\.rows\(\{ athletes: list, programs: progs, order: clientStripOrder \}\)/.test(admin));
  ok("a drag is bound when the strip is", /bindStripDrag\(\);/.test(admin));
  ok("half a second of holding on a phone", /\}, 500\);/.test(admin));
  ok("a finger that moves first is scrolling", /if \(dx > 10 \|\| dy > 10\) finish\(false\);/.test(admin));
  ok("the mouse needs no hold", /if \(dx > 6\) beginDrag\(\);/.test(admin));
  ok("the pinned screen cannot be picked up", /if \(chip\.getAttribute\("data-drag"\) !== "1"\) return;/.test(admin));
  ok("and nothing can be dropped in front of it", /if \(chip\.getAttribute\("data-pinned"\) === "1"\) return;/.test(admin));
  ok("the strip is not repainted mid-drag", /if \(stripDragging\) return;/.test(admin));
  ok("the order is saved once, when he lets go", /window\.ClientScreen\.saveStripOrder\(ids, function/.test(admin));
  ok("and a failed save says so out loud", /הסדר החדש לא נשמר/.test(admin));
  ok("the click that ends a drag opens nobody", /Date\.now\(\) - stripDragEndedAt < 400/.test(admin));
  ok("Escape puts it back", /ev\.key === "Escape" && held/.test(admin));

  console.log("\nAll strip-order checks passed (" + passed + " assertions).");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
