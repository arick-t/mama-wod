/**
 * Vercel serverless: receives analytics events and appends one line to data/analytics.jsonl in the repo via GitHub API.
 * Env: GITHUB_TOKEN (repo scope), GITHUB_REPO (e.g. owner/repo).
 * No monthly cost – Vercel free tier, storage = file in Git.
 *
 * Also: personal_coach_legal_agree mirrors into data/legal-agreements.jsonl
 * (iOS often delivers analytics beacon reliably even when a separate legal-agree fetch drops).
 */

const GITHUB_API = "https://api.github.com";
const { checkRateLimit, sendRateLimit } = require("./rate-limit.js");

function allowCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (xf) return xf.slice(0, 64);
  const real = String(req.headers["x-real-ip"] || "").trim();
  if (real) return real.slice(0, 64);
  return String((req.socket && req.socket.remoteAddress) || "").slice(0, 64);
}

async function appendGithubJsonl(token, repo, filePath, newLine, commitMessage, opts) {
  const headers = {
    Authorization: "token " + token,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
  const getRes = await fetch(GITHUB_API + "/repos/" + repo + "/contents/" + filePath, {
    headers: headers,
  });
  let content = "";
  let sha = null;
  if (getRes.ok) {
    const data = await getRes.json();
    content = Buffer.from(data.content, "base64").toString("utf8");
    sha = data.sha;
  } else if (getRes.status !== 404) {
    const err = await getRes.text();
    return { ok: false, status: 502, error: "GitHub GET failed", detail: err };
  }

  /* Skip if a recent row already recorded the same userId + termsVersion. */
  const skipIf = opts && opts.skipIf;
  if (skipIf && typeof skipIf === "function" && content) {
    const lines = content.split("\n").filter(Boolean);
    const recent = lines.slice(-40);
    for (let i = recent.length - 1; i >= 0; i--) {
      try {
        const row = JSON.parse(recent[i]);
        if (skipIf(row)) {
          return { ok: true, skipped: true };
        }
      } catch (e) {}
    }
  }

  content += newLine;
  const putBody = {
    message: commitMessage,
    content: Buffer.from(content, "utf8").toString("base64"),
  };
  if (sha) putBody.sha = sha;
  const putRes = await fetch(GITHUB_API + "/repos/" + repo + "/contents/" + filePath, {
    method: "PUT",
    headers: headers,
    body: JSON.stringify(putBody),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    return { ok: false, status: 502, error: "GitHub PUT failed", detail: err };
  }
  return { ok: true };
}

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rl = checkRateLimit(req, {
    name: "analytics-event",
    limit: 60,
    windowMs: 60 * 1000,
    uid: "",
  });
  if (!rl.ok) return sendRateLimit(res, rl);

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return res.status(500).json({ error: "Missing GITHUB_TOKEN or GITHUB_REPO" });
  }

  let event = "page_view";
  let t = Date.now();
  let sid = null;
  let uid = null;
  let name = "";
  let ua = "";
  let coachArea = "";
  let changeType = "";
  let dayKey = "";
  let blockStart = "";
  let weekIndex = null;
  let modifiedKindsCount = null;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const allowedEvents = new Set([
      "find_workout",
      "page_view",
      "timer_use",
      "ai_generate_workout",
      "ai_workout_explain",
      "personal_coach_opened",
      "personal_coach_message",
      "personal_coach_block",
      "personal_coach_day_pre",
      "personal_coach_day_debrief",
      "personal_coach_week_pre",
      "personal_coach_workout_change_request",
      "personal_coach_workout_changed",
      "personal_coach_intake_complete",
      "personal_coach_legal_agree",
    ]);
    if (allowedEvents.has(body.event)) event = body.event;
    if (typeof body.t === "number") t = body.t;
    if (typeof body.sid === "string" && body.sid.length <= 64) sid = body.sid;
    if (typeof body.uid === "string" && body.uid.length <= 64) uid = body.uid;
    if (typeof body.name === "string" && body.name.length <= 40) name = body.name.trim().slice(0, 40);
    if (typeof body.ua === "string" && body.ua.length <= 512) ua = body.ua;
    if (typeof body.coachArea === "string" && body.coachArea.length <= 32) coachArea = body.coachArea;
    if (typeof body.changeType === "string" && body.changeType.length <= 64) changeType = body.changeType;
    if (typeof body.dayKey === "string" && body.dayKey.length <= 16) dayKey = body.dayKey;
    if (typeof body.blockStart === "string" && body.blockStart.length <= 16) blockStart = body.blockStart;
    if (typeof body.weekIndex === "number" && isFinite(body.weekIndex)) {
      weekIndex = Math.max(0, Math.min(99, Math.floor(body.weekIndex)));
    }
    if (typeof body.modifiedKindsCount === "number" && isFinite(body.modifiedKindsCount)) {
      modifiedKindsCount = Math.max(0, Math.min(50, Math.floor(body.modifiedKindsCount)));
    }
  } catch (e) {}

  const payload = { event: event, t: t, ua: ua };
  if (sid) payload.sid = sid;
  if (uid) payload.uid = uid;
  if (name) payload.name = name;
  if (coachArea) payload.coachArea = coachArea;
  if (changeType) payload.changeType = changeType;
  if (dayKey) payload.dayKey = dayKey;
  if (blockStart) payload.blockStart = blockStart;
  if (weekIndex !== null) payload.weekIndex = weekIndex;
  if (modifiedKindsCount !== null) payload.modifiedKindsCount = modifiedKindsCount;
  const newLine = JSON.stringify(payload) + "\n";

  try {
    const wrote = await appendGithubJsonl(
      token,
      repo,
      "data/analytics.jsonl",
      newLine,
      "analytics: " + event
    );
    if (!wrote.ok) {
      return res.status(wrote.status || 502).json({
        error: wrote.error || "GitHub write failed",
        detail: wrote.detail,
      });
    }

    /* Mirror Terms Agree into legal audit file (reliable path on iOS). */
    if (event === "personal_coach_legal_agree" && uid) {
      const acceptedAt = new Date(typeof t === "number" ? t : Date.now()).toISOString();
      const termsVersion = changeType || "v2.0-legal";
      const legalRow = {
        event: "legal_agree",
        userId: uid,
        termsAccepted: true,
        termsVersion: termsVersion,
        legalAcceptedVersion: 3,
        acceptedAt: acceptedAt,
        acceptedAtClient: acceptedAt,
        ip: clientIp(req),
        flags: {
          age18: true,
          aiResponsibility: true,
          termsPrivacy: true,
        },
        ua: ua,
        source: "analytics_mirror",
      };
      if (name) legalRow.displayName = name;
      await appendGithubJsonl(
        token,
        repo,
        "data/legal-agreements.jsonl",
        JSON.stringify(legalRow) + "\n",
        "legal: agree " + termsVersion + " · " + String(uid).slice(0, 24),
        {
          skipIf: function (row) {
            return (
              row &&
              row.event === "legal_agree" &&
              String(row.userId || "") === String(uid) &&
              String(row.termsVersion || "") === String(termsVersion)
            );
          },
        }
      );
      /* Best-effort — analytics already saved even if legal mirror fails. */
    }

    return res.status(204).end();
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e.message });
  }
};
