/**
 * Shared coach brain sync (Drive / local knowledge → Gemini File Search).
 * Used by scripts/coach-sync-brain.js CLI and /api/admin-drive-sync.
 *
 * Layer rule: Sync touches L3 (File Search) ONLY.
 * L1/L2 foundation/ops files are excluded from upload.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { isExcludedFromL3Sync } = require("./coach-l3-sync-filter");
const { hasDriveAuth, pullCoachDriveToDir, driveFolderId } = require("./coach-drive-pull");

const ROOT = path.join(__dirname, "..", "..");
const DEFAULT_INBOX = path.join(ROOT, "experiments", "personal-coach", "knowledge-inbox");
const MANIFEST_PATH = path.join(ROOT, "experiments", "personal-coach", ".sync-manifest.json");
const LAST_SYNC_PATH = path.join(ROOT, "data", "admin-meta-sync.json");
const MANIFEST_BLOB_KEY = "admin-meta/coach-sync-manifest.json";
const LAST_SYNC_BLOB_KEY = "admin-meta/last-drive-sync.json";
const DRIVE_PULL_DIR = path.join(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? "/tmp" : path.join(ROOT, "data"),
  "duck-wod-drive-l3"
);

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

function getJsonStore() {
  try {
    return require("./admin/admin-json-store");
  } catch (e) {
    return null;
  }
}

async function loadManifest() {
  const store = getJsonStore();
  if (store && store.useBlob && store.useBlob()) {
    try {
      const j = await store.getJson(MANIFEST_BLOB_KEY);
      if (j && typeof j === "object") return j.files ? j : { files: {} };
    } catch (e) {}
  }
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return { files: {} };
    const j = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    return j && typeof j === "object" ? j : { files: {} };
  } catch (e) {
    return { files: {} };
  }
}

async function saveManifest(m) {
  const store = getJsonStore();
  if (store && store.useBlob && store.useBlob()) {
    try {
      await store.putJson(MANIFEST_BLOB_KEY, m);
      return;
    } catch (e) {}
  }
  try {
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2), "utf8");
  } catch (e) {
    /* read-only FS */
  }
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
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkFiles(abs, base, out);
      continue;
    }
    if (!ent.isFile()) continue;
    const rel = path.relative(base, abs).split(path.sep).join("/");
    if (isExcludedFromL3Sync(rel)) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!MIME[ext]) continue;
    out.push({
      abs,
      rel,
      mime: MIME[ext],
      displayName: ent.name,
    });
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

async function saveLastSync(result) {
  const slim = {
    at: result.at,
    uploaded: result.uploaded,
    skipped: result.skipped,
    failed: result.failed,
    knowledgeDir: result.knowledgeDir,
    source: result.source || "",
    ok: result.ok,
    code: result.code || "",
    message: result.message || "",
    skippedL1L2: result.skippedL1L2 || 0,
    driveFolderId: result.driveFolderId || "",
  };
  const store = getJsonStore();
  if (store && store.useBlob && store.useBlob()) {
    try {
      await store.putJson(LAST_SYNC_BLOB_KEY, slim);
      return;
    } catch (e) {}
  }
  try {
    fs.mkdirSync(path.dirname(LAST_SYNC_PATH), { recursive: true });
    fs.writeFileSync(LAST_SYNC_PATH, JSON.stringify(slim, null, 2), "utf8");
  } catch (e) {
    /* ignore */
  }
}

async function readLastSync() {
  const store = getJsonStore();
  if (store && store.useBlob && store.useBlob()) {
    try {
      const j = await store.getJson(LAST_SYNC_BLOB_KEY);
      if (j) return j;
    } catch (e) {}
  }
  try {
    if (!fs.existsSync(LAST_SYNC_PATH)) return null;
    return JSON.parse(fs.readFileSync(LAST_SYNC_PATH, "utf8"));
  } catch (e) {
    return null;
  }
}

function maxUploadsPerRun() {
  const n = Number(process.env.COACH_SYNC_MAX_UPLOADS || 8);
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.min(40, Math.floor(n));
}

/**
 * Push new/changed L3 knowledge files into Gemini File Search Store.
 * Prefers Google Drive pull when credentials exist; else local COACH_KNOWLEDGE_DIR / inbox.
 * @returns {Promise<object>}
 */
async function runCoachBrainSync(options) {
  const opts = options || {};
  const log = typeof opts.log === "function" ? opts.log : function () {};
  const key = resolveKey();
  const store = resolveStoreName();
  const at = new Date().toISOString();
  let source = "local";
  let dir = knowledgeDir();
  let driveMeta = null;
  let skippedL1L2 = 0;

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
      source: source,
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
      source: source,
    };
  }

  /* Prefer live Drive pull on production / whenever credentials exist */
  if (hasDriveAuth() && opts.skipDrive !== true) {
    try {
      driveMeta = await pullCoachDriveToDir(DRIVE_PULL_DIR, { log: log });
      skippedL1L2 += driveMeta.skippedL1L2 || 0;
      if (driveMeta.pulled > 0) {
        dir = DRIVE_PULL_DIR;
        source = "drive";
      } else if (driveMeta.code === "missing_drive_auth") {
        /* fall through to local */
      } else if (!fs.existsSync(dir) || !walkFiles(dir, dir, []).length) {
        const result = {
          ok: false,
          code: driveMeta.code === "empty" ? "empty" : "drive_empty",
          message: driveMeta.message || "Drive לא החזיר קבצי L3 לסנכרון",
          knowledgeDir: dir,
          store: store,
          uploaded: 0,
          skipped: 0,
          failed: 0,
          at: at,
          errors: driveMeta.errors || [],
          source: "drive",
          driveFolderId: driveFolderId(),
          skippedL1L2: skippedL1L2,
        };
        await saveLastSync(result);
        return result;
      }
    } catch (e) {
      const msg = String(e.message || e);
      if (!fs.existsSync(knowledgeDir()) || !walkFiles(knowledgeDir(), knowledgeDir(), []).length) {
        const result = {
          ok: false,
          code: "drive_error",
          message: "שגיאת Google Drive: " + msg.slice(0, 220),
          knowledgeDir: knowledgeDir(),
          store: store,
          uploaded: 0,
          skipped: 0,
          failed: 1,
          at: at,
          errors: [{ file: "(drive)", error: msg }],
          source: "drive",
          driveFolderId: driveFolderId(),
        };
        await saveLastSync(result);
        return result;
      }
      log("drive pull failed, falling back to local: " + msg);
    }
  } else if (!String(process.env.COACH_KNOWLEDGE_DIR || "").trim()) {
    /* On Vercel without Drive auth — local inbox may be mostly L1/L2; say so clearly */
    const onVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (onVercel) {
      const localFiles = walkFiles(dir, dir, []);
      if (!localFiles.length) {
        const result = {
          ok: false,
          code: "missing_drive_auth",
          message:
            "בשרת אין חיבור ל־Google Drive ואין קבצי L3 מקומיים. הגדר GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (או Refresh Token), שתף את תיקיית ה־Drive עם החשבון, Redeploy, ואז לחץ סנכרן שוב.",
          knowledgeDir: dir,
          store: store,
          uploaded: 0,
          skipped: 0,
          failed: 0,
          at: at,
          errors: [],
          source: "none",
          driveFolderId: driveFolderId(),
        };
        await saveLastSync(result);
        return result;
      }
    }
  }

  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      return {
        ok: false,
        code: "no_knowledge_dir",
        message:
          "תיקיית הידע לא נמצאה. הגדר חיבור Drive או COACH_KNOWLEDGE_DIR, או הרץ מקומית עם knowledge-inbox.",
        knowledgeDir: dir,
        store: store,
        uploaded: 0,
        skipped: 0,
        failed: 0,
        at: at,
        errors: [String(e.message || e)],
        source: source,
      };
    }
  }

  const allFiles = walkFiles(dir, dir, []);
  /* Count L1/L2 skipped for honesty when walking local */
  if (source === "local" && fs.existsSync(dir)) {
    try {
      const rawCount = { n: 0 };
      (function countAll(d) {
        if (!fs.existsSync(d)) return;
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
          if (ent.name.startsWith(".")) continue;
          const abs = path.join(d, ent.name);
          if (ent.isDirectory()) countAll(abs);
          else if (ent.isFile()) {
            const rel = path.relative(dir, abs).split(path.sep).join("/");
            if (isExcludedFromL3Sync(rel)) skippedL1L2++;
            else rawCount.n++;
          }
        }
      })(dir);
    } catch (e) {}
  }

  if (!allFiles.length) {
    const result = {
      ok: true,
      code: "empty",
      message:
        "לא נמצאו קבצי L3 לסנכרון" +
        (skippedL1L2 ? " (דולגו L1/L2: " + skippedL1L2 + ")" : "") +
        ". העלה מאמרים ל־Drive ואז סנכרן שוב.",
      knowledgeDir: dir,
      store: store,
      uploaded: 0,
      skipped: 0,
      failed: 0,
      at: at,
      errors: [],
      fileCount: 0,
      source: source,
      driveFolderId: source === "drive" ? driveFolderId() : "",
      skippedL1L2: skippedL1L2,
    };
    await saveLastSync(result);
    return result;
  }

  const manifest = await loadManifest();
  if (!manifest.files) manifest.files = {};
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];
  const uploadCap = maxUploadsPerRun();
  let capped = false;

  for (const f of allFiles) {
    const fp = fileFingerprint(f.abs);
    const prev = manifest.files[f.rel];
    if (prev && prev.sha256 === fp.sha256) {
      skipped++;
      log("skip " + f.rel);
      continue;
    }
    if (uploaded >= uploadCap) {
      capped = true;
      break;
    }
    log("sync " + f.rel);
    try {
      await uploadToStore(key, store, f);
      manifest.files[f.rel] = {
        sha256: fp.sha256,
        size: fp.size,
        mtimeMs: fp.mtimeMs,
        syncedAt: new Date().toISOString(),
        source: source,
      };
      await saveManifest(manifest);
      uploaded++;
      log("ok " + f.rel);
    } catch (e) {
      failed++;
      const msg = String(e.message || e);
      errors.push({ file: f.rel, error: msg });
      log("FAIL " + f.rel + " " + msg);
    }
  }

  let code = failed ? "partial_or_failed" : uploaded ? "synced" : "noop";
  if (capped && uploaded > 0) code = "synced_more";
  let message =
    "הועלו " +
    uploaded +
    ", דולגו (ללא שינוי) " +
    skipped +
    (failed ? ", נכשלו " + failed : "") +
    (skippedL1L2 ? ", L1/L2 לא סונכרנו: " + skippedL1L2 : "");
  if (capped) {
    message += " — יש עוד קבצים; לחץ «סנכרן» שוב.";
  }
  if (code === "noop") {
    message = "אין שינוי — כל קבצי ה־L3 כבר מסונכרנים" + (skippedL1L2 ? " (L1/L2 לא נכללים)" : "");
  }

  const result = {
    ok: failed === 0,
    code: code,
    message: message,
    knowledgeDir: dir,
    store: store,
    uploaded: uploaded,
    skipped: skipped,
    failed: failed,
    at: at,
    errors: errors,
    fileCount: allFiles.length,
    source: source,
    driveFolderId: source === "drive" ? driveFolderId() : "",
    skippedL1L2: skippedL1L2,
    moreRemaining: !!capped,
  };
  await saveLastSync(result);
  return result;
}

module.exports = {
  runCoachBrainSync,
  readLastSync,
  knowledgeDir,
  resolveStoreName,
  walkFiles,
  isExcludedFromL3Sync,
  DEFAULT_INBOX,
  MANIFEST_PATH,
};
