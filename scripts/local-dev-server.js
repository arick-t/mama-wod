/**
 * שרת פיתוח מקומי: מגיש את הפרויקט מהשורש + /api/generate-workout + /api/event
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
};

const ROOT = path.join(__dirname, "..");
const generateHandler = require("../api/generate-workout.js");
const eventHandler = require("../api/event.js");

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  const joined = path.normalize(path.join(root, decoded));
  if (!joined.startsWith(root)) return null;
  return joined;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/", true);
  const pathname = parsed.pathname || "/";

  if (pathname === "/api/generate-workout" || pathname === "/api/event") {
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
    if (pathname === "/api/generate-workout" && (req.method === "GET" || req.method === "HEAD")) {
      const fakeReq = { method: req.method, body: {} };
      const fakeRes = wrapRes(res);
      generateHandler(fakeReq, fakeRes).catch((e) => {
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
      const fakeReq = { method: "POST", body: parsedBody };
      const fakeRes = wrapRes(res);
      try {
        if (pathname === "/api/generate-workout") {
          await generateHandler(fakeReq, fakeRes);
        } else {
          await eventHandler(fakeReq, fakeRes);
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
        return fs.createReadStream(idx).pipe(res);
      }
    }
    res.statusCode = 404;
    return res.end("Not found");
  }
  const ext = path.extname(filePath);
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
});

loadEnv();
const PORT = parseInt(process.env.PORT || "3000", 10);
server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("  DUCK-WOD local dev");
  console.log("  Open: http://localhost:" + PORT + "/");
  console.log("  API:  http://localhost:" + PORT + "/api/generate-workout");
  if (!process.env.GEMINI_API_KEY) {
    console.log("");
    console.log("  [!] GEMINI_API_KEY missing — copy .env.example to .env.local");
  }
  console.log("");
});
