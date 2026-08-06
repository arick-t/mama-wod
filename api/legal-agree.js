/**
 * Record Personal Coach Terms acceptance to data/legal-agreements.jsonl via GitHub API.
 * Same storage pattern as api/event.js (no external DB).
 * Env: GITHUB_TOKEN, GITHUB_REPO
 */
const GITHUB_API = "https://api.github.com";
const { checkRateLimit, sendRateLimit } = require("../lib/rate-limit.js");
const { applyCors } = require("../lib/cors-allowlist.js");

const LEGAL_TERMS_ID = "v2.0-legal";
const LEGAL_MIN_VERSION = 3;
const FILE_PATH = "data/legal-agreements.jsonl";

function allowCors(req, res) {
  applyCors(req, res, {
    methods: "GET, POST, OPTIONS",
    headers: "Content-Type",
  });
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (xf) return xf.slice(0, 64);
  const real = String(req.headers["x-real-ip"] || "").trim();
  if (real) return real.slice(0, 64);
  return String((req.socket && req.socket.remoteAddress) || "").slice(0, 64);
}

module.exports = async function handler(req, res) {
  allowCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET" || req.method === "HEAD") {
    return res.status(200).json({
      ok: true,
      service: "legal-agree",
      termsVersion: LEGAL_TERMS_ID,
      legalMinVersion: LEGAL_MIN_VERSION,
      file: FILE_PATH,
      hint: "POST on Agree & Continue to append an audit row. View with: node scripts/legal-agreements-summary.js",
    });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const userId = String(body.userId || body.uid || body.athleteId || "")
    .trim()
    .slice(0, 80);
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  const rl = checkRateLimit(req, {
    name: "legal-agree",
    limit: 20,
    windowMs: 60 * 1000,
    uid: userId,
  });
  if (!rl.ok) return sendRateLimit(res, rl);

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return res.status(500).json({ error: "Missing GITHUB_TOKEN or GITHUB_REPO" });
  }

  const termsVersion = String(body.termsVersion || LEGAL_TERMS_ID).slice(0, 40);
  const legalAcceptedVersion = Math.max(
    0,
    Math.min(99, parseInt(body.legalAcceptedVersion, 10) || LEGAL_MIN_VERSION)
  );
  const acceptedAtClient = String(body.acceptedAt || "").slice(0, 40);
  const displayName = String(body.displayName || body.name || "").trim().slice(0, 40);
  const ua = String(body.ua || req.headers["user-agent"] || "").slice(0, 512);
  const flagsIn = body.flags && typeof body.flags === "object" ? body.flags : {};
  const flags = {
    age18: flagsIn.age18 === true || flagsIn.age18 === "true",
    aiResponsibility:
      flagsIn.aiResponsibility === true || flagsIn.aiResponsibility === "true",
    termsPrivacy: flagsIn.termsPrivacy === true || flagsIn.termsPrivacy === "true",
  };

  const payload = {
    event: "legal_agree",
    userId: userId,
    termsAccepted: true,
    termsVersion: termsVersion,
    legalAcceptedVersion: legalAcceptedVersion,
    acceptedAt: new Date().toISOString(),
    acceptedAtClient: acceptedAtClient || null,
    ip: clientIp(req),
    flags: flags,
    ua: ua,
  };
  if (displayName) payload.displayName = displayName;

  const newLine = JSON.stringify(payload) + "\n";
  const headers = {
    Authorization: "token " + token,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  try {
    const getRes = await fetch(
      GITHUB_API + "/repos/" + repo + "/contents/" + FILE_PATH,
      { headers: headers }
    );
    let content = "";
    let sha = null;
    if (getRes.ok) {
      const data = await getRes.json();
      content = Buffer.from(data.content, "base64").toString("utf8");
      sha = data.sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.text();
      return res.status(502).json({ error: "GitHub GET failed", detail: err });
    }

    content += newLine;
    const putBody = {
      message: "legal: agree " + termsVersion + " · " + userId.slice(0, 24),
      content: Buffer.from(content, "utf8").toString("base64"),
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(
      GITHUB_API + "/repos/" + repo + "/contents/" + FILE_PATH,
      {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(putBody),
      }
    );
    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(502).json({ error: "GitHub PUT failed", detail: err });
    }
    return res.status(200).json({
      ok: true,
      recorded: true,
      userId: userId,
      termsVersion: termsVersion,
      acceptedAt: payload.acceptedAt,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e.message });
  }
};
