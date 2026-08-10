/**
 * Admin meta + Gemini credit estimate (founder only)
 * POST /api/admin-meta
 *   action: get | set_credit | get_credit
 *
 * Credit = internal estimate (manual Google balance − burn from real usage).
 * Not a live Google Prepay API.
 */

const { checkRateLimit, sendRateLimit } = require("../../../lib/rate-limit");
const { readLastSync, knowledgeDir, resolveStoreName } = require("../coach-brain-sync");
const {
  resolveAdminPassword,
  checkAdminAuth: sharedCheckAdminAuth,
  adminAuthDenied,
} = require("./admin-auth");
const { applyCors } = require("../../../lib/cors-allowlist");
const {
  getCreditEstimate,
  setManualBalance,
  flushPendingSpend,
  BILLING_URL,
} = require("./admin-credit-estimate");

const ADMIN_PASSWORD = resolveAdminPassword();
const DRIVE_FOLDER_URL =
  process.env.COACH_DRIVE_FOLDER_URL ||
  "https://drive.google.com/drive/u/0/folders/1WLMbabNpXZ80qJPwgrxAY2I77CdTboAo";

function checkAdminAuth(req) {
  return sharedCheckAdminAuth(req, ADMIN_PASSWORD);
}

async function publicMeta() {
  await flushPendingSpend(true).catch(function () {});
  const credit = await getCreditEstimate();
  return {
    ok: true,
    billingUrl: BILLING_URL,
    driveFolderUrl: DRIVE_FOLDER_URL,
    knowledgeDir: knowledgeDir(),
    storeConfigured: !!resolveStoreName(),
    lastSync: await readLastSync(),
    credit: credit,
    creditIls: credit.remainingEstimated,
    creditUpdatedAt: credit.balanceUpdatedAt,
    creditNote: credit.creditNote || "",
    creditApiNote: credit.disclaimerHe,
  };
}

module.exports = async function handler(req, res) {
  applyCors(req, res, {
    methods: "GET,POST,OPTIONS",
    headers: "Content-Type, X-Admin-Password, X-Admin-Token",
  });
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rl = checkRateLimit(req, { name: "admin-meta", limit: 40, windowMs: 60_000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  if (!checkAdminAuth(req)) return adminAuthDenied(res);

  const body = req.body || {};
  const action = String(body.action || (req.query && req.query.action) || "get").trim();

  if (action === "get" || action === "get_credit") {
    return res.status(200).json(await publicMeta());
  }

  if (action === "set_credit") {
    const raw = body.creditIls != null ? body.creditIls : body.amount != null ? body.amount : body.balanceManual;
    try {
      const credit = await setManualBalance(raw, body.note);
      return res.status(200).json(Object.assign(await publicMeta(), { credit: credit }));
    } catch (e) {
      if (e && e.code === "invalid_credit") {
        return res.status(400).json({ ok: false, error: "invalid_credit", message: "סכום לא תקין" });
      }
      return res.status(500).json({
        ok: false,
        error: "write_failed",
        message: "לא ניתן לשמור יתרה. בדקו Blob / הרשאות.",
      });
    }
  }

  return res.status(400).json({ ok: false, error: "unknown_action" });
};
