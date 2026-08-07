/**
 * Unified Admin API entry (single Vercel serverless function).
 * Preserves public paths via vercel.json rewrites:
 *   /api/admin-snapshot | admin-handoff | admin-coach-sandbox | admin-meta | admin-drive-sync
 */
function resolveHandlerName(req) {
  const q = req.query || {};
  if (q.h) return String(q.h);
  const url = String(req.url || "");
  if (url.indexOf("admin-drive-sync") >= 0 || url.indexOf("h=drive-sync") >= 0) return "drive-sync";
  if (url.indexOf("admin-coach-sandbox") >= 0 || url.indexOf("h=sandbox") >= 0) return "sandbox";
  if (url.indexOf("admin-handoff") >= 0 || url.indexOf("h=handoff") >= 0) return "handoff";
  if (url.indexOf("admin-meta") >= 0 || url.indexOf("h=meta") >= 0) return "meta";
  if (url.indexOf("admin-snapshot") >= 0 || url.indexOf("h=snapshot") >= 0) return "snapshot";
  return "snapshot";
}

module.exports = async function handler(req, res) {
  const name = resolveHandlerName(req);
  let mod;
  if (name === "handoff") mod = require("../scripts/lib/admin/admin-handoff.js");
  else if (name === "sandbox") mod = require("../scripts/lib/admin/admin-coach-sandbox.js");
  else if (name === "meta") mod = require("../scripts/lib/admin/admin-meta.js");
  else if (name === "drive-sync") mod = require("../scripts/lib/admin/admin-drive-sync.js");
  else mod = require("../scripts/lib/admin/admin-snapshot.js");
  return mod(req, res);
};

/* Re-export for personal-coach optional directives lookup */
module.exports.getCoachDirectives = async function (athleteId) {
  try {
    return await require("../scripts/lib/admin/admin-snapshot.js").getCoachDirectives(athleteId);
  } catch (e) {
    return "";
  }
};
