/**
 * The block warehouse, and blocks as a list you can rearrange.
 * Run: node scripts/block-warehouse.test.js
 *
 * What the owner asked for (2026-09-05): a block he is happy with goes on a shelf under
 * a name and can be planted at any client; a block can be copied from one client to
 * another; and inside a client, a block can be duplicated, deleted, planted in front of
 * another, or dragged into a different order.
 *
 * The thing that can really go wrong here is not the shuffling — it is what the CLIENT
 * ends up being shown. What a client may see is counted in weeks from the start, so an
 * unsent block that lands in front of a sent one is handed over by arithmetic alone.
 * That is what most of this file guards.
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

const W = require("../lib/block-warehouse.js");
const Store = require("../lib/client-program-store.js");
const Clip = require("../lib/pprog-clipboard.js");
const api = fs.readFileSync(path.join(__dirname, "..", "api", "client-program.js"), "utf8");

/* --- the row the shelf shows ---------------------------------------------- */

ok("a weekly block says seven", W.sessionsPerWeekOf({ scheduleMode: "weekly_schedule" }) === 7);
ok("one sold as sessions says how many", W.sessionsPerWeekOf({ scheduleMode: "session_count", sessionsPerWeek: 3 }) === 3);
ok("and an impossible number falls back to a week", W.sessionsPerWeekOf({ scheduleMode: "session_count", sessionsPerWeek: 99 }) === 7);
ok("the kind is named in his words", W.kindLabel(W.SESSIONS) === "מספר אימונים" && W.kindLabel(W.WEEKLY) === "שבועית");

const entry = W.entryFor({
  name: "בסיס 4 שבועות",
  description: "התחלה קלאסית",
  intake: { scheduleMode: "session_count", sessionsPerWeek: 4 },
  weeks: [{ days: {} }, { days: {} }],
  sourceName: "סטודיו",
});
ok("a saved block carries its name", entry.name === "בסיס 4 שבועות");
ok("its description", entry.description === "התחלה קלאסית");
ok("when it was made", /^\d{4}-\d{2}-\d{2}T/.test(entry.createdAt));
ok("what kind it is", entry.kind === W.SESSIONS && entry.sessionsPerWeek === 4);
ok("and how long it is", entry.weekCount === 2);
ok("with an id of its own", /^blk_[a-z0-9]+$/.test(entry.id));
ok("a block with no name is refused", W.entryFor({ weeks: [{}] }) === null);
ok("and one with no weeks", W.entryFor({ name: "ריק", weeks: [] }) === null);

const rows = W.sortRows([
  { id: "a", createdAt: "2026-01-01T00:00:00Z" },
  { id: "b", createdAt: "2026-05-01T00:00:00Z" },
]);
ok("the newest is at the top", rows[0].id === "b");

/* --- the shelf itself ----------------------------------------------------- */

function fakeStorage() {
  const data = new Map();
  let reads = 0;
  return {
    async getJson(k) { reads += 1; const h = data.get(k); return h === undefined ? null : JSON.parse(JSON.stringify(h)); },
    async putJson(k, v) { data.set(k, JSON.parse(JSON.stringify(v))); return { pathname: k }; },
    async putJsonExclusive(k, v) { if (data.has(k)) { const e = new Error("x"); e.code = "already_exists"; throw e; } data.set(k, v); return { pathname: k }; },
    async deleteJson(k) { data.delete(k); return { pathname: k }; },
    async listJson() { throw new Error("the store must never be listed to draw a list"); },
    storageInfo() { return { backend: "memory", durable: true }; },
    _data: data,
    _reads() { return reads; },
    _resetReads() { reads = 0; },
  };
}

async function main() {
  const storage = fakeStorage();
  const store = Store.createProgramStore(storage);

  const made = await store.createProgram({
    clientName: "סטודיו",
    clientKind: "blank",
    weekCount: 3,
    intake: { clientName: "סטודיו", scheduleMode: "session_count", sessionsPerWeek: 3 },
    blockStart: "2026-09-06",
  });
  let p = made.program;
  let r = await store.updateProgram(
    p.programId,
    p.version,
    function (d) {
      d.weeks[0].days.sun = {
        title: "אימון תחנות",
        parts: [{ id: "p1", title: "Part A", lines: ["הערה", "AMRAP 12", "10 מתח"], noteLines: 1, formatLine: 1, lineColors: { 0: "red" }, numbered: true }],
      };
      return d;
    },
    { actor: "owner" }
  );
  p = r.program;

  const saved = await store.saveWarehouseBlock({
    name: "בסיס",
    description: "מה שעובד",
    intake: p.intake,
    weeks: Clip.blockPayload(p.weeks).weeks,
    sourceName: p.clientName,
  });
  ok("a block goes onto the shelf", saved.ok);

  storage._resetReads();
  const shelf = await store.readWarehouseIndex();
  ok("the shelf is one read, however much is on it", storage._reads() === 1);
  ok("and it lists what was saved", shelf.rows.length === 1 && shelf.rows[0].name === "בסיס");
  ok("with the shape of the programme it came from", shelf.rows[0].kind === "session_count" && shelf.rows[0].sessionsPerWeek === 3);
  ok("and who it came from", shelf.rows[0].sourceName === "סטודיו");
  /* The weeks are NOT in the index — a shelf of twenty blocks must stay cheap to draw. */
  ok("the weeks stay on the shelf, not in the list", shelf.rows[0].weeks === undefined);

  /* --- planting it at someone else --------------------------------------- */

  const other = await store.createProgram({
    clientName: "לקוח אחר",
    clientKind: "coach",
    weekCount: 4,
    intake: { clientName: "לקוח אחר" },
    blockStart: "2026-09-06",
  });
  const got = await store.readWarehouseBlock(shelf.rows[0].id);
  ok("a block can be taken off the shelf", got.ok && got.block.weeks.length === 3);

  const planted = await store.pasteBlock(other.program.programId, other.program.version, got.block);
  ok("and planted at another client", planted.ok && planted.added === 3);
  ok("as a block of its own", planted.program.blocks.length === 2 && planted.program.blocks[1].startWeek === 5);
  ok("with everything that was written in it", planted.program.weeks[4].days.sun.parts[0].lineColors["0"] === "red");
  ok("its shape included", planted.program.weeks[4].days.sun.parts[0].formatLine === 1);
  ok("and the name of the day", planted.program.weeks[4].days.sun.title === "אימון תחנות");
  /* The rule that matters: nothing reaches a client until he sends it. */
  ok("it arrives unsent", planted.program.blocks[1].approvedAt === null);
  ok("so the client is shown nothing new", Store.approvedWeekCount(planted.program) === 0);

  const gone = await store.deleteWarehouseBlock(shelf.rows[0].id);
  ok("a block can be taken off the shelf for good", gone.ok);
  ok("and the shelf is empty again", (await store.readWarehouseIndex()).rows.length === 0);

  /* --- rearranging one client's blocks ------------------------------------ */

  let q = (await store.createProgram({
    clientName: "יעל",
    clientKind: "blank",
    weekCount: 2,
    intake: { clientName: "יעל" },
    blockStart: "2026-09-06",
  })).program;
  q = (await store.approveBlock(q.programId, q.version, 1)).program;
  q = (await store.addBlock(q.programId, q.version, { weekCount: 2 })).program;
  q = (await store.updateProgram(q.programId, q.version, function (d) {
    d.weeks[2].days.mon = { parts: [{ id: "b2", title: "השני", lines: ["x"] }] };
    return d;
  }, { actor: "owner" })).program;
  ok("she has two blocks", q.blocks.length === 2 && q.weeks.length === 4);

  const dup = await store.duplicateBlock(q.programId, q.version, 2);
  ok("a block can be duplicated", dup.ok && dup.program.blocks.length === 3);
  ok("straight after the one it came from", dup.program.blocks[2].startWeek === 5);
  ok("carrying what was written in it", dup.program.weeks[4].days.mon.parts[0].title === "השני");
  ok("and the copy is unsent, whatever the original was", dup.program.blocks[2].approvedAt === null);
  ok("the week numbers are handed out again in order", dup.program.weeks.map(function (w) { return w.weekIndex; }).join(",") === "1,2,3,4,5,6");
  q = dup.program;

  /* THE guard: what the client may see is counted in weeks from the start. */
  const leak = await store.moveBlock(q.programId, q.version, 2, 1);
  ok("an unsent block cannot be moved in front of a sent one", !leak.ok);
  ok("and it says why", /UNSENT_BEFORE_SENT/.test(String(leak.error || "")));
  ok("the endpoint says it in his words", api.indexOf("אי אפשר להעביר לבנה שלא נשלחה") >= 0);

  const swap = await store.moveBlock(q.programId, q.version, 3, 2);
  ok("two unsent blocks can be swapped", swap.ok);
  ok("and the weeks follow them", swap.program.weeks[2].days.mon === undefined || swap.program.weeks[4].days.mon !== undefined);
  q = swap.program;

  const removed = await store.deleteBlock(q.programId, q.version, 3);
  ok("a block can be deleted", removed.ok && removed.program.blocks.length === 2);
  ok("its weeks go with it", removed.program.weeks.length === 4);
  ok("and everyone after it moves up", removed.program.blocks[1].blockIndex === 2 && removed.program.blocks[1].startWeek === 3);
  q = removed.program;

  const lastOne = await store.deleteBlock(q.programId, q.version, 2);
  q = lastOne.ok ? lastOne.program : q;
  const noneLeft = await store.deleteBlock(q.programId, q.version, 1);
  ok("a programme is never left with no blocks at all", !noneLeft.ok);

  /* --- planting in front of another block --------------------------------- */

  const before = await store.insertBlockBefore(q.programId, q.version, 1, {
    weeks: [{ days: { sun: { parts: [{ title: "חדש", lines: ["z"] }] } }, overview: [] }],
  });
  /* Block 1 is sent, so putting an unsent block in front of it would hand it over. */
  ok("planting an unsent block in front of a sent one is refused too", !before.ok);

  /* --- the screens ------------------------------------------------------- */

  const admin = fs.readFileSync(path.join(__dirname, "..", "admin.html"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "..", "lib", "admin-ledger-view.js"), "utf8");

  ok("the shelf has a card on the management screen", admin.indexOf('id="ledBlocks"') >= 0);
  ok("with one row per saved block", view.indexOf("function blocksBoxHtml") >= 0);
  ok("naming what he asked to see", /שם לבנה[\s\S]{0,300}תיאור[\s\S]{0,300}נוצרה[\s\S]{0,300}סוג[\s\S]{0,300}אימונים בשבוע/.test(view));
  ok("and an empty shelf explains how to fill it", /אין עדיין לבנות במחסן/.test(view));
  ok("every row can be taken off the shelf", view.indexOf("data-block-take=") >= 0);
  ok("or removed from it", view.indexOf("data-block-drop=") >= 0);
  ok("the shelf is asked for when the screen opens", admin.indexOf("loadBlocks();") >= 0);
  ok("and again the moment a block is saved onto it", admin.indexOf("window.adminBlocksChanged = function") >= 0);

  /* The menu on a block: the five he listed, in his order (owner, 2026-09-05). */
  ok("a block heading opens a menu", admin.indexOf("function openBlockMenu(") >= 0);
  ok("1. copy the block", admin.indexOf("data-block-copy=") >= 0 && admin.indexOf("העתק לבנה") >= 0);
  ok("2. put it on the shelf, under a name he types", admin.indexOf("data-block-fav=") >= 0 && admin.indexOf("שם ללבנה במחסן") >= 0);
  ok("3. plant the copied one in front of it", admin.indexOf("data-block-paste=") >= 0 && admin.indexOf('action: "block_insert"') >= 0);
  ok("4. duplicate it, straight after itself", admin.indexOf("data-block-dup=") >= 0 && admin.indexOf('action: "block_duplicate"') >= 0);
  ok("5. delete it, and say plainly that there is no way back", admin.indexOf("data-block-del=") >= 0 && admin.indexOf("אין דרך לשחזר לבנה שנמחקה") >= 0);
  ok("planting from the strip is offered only with a block in hand", admin.indexOf('if (chip.getAttribute("data-kind") === "program" && pageHeldBlock())') >= 0);
  ok("and it lands as the client's last block, unsent", admin.indexOf("לא תישלח אליו עד שתאשר") >= 0);

  /* Every action that is about ONE client must sit BELOW the line where the endpoint
     reads the programme id — above it, the id does not exist yet and the whole thing
     fails with nothing but a storage error to show for it (found on the local server,
     2026-09-05). */
  const idLine = api.indexOf('const programId = String(body.programId || "").slice(0, 60);');
  for (const perClient of ["block_save", "block_copy", "paste_block", "block_remove", "set_week_sessions"]) {
    ok(perClient + " is handled after the id is read", api.indexOf('action === "' + perClient + '"') > idLine);
  }
  for (const shelfOnly of ["block_list", "block_read", "block_delete"]) {
    ok(shelfOnly + " needs no client at all", api.indexOf('action === "' + shelfOnly + '"') < idLine);
  }

  console.log("\nAll block warehouse checks passed (" + passed + " assertions).");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
