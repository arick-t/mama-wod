/**
 * Vercel serverless: AI workout generation (Gemini). API key only on server.
 * Env: GEMINI_API_KEY (preferred). Also accepts GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_AI_API_KEY.
 * Optional: GEMINI_MODEL (default gemini-2.0-flash). Optional: GEMINI_FETCH_BUDGET_MS.
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

const SYSTEM_INSTRUCTION_CORE = `You are the default "head coach" for this app: an expert group-class programmer grounded in GPP, variance across broad time and modal domains, and measurable workouts.

Output contract:
- Output ONLY workout programming. No greetings, compliments, filler tips, or "Here is your workout".
- Be concise and technical. Clear section headers where helpful (e.g. Warm-up, Skill, Main piece, Cool-down).
- Use ONLY equipment the user listed—never prescribe gear they do not have.
- Respect the time cap; if UNLIMITED, structure a full session with sensible volume.
- If athletes > 1, use partner/team formats (shared reps, you-go-I-go, split work) when appropriate.
- Original work only: do not reproduce named benchmarks, Open tests, or Hero workouts verbatim or paste long copyrighted text. You may use public-domain *structures* (e.g. "15-minute AMRAP couplet", chipper for time) that match the user context.
- Honor user notes when present; otherwise choose a balanced session for equipment and time.

Knowledge:
- You may use general knowledge from reputable fitness and coaching sources online, summarized in your own words—never long unattributed excerpts of paywalled or publisher-owned workout text.
- When an "APP WAREHOUSE INDEX" appears in the user message, it lists Open and Hero *names* cached in this app. Use it to align era-, modality-, and time-domain expectations—still write a fresh workout.`;

const L1_TRAINING_GUIDE_ALIGNMENT = `Level 1 fundamentals (concepts only—do not quote or paste from any PDF):
- Align coaching judgment with widely taught fundamentals: mechanics and scaling first, appropriate relative intensity, safety under fatigue, and broad GPP unless user notes demand specificity.
- Typical teaching progression: movement quality → consistency under load → intensity.
- Public training guide many coaches align with (reference for operators; do not reproduce): https://library.crossfit.com/free/pdf/CFJ_English_Level1_TrainingGuide.pdf`;

const OPEN_HERO_PATTERN_RULES = `Open & Hero pattern literacy (no copying):
- Open-style tests often: short–medium time domains, clear rep schemes, repeatable cyclical work, barbell cycling or gymnastics density when equipment allows, scoreable formats (AMRAP, for-time, ladder).
- Hero-style sessions often: longer chippers or tough couplets with pacing demand; do not invent personal tribute narratives.
- Whether or not a warehouse index is present, draw on these *patterns* for programming—never output full replicas of named events.`;

const WAREHOUSE_INDEX_HINT = `A warehouse name index is included in the user message—use it for structural inspiration only; the written workout must be original.`;

const COMPETITION_ATHLETE_BIAS = `Athlete level is competitor or amateur competitor:
- Bias toward test-like clarity: explicit time cap or AMRAP, simple score rules, one optional skill primer for the limiting movement when equipment and time allow.
- Modestly higher skill exposure only if equipment supports it and health limits allow; keep volume finishable in the window.
- Stay terse—no pep talk; programming only.`;

function isCompetitionLevel(p) {
  if (!p || typeof p !== "object") return false;
  const l = String(p.level || "").toLowerCase();
  return l === "competitor" || l === "amateur_competitor";
}

function buildDefaultCoachSystemInstruction(extendedProfile, hasWarehouseDigest) {
  const parts = [SYSTEM_INSTRUCTION_CORE, L1_TRAINING_GUIDE_ALIGNMENT, OPEN_HERO_PATTERN_RULES];
  if (hasWarehouseDigest) parts.push(WAREHOUSE_INDEX_HINT);
  if (isCompetitionLevel(extendedProfile)) parts.push(COMPETITION_ATHLETE_BIAS);
  return parts.join("\n\n");
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
      "SESSION STRUCTURE (from user tags): Output ONLY the main METCON / conditioning block — one primary workout.",
      "Do not add Warm-up, Strength, or Weightlifting sections unless the user's free-text notes explicitly ask for prep or accessory work."
    );
    return lines.join("\n");
  }
  const seq = [];
  if (parts.includeWarmup) seq.push("WARM-UP");
  if (parts.includeStrength) seq.push("STRENGTH");
  if (parts.includeWeightlifting) seq.push("WEIGHTLIFTING");
  seq.push("METCON");
  lines.push(
    `SESSION STRUCTURE (from user tags): Use clear section headers in this order: ${seq.join(" → ")}.`,
    unlimited
      ? "TIME: UNLIMITED — give each tagged section enough work to matter; metcon remains the main stimulus."
      : `TIME: Total session budget ~${timeMinutes} minutes — split time sensibly across sections; protect quality on the metcon.`
  );
  if (parts.includeWarmup) {
    lines.push(
      "WARM-UP: Easy general prep, patterning, mobility, light cardio — do not pre-fatigue the athlete for the metcon."
    );
  }
  if (parts.includeStrength) {
    lines.push(
      "STRENGTH: Heavier basic strength (squat, hinge, press, pull as equipment allows) BEFORE the metcon. Moderate volume and intensity so the athlete is not overly tired for conditioning; choose patterns that complement (not duplicate) the metcon's dominant stress."
    );
  }
  if (parts.includeWeightlifting) {
    lines.push(
      "WEIGHTLIFTING: Snatch / clean & jerk technique, pulls, complexes, or controlled barbell cycling BEFORE the metcon, only if equipment supports it. Keep volume moderate; avoid redundancy and excessive fatigue so the metcon stays effective."
    );
  }
  if (parts.includeStrength && parts.includeWeightlifting) {
    lines.push(
      "Both STRENGTH and WEIGHTLIFTING are on: order them Strength → Weightlifting → Metcon unless equipment or time makes a short combined barbell primer clearer; still use separate headers."
    );
  }
  return lines.join("\n");
}

const GENERIC_SYSTEM_INSTRUCTION = `You are a workout programming assistant.
Return only the requested workout/program text. Be concise and avoid chit-chat.
If the user message includes an APP WAREHOUSE INDEX, use it only for light structural inspiration—write original programming, no verbatim copies of named events.`;

const ATHLETE_PROFILE_RULES = `Extended athlete profile is ON:
- Individualize volume, complexity, and movement choices using the ATHLETE PROFILE block in the user message. If a field is blank or "—", do not invent details for it.
- Apply health limitations strictly; scale, substitute, or simplify when in doubt.
- Output remains programming only (no interview, no lifestyle advice, no chit-chat).`;

function buildAthleteProfilePrompt(p) {
  if (!p || typeof p !== "object") return "";
  const level = String(p.level || "").slice(0, 64);
  const years = String(p.yearsTraining || "").slice(0, 64);
  const bw = String(p.bodyweight || "").slice(0, 64);
  const sex = String(p.sex || "").slice(0, 64);
  const age = String(p.age || "").slice(0, 32);
  const health = String(p.healthLimits || "").slice(0, 2000);
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
    ? "TIME: UNLIMITED — structure a full session with sensible volume; still be concise."
    : `TIME BUDGET: approximately ${timeMinutes} minutes total for the main session (warm-up may be short).`;
  const athLine = athletes > 1 ? `ATHLETES: ${athletes} — use partner/team formats when appropriate.` : "ATHLETES: 1 (solo).";
  const notesLine = (userNotes && String(userNotes).trim())
    ? `USER NOTES / GOALS (honor these):\n${String(userNotes).trim()}`
    : "USER NOTES: (none) — choose an optimal session for the equipment and time.";
  return `AVAILABLE EQUIPMENT (strict — use only this):\n${eqList}\n\n${timeLine}\n${athLine}\n\n${notesLine}\n\nProduce the workout now.`;
}

function buildFlexibleUserPrompt(equipment, timeMinutes, unlimited, athletes, userNotes) {
  const eqList = Array.isArray(equipment) && equipment.length ? equipment.join(", ") : "none specified";
  const notes = String(userNotes || "").trim();
  const fallback = "Create one effective workout session.";
  return `USER REQUEST:\n${notes || fallback}\n\nCONTEXT:\n- Equipment: ${eqList}\n- Time: ${unlimited ? "UNLIMITED" : `${timeMinutes} minutes`}\n- Athletes: ${athletes}\n\nIf user request conflicts with context, prioritize user request.`;
}

const EXPLAIN_SYSTEM = `You are a movement coach. Given a workout text, list each main movement pattern with one short coaching cue (one line each).
Then for each movement, add a line: YouTube: https://www.youtube.com/results?search_query=MOVEMENT+NAME+TECHNIQUE
Replace MOVEMENT NAME with the exercise (URL-encode spaces as +). No extra commentary before or after the list.`;

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

/**
 * Vercel Hobby ~10s function wall — leave room for cold start + JSON work.
 * Optional env GEMINI_FETCH_BUDGET_MS (ms), capped at 9000.
 */
async function fetchGeminiGenerateContent(url, geminiBody) {
  const cap = 9000;
  const raw = parseInt(process.env.GEMINI_FETCH_BUDGET_MS || "8200", 10);
  const ms = Math.min(cap, Number.isFinite(raw) && raw > 2000 ? raw : 8200);
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

module.exports = async function handler(req, res) {
  try {
    allowCors(res);
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method === "GET") {
      const configured = !!resolveGeminiApiKey();
      return res.status(200).json({
        ok: true,
        service: "generate-workout",
        geminiKeyConfigured: configured,
        geminiKeySourceEnv: configured ? geminiKeySourceEnvName() : null,
        modelEnv: (process.env.GEMINI_MODEL || "").trim() || null,
        runningOnVercel: !!process.env.VERCEL,
        hint: configured
          ? "POST JSON with action generate or explain."
          : `No API key visible to this function. In Vercel add one of: ${GEMINI_KEY_ENV_NAMES.join(", ")} (Production + Redeploy). Open Vercel → this project → Settings → General → confirm Root Directory is the repo root (folder must contain /api).`,
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const key = resolveGeminiApiKey();
    if (!key) {
      return res.status(503).json({
        error: "Server missing Gemini API key at runtime.",
        hint: `Add one of: ${GEMINI_KEY_ENV_NAMES.join(", ")} for Production, Save, Redeploy. Self-check: GET this same URL in a browser — geminiKeyConfigured should be true.`,
      });
    }

    const model = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

    let body;
    try {
      body = await parseRequestJson(req);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const action = body.action === "explain" ? "explain" : "generate";

    if (action === "generate") {
      const equipment = Array.isArray(body.equipment) ? body.equipment.map((x) => String(x).slice(0, 64)) : [];
      const unlimited = !!body.unlimited;
      const timeMinutes = unlimited ? 999 : Math.min(300, Math.max(1, parseInt(body.timeMinutes, 10) || 20));
      const athletes = Math.min(20, Math.max(1, parseInt(body.athletes, 10) || 1));
      const userNotes = String(body.userNotes || "").slice(0, 4000);
      const useDefaultSettings = body.useDefaultSettings !== false;
      let extendedProfile = body.extendedProfile;
      if (!extendedProfile || typeof extendedProfile !== "object" || Array.isArray(extendedProfile)) {
        extendedProfile = null;
      }
      const profileBlock = extendedProfile ? buildAthleteProfilePrompt(extendedProfile) : "";
      const warehouseDigest = String(body.warehouseDigest || "").trim().slice(0, 14000);
      const hasWarehouseDigest = warehouseDigest.length > 0;

      let userText = useDefaultSettings
        ? buildUserPrompt(equipment, timeMinutes, unlimited, athletes, userNotes)
        : buildFlexibleUserPrompt(equipment, timeMinutes, unlimited, athletes, userNotes);
      if (profileBlock) {
        userText = `${userText}\n\n${profileBlock}`;
      }
      if (hasWarehouseDigest) {
        userText = `${userText}\n\nAPP WAREHOUSE INDEX (Open/Hero names from this app—use for patterns only; original programming required):\n${warehouseDigest}`;
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
          temperature: 0.75,
          maxOutputTokens: 2048,
        },
      };

      let r;
      try {
        r = await fetchGeminiGenerateContent(url, geminiBody);
      } catch (e) {
        if (e && e.name === "AbortError") {
          return res.status(504).json({
            error:
              "Gemini request hit the server time budget (Vercel Free ~10s). Try again, shorten notes, turn off extended profile / extra blocks, or upgrade Vercel for longer runs.",
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

      const text =
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0]
          ? data.candidates[0].content.parts[0].text
          : "";

      if (!text) {
        return res.status(502).json({ error: "Empty model response", detail: data });
      }

      return res.status(200).json({ ok: true, text });
    }

    /* explain */
    const workoutText = String(body.workoutText || "").slice(0, 16000);
    if (!workoutText.trim()) {
      return res.status(400).json({ error: "workoutText required" });
    }

    const geminiBody = {
      systemInstruction: { parts: [{ text: EXPLAIN_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Workout:\n${workoutText}` }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    };

    let r;
    try {
      r = await fetchGeminiGenerateContent(url, geminiBody);
    } catch (e) {
      if (e && e.name === "AbortError") {
        return res.status(504).json({
          error:
            "Gemini explain hit the server time budget (Vercel Free ~10s). Try again or upgrade Vercel for longer runs.",
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
      return res.status(502).json({ error: "Gemini explain failed", detail: msg });
    }

    const text =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
        ? data.candidates[0].content.parts[0].text
        : "";

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
