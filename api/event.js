/**
 * Vercel serverless: receives analytics events and appends one line to data/analytics.jsonl in the repo via GitHub API.
 * Env: GITHUB_TOKEN (repo scope), GITHUB_REPO (e.g. owner/repo).
 * No monthly cost – Vercel free tier, storage = file in Git.
 */

const GITHUB_API = "https://api.github.com";
const { checkRateLimit, sendRateLimit } = require("./rate-limit.js");

function allowCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

  const filePath = "data/analytics.jsonl";
  const payload = { event, t, ua };
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
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  try {
    const getRes = await fetch(`${GITHUB_API}/repos/${repo}/contents/${filePath}`, { headers });
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
    const body = {
      message: "analytics: " + event,
      content: Buffer.from(content, "utf8").toString("base64"),
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(`${GITHUB_API}/repos/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(502).json({ error: "GitHub PUT failed", detail: err });
    }
    return res.status(204).end();
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e.message });
  }
};
