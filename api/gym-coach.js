/**
 * THE GYM BRAIN'S ENDPOINT — /api/gym-coach.
 *
 * ITS OWN FILE, and that is the whole reason it exists. api/personal-coach.js is 3,700 lines of
 * functional doctrine, its prompt, its policy book and its brief, and any road that led a gym
 * request through that file would have been the leak the owner forbade when the second brain was
 * started. So this one is small, standalone, and imports nothing from it.
 *
 * WHAT IS SHARED IS INFRASTRUCTURE, NEVER DOCTRINE. The admin auth check and the cost caps are
 * the product's plumbing — the same door and the same wallet whichever brain is writing. What
 * the brain READS comes from lib/gym-brief.js and lib/gym-layers/, and nothing else reaches it.
 *
 * ONE CALL. A gym block is one week written once, so this endpoint makes exactly one provider
 * call and never a second. There is no week-by-week fill here and no repair pass: the check runs
 * for free afterwards and its findings go back to the human coach, who is the one responsible.
 *
 * GEMINI ONLY, like all programming (POL-020). No backup model, no lite model, no silent
 * downgrade — a cheaper model writing a worse month is exactly what that rule exists to stop.
 */

"use strict";

const { checkAdminAuth, adminAuthDenied } = require("../scripts/lib/admin/admin-auth.js");
const GymBrief = require("../lib/gym-brief.js");
const GymBuild = require("../lib/gym-block-build.js");
const GymCheck = require("../lib/gym-brick-check.js");
const GymIntake = require("../lib/gym-intake.js");
const { evaluateCostCapGate, costCapHttpPayload } = require("../lib/coach-cost-caps.js");

const MAX_BODY_BYTES = 256 * 1024;
const OUTPUT_TOKENS = 16384;

function sanitizeSecret(raw) {
  let s = String(raw || "").trim();
  if (s.length > 1 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function apiKey() {
  return (
    sanitizeSecret(process.env.GEMINI_API_KEY) ||
    sanitizeSecret(process.env.GOOGLE_GENERATIVE_AI_API_KEY) ||
    sanitizeSecret(process.env.GOOGLE_AI_API_KEY)
  );
}

/** The programming model. Never the lite one — see the header. */
function model() {
  return sanitizeSecret(process.env.PERSONAL_COACH_MODEL) || sanitizeSecret(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/**
 * One call to Gemini, and one only.
 *
 * Failure is reported loudly and never papered over with something weaker: a month nobody wrote
 * is better than a month written badly, which is the whole of POL-020.
 */
async function askGemini(system, messages) {
  const key = apiKey();
  if (!key) return { ok: false, status: 503, error: "The coach is not configured on this server." };

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model()) +
    ":generateContent?key=" +
    encodeURIComponent(key);

  const payload = {
    systemInstruction: { parts: [{ text: String(system || "") }] },
    contents: (messages || []).map(function (m) {
      return { role: m.role === "model" ? "model" : "user", parts: [{ text: String(m.text || "") }] };
    }),
    generationConfig: { temperature: 0.4, maxOutputTokens: OUTPUT_TOKENS },
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    /* Never echo the URL: the key rides in its query string. */
    return { ok: false, status: 502, error: "Could not reach the coach.", detail: String((e && e.message) || e).slice(0, 300) };
  }

  const raw = await res.text().catch(function () {
    return "";
  });
  if (!res.ok) {
    return { ok: false, status: 502, error: "The coach refused the request.", detail: raw.slice(0, 400) };
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, status: 502, error: "The coach's answer could not be read.", detail: raw.slice(0, 300) };
  }
  const parts = ((json.candidates || [])[0] || {}).content || {};
  const text = (parts.parts || [])
    .map(function (p) {
      return String(p.text || "");
    })
    .join("");
  const finish = ((json.candidates || [])[0] || {}).finishReason || "";
  if (!text.trim()) {
    return { ok: false, status: 502, error: "The coach returned nothing.", detail: String(finish).slice(0, 80) };
  }
  return { ok: true, text: text, truncated: String(finish).toUpperCase() === "MAX_TOKENS" };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, brain: "gym", blockWeeks: GymIntake.BLOCK_WEEKS });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }
    /* Before the body is parsed and before any provider call, so a refused request costs
       nothing — the same order the other endpoint uses, for the same reason. */
    if (!checkAdminAuth(req)) return adminAuthDenied(res);

    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Could not read the request." });
    }

    const built = GymBrief.gymBlockRequestFor({
      answers: body.gymIntake,
      costCaps: body.costCaps,
      athleteId: body.athleteId,
      methods: body.methods === true,
      handoff: body.gymHandoff,
    });
    if (!built.ok) {
      return res.status(400).json({ ok: false, error: built.why, missing: built.missing || [] });
    }

    /* The same wallet as everything else. A gym block is one call, so it counts as one. */
    const gate = evaluateCostCapGate({
      action: "generate_block",
      profile: { costCaps: body.costCaps },
      body: body,
      isAdmin: true,
    });
    if (gate && gate.blocked) {
      return res.status(200).json(costCapHttpPayload(gate));
    }

    const answer = await askGemini(built.system, built.body.messages);
    if (!answer.ok) {
      return res.status(answer.status || 502).json({ ok: false, error: answer.error, detail: answer.detail });
    }

    const block = GymBuild.blockFromText(answer.text, {
      answers: built.body.gymIntake,
      startWeek: parseInt(body.blockStartWeek, 10) || 1,
      /* The week the LAST deload actually fell on. The cadence runs from the rest already
         given, not from week one, and the builder and the store must answer that question the
         same way or the preview paints a different week from the one that gets saved. */
      deloadSinceWeek: parseInt(body.deloadSinceWeek, 10) || 0,
    });
    if (!block.ok) {
      /* A cut answer is a delivery failure and asking again IS the fix, so say which it was. */
      return res.status(502).json({
        ok: false,
        error: answer.truncated ? "The answer was cut off mid-week — ask again." : block.why,
        truncated: answer.truncated === true,
        text: String(answer.text || "").slice(0, 1200),
      });
    }

    /* Free, and after the fact. What it finds goes to the human coach, who decides. */
    const found = GymCheck.checkGymBlock(block.block, {
      equipment: built.body.equipment,
      answers: built.body.gymIntake,
    });

    return res.status(200).json({
      ok: true,
      brain: "gym",
      block: block.block,
      blocking: found.blocking,
      flags: found.flags,
      model: model(),
    });
  } catch (e) {
    const detail = String((e && e.message) || e).slice(0, 300);
    try {
      console.error("[gym-coach] unhandled:", detail);
    } catch (eLog) {}
    if (res && res.headersSent) return undefined;
    return res.status(502).json({ ok: false, error: "The gym coach is temporarily unavailable.", detail: detail });
  }
};
