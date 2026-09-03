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
    return {
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
    };
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
    const min = f.minPrice === undefined || f.minPrice === "" ? null : money(f.minPrice);
    const max = f.maxPrice === undefined || f.maxPrice === "" ? null : money(f.maxPrice);
    const from = f.from ? dayIso(f.from) : null;
    const to = f.to ? dayIso(f.to) : null;
    return (Array.isArray(deals) ? deals : [])
      .map(normalizeDeal)
      .filter(Boolean)
      .filter(function (d) {
        if (needle && d.name.toLowerCase().indexOf(needle) < 0) return false;
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
    renameInMonth: renameInMonth,
    weekRange: weekRange,
    monthRange: monthRange,
    yearRange: yearRange,
    filterDeals: filterDeals,
    sumOf: sumOf,
    monthsBetween: monthsBetween,
  };
});
