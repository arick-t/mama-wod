/**
 * Layer-3 (File Search) sync allow/deny rules.
 * L1 / L2 programming foundation & ops must NEVER enter File Search via Sync.
 */

const L1_L2_NAME_RE = [
  /(^|\/)l1-l2-programming-foundation(\.md)?$/i,
  /(^|\/)layer2-programming-ops(\.md)?$/i,
  /(^|\/)l1-l2[-_]/i,
  /(^|\/)layer2-programming/i,
  /(^|\/)coach-foundation-brief/i,
];

function normalizeRel(rel) {
  return String(rel || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

/** @returns {boolean} true = do not upload to File Search */
function isExcludedFromL3Sync(relPath) {
  const rel = normalizeRel(relPath);
  if (!rel) return true;
  const base = rel.split("/").pop() || "";
  if (base === "README.md") return true;
  if (base.startsWith(".")) return true;
  for (let i = 0; i < L1_L2_NAME_RE.length; i++) {
    if (L1_L2_NAME_RE[i].test(rel) || L1_L2_NAME_RE[i].test(base)) return true;
  }
  return false;
}

module.exports = {
  isExcludedFromL3Sync,
  L1_L2_NAME_RE,
};
