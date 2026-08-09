/**
 * Pull Google Drive folder → local temp dir for L3 File Search sync.
 * Auth (one of):
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON  — full service-account JSON string
 *   OR GOOGLE_DRIVE_CLIENT_ID + GOOGLE_DRIVE_CLIENT_SECRET + GOOGLE_DRIVE_REFRESH_TOKEN
 * Folder:
 *   COACH_DRIVE_FOLDER_ID (default Duck WOD sources folder)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { isExcludedFromL3Sync } = require("./coach-l3-sync-filter");

const DEFAULT_FOLDER_ID = "1WLMbabNpXZ80qJPwgrxAY2I77CdTboAo";

const EXPORT_MAP = {
  "application/vnd.google-apps.document": {
    exportMime: "text/plain",
    ext: ".txt",
  },
  "application/vnd.google-apps.spreadsheet": {
    exportMime: "text/csv",
    ext: ".csv",
  },
  "application/vnd.google-apps.presentation": {
    exportMime: "text/plain",
    ext: ".txt",
  },
};

function driveFolderId() {
  return String(process.env.COACH_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID).trim();
}

function hasDriveAuth() {
  if (String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "").trim()) return true;
  return !!(
    String(process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "").trim() &&
    String(process.env.GOOGLE_DRIVE_CLIENT_ID || "").trim() &&
    String(process.env.GOOGLE_DRIVE_CLIENT_SECRET || "").trim()
  );
}

function b64url(bufOrStr) {
  const b = Buffer.isBuffer(bufOrStr) ? bufOrStr : Buffer.from(String(bufOrStr), "utf8");
  return b.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function parseServiceAccount() {
  const raw = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch (e2) {
      return null;
    }
  }
}

async function accessTokenFromServiceAccount() {
  const sa = parseServiceAccount();
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON לא תקין");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(claim));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const sig = b64url(signer.sign(String(sa.private_key).replace(/\\n/g, "\n")));
  const jwt = unsigned + "." + sig;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error(
      "drive_sa_token_failed:" + (j.error_description || j.error || r.status)
    );
  }
  return j.access_token;
}

async function accessTokenFromRefresh() {
  const body = new URLSearchParams({
    client_id: String(process.env.GOOGLE_DRIVE_CLIENT_ID || "").trim(),
    client_secret: String(process.env.GOOGLE_DRIVE_CLIENT_SECRET || "").trim(),
    refresh_token: String(process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "").trim(),
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error(
      "drive_refresh_token_failed:" + (j.error_description || j.error || r.status)
    );
  }
  return j.access_token;
}

async function getAccessToken() {
  if (String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "").trim()) {
    return accessTokenFromServiceAccount();
  }
  return accessTokenFromRefresh();
}

async function driveFetch(token, url) {
  const r = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
  });
  return r;
}

async function listChildren(token, folderId) {
  const out = [];
  let pageToken = "";
  do {
    const q =
      "'" +
      folderId.replace(/'/g, "\\'") +
      "' in parents and trashed=false";
    const params = new URLSearchParams({
      q: q,
      pageSize: "100",
      fields: "nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime,size)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const r = await driveFetch(
      token,
      "https://www.googleapis.com/drive/v3/files?" + params.toString()
    );
    const j = await r.json();
    if (!r.ok) {
      throw new Error(
        "drive_list_failed:" + (j.error && j.error.message ? j.error.message : r.status)
      );
    }
    for (const f of j.files || []) out.push(f);
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return out;
}

async function listAllFiles(token, folderId, prefix, out) {
  const kids = await listChildren(token, folderId);
  for (const f of kids) {
    const name = String(f.name || "file");
    const rel = prefix ? prefix + "/" + name : name;
    if (f.mimeType === "application/vnd.google-apps.folder") {
      await listAllFiles(token, f.id, rel, out);
      continue;
    }
    out.push({
      id: f.id,
      name: name,
      rel: rel,
      mimeType: f.mimeType,
      md5Checksum: f.md5Checksum || "",
      modifiedTime: f.modifiedTime || "",
      size: Number(f.size || 0),
    });
  }
  return out;
}

function safeLocalName(rel) {
  return String(rel || "file")
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/^\/+/, "")
    .slice(0, 200);
}

async function downloadFile(token, file, destAbs, exportInfo) {
  let url;
  if (exportInfo) {
    url =
      "https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(file.id) +
      "/export?mimeType=" +
      encodeURIComponent(exportInfo.exportMime);
  } else {
    url =
      "https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(file.id) +
      "?alt=media";
  }
  const r = await driveFetch(token, url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error("drive_download_failed:" + file.rel + ":" + r.status + ":" + t.slice(0, 160));
  }
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.writeFileSync(destAbs, buf);
  return buf.length;
}

/**
 * Pull Drive folder into destDir (cleared first). L1/L2 names skipped.
 * @returns {Promise<object>}
 */
async function pullCoachDriveToDir(destDir, options) {
  const opts = options || {};
  const log = typeof opts.log === "function" ? opts.log : function () {};
  if (!hasDriveAuth()) {
    return {
      ok: false,
      code: "missing_drive_auth",
      message:
        "חסר חיבור Google Drive בשרת. הגדר GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON או Refresh Token (+ Client ID/Secret), שתף את תיקיית ה־Drive עם החשבון, ואז Redeploy.",
      folderId: driveFolderId(),
      pulled: 0,
      skippedL1L2: 0,
      files: [],
    };
  }

  const token = await getAccessToken();
  const folderId = driveFolderId();
  log("drive pull folder " + folderId);

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const listed = await listAllFiles(token, folderId, "", []);
  let pulled = 0;
  let skippedL1L2 = 0;
  const files = [];
  const errors = [];

  for (const f of listed) {
    const exportInfo = EXPORT_MAP[f.mimeType] || null;
    let rel = safeLocalName(f.rel);
    if (exportInfo && !/\.[a-z0-9]+$/i.test(rel)) rel = rel + exportInfo.ext;
    if (isExcludedFromL3Sync(rel)) {
      skippedL1L2++;
      log("skip L1/L2 " + rel);
      continue;
    }
    /* Skip Google shortcuts / forms / unknown workspace types we cannot export usefully */
    if (
      String(f.mimeType || "").indexOf("application/vnd.google-apps.") === 0 &&
      !exportInfo
    ) {
      log("skip unsupported " + rel + " " + f.mimeType);
      continue;
    }
    const abs = path.join(destDir, rel);
    try {
      const n = await downloadFile(token, f, abs, exportInfo);
      pulled++;
      files.push({ rel: rel, abs: abs, bytes: n });
      log("pulled " + rel + " (" + n + "b)");
    } catch (e) {
      errors.push({ file: rel, error: String(e.message || e) });
      log("FAIL pull " + rel + " " + String(e.message || e));
    }
  }

  return {
    ok: errors.length === 0,
    code: pulled ? "pulled" : listed.length ? "empty_after_filter" : "empty",
    message:
      pulled
        ? "נמשכו " + pulled + " קבצים מ־Drive" + (skippedL1L2 ? " (דולגו L1/L2: " + skippedL1L2 + ")" : "")
        : "לא נמשכו קבצי L3 מ־Drive (תיקייה ריקה או רק L1/L2).",
    folderId: folderId,
    pulled: pulled,
    skippedL1L2: skippedL1L2,
    listed: listed.length,
    files: files,
    errors: errors,
    destDir: destDir,
  };
}

module.exports = {
  hasDriveAuth,
  driveFolderId,
  pullCoachDriveToDir,
  DEFAULT_FOLDER_ID,
};
