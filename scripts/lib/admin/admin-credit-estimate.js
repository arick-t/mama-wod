/**
 * Admin Gemini credit estimate (v1) — 0 ₪ AI, no Google Prepay API.
 * Manual balance + burn from real usageMetadata × internal price table × safety factor.
 * Durable store: private Blob (duck-wod-admin) via admin-json-store; FS fallback locally.
 */
const fs = require("fs");
const { putJson, getJson, useBlob, hasBlobAuth } = require("./admin-json-store");
const { adminMetaPath } = require("./admin-paths");

const BLOB_KEY = "admin-meta/credit-estimate.json";
const BILLING_URL = "https://aistudio.google.com/billing";
const PRICE_TABLE_VERSION = 1;
const SAFETY_FACTOR = Number(process.env.ADMIN_CREDIT_SAFETY_FACTOR || 1.2);
const USD_ILS = Number(process.env.ADMIN_USD_ILS_RATE || 3.7);
const FLUSH_MIN_ILS = 0.05;
const FLUSH_MIN_MS = 45_000;

/** Approx Gemini list prices USD / 1M tokens (calibrate later from Google Usage). */
const MODEL_PRICES = {
  "gemini-2.5-flash-lite": { inPerM: 0.1, outPerM: 0.4 },
  "gemini-2.0-flash-lite": { inPerM: 0.1, outPerM: 0.4 },
  "gemini-2.5-flash": { inPerM: 0.15, outPerM: 0.6 },
  "gemini-2.0-flash": { inPerM: 0.15, outPerM: 0.6 },
  "gemini-3.6-flash": { inPerM: 0.15, outPerM: 0.6 },
  "gemini-3-flash": { inPerM: 0.15, outPerM: 0.6 },
};

const DEFAULT_PRICE = { inPerM: 0.15, outPerM: 0.6 };

let memPendingIls = 0;
let memLastFlushAt = 0;
let memFlushInFlight = null;

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Keep sub-agorot precision while accumulating many small chat turns. */
function roundMicros(n) {
  return Math.round((Number(n) || 0) * 1e6) / 1e6;
}

function emptyLedger() {
  const envCredit = String(process.env.ADMIN_CREDIT_BALANCE_ILS || "").trim();
  const manual =
    envCredit === "" || !Number.isFinite(Number(envCredit)) ? null : Number(envCredit);
  return {
    balanceManual: manual,
    balanceUpdatedAt: null,
    spentSinceUpdateEstimated: 0,
    priceTableVersion: PRICE_TABLE_VERSION,
    safetyFactor: SAFETY_FACTOR,
    usdIls: USD_ILS,
    lastFlushAt: null,
    creditNote: "",
  };
}

function priceForModel(model) {
  const key = String(model || "")
    .toLowerCase()
    .trim();
  if (!key) return DEFAULT_PRICE;
  if (MODEL_PRICES[key]) return MODEL_PRICES[key];
  if (key.indexOf("flash-lite") >= 0 || key.indexOf("flash_lite") >= 0) {
    return MODEL_PRICES["gemini-2.5-flash-lite"];
  }
  if (key.indexOf("flash") >= 0) return MODEL_PRICES["gemini-2.5-flash"];
  return DEFAULT_PRICE;
}

function estimateIlsFromUsage(model, usage) {
  if (!usage || typeof usage !== "object") return 0;
  const prompt = Number(usage.promptTokens || usage.promptTokenCount || 0) || 0;
  const output = Number(usage.outputTokens || usage.candidatesTokenCount || 0) || 0;
  if (prompt <= 0 && output <= 0) return 0;
  const p = priceForModel(model);
  const usd = (prompt / 1e6) * p.inPerM + (output / 1e6) * p.outPerM;
  const factor = Number.isFinite(SAFETY_FACTOR) && SAFETY_FACTOR > 0 ? SAFETY_FACTOR : 1.2;
  const rate = Number.isFinite(USD_ILS) && USD_ILS > 0 ? USD_ILS : 3.7;
  /* Do NOT round to agorot here — small chat turns would become 0 and never burn. */
  return roundMicros(usd * rate * factor);
}

function isNonGeminiBillable(model, via) {
  const v = String(via || "").toLowerCase();
  const m = String(model || "").toLowerCase();
  if (/local-guard|rate-limit|cost-cap|static/.test(v)) return true;
  if (/^groq/.test(v) || v.indexOf("groq") >= 0) return true;
  if (/llama|groq|mixtral|gpt-/.test(m)) return true;
  return false;
}

async function readRawLedger() {
  if (hasBlobAuth() && useBlob()) {
    try {
      const j = await getJson(BLOB_KEY);
      if (j && typeof j === "object") {
        if (j.balanceManual == null && j.creditIls != null) {
          return Object.assign(emptyLedger(), {
            balanceManual: Number(j.creditIls),
            balanceUpdatedAt: j.creditUpdatedAt || null,
            creditNote: j.creditNote || "",
            spentSinceUpdateEstimated: Number(j.spentSinceUpdateEstimated || 0) || 0,
          });
        }
        return Object.assign(emptyLedger(), j);
      }
    } catch (e) {}
  }
  try {
    const p = adminMetaPath();
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j && typeof j === "object") {
        if (j.balanceManual == null && j.creditIls != null) {
          return Object.assign(emptyLedger(), {
            balanceManual: Number(j.creditIls),
            balanceUpdatedAt: j.creditUpdatedAt || null,
            creditNote: j.creditNote || "",
            spentSinceUpdateEstimated: Number(j.spentSinceUpdateEstimated || 0) || 0,
          });
        }
        if (j.balanceManual != null || j.spentSinceUpdateEstimated != null) {
          return Object.assign(emptyLedger(), j);
        }
      }
    }
  } catch (e) {}
  return emptyLedger();
}

async function writeRawLedger(ledger) {
  const out = Object.assign(emptyLedger(), ledger, {
    spentSinceUpdateEstimated: roundMicros(ledger.spentSinceUpdateEstimated || 0),
    lastFlushAt: new Date().toISOString(),
    priceTableVersion: PRICE_TABLE_VERSION,
    safetyFactor: SAFETY_FACTOR,
    usdIls: USD_ILS,
  });
  let blobOk = false;
  if (hasBlobAuth() && useBlob()) {
    try {
      await putJson(BLOB_KEY, out);
      blobOk = true;
    } catch (e) {
      blobOk = false;
    }
  }
  if (!blobOk) {
    try {
      const p = adminMetaPath();
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(out, null, 2), "utf8");
    } catch (e) {
      if (hasBlobAuth() && useBlob()) throw e;
    }
  }
  return out;
}

async function loadLedger() {
  const raw = await readRawLedger();
  raw.spentSinceUpdateEstimated = roundMicros(
    (Number(raw.spentSinceUpdateEstimated) || 0) + memPendingIls
  );
  return raw;
}

function publicCreditView(ledger) {
  const manual =
    ledger.balanceManual == null || !Number.isFinite(Number(ledger.balanceManual))
      ? null
      : roundMoney(ledger.balanceManual);
  const spent = roundMoney(ledger.spentSinceUpdateEstimated || 0);
  const remaining = manual == null ? null : roundMoney(Math.max(0, manual - spent));
  const low =
    remaining != null && remaining < Number(process.env.ADMIN_CREDIT_WARN_ILS || 30);
  const critical =
    remaining != null && remaining < Number(process.env.ADMIN_CREDIT_CRITICAL_ILS || 15);
  return {
    ok: true,
    estimated: true,
    labelHe: "משוער",
    labelEn: "Estimated",
    balanceManual: manual,
    balanceUpdatedAt: ledger.balanceUpdatedAt || null,
    spentSinceUpdateEstimated: spent,
    remainingEstimated: remaining,
    currency: "ILS",
    display: remaining == null ? "—" : "₪" + remaining.toFixed(2),
    billingUrl: BILLING_URL,
    creditNote: ledger.creditNote || "",
    priceTableVersion: ledger.priceTableVersion || PRICE_TABLE_VERSION,
    safetyFactor: ledger.safetyFactor || SAFETY_FACTOR,
    warnLow: !!low,
    warnCritical: !!critical,
    disclaimerHe:
      "יתרת קרדיט משוערת — לא משיכה חיה ממסך Google AI Studio Billing. עדכן ידנית אחרי בדיקה בגוגל.",
    creditIls: remaining,
    creditUpdatedAt: ledger.balanceUpdatedAt || null,
  };
}

async function getCreditEstimate() {
  const ledger = await loadLedger();
  return publicCreditView(ledger);
}

async function setManualBalance(amountIls, note) {
  const n = Number(String(amountIls).replace(/,/g, "").replace(/₪/g, "").trim());
  if (!Number.isFinite(n) || n < 0 || n > 1e9) {
    const err = new Error("invalid_credit");
    err.code = "invalid_credit";
    throw err;
  }
  memPendingIls = 0;
  const ledger = await readRawLedger();
  ledger.balanceManual = roundMoney(n);
  ledger.balanceUpdatedAt = new Date().toISOString();
  ledger.spentSinceUpdateEstimated = 0;
  if (typeof note === "string") ledger.creditNote = note.slice(0, 200);
  await writeRawLedger(ledger);
  memLastFlushAt = Date.now();
  return publicCreditView(ledger);
}

async function flushPendingSpend(force) {
  if (memPendingIls <= 0) return null;
  const now = Date.now();
  if (
    !force &&
    memPendingIls < FLUSH_MIN_ILS &&
    now - memLastFlushAt < FLUSH_MIN_MS
  ) {
    return null;
  }
  if (memFlushInFlight) return memFlushInFlight;
  memFlushInFlight = (async function () {
    const add = memPendingIls;
    memPendingIls = 0;
    try {
      const base = await readRawLedger();
      base.spentSinceUpdateEstimated = roundMicros(
        (Number(base.spentSinceUpdateEstimated) || 0) + add
      );
      await writeRawLedger(base);
      memLastFlushAt = Date.now();
      return base;
    } catch (e) {
      memPendingIls = roundMicros(memPendingIls + add);
      return null;
    } finally {
      memFlushInFlight = null;
    }
  })();
  return memFlushInFlight;
}

function recordCoachUsageSpend(model, usage, via) {
  try {
    if (!usage) return;
    if (isNonGeminiBillable(model, via)) return;
    const ils = estimateIlsFromUsage(model, usage);
    if (!(ils > 0)) return;
    memPendingIls = roundMicros(memPendingIls + ils);
    flushPendingSpend(false).catch(function () {});
  } catch (e) {}
}

module.exports = {
  estimateIlsFromUsage,
  getCreditEstimate,
  setManualBalance,
  recordCoachUsageSpend,
  flushPendingSpend,
  publicCreditView,
  isNonGeminiBillable,
  BILLING_URL,
  PRICE_TABLE_VERSION,
  BLOB_KEY,
  priceForModel,
};
