/**
 * The coach's own book: where he trained, what he gave, what he was paid.
 *
 * This is NOT the client-programme world. There, he writes a training plan for someone
 * who holds a link. Here he is the coach on the floor at somebody else's gym, and the
 * only questions are which place, which service, and how much (owner, 2026-09-03).
 *
 * Pure logic, no storage and no network: the same file runs in the admin page and in
 * the tests. The server module wraps it, and the view renders what it returns.
 *
 * Two rules run through everything here:
 *   1. A deal keeps the price it was done at. The warehouse remembers a new price for
 *      NEXT time; it never rewrites what a past month earned, or last month's total
 *      would move every time he raises a rate.
 *   2. A month is a closed box. The header total is that month's deals and nothing
 *      else, so browsing back is just opening another box — no running balance to
 *      reset on the first of the month.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CoachLedger = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** A place he trains at, remembered so he never types it twice. */
  const MAX_NAME = 80;
  const MAX_SERVICE = 80;
  /* Above this a price is a typo, not a session. */
  const MAX_PRICE = 100000;
  const FAVOURITES = 5;
  /* One object per month; a place list that grows without bound is a slow page. */
  const MAX_PLACES = 400;
  const MAX_DEALS_PER_MONTH = 2000;

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function nowMs(clock) {
    return typeof clock === "function" ? clock() : Date.now();
  }

  function text(v, max) {
    return String(v === undefined || v === null ? "" : v)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  /**
   * Money, as shekels with agorot.
   *
   * Returns 0 for anything that is not a number — a deal with no price is a deal he
   * has not finished entering, and the caller refuses it rather than storing NaN.
   */
  function money(v) {
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(Math.min(n, MAX_PRICE) * 100) / 100;
  }

  /** "2026-09-03" from a date, an ISO string, or nothing (→ today). */
  function dayIso(v, clock) {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v || "");
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return new Date(nowMs(clock)).toISOString().slice(0, 10);
  }

  /** "2026-09" — the box a day belongs to. */
  function monthKey(v, clock) {
    return dayIso(v, clock).slice(0, 7);
  }

  /** The days of a month, as ISO dates, for the calendar grid. */
  function daysInMonth(key) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
    if (!m) return [];
    const year = Number(m[1]);
    const month = Number(m[2]);
    const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const out = [];
    for (let d = 1; d <= total; d++) {
      out.push(key + "-" + String(d).padStart(2, "0"));
    }
    return out;
  }

  /** Which weekday a date falls on, 0 = Sunday — the week starts on Sunday here. */
  function weekdayOf(iso) {
    return new Date(dayIso(iso) + "T00:00:00Z").getUTCDay();
  }

  function shiftMonth(key, delta) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
    if (!m) return key;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + Number(delta || 0), 1));
    return d.toISOString().slice(0, 7);
  }

  /** A short, sortable id. Collisions do not matter: it is unique within one month. */
  function dealId(clock) {
    return (
      "d" +
      nowMs(clock).toString(36) +
      Math.floor(Math.random() * 1e6).toString(36)
    );
  }

  /* ---------------------------------------------------------------- deals */

  function emptyMonth(key) {
    return { month: String(key || ""), version: 1, updatedAt: "", deals: [] };
  }

  function normalizeMonth(doc, key) {
    const o = isPlainObject(doc) ? doc : {};
    return {
      month: String(o.month || key || ""),
      version: Number(o.version) > 0 ? Number(o.version) : 1,
      updatedAt: String(o.updatedAt || ""),
      deals: (Array.isArray(o.deals) ? o.deals : []).map(normalizeDeal).filter(Boolean),
    };
  }

  function normalizeDeal(raw) {
    if (!isPlainObject(raw)) return null;
    const name = text(raw.name, MAX_NAME);
    if (!name) return null;
    const deal = {
      id: text(raw.id, 40) || dealId(),
      /* The day it BELONGS to — the square he clicked, not when he typed it. */
      day: dayIso(raw.day || raw.dayIso),
      name: name,
      service: text(raw.service, MAX_SERVICE),
      /* Frozen at what it was worth on the day. See rule 1 at the top. */
      price: money(raw.price),
      /* Hidden from him on purpose: it exists so two deals on the same day keep the
         order he entered them, and so a date filter can be finer than a day. */
      createdAt: String(raw.createdAt || ""),
      updatedAt: String(raw.updatedAt || ""),
      /* Did he invoice this one? Nobody can work it out for him — it is a tick he
         keeps himself, and it is what tells him what is left to bill (owner,
         2026-09-04). */
      invoiced: raw.invoiced === true,
      /* WHAT this row is: a session he gave once, or a month's turn of a client who
         pays every month. Written down rather than worked out at read time, but a row
         from before this field existed still answers correctly, because a subscription
         row carries it in its id (owner, 2026-09-22). */
      nature: raw.nature === NATURE_RECURRING || isRecurringId(raw.id) ? NATURE_RECURRING : NATURE_ONCE,
      /* Which client this belongs to, when it belongs to one. It is how the row finds
         its colour and its subscription; a one-off has nobody and leaves it empty. */
      clientId: text(raw.clientId, 60),
    };
    /* A bill that has not reached its day yet. It is never stored — nothing writes it
       — but it travels through every filter, sort and group on its way to the screen,
       and losing the flag on the way would turn a promise into a record. */
    if (raw.projected === true) deal.projected = true;
    return deal;
  }

  /**
   * @returns {{ok: boolean, code?: string, error?: string, doc?: object, deal?: object}}
   */
  function addDeal(monthDoc, input, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const doc = normalizeMonth(monthDoc, monthKey(input && input.day, o.clock));
    const deal = normalizeDeal(
      Object.assign({}, input, {
        id: dealId(o.clock),
        createdAt: new Date(nowMs(o.clock)).toISOString(),
      })
    );
    if (!deal) return { ok: false, code: "NO_NAME", error: "a deal needs a place" };
    if (deal.price <= 0) return { ok: false, code: "NO_PRICE", error: "a deal needs a price" };
    if (monthKey(deal.day) !== doc.month) {
      return { ok: false, code: "WRONG_MONTH", error: "that day is not in this month" };
    }
    if (doc.deals.length >= MAX_DEALS_PER_MONTH) {
      return { ok: false, code: "MONTH_FULL", error: "too many deals in one month" };
    }
    doc.deals.push(deal);
    return { ok: true, doc: doc, deal: deal };
  }

  /** Editing a mistake — the owner asked for it and he is right: prices get mistyped. */
  function updateDeal(monthDoc, id, patch, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const doc = normalizeMonth(monthDoc, "");
    const idx = doc.deals.findIndex(function (d) {
      return d.id === text(id, 40);
    });
    if (idx < 0) return { ok: false, code: "NOT_FOUND", error: "no such deal" };
    const p = isPlainObject(patch) ? patch : {};
    const next = normalizeDeal(
      Object.assign({}, doc.deals[idx], {
        name: p.name === undefined ? doc.deals[idx].name : p.name,
        service: p.service === undefined ? doc.deals[idx].service : p.service,
        price: p.price === undefined ? doc.deals[idx].price : p.price,
        invoiced: p.invoiced === undefined ? doc.deals[idx].invoiced : p.invoiced === true,
        /* The day can move within the month — a session logged on the wrong square. */
        day: p.day === undefined ? doc.deals[idx].day : p.day,
        updatedAt: new Date(nowMs(o.clock)).toISOString(),
      })
    );
    if (!next) return { ok: false, code: "NO_NAME", error: "a deal needs a place" };
    if (next.price <= 0) return { ok: false, code: "NO_PRICE", error: "a deal needs a price" };
    if (monthKey(next.day) !== doc.month) {
      return { ok: false, code: "WRONG_MONTH", error: "that day is not in this month" };
    }
    doc.deals[idx] = next;
    return { ok: true, doc: doc, deal: next };
  }

  function removeDeal(monthDoc, id) {
    const doc = normalizeMonth(monthDoc, "");
    const before = doc.deals.length;
    doc.deals = doc.deals.filter(function (d) {
      return d.id !== text(id, 40);
    });
    if (doc.deals.length === before) return { ok: false, code: "NOT_FOUND", error: "no such deal" };
    return { ok: true, doc: doc };
  }

  /** What the month earned — the number in the calendar header. */
  function monthTotal(monthDoc) {
    return round2(
      normalizeMonth(monthDoc, "").deals.reduce(function (sum, d) {
        return sum + d.price;
      }, 0)
    );
  }

  /**
   * What is still waiting for an invoice.
   *
   * The rows with no tick, added up. It is the only number on this screen that is a
   * TASK rather than a record: it says what he still has to send out, and it goes to
   * zero the moment he ticks them (owner, 2026-09-08).
   *
   * @param {object[]} deals any list of deals — a month, a range, whatever is on screen
   */
  function uninvoicedTotal(deals) {
    return round2(
      (Array.isArray(deals) ? deals : []).reduce(function (sum, d) {
        if (!d || d.invoiced === true) return sum;
        const n = Number(d.price);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0)
    );
  }

  /** Per-day totals, so a square can carry its own number. */
  function totalsByDay(monthDoc) {
    const out = {};
    normalizeMonth(monthDoc, "").deals.forEach(function (d) {
      out[d.day] = round2((out[d.day] || 0) + d.price);
    });
    return out;
  }

  function dealsOfDay(monthDoc, iso) {
    const day = dayIso(iso);
    return normalizeMonth(monthDoc, "")
      .deals.filter(function (d) {
        return d.day === day;
      })
      .sort(byTime);
  }

  function byTime(a, b) {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    return String(a.createdAt) < String(b.createdAt) ? -1 : 1;
  }

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  /* ------------------------------------------------------------ warehouse */

  /**
   * The places he trains at, and what he last charged there.
   *
   * Never a screen — the owner was explicit. It exists to fill three fields from one
   * click, and to stop him retyping "רימון" for the fortieth time.
   */
  function emptyWarehouse() {
    return { version: 1, updatedAt: "", places: [] };
  }

  function normalizeWarehouse(raw) {
    const o = isPlainObject(raw) ? raw : {};
    const seen = {};
    const places = [];
    (Array.isArray(o.places) ? o.places : []).forEach(function (p) {
      const place = normalizePlace(p);
      if (!place) return;
      const k = placeKey(place.name);
      /* Same place typed with different spacing or case is one place. */
      if (seen[k]) return;
      seen[k] = true;
      places.push(place);
    });
    return {
      version: Number(o.version) > 0 ? Number(o.version) : 1,
      updatedAt: String(o.updatedAt || ""),
      places: places.slice(0, MAX_PLACES),
    };
  }

  function normalizePlace(raw) {
    if (!isPlainObject(raw)) return null;
    const name = text(raw.name, MAX_NAME);
    if (!name) return null;
    return {
      name: name,
      service: text(raw.service, MAX_SERVICE),
      price: money(raw.price),
      lastUsedAt: String(raw.lastUsedAt || ""),
      uses: Number(raw.uses) > 0 ? Math.floor(Number(raw.uses)) : 0,
      /* His own colour for the place, so a row can be picked out of a month at a
         glance. Validated on the way in as well as out: it ends up in a style
         attribute (owner, 2026-09-03). */
      colour: /^#[0-9a-f]{6}$/i.test(String(raw.colour || "")) ? String(raw.colour) : "",
    };
  }

  function placeKey(name) {
    return text(name, MAX_NAME).toLowerCase();
  }

  /**
   * Write a place back after a deal.
   *
   * The price stored here is the one to offer NEXT time — changing it does not touch a
   * single past deal (rule 1). A new place is added the moment it is typed, which is
   * exactly what the owner asked for: he never adds a place on purpose.
   */
  function rememberPlace(warehouse, deal, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const w = normalizeWarehouse(warehouse);
    const name = text(deal && deal.name, MAX_NAME);
    if (!name) return w;
    const stamp = new Date(nowMs(o.clock)).toISOString();
    const k = placeKey(name);
    const idx = w.places.findIndex(function (p) {
      return placeKey(p.name) === k;
    });
    const next = {
      name: name,
      service: text(deal && deal.service, MAX_SERVICE),
      price: money(deal && deal.price),
      lastUsedAt: stamp,
      uses: (idx >= 0 ? w.places[idx].uses : 0) + 1,
      colour: idx >= 0 ? w.places[idx].colour : "",
    };
    /* A blank service on this deal must not erase what the place is known for. */
    if (!next.service && idx >= 0) next.service = w.places[idx].service;
    if (idx >= 0) w.places[idx] = next;
    else w.places.unshift(next);
    w.places = w.places.slice(0, MAX_PLACES);
    return w;
  }

  /**
   * Forget a place.
   *
   * The warehouse is a memory, not a record: dropping a place here changes no deal
   * that was ever done at it. A mistyped name has to be removable, or the list he
   * picks from grows a row of rubbish for ever (owner, 2026-09-04).
   */
  function forgetPlace(warehouse, name) {
    const w = normalizeWarehouse(warehouse);
    const k = placeKey(name);
    const before = w.places.length;
    w.places = w.places.filter(function (p) {
      return placeKey(p.name) !== k;
    });
    if (w.places.length === before) return { ok: false, code: "NOT_FOUND", error: "no such place" };
    return { ok: true, warehouse: w };
  }

  /** The five he saw last, most recent first — the list behind the name field. */
  function favourites(warehouse, limit) {
    const n = Number(limit) > 0 ? Math.floor(Number(limit)) : FAVOURITES;
    return normalizeWarehouse(warehouse)
      .places.slice()
      .sort(function (a, b) {
        if (a.lastUsedAt === b.lastUsedAt) return b.uses - a.uses;
        return a.lastUsedAt > b.lastUsedAt ? -1 : 1;
      })
      .slice(0, n);
  }

  /**
   * Everyone he has worked for, the busiest first.
   *
   * "Favourites" the way he means it: not a shortlist he curates, but the places he
   * actually goes to, ordered by how often they appear in the calendar
   * (owner, 2026-09-03).
   */
  function placesByUse(warehouse) {
    return normalizeWarehouse(warehouse)
      .places.slice()
      .sort(function (a, b) {
        if (b.uses !== a.uses) return b.uses - a.uses;
        /* A tie goes to whoever was there most recently, then alphabetically, so the
           list never reshuffles itself between two identical answers. */
        if (a.lastUsedAt !== b.lastUsedAt) return a.lastUsedAt > b.lastUsedAt ? -1 : 1;
        return a.name < b.name ? -1 : 1;
      });
  }

  /** name → colour, for painting rows without carrying the whole warehouse around. */
  function colourMap(warehouse) {
    const out = {};
    normalizeWarehouse(warehouse).places.forEach(function (p) {
      if (p.colour) out[p.name] = p.colour;
    });
    return out;
  }

  /** His colour for a place, or "". */
  function placeColour(warehouse, name) {
    const hit = normalizeWarehouse(warehouse).places.find(function (p) {
      return placeKey(p.name) === placeKey(name);
    });
    return (hit && hit.colour) || "";
  }

  function setPlaceColour(warehouse, name, colour) {
    const w = normalizeWarehouse(warehouse);
    const idx = w.places.findIndex(function (p) {
      return placeKey(p.name) === placeKey(name);
    });
    if (idx < 0) return { ok: false, code: "NOT_FOUND", error: "no such place" };
    const hex = /^#[0-9a-f]{6}$/i.test(String(colour || "")) ? String(colour) : "";
    w.places[idx] = Object.assign({}, w.places[idx], { colour: hex });
    return { ok: true, warehouse: w };
  }

  /**
   * Renaming a place.
   *
   * The new name must not already belong to somebody else, or two places would silently
   * become one and their counts would merge. The deals themselves are renamed by the
   * caller, month by month — a name he corrects is corrected everywhere, otherwise the
   * old rows keep the typo and the list splits in two.
   */
  function renamePlace(warehouse, from, to) {
    const w = normalizeWarehouse(warehouse);
    const nextName = text(to, MAX_NAME);
    if (!nextName) return { ok: false, code: "NO_NAME", error: "a place needs a name" };
    const idx = w.places.findIndex(function (p) {
      return placeKey(p.name) === placeKey(from);
    });
    if (idx < 0) return { ok: false, code: "NOT_FOUND", error: "no such place" };
    const clash = w.places.findIndex(function (p, i) {
      return i !== idx && placeKey(p.name) === placeKey(nextName);
    });
    if (clash >= 0) return { ok: false, code: "NAME_TAKEN", error: "that name is already a place" };
    w.places[idx] = Object.assign({}, w.places[idx], { name: nextName });
    return { ok: true, warehouse: w, from: w.places[idx].name, to: nextName };
  }

  /** Rename inside one month. Returns the month and how many rows moved. */
  function renameInMonth(monthDoc, from, to) {
    const doc = normalizeMonth(monthDoc, "");
    const nextName = text(to, MAX_NAME);
    let changed = 0;
    doc.deals = doc.deals.map(function (d) {
      if (placeKey(d.name) !== placeKey(from)) return d;
      changed += 1;
      return Object.assign({}, d, { name: nextName });
    });
    return { doc: doc, changed: changed };
  }

  /** What a picked place plants into the other two fields. */
  function placeDefaults(warehouse, name) {
    const k = placeKey(name);
    const hit = normalizeWarehouse(warehouse).places.find(function (p) {
      return placeKey(p.name) === k;
    });
    if (!hit) return null;
    return { name: hit.name, service: hit.service, price: hit.price };
  }

  /* --------------------------------------------------------------- filters */

  /** Sunday→Saturday, the week the given day sits in. */
  function weekRange(iso) {
    const day = dayIso(iso);
    const start = new Date(day + "T00:00:00Z");
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  /** The calendar year the given day sits in — January to December. */
  function yearRange(iso) {
    const year = dayIso(iso).slice(0, 4);
    return { from: year + "-01-01", to: year + "-12-31" };
  }

  function monthRange(iso) {
    const key = monthKey(iso);
    const days = daysInMonth(key);
    return { from: days[0] || key + "-01", to: days[days.length - 1] || key + "-28" };
  }

  /**
   * The table's filters, all optional and all combinable.
   *
   * @param {object[]} deals
   * @param {{name?: string, minPrice?: number, maxPrice?: number, from?: string, to?: string}} q
   */
  function filterDeals(deals, q) {
    const f = isPlainObject(q) ? q : {};
    const needle = text(f.name, MAX_NAME).toLowerCase();
    /* An exact service, chosen from a list — not a search box. He picks "personal
       training" to see what he owes an invoice for. */
    const service = text(f.service, MAX_SERVICE).toLowerCase();
    const exactName = f.exactName === true;
    const nature = f.nature === NATURE_RECURRING || f.nature === NATURE_ONCE ? f.nature : "";
    const min = f.minPrice === undefined || f.minPrice === "" ? null : money(f.minPrice);
    const max = f.maxPrice === undefined || f.maxPrice === "" ? null : money(f.maxPrice);
    const from = f.from ? dayIso(f.from) : null;
    const to = f.to ? dayIso(f.to) : null;
    return (Array.isArray(deals) ? deals : [])
      .map(normalizeDeal)
      .filter(Boolean)
      .filter(function (d) {
        if (needle) {
          const hay = d.name.toLowerCase();
          if (exactName ? hay !== needle : hay.indexOf(needle) < 0) return false;
        }
        if (service && d.service.toLowerCase() !== service) return false;
        /* "חד פעמי" / "חזרתי" — a gig and an income answer different questions, and
           he asked to be able to look at one without the other (owner, 2026-09-22). */
        if (nature && d.nature !== nature) return false;
        if (min !== null && d.price < min) return false;
        if (max !== null && d.price > max) return false;
        if (from && d.day < from) return false;
        if (to && d.day > to) return false;
        return true;
      })
      .sort(function (a, b) {
        /* Newest first: the table is a record he scans, not a diary he reads. */
        return byTime(b, a);
      });
  }

  /**
   * The table, ordered the way he asked for it by clicking a column.
   *
   * Each column has a natural first direction — a name reads A→Z, money reads big
   * first, a date reads newest first — and clicking again turns it round. Kept here
   * rather than in the page, so it is a fact a test can check (owner, 2026-09-04).
   *
   * @param {object[]} deals
   * @param {"name"|"service"|"price"|"day"|"invoiced"} key
   * @param {1|-1} dir 1 = the column's natural direction
   */
  function sortDeals(deals, key, dir) {
    const rows = (Array.isArray(deals) ? deals : []).map(normalizeDeal).filter(Boolean);
    const d = Number(dir) === -1 ? -1 : 1;
    const by = String(key || "day");
    const cmp = function (a, b) {
      if (by === "name") return a.name.localeCompare(b.name, "he") * -1;
      if (by === "service") return a.service.localeCompare(b.service, "he");
      if (by === "price") return b.price - a.price;
      if (by === "invoiced") {
        /* Not invoiced first: that is the list he still has work to do about. */
        const av = a.invoiced ? 1 : 0;
        const bv = b.invoiced ? 1 : 0;
        if (av !== bv) return av - bv;
        return byTime(b, a);
      }
      return byTime(b, a);
    };
    return rows.sort(function (a, b) {
      const base = cmp(a, b);
      if (base !== 0) return base * d;
      /* A stable tail, so two identical rows never swap between renders. */
      return String(a.id) < String(b.id) ? -1 : 1;
    });
  }

  /**
   * One line per place — the answer to "what do I invoice each of them for".
   *
   * The detail is one line per session and it is still there behind a button; this is
   * what the table opens on, because the question he brings to it is per place and not
   * per session (owner, 2026-09-04).
   *
   * A place he gave two different services at says MIXED rather than picking one, and
   * a place is only ticked as invoiced when EVERY session in it is — untick one and
   * the place stops being done, which is the truth about an invoice.
   */
  function groupByPlace(deals) {
    const rows = (Array.isArray(deals) ? deals : []).map(normalizeDeal).filter(Boolean);
    const order = [];
    const byName = {};
    rows.forEach(function (d) {
      const k = placeKey(d.name);
      if (!byName[k]) {
        byName[k] = {
          name: d.name,
          count: 0,
          total: 0,
          services: [],
          invoiced: true,
          ids: [],
          lastDay: "",
          natures: [],
        };
        order.push(k);
      }
      const g = byName[k];
      g.count += 1;
      g.total = round2(g.total + d.price);
      if (d.service && g.services.indexOf(d.service) < 0) g.services.push(d.service);
      if (!d.invoiced) g.invoiced = false;
      if (g.natures.indexOf(d.nature) < 0) g.natures.push(d.nature);
      g.ids.push(d.id);
      if (d.day > g.lastDay) g.lastDay = d.day;
    });
    return order.map(function (k) {
      const g = byName[k];
      return {
        name: g.name,
        count: g.count,
        total: g.total,
        /* One service, or "mixed" — never one of them chosen at random. */
        service: g.services.length === 1 ? g.services[0] : "",
        mixed: g.services.length > 1,
        invoiced: g.count > 0 && g.invoiced,
        /* Blank where a name covers both a monthly client and a one-off session:
           better an honest dash than a label that is true of half the lines. */
        nature: g.natures.length === 1 ? g.natures[0] : "",
        ids: g.ids,
        lastDay: g.lastDay,
      };
    });
  }

  /** The grouped table, ordered by whichever column he pressed. */
  function sortGroups(groups, key, dir) {
    const rows = Array.isArray(groups) ? groups.slice() : [];
    const d = Number(dir) === -1 ? -1 : 1;
    const by = String(key || "price");
    return rows.sort(function (a, b) {
      let base;
      if (by === "name") base = a.name.localeCompare(b.name, "he") * -1;
      else if (by === "service") base = String(a.service).localeCompare(String(b.service), "he");
      else if (by === "invoiced") base = (a.invoiced ? 1 : 0) - (b.invoiced ? 1 : 0);
      /* A date column has no meaning for a place, so it falls back to what he is
         really asking: who is the biggest. */
      else base = b.total - a.total;
      if (base !== 0) return base * d;
      return a.name < b.name ? -1 : 1;
    });
  }

  /** The direction a column opens in when it is clicked for the first time. */
  const SORTS = ["name", "service", "nature", "price", "day", "invoiced"];

  function sumOf(deals) {
    return round2(
      (Array.isArray(deals) ? deals : []).reduce(function (s, d) {
        return s + money(d && d.price);
      }, 0)
    );
  }

  /** Which month objects a date range touches — one read per month, never a list. */
  function monthsBetween(from, to) {
    const a = monthKey(from);
    const b = monthKey(to);
    if (!a || !b) return [];
    const out = [];
    let cur = a < b ? a : b;
    const last = a < b ? b : a;
    let guard = 0;
    while (cur <= last && guard < 240) {
      out.push(cur);
      cur = shiftMonth(cur, 1);
      guard += 1;
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RECURRING CLIENTS — the studio that pays every month.

     A deal in the book above is something he did once: he drove to a gym, gave a
     session, was paid for it. A client like Oded Mechina is the other thing entirely —
     he was handed a programme, and from that day he pays every month for as long as
     the subscription is alive. Until now the book had no idea such a person existed,
     so the one number that matters ("what have I not invoiced") was missing him
     (owner, 2026-09-22).

     WHERE IT LIVES. One small object for ALL of them, `coach-ledger/subscriptions.json`.
     Not a row per client in a store that has to be listed — that is the pattern that
     had the Blob store suspended on 2026-09-02. Opening the book reads it once.

     PAST IS WRITTEN, FUTURE IS DRAWN. A month whose billing day has arrived gets a
     real deal written into that month, once, under a fixed id (`sub:<client>:<month>`),
     and from then on it is a row like any other: tick it, edit it, delete it. Months
     ahead are never written — the calendar draws them from this object as he scrolls,
     so he can look a year forward without the book growing by a byte, and a price he
     changes tomorrow does not leave a trail of wrong rows behind it.
     ══════════════════════════════════════════════════════════════════════════ */

  /* A book of subscriptions, not a mailing list. Bounded like everything else here. */
  const MAX_SUBS = 400;
  /* Prefix of the id a materialised occurrence carries for ever. */
  const SUB_PREFIX = "sub:";

  /** What a deal IS: something done once, or this month's turn of a subscription. */
  const NATURE_ONCE = "once";
  const NATURE_RECURRING = "recurring";

  /**
   * A month key, strictly.
   *
   * `monthKey` above falls back to TODAY for anything it does not recognise, which is
   * right for a deal the owner is typing and wrong here: this file asks "which month
   * is 2026-10?" all the time, and being answered "September" silently drew every
   * future bill on the wrong day. So the subscription side has its own, which accepts
   * "2026-10" or a full date and answers "" for anything else (owner, 2026-09-22).
   */
  function asMonth(v) {
    const t = String(v || "");
    if (/^\d{4}-\d{2}$/.test(t)) return t;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 7);
    return "";
  }

  /** How many months from a to b, negative when b is earlier. */
  function monthDistance(a, b) {
    const x = asMonth(a);
    const y = asMonth(b);
    if (!x || !y) return 0;
    return (Number(y.slice(0, 4)) - Number(x.slice(0, 4))) * 12 +
      (Number(y.slice(5, 7)) - Number(x.slice(5, 7)));
  }

  function emptySubscriptions() {
    return { version: 1, updatedAt: "", subs: [] };
  }

  function normalizeSubscriptions(raw) {
    const o = isPlainObject(raw) ? raw : {};
    const seen = {};
    const subs = [];
    (Array.isArray(o.subs) ? o.subs : []).forEach(function (s) {
      const sub = normalizeSubscription(s);
      if (!sub) return;
      /* One subscription per client. A second row for the same client is a bug
         upstream, and silently doubling his income would be the worst way to show it. */
      if (seen[sub.clientId]) return;
      seen[sub.clientId] = true;
      subs.push(sub);
    });
    return {
      version: Number(o.version) > 0 ? Number(o.version) : 1,
      updatedAt: String(o.updatedAt || ""),
      subs: subs.slice(0, MAX_SUBS),
    };
  }

  /**
   * A subscription is a client, a price, and the day of the month it falls on.
   *
   * `startDay` is the day the programme was handed over — the first press of "צור לינק
   * חד פעמי", which is what the owner calls handing the programme to the client. It is
   * never moved by a later press of that button, because the second press is how a
   * second device is attached, not a new sale (owner, 2026-09-22).
   */
  function normalizeSubscription(raw) {
    if (!isPlainObject(raw)) return null;
    const clientId = text(raw.clientId, 60);
    const name = text(raw.name, MAX_NAME);
    if (!clientId || !name) return null;
    const startDay = dayIso(raw.startDay);
    return {
      clientId: clientId,
      name: name,
      service: text(raw.service, MAX_SERVICE),
      price: money(raw.price),
      /* How he is paid. His business, never the client's — it rides along so the
         favourites row can show it without a second read. */
      method: text(raw.method, 120),
      colour: /^#[0-9a-f]{6}$/i.test(String(raw.colour || "")) ? String(raw.colour) : "",
      startDay: startDay,
      /* The day of the month the money is due. Defaults to the handover day, and he
         may move it — see setBillingDay. */
      billingDay: billingDayOf(raw.billingDay, startDay),
      /* Frozen keeps everything it knows and simply stops billing (owner, 2026-09-22). */
      active: raw.active !== false,
      /* A price that is agreed now but starts at the next billing date. Until that
         date the old price is what is charged, and the table shows both. */
      pending: normalizePending(raw.pending),
      /* The last month whose bill has actually been written into the book.
         It is what makes "has this month been billed?" answerable without reading a
         single month object — and it is why a recurring row he deletes on purpose
         stays deleted instead of growing back on the next page load. */
      billedThrough: asMonth(raw.billedThrough),
      updatedAt: String(raw.updatedAt || ""),
    };
  }

  function normalizePending(raw) {
    if (!isPlainObject(raw)) return null;
    const from = dayIso(raw.from);
    const price = money(raw.price);
    if (!from || price <= 0) return null;
    return { price: price, from: from };
  }

  /** 1–31, and never a month's end it cannot reach — see occurrenceDay. */
  function billingDayOf(v, fallbackIso) {
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n >= 1 && n <= 31) return n;
    const iso = dayIso(fallbackIso);
    return iso ? Number(iso.slice(8, 10)) : 1;
  }

  function findSub(store, clientId) {
    const s = normalizeSubscriptions(store);
    const id = text(clientId, 60);
    for (let i = 0; i < s.subs.length; i += 1) {
      if (s.subs[i].clientId === id) return s.subs[i];
    }
    return null;
  }

  function subIndex(store, clientId) {
    const id = text(clientId, 60);
    for (let i = 0; i < store.subs.length; i += 1) {
      if (store.subs[i].clientId === id) return i;
    }
    return -1;
  }

  /**
   * Add or update. The caller passes what it knows; what it leaves out is kept.
   *
   * This is how the client screen speaks to the book: a rename, a new colour, a freeze
   * and a handover all arrive here, and none of them may quietly erase the others.
   */
  function upsertSubscription(store, input, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const s = normalizeSubscriptions(store);
    const patch = isPlainObject(input) ? input : {};
    const id = text(patch.clientId, 60);
    if (!id) return { ok: false, code: "NO_CLIENT", error: "a subscription needs a client" };
    const idx = subIndex(s, id);
    if (idx < 0 && s.subs.length >= MAX_SUBS) {
      return { ok: false, code: "FULL", error: "too many subscriptions" };
    }
    const before = idx >= 0 ? s.subs[idx] : null;
    /* A field the caller did not send is a field it has no opinion about. Object.assign
       would copy the undefined straight over what is stored, so freezing a client — a
       call that sends nothing but `active` — would erase his name, his price and his
       colour on the way through (found by the API test, 2026-09-22). */
    const given = {};
    Object.keys(patch).forEach(function (k) {
      if (patch[k] !== undefined) given[k] = patch[k];
    });
    const merged = normalizeSubscription(Object.assign({}, before || {}, given, {
      clientId: id,
      /* The handover day is written once and then it is history. */
      startDay: (before && before.startDay) || dayIso(patch.startDay),
      updatedAt: new Date(nowMs(o.clock)).toISOString(),
    }));
    if (!merged) return { ok: false, code: "NO_NAME", error: "a subscription needs a name" };
    if (idx >= 0) s.subs[idx] = merged;
    else s.subs.push(merged);
    return { ok: true, store: s, sub: merged };
  }

  /** A client deleted in the module leaves the book too (owner, 2026-09-22). */
  function removeSubscription(store, clientId) {
    const s = normalizeSubscriptions(store);
    const before = s.subs.length;
    const id = text(clientId, 60);
    s.subs = s.subs.filter(function (x) {
      return x.clientId !== id;
    });
    if (s.subs.length === before) return { ok: false, code: "NOT_FOUND", error: "no such subscription" };
    return { ok: true, store: s };
  }

  /**
   * A new price, and WHEN it starts.
   *
   *   "now"  — this month's turn is worth the new price too, even five days in.
   *   "next" — the old price stands until the next billing date, and the table shows
   *            "₪100 (₪200)" until that date arrives.
   *
   * Either way, what was already written into a past month is never touched: rule 1 at
   * the top of this file is not negotiable, or last month's total would move.
   */
  function setSubscriptionPrice(store, clientId, price, mode, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const s = normalizeSubscriptions(store);
    const idx = subIndex(s, clientId);
    if (idx < 0) return { ok: false, code: "NOT_FOUND", error: "no such subscription" };
    const next = money(price);
    if (next <= 0) return { ok: false, code: "NO_PRICE", error: "a subscription needs a price" };
    const sub = s.subs[idx];
    const today = dayIso(o.today, o.clock);
    if (mode === "next") {
      const from = nextBillingDay(sub, today);
      s.subs[idx] = normalizeSubscription(Object.assign({}, sub, {
        pending: { price: next, from: from },
        updatedAt: new Date(nowMs(o.clock)).toISOString(),
      }));
      return { ok: true, store: s, sub: s.subs[idx], from: from };
    }
    s.subs[idx] = normalizeSubscription(Object.assign({}, sub, {
      price: next,
      pending: null,
      updatedAt: new Date(nowMs(o.clock)).toISOString(),
    }));
    return { ok: true, store: s, sub: s.subs[idx], from: today };
  }

  /**
   * Move the day of the month the money falls on.
   *
   * It takes effect from the NEXT billing date onwards — a month already written keeps
   * the day it was written on, because that is when he was actually paid.
   */
  function setBillingDay(store, clientId, day, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const s = normalizeSubscriptions(store);
    const idx = subIndex(s, clientId);
    if (idx < 0) return { ok: false, code: "NOT_FOUND", error: "no such subscription" };
    const n = Math.floor(Number(day));
    if (!Number.isFinite(n) || n < 1 || n > 31) {
      return { ok: false, code: "BAD_DAY", error: "a billing day is 1–31" };
    }
    const sub = s.subs[idx];
    const moved = normalizeSubscription(Object.assign({}, sub, {
      billingDay: n,
      updatedAt: new Date(nowMs(o.clock)).toISOString(),
    }));
    s.subs[idx] = moved;
    return { ok: true, store: s, sub: moved, from: nextBillingDay(moved, dayIso(o.today, o.clock)) };
  }

  /**
   * The day this subscription falls on in a given month.
   *
   * The 31st in a 30-day month is the 30th, and February takes the 28th or 29th: a
   * bill does not skip a month because the calendar is short.
   */
  function occurrenceDay(sub, month) {
    const key = asMonth(month);
    if (!key) return "";
    const days = daysInMonth(key).length;
    const d = Math.min(billingDayOf(sub && sub.billingDay, sub && sub.startDay), days);
    return key + "-" + String(d).padStart(2, "0");
  }

  /** The id a materialised occurrence keeps for ever, so it is written only once. */
  function occurrenceId(sub, month) {
    return SUB_PREFIX + text(sub && sub.clientId, 60) + ":" + asMonth(month);
  }

  function isRecurringId(id) {
    return String(id || "").slice(0, SUB_PREFIX.length) === SUB_PREFIX;
  }

  /** What this subscription is worth on a given day — the pending price, if it has come. */
  function priceAt(sub, iso) {
    const s = normalizeSubscription(sub);
    if (!s) return 0;
    const day = dayIso(iso);
    if (s.pending && day && day >= s.pending.from) return s.pending.price;
    return s.price;
  }

  /** The next date the money is due, strictly after today. */
  function nextBillingDay(sub, today) {
    const day = dayIso(today);
    if (!day) return "";
    const thisMonth = occurrenceDay(sub, asMonth(day));
    if (thisMonth > day) return thisMonth;
    return occurrenceDay(sub, shiftMonth(asMonth(day), 1));
  }

  /** Has this subscription started billing by the given month? */
  function startedBy(sub, month) {
    const s = normalizeSubscription(sub);
    if (!s || !s.startDay) return false;
    return asMonth(s.startDay) <= asMonth(month);
  }

  /**
   * This month's turn of one subscription, in the shape of a deal.
   *
   * The FIRST month is special: the bill falls on the handover day itself, whatever the
   * billing day says, because that is the day he started paying (owner, 2026-09-22).
   */
  function occurrenceOf(sub, month, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const s = normalizeSubscription(sub);
    const key = asMonth(month);
    if (!s || !key || !startedBy(s, key)) return null;
    const first = asMonth(s.startDay) === key;
    const day = first ? s.startDay : occurrenceDay(s, key);
    const deal = normalizeDeal({
      id: occurrenceId(s, key),
      day: day,
      name: s.name,
      service: s.service,
      price: priceAt(s, day),
      invoiced: false,
      nature: NATURE_RECURRING,
      clientId: s.clientId,
    });
    /* A projection is not a record, and it must not look like one in storage: the flag
       is added here rather than in the deal shape, so nothing ever writes it down.
       The colour is NOT frozen onto the row either — it is looked up from the
       subscription every time it is drawn, which is what makes changing a client's
       colour change it everywhere at once (owner, 2026-09-22). */
    if (deal && o.projected === true) deal.projected = true;
    return deal;
  }

  /**
   * Every turn that falls in one month, for the calendar and the table.
   *
   * `have` is the ids already written into that month — those are skipped, because the
   * written row is the truth and the projection is only a promise. A frozen
   * subscription projects nothing; what it already earned stays where it was written.
   */
  function occurrencesIn(store, month, have, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const s = normalizeSubscriptions(store);
    const key = asMonth(month);
    const taken = {};
    (Array.isArray(have) ? have : []).forEach(function (id) {
      taken[String(id)] = true;
    });
    const out = [];
    s.subs.forEach(function (sub) {
      if (!sub.active) return;
      if (taken[occurrenceId(sub, key)]) return;
      const deal = occurrenceOf(sub, key, { projected: o.projected !== false });
      if (deal) out.push(deal);
    });
    return out;
  }

  /**
   * The turns whose day has already come and are not yet in the book.
   *
   * These are the ones that get written for real, once. Bounded by `backMonths` so a
   * subscription opened two years ago cannot ask for a hundred writes in one go — and
   * so nothing here ever walks the whole store.
   */
  function dueOccurrences(store, today, known, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const day = dayIso(today, o.clock);
    if (!day) return [];
    const back = Number(o.backMonths) > 0 ? Math.floor(Number(o.backMonths)) : 12;
    const s = normalizeSubscriptions(store);
    const taken = {};
    (Array.isArray(known) ? known : []).forEach(function (id) {
      taken[String(id)] = true;
    });
    const out = [];
    s.subs.forEach(function (sub) {
      if (!sub.active || !sub.startDay) return;
      /* Never look back past what has already been written: the marker is the whole
         reason this costs no reads, and the reason a row he deleted on purpose does
         not grow back. */
      const first = sub.billedThrough
        ? maxMonth(asMonth(sub.startDay), shiftMonth(sub.billedThrough, 1))
        : asMonth(sub.startDay);
      const last = asMonth(day);
      let cur = first;
      let guard = 0;
      /* Walk forward from the handover, never further back than the window. */
      if (monthDistance(first, last) + 1 > back) cur = shiftMonth(last, -(back - 1));
      while (cur <= last && guard < back + 1) {
        const deal = occurrenceOf(sub, cur, { projected: false });
        if (deal && deal.day <= day && !taken[deal.id]) out.push({ month: cur, deal: deal });
        cur = shiftMonth(cur, 1);
        guard += 1;
      }
    });
    return out;
  }

  function maxMonth(a, b) {
    return asMonth(a) > asMonth(b) ? asMonth(a) : asMonth(b);
  }

  /**
   * Write a month's bill into the book — once, and never twice.
   *
   * The id is the guard: it is built from the client and the month, so a second
   * attempt finds the row already there and changes nothing. This is what stands
   * between the owner and a studio billed twice for September because a page was
   * opened in two tabs.
   */
  function plantOccurrence(monthDoc, deal, opts) {
    const o = isPlainObject(opts) ? opts : {};
    const doc = normalizeMonth(monthDoc, asMonth(deal && deal.day));
    const row = normalizeDeal(deal);
    if (!row || !row.id) return { ok: false, code: "BAD_DEAL", error: "not a bill", doc: doc };
    if (asMonth(row.day) !== doc.month) {
      return { ok: false, code: "WRONG_MONTH", error: "that day is not in this month", doc: doc };
    }
    for (let i = 0; i < doc.deals.length; i += 1) {
      if (doc.deals[i].id === row.id) return { ok: false, code: "ALREADY", doc: doc, deal: doc.deals[i] };
    }
    if (doc.deals.length >= MAX_DEALS_PER_MONTH) {
      return { ok: false, code: "MONTH_FULL", error: "too many deals in one month", doc: doc };
    }
    row.createdAt = new Date(nowMs(o.clock)).toISOString();
    doc.deals.push(row);
    return { ok: true, doc: doc, deal: row };
  }

  return {
    MAX_NAME: MAX_NAME,
    MAX_SERVICE: MAX_SERVICE,
    MAX_PRICE: MAX_PRICE,
    FAVOURITES: FAVOURITES,
    MAX_DEALS_PER_MONTH: MAX_DEALS_PER_MONTH,
    money: money,
    dayIso: dayIso,
    monthKey: monthKey,
    daysInMonth: daysInMonth,
    weekdayOf: weekdayOf,
    shiftMonth: shiftMonth,
    emptyMonth: emptyMonth,
    normalizeMonth: normalizeMonth,
    normalizeDeal: normalizeDeal,
    addDeal: addDeal,
    updateDeal: updateDeal,
    removeDeal: removeDeal,
    monthTotal: monthTotal,
    uninvoicedTotal: uninvoicedTotal,
    totalsByDay: totalsByDay,
    dealsOfDay: dealsOfDay,
    emptyWarehouse: emptyWarehouse,
    normalizeWarehouse: normalizeWarehouse,
    rememberPlace: rememberPlace,
    favourites: favourites,
    placeDefaults: placeDefaults,
    placesByUse: placesByUse,
    colourMap: colourMap,
    placeColour: placeColour,
    setPlaceColour: setPlaceColour,
    renamePlace: renamePlace,
    forgetPlace: forgetPlace,
    renameInMonth: renameInMonth,
    weekRange: weekRange,
    monthRange: monthRange,
    yearRange: yearRange,
    filterDeals: filterDeals,
    sortDeals: sortDeals,
    groupByPlace: groupByPlace,
    sortGroups: sortGroups,
    SORTS: SORTS,
    sumOf: sumOf,
    monthsBetween: monthsBetween,
    MAX_SUBS: MAX_SUBS,
    NATURE_ONCE: NATURE_ONCE,
    NATURE_RECURRING: NATURE_RECURRING,
    emptySubscriptions: emptySubscriptions,
    normalizeSubscriptions: normalizeSubscriptions,
    normalizeSubscription: normalizeSubscription,
    upsertSubscription: upsertSubscription,
    removeSubscription: removeSubscription,
    setSubscriptionPrice: setSubscriptionPrice,
    setBillingDay: setBillingDay,
    findSub: findSub,
    occurrenceDay: occurrenceDay,
    occurrenceId: occurrenceId,
    isRecurringId: isRecurringId,
    priceAt: priceAt,
    nextBillingDay: nextBillingDay,
    occurrenceOf: occurrenceOf,
    occurrencesIn: occurrencesIn,
    dueOccurrences: dueOccurrences,
    plantOccurrence: plantOccurrence,
  };
});
