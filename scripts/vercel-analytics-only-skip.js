/**
 * Vercel "Ignored Build Step" / vercel.json ignoreCommand:
 * exit 0 = skip deployment (do not build)
 * exit 1 = proceed with build
 *
 * Skips when the only files changed vs HEAD~1 are data/analytics.jsonl (analytics commits from api/event).
 * Stops burning the Hobby ~100 deployments/day limit on per-event Git commits.
 *
 * Merge commits must NEVER skip: `git diff HEAD~1 HEAD` on a merge is vs first parent only,
 * so a real Admin/Coach ship that merged analytics-only main looks like analytics.jsonl
 * and would cancel Production (Admin 3.0.1 was skipped this way).
 */
const { execSync } = require("child_process");

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function parseNameOnlyDiff(diff) {
  if (diff == null || diff === "") return [];
  return String(diff)
    .split(/\r?\n/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

/** `git rev-list --parents -n 1 HEAD` → sha parent1 [parent2 ...] */
function isMergeRevListLine(line) {
  var parts = String(line || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length > 2;
}

function shouldSkipAnalyticsOnlyBuild(files, isMerge) {
  if (isMerge) return false;
  if (!files || files.length === 0) return false;
  return files.every(function (f) {
    return f === "data/analytics.jsonl";
  });
}

function main() {
  const hasParent = sh("git rev-parse --verify HEAD~1");
  if (!hasParent) {
    process.exit(1);
    return;
  }

  const merge = isMergeRevListLine(sh("git rev-list --parents -n 1 HEAD") || "");
  const files = parseNameOnlyDiff(sh("git diff --name-only HEAD~1 HEAD"));
  if (shouldSkipAnalyticsOnlyBuild(files, merge)) {
    console.log("vercel-analytics-only-skip: skipping build (only data/analytics.jsonl changed)");
    process.exit(0);
    return;
  }

  process.exit(1);
}

module.exports = {
  parseNameOnlyDiff,
  isMergeRevListLine,
  shouldSkipAnalyticsOnlyBuild,
};

if (require.main === module) {
  main();
}
