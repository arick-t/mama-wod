/**
 * Vercel serverless: AI workout generation (Gemini). API key only on server.
 * Env: GEMINI_API_KEY (Google AI Studio). Optional: GEMINI_MODEL (default gemini-2.0-flash).
 */

function allowCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const SYSTEM_INSTRUCTION = `You are an expert CrossFit coach and programmer. Your knowledge follows CrossFit Level 1 ideology and established training principles (GPP, intensity, variance, functional movement).

Rules:
- Output ONLY the workout programming. No greetings, no compliments, no filler tips, no "Here is your workout".
- Be concise and technical. Use clear section headers where helpful (e.g. Warm-up, Skill, Metcon, Cool-down).
- You MUST use ONLY equipment the user listed. Never program movements that require gear they do not have.
- Respect time cap: total work should fit the time window (or state clearly if UNLIMITED).
- If athletes > 1 (e.g. partner WOD), program partner-style work (shared reps, you-go-I-go, split work) as appropriate.
- Original programming — do not copy named benchmark WODs verbatim; you may use similar structures.
- If the user gave goals/notes, reflect them. If none, choose a balanced, effective session for the equipment and time.`;

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

const EXPLAIN_SYSTEM = `You are a CrossFit coach. Given a workout text, list each main movement pattern with one short coaching cue (one line each).
Then for each movement, add a line: YouTube: https://www.youtube.com/results?search_query=CROSSFIT+MOVEMENT+NAME+TECHNIQUE
Replace MOVEMENT NAME with the exercise (URL-encode spaces as +). No extra commentary before or after the list.`;

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "Server missing GEMINI_API_KEY. Add it in Vercel project settings." });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const action = body.action === "explain" ? "explain" : "generate";

  try {
    if (action === "generate") {
      const equipment = Array.isArray(body.equipment) ? body.equipment.map((x) => String(x).slice(0, 64)) : [];
      const unlimited = !!body.unlimited;
      const timeMinutes = unlimited ? 999 : Math.min(300, Math.max(1, parseInt(body.timeMinutes, 10) || 20));
      const athletes = Math.min(20, Math.max(1, parseInt(body.athletes, 10) || 1));
      const userNotes = String(body.userNotes || "").slice(0, 4000);

      const userText = buildUserPrompt(equipment, timeMinutes, unlimited, athletes, userNotes);

      const geminiBody = {
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 4096,
        },
      };

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      const data = await r.json();
      if (!r.ok) {
        const msg = data && (data.error && data.error.message) ? data.error.message : JSON.stringify(data);
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
        maxOutputTokens: 4096,
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data && (data.error && data.error.message) ? data.error.message : JSON.stringify(data);
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
    return res.status(500).json({ error: "Server error", message: e.message });
  }
};
