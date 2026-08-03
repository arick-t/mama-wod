/**
 * סנכרון מוח המאמן (ידני בלבד — אין cron)
 *
 * מעלה קבצים חדשים/מעודכנים מתיקיית ידע מקומית אל Gemini File Search Store.
 * התיקייה יכולה להיות:
 *   - experiments/personal-coach/knowledge-inbox  (ברירת מחדל)
 *   - או נתיב Google Drive Desktop לתיקיית המקורות (COACH_KNOWLEDGE_DIR ב־.env.local)
 *
 * שימוש:
 *   npm run coach:sync-brain
 *
 * דורש: GEMINI_API_KEY + GEMINI_FILE_SEARCH_STORE ב־.env.local
 *
 * גם זמין מדשבורד האדמין: כפתור «סנכרן» ב־/admin.html (דף ניהול)
 */
const fs = require("fs");
const path = require("path");
const { runCoachBrainSync } = require("./lib/coach-brain-sync");

const ROOT = path.join(__dirname, "..");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split(/\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

async function main() {
  loadEnv();
  console.log("");
  console.log("  Coach brain sync (manual push)");
  const result = await runCoachBrainSync({
    log: function (line) {
      console.log("  " + line);
    },
  });
  console.log("  Knowledge dir:", result.knowledgeDir);
  console.log("  Store:", result.store || "(missing)");
  console.log("");
  if (!result.ok && (result.code === "missing_key" || result.code === "missing_store" || result.code === "no_knowledge_dir")) {
    console.error(result.message);
    process.exit(1);
  }
  console.log("  Done. uploaded=" + result.uploaded + " skipped=" + result.skipped + " failed=" + result.failed);
  if (result.message) console.log("  " + result.message);
  console.log("  Restart npm run dev:local if it was already running, then chat in Personal Coach.");
  console.log("");
  process.exit(result.failed ? 1 : 0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runCoachBrainSync };
