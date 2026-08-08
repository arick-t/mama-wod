/**
 * Persistent JSON store for Admin dashboard.
 * Prefers private Vercel Blob when BLOB_READ_WRITE_TOKEN / OIDC is available;
 * falls back to local filesystem under data/ for offline dev without Blob.
 */
const fs = require("fs");
const path = require("path");
const { adminDataRoot } = require("./admin-paths");

let blobSdk = null;
try {
  blobSdk = require("@vercel/blob");
} catch (e) {
  blobSdk = null;
}

function hasBlobAuth() {
  return !!(
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.BLOB_STORE_ID
  );
}

function useBlob() {
  return !!(blobSdk && hasBlobAuth());
}

/**
 * Production must use durable Blob. Local/dev may use FS.
 * On Vercel without Blob credentials → fail closed (no silent /tmp).
 */
function assertDurableStorage() {
  const onVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (onVercel && !useBlob()) {
    const err = new Error(
      "אין מאגר קבוע (Blob) מוגדר בשרת. שמירה זמנית ב־/tmp כבויה. פנו למנהל המערכת."
    );
    err.code = "blob_required";
    throw err;
  }
}

function fsPathFor(key) {
  const safe = String(key || "")
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/^\/+/, "");
  return path.join(adminDataRoot(), safe);
}

function ensureFsParent(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function putJson(key, data, opts) {
  assertDurableStorage();
  const pathname = String(key || "").replace(/^\/+/, "");
  const body = typeof data === "string" ? data : JSON.stringify(data);
  const allowOverwrite = !(opts && opts.allowOverwrite === false);
  if (useBlob()) {
    await blobSdk.put(pathname, body, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: allowOverwrite,
      token: process.env.BLOB_READ_WRITE_TOKEN || undefined,
    });
    return { backend: "blob", pathname };
  }
  const file = fsPathFor(pathname);
  if (!allowOverwrite && fs.existsSync(file)) {
    const err = new Error("already_exists");
    err.code = "already_exists";
    throw err;
  }
  ensureFsParent(file);
  fs.writeFileSync(file, body, "utf8");
  return { backend: "fs", pathname };
}

/** Create-only put for atomic locks (fail if pathname already exists). */
async function putJsonExclusive(key, data) {
  return putJson(key, data, { allowOverwrite: false });
}

async function getJson(key) {
  assertDurableStorage();
  const pathname = String(key || "").replace(/^\/+/, "");
  if (useBlob()) {
    const result = await blobSdk.get(pathname, {
      access: "private",
      useCache: false,
      token: process.env.BLOB_READ_WRITE_TOKEN || undefined,
    });
    if (!result || result.statusCode === 404 || !result.stream) return null;
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(chunk);
    const raw = Buffer.concat(
      chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))
    ).toString("utf8");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  const file = fsPathFor(pathname);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
}

async function listJson(prefix) {
  assertDurableStorage();
  const pref = String(prefix || "").replace(/^\/+/, "");
  if (useBlob()) {
    const out = [];
    let cursor;
    do {
      const page = await blobSdk.list({
        prefix: pref,
        cursor,
        limit: 100,
        token: process.env.BLOB_READ_WRITE_TOKEN || undefined,
      });
      for (const blob of page.blobs || []) {
        const pathname = blob.pathname || "";
        if (!pathname.endsWith(".json")) continue;
        const row = await getJson(pathname);
        if (row) out.push({ pathname, data: row });
      }
      cursor = page.hasMore ? page.cursor : null;
    } while (cursor);
    return out;
  }
  const dir = fsPathFor(pref);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const pathname = (pref.endsWith("/") ? pref : pref + "/") + f;
      try {
        return {
          pathname,
          data: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

async function deleteJson(key) {
  assertDurableStorage();
  const pathname = String(key || "").replace(/^\/+/, "");
  if (useBlob()) {
    await blobSdk.del(pathname, {
      token: process.env.BLOB_READ_WRITE_TOKEN || undefined,
    });
    return { backend: "blob", pathname };
  }
  const file = fsPathFor(pathname);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { backend: "fs", pathname };
}

function storageInfo() {
  return {
    backend: useBlob() ? "blob" : "fs",
    blobConfigured: hasBlobAuth(),
    durable: useBlob() || !(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
  };
}

module.exports = {
  putJson,
  putJsonExclusive,
  getJson,
  listJson,
  deleteJson,
  useBlob,
  hasBlobAuth,
  storageInfo,
  assertDurableStorage,
};
