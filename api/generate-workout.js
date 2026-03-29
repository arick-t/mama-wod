/**
 * Vercel serverless: AI workout generation. API keys only on server.
 *
 * Provider (priority): GROQ_API_KEY → Groq Chat Completions (Llama, fast). Else Gemini keys → Google Generative Language.
 * Groq: GROQ_API_KEY; optional GROQ_MODEL (default llama-3.3-70b-versatile).
 * Gemini: GEMINI_API_KEY | GOOGLE_GENERATIVE_AI_API_KEY | GOOGLE_AI_API_KEY; optional GEMINI_MODEL, GEMINI_FETCH_*.
 *
 * POST action generate: JSON { ok, text } or stream: true → SSE (OpenAI-style for Groq, Gemini SSE if on Gemini).
 */

function allowCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const GEMINI_KEY_ENV_NAMES = ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_API_KEY"];

function resolveGeminiApiKey() {
  for (let i = 0; i < GEMINI_KEY_ENV_NAMES.length; i++) {
    const v = String(process.env[GEMINI_KEY_ENV_NAMES[i]] || "").trim();
    if (v) return v;
  }
  return "";
}

function geminiKeySourceEnvName() {
  for (let i = 0; i < GEMINI_KEY_ENV_NAMES.length; i++) {
    const name = GEMINI_KEY_ENV_NAMES[i];
    if (String(process.env[name] || "").trim()) return name;
  }
  return null;
}

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

function resolveGroqApiKey() {
  return String(process.env.GROQ_API_KEY || "").trim();
}

function resolveGroqModelId() {
  const raw = (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
  return raw || "llama-3.3-70b-versatile";
}

/** Prefer Groq when configured; otherwise Gemini. */
function resolveProvider() {
  const groq = resolveGroqApiKey();
  if (groq) return { id: "groq", key: groq };
  const gemini = resolveGeminiApiKey();
  if (gemini) return { id: "gemini", key: gemini };
  return { id: "none", key: "" };
}

/**
 * v1beta rejects legacy bare IDs (e.g. gemini-1.5-flash). Remap to names that ListModels returns for generateContent.
 * @see https://ai.google.dev/api/rest/v1beta/models
 */
function resolveGeminiModelId() {
  const raw = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const key = raw.toLowerCase();
  const aliases = {
    "gemini-1.5-flash": "gemini-flash-latest",
    "gemini-1.5-flash-latest": "gemini-flash-latest",
  };
  return aliases[key] || raw;
}

/** No secret values — only whether known env names are non-empty (for Vercel troubleshooting). */
function buildGeminiEnvDebug() {
  const found = [];
  for (let i = 0; i < GEMINI_KEY_ENV_NAMES.length; i++) {
    const n = GEMINI_KEY_ENV_NAMES[i];
    if (String(process.env[n] || "").trim()) found.push(n);
  }
  return {
    onVercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    geminiKeyEnvNamesFound: found,
    groqKeyConfigured: !!resolveGroqApiKey(),
    /** Booleans only — see if other project env vars reach this function at all. */
    githubTokenConfigured: !!String(process.env.GITHUB_TOKEN || "").trim(),
    githubRepoConfigured: !!String(process.env.GITHUB_REPO || "").trim(),
  };
}

const SYSTEM_INSTRUCTION_CORE = `Head coach for group-class GPP. Output ONLY the workout—concise, technical, headers OK (Warm-up / Strength / Metcon etc.). Use ONLY listed equipment; respect time; UNLIMITED = full session. Multi-athlete: partner/team formats when fit. Original work: no verbatim Hero/Open/benchmarks or long copied text; AMRAP/chipper-style structures OK. Honor user notes. If a WAREHOUSE NAMES block appears, use for modality/time hints only—write a fresh workout. No greetings or filler. Summarize public fitness knowledge in your own words—no long excerpts.

Completeness: every main piece (especially METCON) must list ALL movements with reps, distance, or load—not a time cap plus a single line (e.g. AMRAP needs a full round written out). Prefer short exercise names and tight formatting over leaving work implied.`;

const L1_TRAINING_GUIDE_ALIGNMENT = `L1-style judgment: mechanics/scaling first, safety under fatigue, broad GPP unless notes say otherwise; quality → consistency → intensity.`;

const OPEN_HERO_PATTERN_RULES = `Open/Hero *patterns* only (scoreable time/reps, density, chippers)—never full replicas of named events.`;

const COMPETITION_ATHLETE_BIAS = `Competitor level: clear time cap or AMRAP, simple scoring, optional short skill primer if time/equipment allow; terse programming only.`;

function isCompetitionLevel(p) {
  if (!p || typeof p !== "object") return false;
  const l = String(p.level || "").toLowerCase();
  return l === "competitor" || l === "amateur_competitor";
}

function buildDefaultCoachSystemInstruction(extendedProfile, includeWarehouseDigest) {
  const parts = [SYSTEM_INSTRUCTION_CORE, L1_TRAINING_GUIDE_ALIGNMENT];
  if (includeWarehouseDigest) parts.push(OPEN_HERO_PATTERN_RULES);
  if (isCompetitionLevel(extendedProfile)) parts.push(COMPETITION_ATHLETE_BIAS);
  return parts.join("\n");
}

function normalizeSessionParts(body) {
  const sp = body && body.sessionParts;
  if (!sp || typeof sp !== "object" || Array.isArray(sp)) {
    return { includeWarmup: false, includeStrength: false, includeWeightlifting: false };
  }
  return {
    includeWarmup: !!sp.includeWarmup,
    includeStrength: !!sp.includeStrength,
    includeWeightlifting: !!sp.includeWeightlifting,
  };
}

/**
 * User-selected session pieces: default metcon-only; optional warm-up, strength, weightlifting before metcon.
 */
function buildSessionStructureBlock(parts, timeMinutes, unlimited) {
  const none = !parts.includeWarmup && !parts.includeStrength && !parts.includeWeightlifting;
  const lines = [];
  if (none) {
    lines.push(
      "STRUCTURE: Metcon/conditioning ONLY unless user notes explicitly ask for warm-up/strength/accessory."
    );
    return lines.join("\n");
  }
  const seq = [];
  if (parts.includeWarmup) seq.push("WARM-UP");
  if (parts.includeStrength) seq.push("STRENGTH");
  if (parts.includeWeightlifting) seq.push("WEIGHTLIFTING");
  seq.push("METCON");
  lines.push(
    `STRUCTURE: Sections in order ${seq.join(" → ")}.`,
    unlimited
      ? "TIME UNLIMITED: meaningful work per section; metcon = main stimulus."
      : `~${timeMinutes} min total: split time; protect metcon quality.`
  );
  if (parts.includeWarmup) {
    lines.push("WARM-UP: light prep—no pre-fatigue for metcon.");
  }
  if (parts.includeStrength) {
    lines.push("STRENGTH: basic heavy work before metcon; complement metcon stress, moderate vol.");
  }
  if (parts.includeWeightlifting) {
    lines.push("WEIGHTLIFTING: Oly/primer before metcon if gear allows; moderate vol.");
  }
  if (parts.includeStrength && parts.includeWeightlifting) {
    lines.push("Order: Strength → Weightlifting → Metcon (separate headers).");
  }
  return lines.join(" ");
}

const GENERIC_SYSTEM_INSTRUCTION = `Workout programmer—output program text only, concise. WAREHOUSE INDEX = inspiration only; original work.`;

const ATHLETE_PROFILE_RULES = `Use ATHLETE PROFILE in user message; blank fields = no invention. Strict health limits. Programming only.`;

function buildAthleteProfilePrompt(p) {
  if (!p || typeof p !== "object") return "";
  const level = String(p.level || "").slice(0, 64);
  const years = String(p.yearsTraining || "").slice(0, 64);
  const bw = String(p.bodyweight || "").slice(0, 64);
  const sex = String(p.sex || "").slice(0, 64);
  const age = String(p.age || "").slice(0, 32);
  const health = String(p.healthLimits || "").slice(0, 1200);
  const athletesN = Math.min(20, Math.max(1, parseInt(p.athletes, 10) || 1));
  const has = level || years || bw || sex || age || health || athletesN >= 1;
  if (!has) return "";
  return (
    `ATHLETE PROFILE (tailor the session; do not echo as Q&A):\n` +
    `- Level: ${level || "—"}\n` +
    `- Athletes / class size: ${athletesN} (use partner or team formats when > 1)\n` +
    `- Years in domain: ${years || "—"}\n` +
    `- Bodyweight: ${bw || "—"}\n` +
    `- Sex / gender: ${sex || "—"}\n` +
    `- Age: ${age || "—"}\n` +
    `- Health / limitations: ${health || "—"}\n`
  );
}

function buildUserPrompt(equipment, timeMinutes, unlimited, athletes, userNotes) {
  const eqList = Array.isArray(equipment) && equipment.length ? equipment.join(", ") : "BODYWEIGHT ONLY (assume floor space only)";
  const timeLine = unlimited
    ? "TIME: UNLIMITED — full session, stay concise."
    : `TIME: ~${timeMinutes} min main work.`;
  const athLine = athletes > 1 ? `ATHLETES: ${athletes} — use partner/team formats when appropriate.` : "ATHLETES: 1 (solo).";
  const notesLine = (userNotes && String(userNotes).trim())
    ? `USER NOTES / GOALS (honor these):\n${String(userNotes).trim()}`
    : "USER NOTES: (none) — choose an optimal session for the equipment and time.";
  return `AVAILABLE EQUIPMENT (strict — use only this):\n${eqList}\n\n${timeLine}\n${athLine}\n\n${notesLine}\n\nProduce the full workout now (complete exercise list per section; do not omit movements).`;
}

function buildFlexibleUserPrompt(equipment, timeMinutes, unlimited, athletes, userNotes) {
  const eqList = Array.isArray(equipment) && equipment.length ? equipment.join(", ") : "none specified";
  const notes = String(userNotes || "").trim();
  const fallback = "Create one effective workout session.";
  return `USER REQUEST:\n${notes || fallback}\n\nCONTEXT:\n- Equipment: ${eqList}\n- Time: ${unlimited ? "UNLIMITED" : `${timeMinutes} minutes`}\n- Athletes: ${athletes}\n\nIf user request conflicts with context, prioritize user request.`;
}

const EXPLAIN_SYSTEM = `Movement coach: list main movements, one cue per line, then per movement: YouTube: https://www.youtube.com/results?search_query=NAME+TECHNIQUE (+ for spaces). No extra prose.`;

/**
 * Vercel may expose POST JSON as object, string, Buffer, or leave body unset (stream).
 * Never assume req.body is already a plain object.
 */
async function parseRequestJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    const s = req.body.toString("utf8");
    try {
      return s ? JSON.parse(s) : {};
    } catch (e) {
      throw new Error("Invalid JSON body");
    }
  }
  if (typeof req.body === "string") {
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch (e) {
      throw new Error("Invalid JSON body");
    }
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    throw new Error("Invalid JSON body");
  }
}

async function parseGeminiJsonResponse(r) {
  const raw = await r.text();
  if (!raw || !raw.trim()) {
    return { ok: false, status: r.status, data: null, raw: "", parseError: "Empty response body from Gemini" };
  }
  try {
    return { ok: r.ok, status: r.status, data: JSON.parse(raw), raw, parseError: null };
  } catch (e) {
    return { ok: false, status: r.status, data: null, raw, parseError: e.message };
  }
}

function resolveGeminiFetchBudget() {
  const capParsed = parseInt(process.env.GEMINI_FETCH_BUDGET_CAP || "", 10);
  /** Hobby ~10s wall: tight cap leaves ms for cold start + JSON; first request may still need client retries. */
  const defaultCap = 9850;
  const cap = Number.isFinite(capParsed) && capParsed >= 2500 ? Math.min(120000, capParsed) : defaultCap;
  const rawParsed = parseInt(process.env.GEMINI_FETCH_BUDGET_MS || "", 10);
  const defaultMs = 9650;
  const want = Number.isFinite(rawParsed) && rawParsed >= 2500 ? rawParsed : defaultMs;
  return { ms: Math.min(cap, want), cap };
}

/** Honours GEMINI_FETCH_BUDGET_MS / GEMINI_FETCH_BUDGET_CAP (see file header). */
async function fetchGeminiGenerateContent(url, geminiBody) {
  const { ms } = resolveGeminiFetchBudget();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function groqChatPayloadFromGeminiShape(geminiBody, stream) {
  let systemText = "";
  if (geminiBody.systemInstruction && Array.isArray(geminiBody.systemInstruction.parts)) {
    systemText = geminiBody.systemInstruction.parts
      .map((p) => (p && p.text ? String(p.text) : ""))
      .join("\n")
      .trim();
  }
  let userText = "";
  if (geminiBody.contents && geminiBody.contents[0] && Array.isArray(geminiBody.contents[0].parts)) {
    userText = geminiBody.contents[0].parts
      .map((p) => (p && p.text ? String(p.text) : ""))
      .join("");
  }
  const gc = geminiBody.generationConfig || {};
  const payload = {
    model: resolveGroqModelId(),
    messages: [
      { role: "system", content: systemText || "You are a concise fitness programming assistant." },
      { role: "user", content: userText },
    ],
    temperature: typeof gc.temperature === "number" ? gc.temperature : 0.65,
    max_tokens: typeof gc.maxOutputTokens === "number" ? gc.maxOutputTokens : 1536,
  };
  if (stream) payload.stream = true;
  return payload;
}

async function fetchGroqChatCompletions(apiKey, groqBody) {
  const { ms } = resolveGeminiFetchBudget();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groqBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractGroqAssistantText(data) {
  const ch = data && data.choices && data.choices[0];
  if (!ch) return "";
  const msg = ch.message;
  if (msg && msg.content != null) return String(msg.content);
  return "";
}

function groqFinishTruncated(data) {
  const ch = data && data.choices && data.choices[0];
  const fr = ch && ch.finish_reason ? String(ch.finish_reason) : "";
  return fr === "length";
}

function extractOpenAiStreamDelta(obj) {
  const ch = obj && obj.choices && obj.choices[0];
  if (!ch || !ch.delta) return "";
  const c = ch.delta.content;
  return c != null ? String(c) : "";
}

function openAiStreamFinishReason(obj) {
  const ch = obj && obj.choices && obj.choices[0];
  return ch && ch.finish_reason ? String(ch.finish_reason) : "";
}

async function pipeOpenAiSseToClient(res, upstream) {
  if (!upstream.body) {
    res.write(`data: ${JSON.stringify({ error: "No stream body from provider" })}\n\n`);
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let lineBuf = "";
  let full = "";
  let lastFinish = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    lineBuf += dec.decode(value, { stream: true });
    for (;;) {
      const nl = lineBuf.indexOf("\n");
      if (nl === -1) break;
      let line = lineBuf.slice(0, nl).replace(/\r$/, "");
      lineBuf = lineBuf.slice(nl + 1);
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      let obj;
      try {
        obj = JSON.parse(raw);
      } catch {
        continue;
      }
      if (obj.error) {
        const msg = obj.error.message ? String(obj.error.message) : JSON.stringify(obj.error);
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        continue;
      }
      const piece = extractOpenAiStreamDelta(obj);
      if (piece) {
        full += piece;
        res.write(`data: ${JSON.stringify({ delta: piece })}\n\n`);
      }
      const fr = openAiStreamFinishReason(obj);
      if (fr) lastFinish = fr;
    }
  }
  const truncated = lastFinish === "length";
  res.write(`data: ${JSON.stringify({ done: true, text: full, truncated })}\n\n`);
  res.end();
}

async function handleGenerateStreamGroq(res, apiKey, geminiBody) {
  const groqPayload = groqChatPayloadFromGeminiShape(geminiBody, true);
  let r;
  try {
    r = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groqPayload),
    });
  } catch (e) {
    return res.status(502).json({ error: "Groq stream fetch failed", detail: e.message });
  }
  if (!r.ok) {
    const t = await r.text();
    return res.status(502).json({
      error: "Groq stream HTTP error",
      detail: (t || "").slice(0, 900),
    });
  }
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    await pipeOpenAiSseToClient(res, r);
  } catch (e) {
    if (!res.headersSent) {
      return res.status(500).json({ error: "Stream failed", detail: e.message });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: e.message || "stream error" })}\n\n`);
    } catch (_) {}
    try {
      res.end();
    } catch (_) {}
  }
}

function extractGeminiTextFromData(data) {
  const c = data && data.candidates && data.candidates[0];
  if (!c || !c.content || !c.content.parts) return "";
  let s = "";
  for (let i = 0; i < c.content.parts.length; i++) {
    const p = c.content.parts[i];
    if (p && p.text) s += String(p.text);
  }
  return s;
}

function buildWorkoutGeminiBody(body) {
  const equipment = Array.isArray(body.equipment) ? body.equipment.map((x) => String(x).slice(0, 64)) : [];
  const unlimited = !!body.unlimited;
  const timeMinutes = unlimited ? 999 : Math.min(300, Math.max(1, parseInt(body.timeMinutes, 10) || 20));
  const athletes = Math.min(20, Math.max(1, parseInt(body.athletes, 10) || 1));
  const userNotes = String(body.userNotes || "").slice(0, 1600);
  const useDefaultSettings = body.useDefaultSettings !== false;
  let extendedProfile = body.extendedProfile;
  if (!extendedProfile || typeof extendedProfile !== "object" || Array.isArray(extendedProfile)) {
    extendedProfile = null;
  }
  const profileBlock = extendedProfile ? buildAthleteProfilePrompt(extendedProfile) : "";
  const warehouseDigest = String(body.warehouseDigest || "").trim().slice(0, 4000);
  const hasWarehouseDigest = warehouseDigest.length > 0;

  let userText = useDefaultSettings
    ? buildUserPrompt(equipment, timeMinutes, unlimited, athletes, userNotes)
    : buildFlexibleUserPrompt(equipment, timeMinutes, unlimited, athletes, userNotes);
  if (profileBlock) {
    userText = `${userText}\n\n${profileBlock}`;
  }
  if (hasWarehouseDigest) {
    userText = `${userText}\n\nWAREHOUSE NAMES (patterns only; original work):\n${warehouseDigest}`;
  }

  const sessionParts = normalizeSessionParts(body);
  userText = `${userText}\n\n${buildSessionStructureBlock(sessionParts, timeMinutes, unlimited)}`;

  let systemText = useDefaultSettings
    ? buildDefaultCoachSystemInstruction(extendedProfile, hasWarehouseDigest)
    : GENERIC_SYSTEM_INSTRUCTION;
  if (profileBlock) {
    systemText = `${systemText}\n\n${ATHLETE_PROFILE_RULES}`;
  }

  const geminiBody = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 1536,
    },
  };
  return { geminiBody };
}

async function pipeGeminiSseToClient(res, upstream) {
  if (!upstream.body) {
    res.write(`data: ${JSON.stringify({ error: "No stream body from Gemini" })}\n\n`);
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let lineBuf = "";
  let prevFull = "";
  let lastFinishReason = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    lineBuf += dec.decode(value, { stream: true });
    for (;;) {
      const nl = lineBuf.indexOf("\n");
      if (nl === -1) break;
      let line = lineBuf.slice(0, nl).replace(/\r$/, "");
      lineBuf = lineBuf.slice(nl + 1);
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      let obj;
      try {
        obj = JSON.parse(raw);
      } catch {
        continue;
      }
      if (obj.error) {
        const msg = obj.error.message ? String(obj.error.message) : JSON.stringify(obj.error);
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        continue;
      }
      const c0 = obj.candidates && obj.candidates[0];
      if (c0 && c0.finishReason) lastFinishReason = String(c0.finishReason);
      const full = extractGeminiTextFromData(obj);
      if (full.length > prevFull.length) {
        const delta = full.slice(prevFull.length);
        prevFull = full;
        if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
  }
  const truncated = lastFinishReason === "MAX_TOKENS";
  res.write(`data: ${JSON.stringify({ done: true, text: prevFull, truncated })}\n\n`);
  res.end();
}

async function handleGenerateStream(res, key, model, geminiBody) {
  const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  let r;
  try {
    r = await fetch(streamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    return res.status(502).json({ error: "Gemini stream fetch failed", detail: e.message });
  }
  if (!r.ok) {
    const t = await r.text();
    return res.status(502).json({
      error: "Gemini stream HTTP error",
      detail: (t || "").slice(0, 900),
    });
  }
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    await pipeGeminiSseToClient(res, r);
  } catch (e) {
    if (!res.headersSent) {
      return res.status(500).json({ error: "Stream failed", detail: e.message });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: e.message || "stream error" })}\n\n`);
    } catch (_) {}
    try {
      res.end();
    } catch (_) {}
  }
}

module.exports = async function handler(req, res) {
  try {
    allowCors(res);
    const method = String(req.method || "")
      .trim()
      .toUpperCase();

    if (method === "OPTIONS") return res.status(204).end();

    if (method === "GET" || method === "HEAD") {
      const prov = resolveProvider();
      const configured = prov.id !== "none";
      const payload = {
        ok: true,
        service: "generate-workout",
        provider: prov.id,
        groqKeyConfigured: !!resolveGroqApiKey(),
        groqModelEnv: (process.env.GROQ_MODEL || "").trim() || null,
        groqModelResolved: prov.id === "groq" ? resolveGroqModelId() : null,
        geminiKeyConfigured: !!resolveGeminiApiKey(),
        geminiKeySourceEnv: resolveGeminiApiKey() ? geminiKeySourceEnvName() : null,
        modelEnv: (process.env.GEMINI_MODEL || "").trim() || null,
        modelResolved: resolveGeminiModelId(),
        geminiFetchBudgetMs: resolveGeminiFetchBudget().ms,
        geminiFetchBudgetCap: resolveGeminiFetchBudget().cap,
        runningOnVercel: !!process.env.VERCEL,
        debug: buildGeminiEnvDebug(),
        hint: configured
          ? `Active provider: ${prov.id}. POST JSON action generate|explain.`
          : "Set GROQ_API_KEY (preferred) or GEMINI_API_KEY for Production, Redeploy; repo root must contain /api.",
        features: {
          streamGenerate: true,
          asyncJobQueue: false,
        },
      };
      if (method === "HEAD") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.status(200).end();
      }
      return res.status(200).json(payload);
    }

    if (method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
        allow: "GET, HEAD, POST, OPTIONS",
        seenMethod: method || "(empty)",
      });
    }

    const prov = resolveProvider();
    if (prov.id === "none") {
      return res.status(503).json({
        error: "Server missing AI API key at runtime.",
        hint: "Set GROQ_API_KEY (Groq / Llama, recommended) or GEMINI_API_KEY for Production, then Redeploy.",
        debug: buildGeminiEnvDebug(),
      });
    }

    const model = resolveGeminiModelId();
    const geminiKeyOnly = resolveGeminiApiKey();
    const geminiUrl =
      geminiKeyOnly &&
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        geminiKeyOnly
      )}`;

    let body;
    try {
      body = await parseRequestJson(req);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const action = body.action === "explain" ? "explain" : "generate";

    if (action === "generate") {
      const { geminiBody } = buildWorkoutGeminiBody(body);

      if (body.stream === true) {
        if (prov.id === "groq") return handleGenerateStreamGroq(res, prov.key, geminiBody);
        if (!geminiKeyOnly) {
          return res.status(503).json({ error: "Gemini streaming unavailable (no Gemini API key)." });
        }
        return handleGenerateStream(res, geminiKeyOnly, model, geminiBody);
      }

      if (prov.id === "groq") {
        const groqPayload = groqChatPayloadFromGeminiShape(geminiBody, false);
        let r;
        try {
          r = await fetchGroqChatCompletions(prov.key, groqPayload);
        } catch (e) {
          if (e && e.name === "AbortError") {
            const b = resolveGeminiFetchBudget();
            return res.status(504).json({
              error: "Groq request hit the server time budget.",
              hint: `Abort after ${b.ms}ms. Retry or raise GEMINI_FETCH_BUDGET_* (shared fetch budget name) / Vercel limits.`,
            });
          }
          throw e;
        }
        const parsed = await parseGeminiJsonResponse(r);
        if (parsed.parseError) {
          return res.status(502).json({
            error: "Groq response not JSON",
            detail: parsed.parseError,
            snippet: (parsed.raw || "").slice(0, 800),
          });
        }
        const data = parsed.data;
        if (!r.ok) {
          const msg = data && data.error && data.error.message ? data.error.message : JSON.stringify(data || {});
          return res.status(502).json({ error: "Groq request failed", detail: msg });
        }
        const text = extractGroqAssistantText(data);
        if (!text) {
          return res.status(502).json({ error: "Empty Groq response", detail: data });
        }
        const truncated = groqFinishTruncated(data);
        const out = { ok: true, text };
        if (truncated) out.truncated = true;
        return res.status(200).json(out);
      }

      if (!geminiUrl) {
        return res.status(503).json({ error: "Gemini URL unavailable (no Gemini API key)." });
      }
      let r;
      try {
        r = await fetchGeminiGenerateContent(geminiUrl, geminiBody);
      } catch (e) {
        if (e && e.name === "AbortError") {
          const b = resolveGeminiFetchBudget();
          return res.status(504).json({
            error:
              "Gemini is still working, but the server stopped waiting (time budget)—newer Flash models often need more seconds.",
            hint: `This route aborts the fetch after ${b.ms}ms (cap ${b.cap}ms). On Vercel Free the whole function still has ~10s. Retry; shorten notes/tags; or use Pro + longer maxDuration/budget. See GET this URL for budget fields.`,
          });
        }
        throw e;
      }

      const parsed = await parseGeminiJsonResponse(r);
      if (parsed.parseError) {
        return res.status(502).json({
          error: "Gemini response not JSON",
          detail: parsed.parseError,
          snippet: (parsed.raw || "").slice(0, 800),
        });
      }
      const data = parsed.data;
      if (!r.ok) {
        const msg = data && data.error && data.error.message ? data.error.message : JSON.stringify(data || {});
        return res.status(502).json({ error: "Gemini request failed", detail: msg });
      }

      const cand0 = data.candidates && data.candidates[0] ? data.candidates[0] : null;
      const text = extractGeminiTextFromData(data);

      if (!text) {
        return res.status(502).json({ error: "Empty model response", detail: data });
      }

      const finishReason = cand0 && cand0.finishReason ? String(cand0.finishReason) : "";
      const truncated = finishReason === "MAX_TOKENS";
      const out = { ok: true, text };
      if (truncated) out.truncated = true;
      return res.status(200).json(out);
    }

    /* explain */
    const workoutText = String(body.workoutText || "").slice(0, 6000);
    if (!workoutText.trim()) {
      return res.status(400).json({ error: "workoutText required" });
    }

    const geminiBody = {
      systemInstruction: { parts: [{ text: EXPLAIN_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Workout:\n${workoutText}` }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 640,
      },
    };

    let r;
    try {
      if (prov.id === "groq") {
        r = await fetchGroqChatCompletions(prov.key, groqChatPayloadFromGeminiShape(geminiBody, false));
      } else {
        if (!geminiUrl) {
          return res.status(503).json({ error: "No Gemini API key for explain." });
        }
        r = await fetchGeminiGenerateContent(geminiUrl, geminiBody);
      }
    } catch (e) {
      if (e && e.name === "AbortError") {
        const b = resolveGeminiFetchBudget();
        return res.status(504).json({
          error: `Explain: server time budget reached before ${prov.id} finished.`,
          hint: `Fetch budget ${b.ms}ms / cap ${b.cap}ms. Retry with shorter workout text or raise budgets on Pro.`,
        });
      }
      throw e;
    }

    const parsed = await parseGeminiJsonResponse(r);
    if (parsed.parseError) {
      return res.status(502).json({
        error: `${prov.id} response not JSON`,
        detail: parsed.parseError,
        snippet: (parsed.raw || "").slice(0, 800),
      });
    }
    const data = parsed.data;
    if (!r.ok) {
      const msg = data && data.error && data.error.message ? data.error.message : JSON.stringify(data || {});
      return res.status(502).json({ error: `${prov.id} explain failed`, detail: msg });
    }

    const text = prov.id === "groq" ? extractGroqAssistantText(data) : extractGeminiTextFromData(data);

    return res.status(200).json({ ok: true, text: text || "(no text)" });
  } catch (e) {
    console.error("[generate-workout]", e);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error", message: e.message });
    }
  }
};

/** Hobby: max 10s default; Pro: up to 300s — avoid empty cutoffs on slow Gemini */
module.exports.config = {
  maxDuration: 60,
};
