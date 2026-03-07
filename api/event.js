/**
 * Vercel serverless: receives analytics events and appends one line to data/analytics.jsonl in the repo via GitHub API.
 * Env: GITHUB_TOKEN (repo scope), GITHUB_REPO (e.g. owner/repo).
 * No monthly cost – Vercel free tier, storage = file in Git.
 */

const GITHUB_API = "https://api.github.com";

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

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return res.status(500).json({ error: "Missing GITHUB_TOKEN or GITHUB_REPO" });
  }

  let event = "page_view";
  let t = Date.now();
  let sid = null;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (body.event === "find_workout" || body.event === "page_view" || body.event === "timer_use") event = body.event;
    if (typeof body.t === "number") t = body.t;
    if (typeof body.sid === "string" && body.sid.length <= 64) sid = body.sid;
  } catch (e) {}

  const filePath = "data/analytics.jsonl";
  const payload = sid ? { event, t, sid } : { event, t };
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
