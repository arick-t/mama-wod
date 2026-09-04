/**
 * שרת פיתוח מקומי: מגיש את הפרויקט מהשורש + personal-coach + event + admin-snapshot
 * הרצה: npm run dev:local
 * קובץ סודות: .env.local (או .env) בראש הפרויקט — ראו .env.example
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(__dirname, "..", name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
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

/** תאימות ל־handler של Vercel (res.status().json() + כתיבה לזרם SSE) */
function wrapRes(res) {
  const out = {
    _code: 200,
    status(c) {
      out._code = c;
      return out;
    },
    json(obj) {
      if (!res.headersSent) {
        res.statusCode = out._code;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(obj));
    },
    write(chunk) {
      if (!res.headersSent) {
        res.statusCode = out._code;
      }
      return res.write(chunk);
    },
    end(chunk) {
      if (!res.headersSent) {
        res.statusCode = out._code;
      }
      res.end(chunk !== undefined ? chunk : "");
    },
    setHeader: res.setHeader.bind(res),
  };
  return out;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const ROOT = path.join(__dirname, "..");

/** Always load fresh API handlers in local dev (avoid stale require cache after edits). */
function loadApiHandler(relPath) {
  const abs = require.resolve(path.join(ROOT, relPath));
  delete require.cache[abs];
  /* Also bust sibling requires used by the handler (e.g. hamamen-prompt.js). */
  try {
    const dir = path.dirname(abs);
    Object.keys(require.cache).forEach(function (k) {
      if (k.indexOf(dir + path.sep) === 0 || k.indexOf(dir + "/") === 0) {
        delete require.cache[k];
      }
    });
  } catch (e) {}
  return require(abs);
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  const joined = path.normalize(path.join(root, decoded));
  if (!joined.startsWith(root)) return null;
  return joined;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/", true);
  const pathnameRaw = parsed.pathname || "/";
  const pathname =
    pathnameRaw.length > 1 && pathnameRaw.endsWith("/")
      ? pathnameRaw.slice(0, -1)
      : pathnameRaw;

  /* Log every request first (debug Simple Browser / port-forward) */
  try {
    fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
    fs.appendFileSync(
      path.join(ROOT, "data", "local-dev-access.log"),
      new Date().toISOString() + " " + req.method + " " + (req.url || pathnameRaw) + "\n"
    );
  } catch (e) {}

  /* ?view=dash on any path → admin (works even if /admin.html is blocked/cached) */
  if (String((parsed.query && parsed.query.view) || "") === "dash") {
    const adminPath = path.join(ROOT, "admin.html");
    if (fs.existsSync(adminPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return fs.createReadStream(adminPath).pipe(res);
    }
  }

  /* Friendly shortcuts for founder preview */
  const adminAliases = {
    "/admin": "admin.html",
    "/admin.html": "admin.html",
    "/dash": "admin.html",
    "/dash.html": "admin.html",
    "/founder": "admin.html",
    "/founder.html": "admin.html",
  };
  if (adminAliases[pathname]) {
    const adminPath = path.join(ROOT, adminAliases[pathname]);
    if (fs.existsSync(adminPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return fs.createReadStream(adminPath).pipe(res);
    }
  }
  if (pathname === "/claim" || pathname === "/claim.html") {
    const claimPath = path.join(ROOT, "claim.html");
    if (fs.existsSync(claimPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return fs.createReadStream(claimPath).pipe(res);
    }
  }

  if (
    pathname === "/api/admin-snapshot" ||
    pathname === "/api/admin-coach-sandbox" ||
    pathname === "/api/admin-handoff" ||
    pathname === "/api/admin-meta" ||
    pathname === "/api/admin-drive-sync" ||
    /* The client programmes and the coach's own book — without these the admin page
       runs locally with two of its three screens dead (owner, 2026-09-04: work on the
       design here, not on Vercel). */
    pathname === "/api/client-program" ||
    pathname === "/api/admin-ledger" ||
    pathname === "/api/admin"
  ) {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Admin-Password, X-Admin-Token, X-Athlete-Id"
      );
      res.statusCode = 204;
      return res.end();
    }
    const apiRel =
      pathname === "/api/client-program"
        ? "api/client-program.js"
        : pathname === "/api/admin-ledger"
        ? "scripts/lib/admin/admin-ledger.js"
        : pathname === "/api/admin-coach-sandbox"
        ? "scripts/lib/admin/admin-coach-sandbox.js"
        : pathname === "/api/admin-handoff"
        ? "scripts/lib/admin/admin-handoff.js"
        : pathname === "/api/admin-meta"
        ? "scripts/lib/admin/admin-meta.js"
        : pathname === "/api/admin-drive-sync"
        ? "scripts/lib/admin/admin-drive-sync.js"
        : pathname === "/api/admin"
        ? "api/admin.js"
        : "scripts/lib/admin/admin-snapshot.js";
    const runAdmin = async (body) => {
      const fakeReq = {
        method: req.method,
        body: body || {},
        query: parsed.query || {},
        url: req.url || pathname,
        headers: req.headers || {},
      };
      const fakeRes = wrapRes(res);
      try {
        await loadApiHandler(apiRel)(fakeReq, fakeRes);
      } catch (e) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(e.message || e) }));
        }
      }
    };
    if (req.method === "GET" || req.method === "DELETE" || req.method === "HEAD") {
      runAdmin({});
      return;
    }
    if (req.method === "POST") {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
      });
      req.on("end", () => {
        let parsedBody = {};
        try {
          parsedBody = raw ? JSON.parse(raw) : {};
        } catch (e) {
          parsedBody = {};
        }
        runAdmin(parsedBody);
      });
      return;
    }
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  if (
    pathname === "/api/personal-coach" ||
    pathname === "/api/coach-feedback" ||
    pathname === "/api/event"
  ) {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.statusCode = 204;
      return res.end();
    }
    if (pathname === "/api/event" && req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method not allowed");
    }
    if (
      (pathname === "/api/personal-coach" ||
        pathname === "/api/coach-feedback") &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      const fakeReq = {
        method: req.method,
        body: {},
        query: parsed.query || {},
        url: req.url || pathname,
        headers: req.headers || {},
      };
      const fakeRes = wrapRes(res);
      const rel =
        pathname === "/api/coach-feedback"
          ? "api/coach-feedback.js"
          : "api/personal-coach.js";
      loadApiHandler(rel)(fakeReq, fakeRes).catch((e) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(e.message || e) }));
        }
      });
      return;
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method not allowed");
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", async () => {
      let parsedBody;
      try {
        parsedBody = raw ? JSON.parse(raw) : {};
      } catch (e) {
        parsedBody = {};
      }
      const fakeReq = { method: "POST", body: parsedBody, headers: req.headers || {}, query: parsed.query || {}, url: req.url || pathname };
      const fakeRes = wrapRes(res);
      try {
        if (pathname === "/api/personal-coach") {
          await loadApiHandler("api/personal-coach.js")(fakeReq, fakeRes);
        } else if (pathname === "/api/coach-feedback") {
          await loadApiHandler("api/coach-feedback.js")(fakeReq, fakeRes);
        } else {
          await loadApiHandler("api/event.js")(fakeReq, fakeRes);
        }
      } catch (e) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(e.message || e) }));
        }
      }
    });
    return;
  }

  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = safeJoin(ROOT, rel);
  if (!filePath) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (pathname === "/") {
      const idx = path.join(ROOT, "index.html");
      if (fs.existsSync(idx)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        return fs.createReadStream(idx).pipe(res);
      }
    }
    res.statusCode = 404;
    return res.end("Not found");
  }
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const isMedia = ext === ".mp4" || ext === ".webm" || ext === ".mov" || ext === ".m4v";

  if (ext === ".html") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  /* iOS Safari needs Range/206 for reliable MP4 playback (esp. over tunnels). */
  if (isMedia) {
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", mime);
    const range = req.headers.range;
    if (range) {
      const m = String(range).match(/bytes=(\d*)-(\d*)/);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : total - 1;
        if (start >= total || end >= total || start > end) {
          res.statusCode = 416;
          res.setHeader("Content-Range", "bytes */" + total);
          return res.end();
        }
        res.statusCode = 206;
        res.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + total);
        res.setHeader("Content-Length", String(end - start + 1));
        return fs.createReadStream(filePath, { start: start, end: end }).pipe(res);
      }
    }
    res.setHeader("Content-Length", String(total));
    return fs.createReadStream(filePath).pipe(res);
  }

  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", String(total));
  fs.createReadStream(filePath).pipe(res);
});

loadEnv();
const PORT = parseInt(process.env.PORT || "3000", 10);

function lanIpv4Addresses() {
  const os = require("os");
  const out = [];
  const ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(function (name) {
    (ifs[name] || []).forEach(function (addr) {
      if (addr && addr.family === "IPv4" && !addr.internal) out.push(addr.address);
    });
  });
  return out;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  DUCK-WOD local dev");
  console.log("  Open: http://localhost:" + PORT + "/");
  const ips = lanIpv4Addresses();
  if (ips.length) {
    ips.forEach(function (ip) {
      console.log("  Phone (same Wi‑Fi): http://" + ip + ":" + PORT + "/");
    });
  } else {
    console.log("  Phone (same Wi‑Fi): http://<this-PC-LAN-IP>:" + PORT + "/");
  }
  console.log("  API:  http://localhost:" + PORT + "/api/personal-coach");
  console.log("  API:  http://localhost:" + PORT + "/api/coach-feedback");
  console.log("  Admin: http://localhost:" + PORT + "/dash");
  console.log("         http://localhost:" + PORT + "/admin.html");
  console.log("  Claim: http://localhost:" + PORT + "/claim.html?t=<token>");
  if (!process.env.ADMIN_PASSWORD) {
    console.log("  [!] ADMIN_PASSWORD missing — admin login will fail until set in .env.local");
  }
  if (!process.env.GEMINI_API_KEY) {
    console.log("");
    console.log("  [!] GEMINI_API_KEY missing — copy .env.example to .env.local");
  }
  if (!process.env.GEMINI_FILE_SEARCH_STORE) {
    console.log("  [i] GEMINI_FILE_SEARCH_STORE not set — coach runs without Drive File Search");
  }
  if (!process.env.BREVO_API_KEY) {
    console.log("  [!] BREVO_API_KEY missing — coach debrief/feedback emails will not send");
    console.log("      set BREVO_API_KEY (+ BREVO_SENDER_EMAIL=contact.duckwod@gmail.com) in .env.local — see BREVO_SECRETS.md");
  }
  console.log("");
});
