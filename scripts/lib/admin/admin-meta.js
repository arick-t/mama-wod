/**
 * Admin meta (founder management page)
 * POST /api/admin-meta
 *   action: get | set_credit
 *
 * Stores credit balance locally (Google has no public API for prepaid credit ₪).
 * File: data/admin-meta.json
 */

const fs = require("fs");
const path = require("path");
const { checkRateLimit, sendRateLimit } = require("../../../api/rate-limit");
const { readLastSync, knowledgeDir, resolveStoreName } = require("../coach-brain-sync");

const META_PATH = path.join(process.cwd(), "data", "admin-meta.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const DRIVE_FOLDER_URL =
  process.env.COACH_DRIVE_FOLDER_URL ||
  "https://drive.google.com/drive/u/0/folders/1WLMbabNpXZ80qJPwgrxAY2I77CdTboAo";
const BILLING_URL = "https://aistudio.google.com/billing";

function checkAdminAuth(req) {
  if (!ADMIN_PASSWORD) return false;
  const headers = req.headers || {};
  const q = req.query || {};
  const body = req.body || {};
  const auth =
    headers["x-admin-password"] ||
    headers["x-admin-token"] ||
    q.adminPassword ||
    q.pw ||
    body.adminPassword ||
    body.password ||
    "";
  return String(auth) === ADMIN_PASSWORD;
}

function readMeta() {
  try {
    if (fs.existsSync(META_PATH)) {
      const j = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
      if (j && typeof j === "object") return j;
    }
  } catch (e) {}
  const envCredit = String(process.env.ADMIN_CREDIT_BALANCE_ILS || "").trim();
  return {
    creditIls: envCredit === "" ? null : Number(envCredit),
    creditUpdatedAt: null,
    creditNote: "",
  };
}

function writeMeta(meta) {
  fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

function publicMeta() {
  const meta = readMeta();
  const credit =
    meta.creditIls == null || !Number.isFinite(Number(meta.creditIls))
      ? null
      : Number(meta.creditIls);
  return {
    ok: true,
    creditIls: credit,
    creditUpdatedAt: meta.creditUpdatedAt || null,
    creditNote: meta.creditNote || "",
    billingUrl: BILLING_URL,
    driveFolderUrl: DRIVE_FOLDER_URL,
    knowledgeDir: knowledgeDir(),
    storeConfigured: !!resolveStoreName(),
    lastSync: readLastSync(),
    creditApiNote:
      "לגוגל אין API רשמי ליתרת קרדיט — מעדכנים ידנית אחרי בדיקה ב־AI Studio Billing.",
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Password, X-Admin-Token"
  );
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rl = checkRateLimit(req, { name: "admin-meta", limit: 40, windowMs: 60_000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  if (!checkAdminAuth(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const body = req.body || {};
  const action = String(body.action || req.query?.action || "get").trim();

  if (action === "get") {
    return res.status(200).json(publicMeta());
  }

  if (action === "set_credit") {
    const raw = body.creditIls != null ? body.creditIls : body.amount;
    const n = Number(String(raw).replace(/,/g, "").replace(/₪/g, "").trim());
    if (!Number.isFinite(n) || n < 0 || n > 1e9) {
      return res.status(400).json({ ok: false, error: "invalid_credit" });
    }
    const meta = readMeta();
    meta.creditIls = Math.round(n * 100) / 100;
    meta.creditUpdatedAt = new Date().toISOString();
    if (typeof body.note === "string") meta.creditNote = body.note.slice(0, 200);
    try {
      writeMeta(meta);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "write_failed",
        message: "לא ניתן לשמור יתרה בסביבה הזו (דיסק לקריאה בלבד?). נסה מקומית.",
      });
    }
    return res.status(200).json(publicMeta());
  }

  return res.status(400).json({ ok: false, error: "unknown_action" });
};
