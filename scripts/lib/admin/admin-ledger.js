/**
 * The coach's own book, server side.
 * POST /api/admin-ledger
 *   action: month | add_deal | update_deal | delete_deal | range
 *
 * Owner only — this is his income. Every action checks admin auth before it touches
 * storage, and the module holds no route to any provider.
 *
 * Storage shape, chosen against the lesson of 2026-09-02 (a poll that read every
 * object had the Blob store suspended): ONE object per month, plus one small warehouse
 * of places. Opening a month reads one object whose size is bounded by that month's
 * deals. Nothing here ever lists the store.
 */
const JsonStore = require("./admin-json-store");
const Ledger = require("../../../lib/coach-ledger.js");
const { checkRateLimit, sendRateLimit } = require("../../../lib/rate-limit");
const { checkAdminAuth, adminAuthDenied } = require("./admin-auth");
const { applyCors } = require("../../../lib/cors-allowlist");

const MONTH_PREFIX = "coach-ledger/";
const PLACES_KEY = "coach-ledger/places.json";

function monthKeyFor(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return "";
  return MONTH_PREFIX + m[1] + "-" + m[2] + ".json";
}

function bad(res, status, code, error) {
  return res.status(status).json({ ok: false, code: code, error: error });
}

function parseBody(req) {
  const raw = req && req.body;
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch (e) {
    return null;
  }
}

async function readMonth(month) {
  const key = monthKeyFor(month);
  if (!key) return null;
  const stored = await JsonStore.getJson(key);
  return Ledger.normalizeMonth(stored || Ledger.emptyMonth(month), month);
}

async function writeMonth(doc) {
  const key = monthKeyFor(doc.month);
  if (!key) throw new Error("bad month");
  const next = Object.assign({}, doc, {
    version: Number(doc.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  });
  await JsonStore.putJson(key, next);
  return next;
}

async function readPlaces() {
  const stored = await JsonStore.getJson(PLACES_KEY);
  return Ledger.normalizeWarehouse(stored || Ledger.emptyWarehouse());
}

async function writePlaces(warehouse) {
  const next = Object.assign({}, warehouse, {
    version: Number(warehouse.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  });
  await JsonStore.putJson(PLACES_KEY, next);
  return next;
}

/* The month a caller asked for, and the five places behind the name field. */
async function monthPayload(month) {
  const doc = await readMonth(month);
  const places = await readPlaces();
  return {
    ok: true,
    month: doc.month,
    version: doc.version,
    deals: doc.deals,
    total: Ledger.monthTotal(doc),
    totalsByDay: Ledger.totalsByDay(doc),
    /* Never the whole warehouse: it is not a screen, it is the five it can offer. */
    favourites: Ledger.favourites(places),
    /* name → colour, so a row can be painted without a second request. */
    colours: Ledger.colourMap(places),
    /* The names behind the autocomplete, busiest first, and what each one is known
       for — so typing a place he knows fills the other two fields without a round
       trip (owner, 2026-09-04). Names and two small fields, never the warehouse. */
    placeNames: Ledger.placesByUse(places).map(function (p) {
      return p.name;
    }).slice(0, 300),
    placeDefaults: Ledger.placesByUse(places).slice(0, 300).reduce(function (acc, p) {
      acc[p.name] = { service: p.service, price: p.price };
      return acc;
    }, {}),
  };
}

module.exports = async function handler(req, res) {
  applyCors(req, res, { methods: "GET, POST, OPTIONS", headers: "Content-Type, X-Admin-Password, X-Admin-Token" });
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "admin-ledger",
      aiSurface: "none",
      hint: "POST with an owner credential: month | add_deal | update_deal | delete_deal | range",
    });
  }
  if (req.method !== "POST") return bad(res, 405, "METHOD", "Method not allowed");

  /* His income, and nobody else's business — before the body is read. */
  if (!checkAdminAuth(req)) return adminAuthDenied(res);

  const rl = checkRateLimit(req, { name: "admin-ledger", limit: 90, windowMs: 60 * 1000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  const body = parseBody(req);
  if (body === null) return bad(res, 400, "BAD_JSON", "Invalid JSON body");
  const action = String(body.action || "").slice(0, 40);

  try {
    if (action === "month") {
      const month = Ledger.monthKey(body.month ? body.month + "-01" : undefined);
      return res.status(200).json(await monthPayload(month));
    }

    if (action === "add_deal") {
      const day = Ledger.dayIso(body.day);
      const month = Ledger.monthKey(day);
      const doc = await readMonth(month);
      const added = Ledger.addDeal(doc, {
        day: day,
        name: body.name,
        service: body.service,
        price: body.price,
      });
      if (!added.ok) return bad(res, 400, added.code, added.error);
      await writeMonth(added.doc);
      /* The place is remembered from the deal that was actually saved, so a typo in a
         refused deal never reaches the warehouse. */
      await writePlaces(await readPlaces().then(function (w) {
        return Ledger.rememberPlace(w, added.deal);
      }));
      const payload = await monthPayload(month);
      payload.deal = added.deal;
      return res.status(200).json(payload);
    }

    if (action === "update_deal") {
      const month = Ledger.monthKey(body.month ? body.month + "-01" : body.day);
      const doc = await readMonth(month);
      const updated = Ledger.updateDeal(doc, body.id, {
        name: body.name,
        service: body.service,
        price: body.price,
        day: body.day,
        /* Undefined means "not part of this edit" — ticking the invoice box sends only
           this, and editing a row must not clear it (owner, 2026-09-04). */
        invoiced: body.invoiced === undefined ? undefined : body.invoiced === true,
      });
      if (!updated.ok) {
        return bad(res, updated.code === "NOT_FOUND" ? 404 : 400, updated.code, updated.error);
      }
      await writeMonth(updated.doc);
      /* A corrected price is what to offer next time — the other deals keep theirs. */
      await writePlaces(await readPlaces().then(function (w) {
        return Ledger.rememberPlace(w, updated.deal);
      }));
      const payload = await monthPayload(month);
      payload.deal = updated.deal;
      return res.status(200).json(payload);
    }

    if (action === "delete_deal") {
      const month = Ledger.monthKey(body.month ? body.month + "-01" : body.day);
      const doc = await readMonth(month);
      const removed = Ledger.removeDeal(doc, body.id);
      if (!removed.ok) return bad(res, 404, removed.code, removed.error);
      await writeMonth(removed.doc);
      return res.status(200).json(await monthPayload(month));
    }

    /**
     * "I invoiced this place" — every session at it, inside the range on screen.
     *
     * Bounded to the months the range touches, which is at most twelve: the same fence
     * every other multi-month write here has. Unticking is the same call with false,
     * because a place stops being invoiced the moment one of its sessions does
     * (owner, 2026-09-04).
     */
    if (action === "invoice_place") {
      const from = Ledger.dayIso(body.from);
      const to = Ledger.dayIso(body.to);
      const want = body.invoiced === true;
      const name = String(body.name || "");
      if (!name) return bad(res, 400, "NO_NAME", "which place?");
      const months = Ledger.monthsBetween(from, to).slice(0, 12);
      let changed = 0;
      for (const m of months) {
        const doc = await readMonth(m);
        if (!doc.deals.length) continue;
        let touched = false;
        const next = Object.assign({}, doc, {
          deals: doc.deals.map(function (d) {
            const inRange = d.day >= from && d.day <= to;
            const samePlace = d.name.trim().toLowerCase() === name.trim().toLowerCase();
            if (!inRange || !samePlace || d.invoiced === want) return d;
            touched = true;
            changed += 1;
            return Object.assign({}, d, { invoiced: want });
          }),
        });
        if (touched) await writeMonth(next);
      }
      return res.status(200).json({ ok: true, changed: changed, invoiced: want });
    }

    /* Everyone he has worked for, busiest first — the list behind the "favourites"
       box. One object, and it is the same one the five come from. */
    if (action === "places") {
      const places = await readPlaces();
      return res.status(200).json({ ok: true, places: Ledger.placesByUse(places) });
    }

    /* A place dropped from the memory list. The deals done at it are untouched — this
       is the list he picks a name from, not the record (owner, 2026-09-04). */
    if (action === "delete_place") {
      const places = await readPlaces();
      const gone = Ledger.forgetPlace(places, body.name);
      if (!gone.ok) return bad(res, 404, gone.code, gone.error);
      await writePlaces(gone.warehouse);
      return res.status(200).json({
        ok: true,
        places: Ledger.placesByUse(gone.warehouse),
        colours: Ledger.colourMap(gone.warehouse),
      });
    }

    /**
     * A place renamed or given a colour.
     *
     * A colour is written once, on the place. A RENAME also rewrites the rows that
     * carry the old name, month by month — otherwise the old deals keep the typo and
     * the list splits in two. Bounded to two years back: it is a deliberate action, not
     * a timer, but it still may not turn into a scan of the whole store.
     */
    if (action === "update_place") {
      const places = await readPlaces();
      const from = String(body.name || "");
      let next = places;
      let renamed = 0;

      if (body.newName !== undefined && String(body.newName || "").trim() !== from.trim()) {
        const r = Ledger.renamePlace(next, from, body.newName);
        if (!r.ok) return bad(res, r.code === "NOT_FOUND" ? 404 : 400, r.code, r.error);
        next = r.warehouse;
        const today = Ledger.dayIso();
        /* Two years back and three months forward: a session can be written ahead of
           today, and a rename that skipped it would leave the old name on a row he can
           still see (found by the test, 2026-09-03). Bounded on purpose — a rename is a
           deliberate action, never a timer. */
        const months = Ledger.monthsBetween(
          Ledger.shiftMonth(Ledger.monthKey(today), -23) + "-01",
          Ledger.shiftMonth(Ledger.monthKey(today), 3) + "-28"
        ).slice(0, 30);
        for (const m of months) {
          const doc = await readMonth(m);
          if (!doc.deals.length) continue;
          const moved = Ledger.renameInMonth(doc, from, body.newName);
          if (!moved.changed) continue;
          await writeMonth(moved.doc);
          renamed += moved.changed;
        }
      }

      if (body.colour !== undefined) {
        const c = Ledger.setPlaceColour(next, body.newName || from, body.colour);
        if (!c.ok) return bad(res, 404, c.code, c.error);
        next = c.warehouse;
      }

      await writePlaces(next);
      return res.status(200).json({
        ok: true,
        places: Ledger.placesByUse(next),
        colours: Ledger.colourMap(next),
        renamedRows: renamed,
      });
    }

    /* "This week" crosses a month boundary six times a year, so a range reads the one
       or two month objects it touches — never a list, never the whole history. */
    if (action === "range") {
      const from = Ledger.dayIso(body.from);
      const to = Ledger.dayIso(body.to);
      /* A year is twelve small objects and he asked for the button, so twelve is the
         ceiling. It is still a hard cap: a range is answered from the months it
         touches, never from a listing of the store (owner, 2026-09-03). */
      const months = Ledger.monthsBetween(from, to).slice(0, 12);
      let deals = [];
      for (const m of months) {
        const doc = await readMonth(m);
        deals = deals.concat(doc.deals);
      }
      /* The range on its own, for the lists. */
      const inRange = Ledger.filterDeals(deals, { from: from, to: to });
      const rows = Ledger.filterDeals(deals, {
        name: body.name,
        /* A place chosen from the list is an exact answer to "what do I invoice this
           gym for", not a search (owner, 2026-09-04). */
        exactName: body.exactName === true,
        service: body.service,
        minPrice: body.minPrice,
        maxPrice: body.maxPrice,
        from: from,
        to: to,
      });
      const ordered = Ledger.sortDeals(rows, body.sortBy, body.sortDir);
      /* One line per place, which is what the table opens on. Computed here so the
         page renders one answer rather than doing arithmetic on a list it happens to
         hold (owner, 2026-09-04). */
      const groups = Ledger.sortGroups(Ledger.groupByPlace(rows), body.sortBy, body.sortDir);
      return res.status(200).json({
        ok: true,
        from: from,
        to: to,
        months: months,
        deals: ordered,
        groups: groups,
        total: Ledger.sumOf(ordered),
        /* What the two lists can offer — computed BEFORE the name and service filters,
           or choosing a place would collapse the list to that one place and he could
           never switch (owner, 2026-09-04). */
        names: Array.from(new Set(inRange.map(function (d) { return d.name; }))).sort(),
        services: Array.from(new Set(inRange.map(function (d) { return d.service; }).filter(Boolean))).sort(),
      });
    }

    return bad(res, 400, "BAD_ACTION", "unknown action");
  } catch (e) {
    return bad(res, 503, "STORE_FAILED", String((e && e.message) || e).slice(0, 200));
  }
};
