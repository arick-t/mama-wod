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

    /* "This week" crosses a month boundary six times a year, so a range reads the one
       or two month objects it touches — never a list, never the whole history. */
    if (action === "range") {
      const from = Ledger.dayIso(body.from);
      const to = Ledger.dayIso(body.to);
      const months = Ledger.monthsBetween(from, to).slice(0, 3);
      let deals = [];
      for (const m of months) {
        const doc = await readMonth(m);
        deals = deals.concat(doc.deals);
      }
      const rows = Ledger.filterDeals(deals, {
        name: body.name,
        minPrice: body.minPrice,
        maxPrice: body.maxPrice,
        from: from,
        to: to,
      });
      return res.status(200).json({
        ok: true,
        from: from,
        to: to,
        months: months,
        deals: rows,
        total: Ledger.sumOf(rows),
      });
    }

    return bad(res, 400, "BAD_ACTION", "unknown action");
  } catch (e) {
    return bad(res, 503, "STORE_FAILED", String((e && e.message) || e).slice(0, 200));
  }
};
