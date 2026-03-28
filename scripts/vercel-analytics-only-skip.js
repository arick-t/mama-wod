/**
 * Vercel "Ignored Build Step" / vercel.json ignoreCommand:
 * exit 0 = skip deployment (do not build)
 * exit 1 = proceed with build
 *
 * Skips when the only files changed vs HEAD~1 are data/analytics.jsonl (analytics commits from api/event).
 * Stops burning the Hobby ~100 deployments/day limit on per-event Git commits.
 */
const { execSync } = require("child_process");

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function main() {
  const hasParent = sh("git rev-parse --verify HEAD~1");
  if (!hasParent) {
    process.exit(1);
    return;
  }

  const diff = sh("git diff --name-only HEAD~1 HEAD");
  if (diff == null || diff === "") {
    process.exit(1);
    return;
  }

  const files = diff.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (files.length === 0) {
    process.exit(1);
    return;
  }

  const onlyAnalytics = files.every((f) => f === "data/analytics.jsonl");
  if (onlyAnalytics) {
    console.log("vercel-analytics-only-skip: skipping build (only data/analytics.jsonl changed)");
    process.exit(0);
    return;
  }

  process.exit(1);
}

main();
