/**
 * Shared coach brain sync (Drive/local knowledge → Gemini File Search).
 * Used by scripts/coach-sync-brain.js CLI and /api/admin-drive-sync.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..");
const DEFAULT_INBOX = path.join(ROOT, "experiments", "personal-coach", "knowledge-inbox");
const MANIFEST_PATH = path.join(ROOT, "experiments", "personal-coach", ".sync-manifest.json");
const LAST_SYNC_PATH = path.join(ROOT, "data", "admin-meta-sync.json");

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

  if (j.name && (j.done === false || j.metadata || String(j.name).indexOf("operations/") >= 0)) {
    const op = await waitOperation(key, j.name);
    return op;
  }
  return j;
}

function saveLastSync(result) {
  try {
    fs.mkdirSync(path.dirname(LAST_SYNC_PATH), { recursive: true });
    fs.writeFileSync(
      LAST_SYNC_PATH,
      JSON.stringify(
        {
          at: result.at,
          uploaded: result.uploaded,
          skipped: result.skipped,
          failed: result.failed,
          knowledgeDir: result.knowledgeDir,
          ok: result.ok,
          message: result.message || "",
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (e) {
    /* ignore persistence failures (e.g. read-only prod FS) */
  }
}

function readLastSync() {
  try {
    if (!fs.existsSync(LAST_SYNC_PATH)) return null;
    return JSON.parse(fs.readFileSync(LAST_SYNC_PATH, "utf8"));
  } catch (e) {
    return null;
  }
}

/**
 * Push new/changed knowledge files into Gemini File Search Store.
 * @returns {Promise<object>}
 */
async function runCoachBrainSync(options) {
  const opts = options || {};
  const log = typeof opts.log === "function" ? opts.log : function () {};
  const key = resolveKey();
  const store = resolveStoreName();
  const dir = knowledgeDir();
  const at = new Date().toISOString();

  if (!key) {
    return {
      ok: false,
      code: "missing_key",
      message: "חסר GEMINI_API_KEY — לא ניתן לסנכרן",
      knowledgeDir: dir,
      store: store || "",
      uploaded: 0,
      skipped: 0,
      failed: 0,
      at: at,
      errors: [],
    };
  }
  if (!store) {
    return {
      ok: false,
      code: "missing_store",
      message: "חסר GEMINI_FILE_SEARCH_STORE — לא ניתן לסנכרן",
      knowledgeDir: dir,
      store: "",
      uploaded: 0,
      skipped: 0,
      failed: 0,
      at: at,
      errors: [],
    };
  }
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      return {
        ok: false,
        code: "no_knowledge_dir",
        message: "תיקיית הידע לא נמצאה ולא ניתן ליצור אותה כאן. הגדר COACH_KNOWLEDGE_DIR או הרץ מקומית.",
        knowledgeDir: dir,
        store: store,
        uploaded: 0,
        skipped: 0,
        failed: 0,
        at: at,
        errors: [String(e.message || e)],
      };
    }
  }

  const files = walkFiles(dir, dir, []);
  if (!files.length) {
    const result = {
      ok: true,
      code: "empty",
      message: "לא נמצאו קבצים לסנכרון. העלה קבצים ל־Drive / תיקיית הידע ואז נסה שוב.",
      knowledgeDir: dir,
      store: store,
      uploaded: 0,
      skipped: 0,
      failed: 0,
      at: at,
      errors: [],
      fileCount: 0,
    };
    saveLastSync(result);
    return result;
  }

  const manifest = loadManifest();
  if (!manifest.files) manifest.files = {};
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const f of files) {
    const fp = fileFingerprint(f.abs);
    const prev = manifest.files[f.rel];
    if (prev && prev.sha256 === fp.sha256) {
      skipped++;
      log("skip " + f.rel);
      continue;
    }
    log("sync " + f.rel);
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
      log("ok " + f.rel);
    } catch (e) {
      failed++;
      const msg = String(e.message || e);
      errors.push({ file: f.rel, error: msg });
      log("FAIL " + f.rel + " " + msg);
    }
  }

  const result = {
    ok: failed === 0,
    code: failed ? "partial_or_failed" : uploaded ? "synced" : "noop",
    message:
      "הועלו " +
      uploaded +
      ", דולגו " +
      skipped +
      (failed ? ", נכשלו " + failed : ""),
    knowledgeDir: dir,
    store: store,
    uploaded: uploaded,
    skipped: skipped,
    failed: failed,
    at: at,
    errors: errors,
    fileCount: files.length,
  };
  saveLastSync(result);
  return result;
}

module.exports = {
  runCoachBrainSync,
  readLastSync,
  knowledgeDir,
  resolveStoreName,
  DEFAULT_INBOX,
  MANIFEST_PATH,
};
