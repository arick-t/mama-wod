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
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const DEFAULT_INBOX = path.join(ROOT, "experiments", "personal-coach", "knowledge-inbox");
const MANIFEST_PATH = path.join(ROOT, "experiments", "personal-coach", ".sync-manifest.json");

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

function resolveKey() {
  for (const n of ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_API_KEY"]) {
    const v = String(process.env[n] || "").trim();
    if (v) return v;
  }
  return "";
}

function resolveStoreName() {
  let s = String(process.env.GEMINI_FILE_SEARCH_STORE || "").trim();
  if (!s) return "";
  if (s.indexOf("fileSearchStores/") !== 0) s = "fileSearchStores/" + s;
  return s;
}

function storeIdOnly(fullName) {
  return String(fullName || "").replace(/^fileSearchStores\//, "");
}

function knowledgeDir() {
  const custom = String(process.env.COACH_KNOWLEDGE_DIR || "").trim();
  if (custom) return path.resolve(custom);
  return DEFAULT_INBOX;
}

function loadManifest() {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return { files: {} };
    const j = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    return j && typeof j === "object" ? j : { files: {} };
  } catch (e) {
    return { files: {} };
  }
}

function saveManifest(m) {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2), "utf8");
}

function fileFingerprint(abs) {
  const st = fs.statSync(abs);
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(abs));
  return {
    size: st.size,
    mtimeMs: st.mtimeMs,
    sha256: hash.digest("hex"),
  };
}

const MIME = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".htm": "text/html",
  ".csv": "text/csv",
  ".json": "application/json",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function walkFiles(dir, base, out) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    if (ent.name === "README.md" && path.resolve(dir) === path.resolve(DEFAULT_INBOX)) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(abs, base, out);
    else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (!MIME[ext]) continue;
      out.push({
        abs,
        rel: path.relative(base, abs).split(path.sep).join("/"),
        mime: MIME[ext],
        displayName: ent.name,
      });
    }
  }
  return out;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitOperation(key, opName) {
  let name = opName;
  for (let i = 0; i < 60; i++) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/" +
      name +
      "?key=" +
      encodeURIComponent(key);
    const r = await fetch(url);
    const j = await r.json();
    if (j.done) return j;
    if (j.name) name = j.name;
    await sleep(2000);
  }
  throw new Error("operation_timeout:" + opName);
}

async function uploadToStore(key, storeFullName, file) {
  const id = storeIdOnly(storeFullName);
  const bytes = fs.readFileSync(file.abs);
  const numBytes = bytes.length;
  const startUrl =
    "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/" +
    encodeURIComponent(id) +
    ":uploadToFileSearchStore?key=" +
    encodeURIComponent(key);

  const start = await fetch(startUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(numBytes),
      "X-Goog-Upload-Header-Content-Type": file.mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName: file.displayName }),
  });

  const uploadUrl = start.headers.get("x-goog-upload-url") || start.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    const t = await start.text();
    throw new Error("no_upload_url:" + start.status + ":" + t.slice(0, 300));
  }

  const finish = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(numBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  const raw = await finish.text();
  let j;
  try {
    j = JSON.parse(raw);
  } catch (e) {
    throw new Error("upload_not_json:" + raw.slice(0, 300));
  }
  if (!finish.ok) {
    throw new Error("upload_failed:" + (j.error && j.error.message ? j.error.message : raw.slice(0, 300)));
  }

  // Response may be a long-running operation
  if (j.name && (j.done === false || j.metadata || String(j.name).indexOf("operations/") >= 0)) {
    const op = await waitOperation(key, j.name);
    return op;
  }
  return j;
}

async function main() {
  loadEnv();
  const key = resolveKey();
  const store = resolveStoreName();
  const dir = knowledgeDir();

  console.log("");
  console.log("  Coach brain sync (manual push)");
  console.log("  Knowledge dir:", dir);
  console.log("  Store:", store || "(missing)");
  console.log("");

  if (!key) {
    console.error("Missing GEMINI_API_KEY in .env.local");
    process.exit(1);
  }
  if (!store) {
    console.error("Missing GEMINI_FILE_SEARCH_STORE in .env.local");
    process.exit(1);
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("Created empty knowledge dir. Add files, then re-run.");
    process.exit(0);
  }

  const files = walkFiles(dir, dir, []);
  if (!files.length) {
    console.log("No supported files found (.pdf .txt .md .docx .pptx …).");
    console.log("Copy/drag sources into the knowledge dir (or set COACH_KNOWLEDGE_DIR to your Drive Desktop folder), then re-run.");
    process.exit(0);
  }

  const manifest = loadManifest();
  if (!manifest.files) manifest.files = {};
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const f of files) {
    const fp = fileFingerprint(f.abs);
    const prev = manifest.files[f.rel];
    if (prev && prev.sha256 === fp.sha256) {
      skipped++;
      console.log("  skip ", f.rel);
      continue;
    }
    process.stdout.write("  sync " + f.rel + " … ");
    try {
      await uploadToStore(key, store, f);
      manifest.files[f.rel] = {
        sha256: fp.sha256,
        size: fp.size,
        mtimeMs: fp.mtimeMs,
        syncedAt: new Date().toISOString(),
      };
      saveManifest(manifest);
      uploaded++;
      console.log("ok");
    } catch (e) {
      failed++;
      console.log("FAIL", e.message || e);
    }
  }

  console.log("");
  console.log("  Done. uploaded=" + uploaded + " skipped=" + skipped + " failed=" + failed);
  console.log("  Restart npm run dev:local if it was already running, then chat in Personal Coach.");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
