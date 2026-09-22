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
/* ══════════════════════════════════════════════════════════════════════════
   WHAT WAS NEVER INVOICED — a running total, since ever.

   The owner's rule: this number is "everything I have not invoiced, from the beginning
   of time", so that nothing is ever missed. It must not depend on the month on screen
   or on any filter (owner, 2026-09-08).

   Reading every month to add that up on every screen is the pattern that had the Blob
   store suspended on 2026-09-02. So it is kept as ONE small object — a number per month
   and their sum — rewritten only when a month actually changes. Drawing the box is one
   read; a month he edits costs one extra write.

   It is built once, from a bounded window of months, the first time it is asked for.
   ══════════════════════════════════════════════════════════════════════════ */
const UNINVOICED_KEY = "coach-ledger/_uninvoiced.json";
/* ══════════════════════════════════════════════════════════════════════════
   THE MONTHLY CLIENTS — one object for all of them.

   A studio that pays every month is not a deal, it is a standing arrangement, and
   until now the book had no shape for one. It lives in ONE small object: opening the
   book reads it once, and nothing here ever lists the store — the lesson of
   2026-09-02 holds on this side of the feature too.

   A bill whose day has come is WRITTEN into its month, once, under an id built from
   the client and the month. A bill still ahead is never written: the page draws it
   from this object as he scrolls forward, so looking at next March costs nothing and
   leaves nothing behind.
   ══════════════════════════════════════════════════════════════════════════ */
const SUBS_KEY = "coach-ledger/subscriptions.json";
/* What a monthly bill is called until he says otherwise. */
const DEFAULT_SERVICE = "תוכנית אימון";
/* How far back the first build looks. Two years of a coach's book, bounded — and after
   that first build nothing ever scans again. */
const BUILD_MONTHS_BACK = 23;

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

async function readSubs() {
  const stored = await JsonStore.getJson(SUBS_KEY);
  return Ledger.normalizeSubscriptions(stored || Ledger.emptySubscriptions());
}

async function writeSubs(store) {
  const next = Object.assign({}, store, {
    version: Number(store.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  });
  await JsonStore.putJson(SUBS_KEY, next);
  return next;
}

/**
 * Write down the bills whose day has come.
 *
 * Costs nothing on the common path: every subscription carries the last month it was
 * billed for, so "is anything owed?" is answered from the one object already in hand,
 * with no month read at all. Only a month that actually gains a bill is read and
 * written, and the whole pass is fenced at twelve months so a subscription opened two
 * years ago can never turn into a hundred writes.
 *
 * Planting is idempotent by id, so two tabs opening the book at once cannot bill a
 * studio twice for the same month.
 */
async function settleDue(todayIso) {
  const store = await readSubs();
  const due = Ledger.dueOccurrences(store, todayIso, [], { backMonths: 12 });
  if (!due.length) return store;

  const byMonth = {};
  due.forEach(function (d) {
    if (!byMonth[d.month]) byMonth[d.month] = [];
    byMonth[d.month].push(d.deal);
  });

  const billedThrough = {};
  for (const month of Object.keys(byMonth).sort()) {
    let doc = await readMonth(month);
    let touched = false;
    for (const deal of byMonth[month]) {
      const planted = Ledger.plantOccurrence(doc, deal);
      doc = planted.doc;
      if (planted.ok) touched = true;
      /* Marked even when it was already there: the marker is about what has been
         settled, not about what this pass happened to write. */
      if (!billedThrough[deal.clientId] || month > billedThrough[deal.clientId]) {
        billedThrough[deal.clientId] = month;
      }
    }
    if (touched) await noteUninvoiced(await writeMonth(doc));
  }

  let next = store;
  Object.keys(billedThrough).forEach(function (clientId) {
    const moved = Ledger.upsertSubscription(next, {
      clientId: clientId,
      billedThrough: billedThrough[clientId],
    });
    if (moved.ok) next = moved.store;
  });
  return writeSubs(next);
}

/* The month a caller asked for, and the five places behind the name field. */
async function readUninvoiced() {
  let doc = null;
  try {
    doc = await JsonStore.getJson(UNINVOICED_KEY);
  } catch (e) {
    doc = null;
  }
  if (!doc || typeof doc !== "object" || typeof doc.months !== "object" || !doc.months) return null;
  return doc;
}

function sumOf(months) {
  let total = 0;
  for (const k of Object.keys(months || {})) {
    const n = Number(months[k]);
    if (Number.isFinite(n)) total += n;
  }
  return Math.round(total * 100) / 100;
}

async function writeUninvoiced(months) {
  const clean = {};
  for (const k of Object.keys(months || {})) {
    const n = Number(months[k]);
    /* A month with nothing outstanding is dropped rather than stored as a zero: the
       object stays the size of the work, not the size of the calendar. */
    if (Number.isFinite(n) && n > 0) clean[k] = Math.round(n * 100) / 100;
  }
  const doc = {
    version: 1,
    updatedAt: new Date().toISOString(),
    months: clean,
    total: sumOf(clean),
  };
  await JsonStore.putJson(UNINVOICED_KEY, doc);
  return doc;
}

/**
 * One month changed — write down what it owes now.
 *
 * Called after every write to a month, with the document that was just saved, so the
 * running total is a consequence of the write rather than a second opinion about it.
 */
async function noteUninvoiced(doc) {
  if (!doc || !doc.month) return null;
  const idx = (await readUninvoiced()) || { months: {} };
  const months = Object.assign({}, idx.months);
  const owed = Ledger.uninvoicedTotal(doc.deals || []);
  if (owed > 0) months[doc.month] = owed;
  else delete months[doc.month];
  try {
    return await writeUninvoiced(months);
  } catch (e) {
    /* The number is a convenience; losing it must never cost him the write that
       mattered. It rebuilds itself the next time it is asked for. */
    return null;
  }
}

/**
 * Build it for the first time, from a bounded window of months.
 *
 * This is the ONLY place that reads more than one month, it happens once, and it is
 * fenced at two years — see the comment on UNINVOICED_KEY.
 */
async function buildUninvoiced(todayIso) {
  const from = Ledger.shiftMonth(Ledger.monthKey(todayIso), -BUILD_MONTHS_BACK);
  const months = {};
  let cursor = from;
  for (let i = 0; i <= BUILD_MONTHS_BACK + 3; i++) {
    const doc = await readMonth(cursor);
    if (doc && doc.deals && doc.deals.length) {
      const owed = Ledger.uninvoicedTotal(doc.deals);
      if (owed > 0) months[cursor] = owed;
    }
    cursor = Ledger.shiftMonth(cursor, 1);
  }
  return writeUninvoiced(months);
}

async function monthPayload(month, opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const doc = await readMonth(month);
  const places = await readPlaces();
  const subs = o.subs || (await readSubs());
  /* Bills still ahead of their day, drawn and never stored. A month whose bill is
     already in the book is skipped by id, so nothing is ever shown twice. */
  const projected = Ledger.occurrencesIn(subs, doc.month, doc.deals.map(function (d) {
    return d.id;
  }));
  /* What the month is worth is what is written PLUS what is already promised: a
     studio that pays on the 5th is worth its fee on the 1st too (owner, 2026-09-22).
     The book itself still holds only what was written — this shape exists for the
     screen and is never saved. */
  const shown = Object.assign({}, doc, { deals: doc.deals.concat(projected) });
  return {
    ok: true,
    month: doc.month,
    version: doc.version,
    deals: shown.deals,
    total: Ledger.monthTotal(shown),
    totalsByDay: Ledger.totalsByDay(shown),
    /* Everyone who pays every month, for the favourites box and the billing date
       field beside each one. One object, already in hand. */
    subscriptions: subs.subs,
    /* Never the whole warehouse: it is not a screen, it is the five it can offer. */
    favourites: Ledger.favourites(places),
    /* name → colour, so a row can be painted without a second request. A monthly
       client's colour wins over a place of the same name: the colour is chosen on his
       tab, and that one choice has to be what the strip, the favourites, the table and
       the calendar all show (owner, 2026-09-22). */
    colours: subs.subs.reduce(function (acc, sub) {
      if (sub.colour) acc[sub.name] = sub.colour;
      return acc;
    }, Ledger.colourMap(places)),
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
      hint: "POST with an owner credential: month | add_deal | update_deal | delete_deal | range | subscriptions",
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
      /* Opening the book is when a bill whose day has come gets written down. It
         costs nothing when nothing is owed — see settleDue. */
      const subs = await settleDue(Ledger.dayIso(body.today) || undefined);
      return res.status(200).json(await monthPayload(month, { subs: subs }));
    }

    /* ---------------------------------------------------------- monthly clients */

    /* The whole arrangement book: one object, never a listing of the store. */
    if (action === "subscriptions") {
      const subs = await settleDue(Ledger.dayIso(body.today) || undefined);
      return res.status(200).json({ ok: true, subscriptions: subs.subs });
    }

    /**
     * A client became a monthly client, or something about him changed.
     *
     * The client screen sends what it knows — a name, a colour, a price, a freeze, the
     * day the programme was handed over. What it leaves out is kept, so a rename can
     * never quietly erase a price.
     */
    if (action === "save_subscription") {
      const store = await readSubs();
      /* A rename or a new colour must not INVENT an arrangement. Every client in the
         module sends those, and only the ones who actually pay every month belong in
         this book — so a client the book has never heard of is only written down when
         the call carries a price (owner, 2026-09-22). */
      if (!String(body.clientId || "").trim()) {
        return bad(res, 400, "NO_CLIENT", "a subscription needs a client");
      }
      const known = Ledger.findSub(store, body.clientId);
      if (!known && !(Number(body.price) > 0)) {
        return res.status(200).json({ ok: true, subscriptions: store.subs, subscription: null });
      }
      const saved = Ledger.upsertSubscription(store, {
        clientId: body.clientId,
        name: body.name,
        /* The first intake has no "what is this for" field, so a new arrangement gets
           the plain answer and he changes it in the table when it is something else
           (owner, 2026-09-22). */
        service: known ? body.service : body.service || DEFAULT_SERVICE,
        price: body.price,
        method: body.method,
        colour: body.colour,
        startDay: body.startDay,
        active: body.active,
      });
      if (!saved.ok) return bad(res, 400, saved.code, saved.error);
      await writeSubs(saved.store);
      /* A new arrangement whose first day has already passed is billed at once, so he
         never has to remember to open the book on the right day. */
      const settled = await settleDue(Ledger.dayIso(body.today) || undefined);
      return res.status(200).json({
        ok: true,
        subscriptions: settled.subs,
        subscription: Ledger.findSub(settled, body.clientId),
      });
    }

    /**
     * What the bill is FOR — changed by hand, from the row in the table.
     *
     * It moves the arrangement, so every bill from here on carries the new wording.
     * It also rewrites the bill of the month on screen when that one has not been
     * invoiced yet: he is looking at it, and a line that keeps the old words while the
     * list beside it shows the new ones is just confusing. A bill he has already
     * invoiced is left exactly as it was billed (owner, 2026-09-22).
     */
    if (action === "set_subscription_service") {
      const store = await readSubs();
      const sub = Ledger.findSub(store, body.clientId);
      if (!sub) return bad(res, 404, "NOT_FOUND", "no such subscription");
      const saved = Ledger.upsertSubscription(store, {
        clientId: body.clientId,
        service: String(body.service || "").trim() || DEFAULT_SERVICE,
      });
      if (!saved.ok) return bad(res, 400, saved.code, saved.error);
      await writeSubs(saved.store);

      const month = Ledger.monthKey(body.month ? body.month + "-01" : undefined);
      const doc = await readMonth(month);
      const id = Ledger.occurrenceId(saved.sub, month);
      const row = doc.deals.filter(function (d) { return d.id === id; })[0];
      if (row && !row.invoiced) {
        const moved = Ledger.updateDeal(doc, id, { service: saved.sub.service });
        if (moved.ok) await writeMonth(moved.doc);
      }
      return res.status(200).json({
        ok: true,
        subscriptions: saved.store.subs,
        subscription: saved.sub,
      });
    }

    /* A client deleted in the module leaves the book with him (owner, 2026-09-22).
       What he already paid stays written where it was written. */
    if (action === "delete_subscription") {
      const store = await readSubs();
      const gone = Ledger.removeSubscription(store, body.clientId);
      if (!gone.ok) return bad(res, 404, gone.code, gone.error);
      await writeSubs(gone.store);
      return res.status(200).json({ ok: true, subscriptions: gone.store.subs });
    }

    /**
     * A new price — and the whole question is WHEN.
     *
     * "now"  · this month is worth the new price too, even five days in.
     * "next" · the old price stands until the next billing date, which is named here
     *          so the popup and the book cannot disagree about it.
     */
    if (action === "set_subscription_price") {
      const store = await readSubs();
      const mode = body.mode === "next" ? "next" : "now";
      const moved = Ledger.setSubscriptionPrice(store, body.clientId, body.price, mode, {
        today: Ledger.dayIso(body.today) || undefined,
      });
      if (!moved.ok) return bad(res, moved.code === "NOT_FOUND" ? 404 : 400, moved.code, moved.error);
      await writeSubs(moved.store);
      return res.status(200).json({
        ok: true,
        subscriptions: moved.store.subs,
        subscription: moved.sub,
        from: moved.from,
      });
    }

    /* The day of the month the money falls on. It moves from the next bill onwards —
       a month already written keeps the day it was written on. */
    if (action === "set_billing_day") {
      const store = await readSubs();
      const moved = Ledger.setBillingDay(store, body.clientId, body.day, {
        today: Ledger.dayIso(body.today) || undefined,
      });
      if (!moved.ok) return bad(res, moved.code === "NOT_FOUND" ? 404 : 400, moved.code, moved.error);
      await writeSubs(moved.store);
      return res.status(200).json({
        ok: true,
        subscriptions: moved.store.subs,
        subscription: moved.sub,
        from: moved.from,
      });
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
      const addedDoc = await writeMonth(added.doc);
      await noteUninvoiced(addedDoc);
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
      const updatedDoc = await writeMonth(updated.doc);
      await noteUninvoiced(updatedDoc);
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
      const removedDoc = await writeMonth(removed.doc);
      await noteUninvoiced(removedDoc);
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
        if (touched) await noteUninvoiced(await writeMonth(next));
      }
      return res.status(200).json({ ok: true, changed: changed, invoiced: want });
    }

    /**
     * "סכום לחשבונית קרובה" — everything not invoiced, since ever.
     *
     * One read of one small object. It is not affected by the month on screen or by any
     * filter, because the number's whole job is that nothing is missed
     * (owner, 2026-09-08).
     */
    if (action === "uninvoiced") {
      /* A bill that fell due this morning belongs in this number, so the settling
         happens before it is read. Free when there is nothing to settle. */
      await settleDue(Ledger.dayIso(body.today) || undefined);
      let idx = await readUninvoiced();
      if (!idx) idx = await buildUninvoiced(Ledger.dayIso(body.today) || undefined);
      return res.status(200).json({
        ok: true,
        total: Number(idx && idx.total) || 0,
        months: (idx && idx.months) || {},
      });
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
      const subs = await readSubs();
      let deals = [];
      for (const m of months) {
        const doc = await readMonth(m);
        /* The table and the calendar have to agree. A bill still ahead of its day is
           drawn on the calendar, so it belongs in the record on the same terms:
           visible, marked as a promise, and never stored (owner, 2026-09-22). */
        deals = deals.concat(doc.deals, Ledger.occurrencesIn(subs, m, doc.deals.map(function (d) {
          return d.id;
        })));
      }
      /* The range on its own, for the lists. */
      const inRange = Ledger.filterDeals(deals, { from: from, to: to });
      const rows = Ledger.filterDeals(deals, {
        nature: body.nature,
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
        /* The arrangements themselves, so a row can show the price that is coming
           without a second request. One object, already in hand. */
        subscriptions: subs.subs,
        names: Array.from(new Set(inRange.map(function (d) { return d.name; }))).sort(),
        services: Array.from(new Set(inRange.map(function (d) { return d.service; }).filter(Boolean))).sort(),
      });
    }

    return bad(res, 400, "BAD_ACTION", "unknown action");
  } catch (e) {
    return bad(res, 503, "STORE_FAILED", String((e && e.message) || e).slice(0, 200));
  }
};
