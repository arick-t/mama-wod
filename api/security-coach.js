/**
 * Security Coach
 * POST /api/security-coach
 *  {
 *    action?: "learn_context" | "recommend_hardening",
 *    messages?: [{ role, content }],
 *    appContext?: object|string,
 *    rulesContext?: object|string
 *  }
 * GET /api/security-coach -> status
 */
const SECURITY_SYSTEM = require("../lib/security-prompt.js");
const SECURITY_POLICY = require("../lib/security-policy.js");
const { checkRateLimit, sendRateLimit } = require("../lib/rate-limit.js");
const { scrubPiiText } = require("./sanitize-pii.js");
const { applyCors } = require("../lib/cors-allowlist.js");

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_KEY_ENV_NAMES = ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_API_KEY"];

function allowCors(req, res) {
  applyCors(req, res, {
    methods: "GET, POST, OPTIONS",
    headers: "Content-Type",
  });
}

function sanitizeSecret(raw) {
  let s = String(raw || "").trim();
  if (
    (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
    (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function resolveGeminiApiKey() {
  for (let i = 0; i < GEMINI_KEY_ENV_NAMES.length; i++) {
    const v = sanitizeSecret(process.env[GEMINI_KEY_ENV_NAMES[i]]);
    if (v) return v;
  }
  return "";
}

function resolveGroqApiKey() {
  return sanitizeSecret(process.env.GROQ_API_KEY);
}

function resolveProvider() {
  const gemini = resolveGeminiApiKey();
  if (gemini) return { id: "gemini", key: gemini };
  const groq = resolveGroqApiKey();
  if (groq) return { id: "groq", key: groq };
  return { id: "none", key: "" };
}

function resolveGeminiModelId() {
  const raw = sanitizeSecret(process.env.SECURITY_COACH_MODEL || process.env.PERSONAL_COACH_MODEL || "gemini-2.5-flash");
  const key = raw.toLowerCase();
  const aliases = {
    "gemini-1.5-flash": "gemini-2.5-flash",
    "gemini-1.5-flash-latest": "gemini-2.5-flash",
    "gemini-flash-latest": "gemini-2.5-flash",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-2.0-flash-001": "gemini-2.5-flash",
  };
  return aliases[key] || raw || "gemini-2.5-flash";
}

function resolveGroqModelId() {
  return sanitizeSecret(process.env.SECURITY_COACH_GROQ_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile");
}

function safeJsonString(value, maxLen) {
  const lim = typeof maxLen === "number" && maxLen > 0 ? maxLen : 32000;
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, lim);
  try {
    return JSON.stringify(value, null, 2).slice(0, lim);
  } catch (e) {
    return String(value).slice(0, lim);
  }
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-20)
    .map(function (m) {
      const role = String((m && m.role) || "user").toLowerCase();
      const content = scrubPiiText(String((m && m.content) || "").slice(0, 6000));
      if (!content) return null;
      return {
        role:
          role === "assistant" || role === "model"
            ? "assistant"
            : role === "system"
              ? "system"
              : "user",
        content: content,
      };
    })
    .filter(Boolean);
}

function actionInstruction(action) {
  if (action === "recommend_hardening") {
    return [
      "TASK MODE: recommend_hardening.",
      "Return a prioritized hardening plan.",
      "For each recommendation include:",
      "- severity (critical/high/medium/low)",
      "- risk",
      "- evidence (path/endpoint/context reference)",
      "- remediation steps",
      "- verification test",
      "- rollout safety note",
      "Use concise markdown table or bullet list.",
    ].join("\n");
  }
  return [
    "TASK MODE: learn_context.",
    "First build a security understanding of the app and rules.",
    "Return:",
    "- trust boundaries",
    "- data classes",
    "- attack surfaces",
    "- current controls",
    "- gaps or unknowns",
    "Do not recommend broad fixes yet unless critical and obvious.",
  ].join("\n");
}

function buildUserPayload(action, appContext, rulesContext) {
  return [
    actionInstruction(action),
    "",
    "APP CONTEXT:",
    safeJsonString(appContext, 52000) || "(missing)",
    "",
    "RULES / POLICY CONTEXT:",
    safeJsonString(rulesContext, 26000) || "(missing)",
  ].join("\n");
}

async function askGemini(systemText, chatMessages, key, modelId) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(modelId) +
    ":generateContent?key=" +
    encodeURIComponent(key);
  const payload = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: chatMessages.map(function (m) {
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      };
    }),
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("Gemini error " + r.status + ": " + String(t || "").slice(0, 500));
  }
  const j = await r.json();
  try {
    const { recordGeminiResponseSpend } = require("../scripts/lib/admin/admin-credit-estimate");
    await recordGeminiResponseSpend(modelId, j, "security-coach");
  } catch (eSpend) {}
  const parts = (((j || {}).candidates || [])[0] || {}).content || {};
  const out = Array.isArray(parts.parts)
    ? parts.parts
        .map(function (p) {
          return String((p && p.text) || "");
        })
        .join("\n")
        .trim()
    : "";
  if (!out) throw new Error("Gemini empty response");
  return out;
}

async function askGroq(systemText, chatMessages, key, modelId) {
  const payload = {
    model: modelId,
    temperature: 0.2,
    messages: [{ role: "system", content: systemText }].concat(
      chatMessages.map(function (m) {
        return { role: m.role, content: m.content };
      })
    ),
  };
  const r = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("Groq error " + r.status + ": " + String(t || "").slice(0, 500));
  }
  const j = await r.json();
  const out = (((j || {}).choices || [])[0] || {}).message || {};
  const text = String(out.content || "").trim();
  if (!text) throw new Error("Groq empty response");
  return text;
}

module.exports = async function handler(req, res) {
  allowCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET" || req.method === "HEAD") {
    const provider = resolveProvider();
    return res.status(200).json({
      ok: true,
      service: "security-coach",
      provider: provider.id,
      actions: ["learn_context", "recommend_hardening"],
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rl = checkRateLimit(req, { name: "security-coach", limit: 30, windowMs: 60 * 1000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const action = String(body.action || "learn_context").toLowerCase();
  if (action !== "learn_context" && action !== "recommend_hardening") {
    return res.status(400).json({ error: "Invalid action. Use learn_context or recommend_hardening." });
  }

  const provider = resolveProvider();
  if (provider.id === "none") {
    return res.status(500).json({
      error: "No AI provider configured",
      neededEnv: ["GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY", "or GROQ_API_KEY"],
    });
  }

  const appContext = body.appContext || {};
  const rulesContext = body.rulesContext || {};
  const messages = normalizeMessages(body.messages);
  const systemText = [SECURITY_SYSTEM, "", SECURITY_POLICY].join("\n\n");
  const userPayload = buildUserPayload(action, appContext, rulesContext);
  const finalMessages = messages.concat([{ role: "user", content: userPayload }]);

  try {
    let text = "";
    let usedProvider = provider.id;
    let usedModel = "";

    if (provider.id === "gemini") {
      usedModel = resolveGeminiModelId();
      text = await askGemini(systemText, finalMessages, provider.key, usedModel);
    } else {
      usedModel = resolveGroqModelId();
      text = await askGroq(systemText, finalMessages, provider.key, usedModel);
    }

    return res.status(200).json({
      ok: true,
      service: "security-coach",
      action: action,
      provider: usedProvider,
      model: usedModel,
      text: scrubPiiText(text),
    });
  } catch (e) {
    return res.status(502).json({
      error: "Security coach generation failed",
      detail: String(e.message || e),
    });
  }
};
