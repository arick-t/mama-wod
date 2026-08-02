/**
 * Admin Coach Training Sandbox
 * POST /api/admin-coach-sandbox
 *   action: build | feedback | decide | learn | coach_note | list
 *
 * Founder-only (ADMIN_PASSWORD). Does NOT touch personal-coach / policy / prompt files.
 * Local storage: data/coach-training/
 * coach_note = quick learning note from admin UI (ON mode) → awaiting decide
 */

const fs = require("fs");
const path = require("path");
const { checkRateLimit, sendRateLimit } = require("./rate-limit");

const ROOT = path.join(process.cwd(), "data", "coach-training");
const SESSIONS_DIR = path.join(ROOT, "sessions");
const WAREHOUSE_DIR = path.join(ROOT, "warehouse");
const PENDING_FILE = path.join(ROOT, "pending-notes.jsonl");
const IMPLEMENTED_FILE = path.join(ROOT, "implemented-notes.jsonl");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const MAX_IMAGE_CHARS = 6_000_000; // ~4.5MB base64

function ensureDirs() {
  [ROOT, SESSIONS_DIR, WAREHOUSE_DIR].forEach(function (d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
  if (!fs.existsSync(PENDING_FILE)) fs.writeFileSync(PENDING_FILE, "", "utf8");
  if (!fs.existsSync(IMPLEMENTED_FILE)) fs.writeFileSync(IMPLEMENTED_FILE, "", "utf8");
}

function checkAdminAuth(req) {
  if (!ADMIN_PASSWORD) return false;
  const headers = req.headers || {};
  const q = req.query || {};
  const body = req.body || {};
  const auth =
    headers["x-admin-password"] ||
    headers["x-admin-token"] ||
    q.adminPassword ||
    q.pw ||
    body.adminPassword ||
    body.password ||
    "";
  return String(auth) === ADMIN_PASSWORD;
}

function uid(prefix) {
  return (
    String(prefix || "id") +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

function appendJsonl(file, obj) {
  ensureDirs();
  fs.appendFileSync(file, JSON.stringify(obj) + "\n", "utf8");
}

function readJsonl(file, limit) {
  ensureDirs();
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < (limit || 50); i--) {
    try {
      out.push(JSON.parse(lines[i]));
    } catch (e) {}
  }
  return out;
}

function saveSession(session) {
  ensureDirs();
  fs.writeFileSync(path.join(SESSIONS_DIR, session.id + ".json"), JSON.stringify(session, null, 2), "utf8");
}

function loadSession(id) {
  const safe = String(id || "").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 80);
  if (!safe) return null;
  const file = path.join(SESSIONS_DIR, safe + ".json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
}

function resolveGeminiKey() {
  const names = ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_API_KEY"];
  for (let i = 0; i < names.length; i++) {
    const v = String(process.env[names[i]] || "").trim();
    if (v) return v;
  }
  return "";
}

function resolveGeminiModel() {
  const raw = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  return raw || "gemini-2.0-flash";
}

async function callGemini({ system, userText, imageBase64, mimeType }) {
  const key = resolveGeminiKey();
  if (!key) {
    const err = new Error("GEMINI_API_KEY missing");
    err.code = "no_key";
    throw err;
  }
  const model = resolveGeminiModel();
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(key);

  const parts = [];
  if (imageBase64 && mimeType) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: String(imageBase64).replace(/^data:[^;]+;base64,/, ""),
      },
    });
  }
  parts.push({ text: String(userText || "") });

  const body = {
    systemInstruction: { parts: [{ text: String(system || "") }] },
    contents: [{ role: "user", parts: parts }],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 4096,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch (e) {
    json = null;
  }
  if (!resp.ok) {
    const msg =
      (json && json.error && json.error.message) ||
      ("Gemini HTTP " + resp.status);
    const err = new Error(msg);
    err.code = "gemini_http";
    err.status = resp.status;
    throw err;
  }
  const cand = (((json || {}).candidates || [])[0] || {});
  const outParts = ((cand.content || {}).parts) || [];
  const text = outParts
    .map(function (p) {
      return p && p.text ? p.text : "";
    })
    .join("")
    .trim();
  return text;
}

function extractJsonBlock(text) {
  const s = String(text || "");
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : s;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

const BUILD_SYSTEM = [
  "You are a CrossFit-style personal coach building ONE training day for founder QA.",
  "Match production Personal Coach workout structure EXACTLY.",
  "Return ONLY valid JSON (no markdown) with this shape:",
  "{",
  '  "title": "short day title",',
  '  "summary": "Part 1 - Deadlift Strength + Part 2 - Conditioning AMRAP",',
  '  "parts": [',
  "    {",
  '      "title": "Part 1 - Deadlift Strength",',
  '      "lines": [',
  '        "Duration & Intent: 15 min effective - Heavy Hinge priority.",',
  '        "Build to heavy working sets:",',
  '        "5 sets x 5 reps @ RPE 7-8"',
  "      ]",
  "    }",
  "  ],",
  '  "coachNotes": "why this session fits"',
  "}",
  "Rules:",
  '- Part titles like: "Part 1 - Deadlift Strength" (not "Part A · ...")',
  '- First line of each part SHOULD be: "Duration & Intent: ..."',
  '- Next line often a format header ending with ":" (AMRAP / Build to / For Time / EMOM)',
  "- Remaining lines are prescription bullets (sets/reps/movements)",
  "- summary mirrors production overview focus (Part 1 - … + Part 2 - …)",
  "- Units: kg / meters. Practical and clear. English for part titles/lines like production.",
].join("\n");

const LEARN_SYSTEM = [
  "You convert a workout example (text and/or whiteboard photo) into structured JSON for a training warehouse.",
  "Match production Personal Coach structure when possible.",
  "Return ONLY valid JSON:",
  "{",
  '  "title": "...",',
  '  "summary": "Part 1 - … + Part 2 - …",',
  '  "parts": [{ "title": "Part 1 - …", "lines": ["Duration & Intent: …", "AMRAP 10 Minutes:", "…"] }],',
  '  "lessons": ["what to learn from this structure", "..."],',
  '  "tags": ["strength","engine","skill"]',
  "}",
].join("\n");

async function actionBuild(body) {
  const prompt = String(body.prompt || "").trim().slice(0, 4000);
  if (!prompt) return { status: 400, json: { error: "prompt required" } };

  const userText =
    "Founder request — build one training day:\n" +
    prompt +
    "\n\nIf relevant, respect soft constraints in the request (injuries, time, equipment).";

  let rawText;
  try {
    rawText = await callGemini({ system: BUILD_SYSTEM, userText: userText });
  } catch (e) {
    if (e.code === "no_key") {
      const workout = demoWorkout(prompt);
      const session = {
        id: uid("sess"),
        createdAt: new Date().toISOString(),
        prompt: prompt,
        workout: workout,
        feedbacks: [],
        status: "built",
        demo: true,
      };
      saveSession(session);
      return {
        status: 200,
        json: {
          ok: true,
          demo: true,
          sessionId: session.id,
          workout: workout,
          message: "אין מפתח Gemini מקומי — מוצג אימון הדגמה. חבר GEMINI_API_KEY ב־.env.local לבנייה אמיתית.",
        },
      };
    }
    return { status: 502, json: { error: "build_failed", detail: String(e.message || e) } };
  }

  const parsed = extractJsonBlock(rawText) || {
    title: "Training day",
    summary: prompt.slice(0, 120),
    parts: [{ title: "Session", lines: [rawText.slice(0, 1200)] }],
    coachNotes: "",
  };

  const session = {
    id: uid("sess"),
    createdAt: new Date().toISOString(),
    prompt: prompt,
    workout: parsed,
    feedbacks: [],
    status: "built",
  };
  saveSession(session);
  return { status: 200, json: { ok: true, sessionId: session.id, workout: parsed } };
}

function demoWorkout(prompt) {
  return {
    title: "Mon · Demo day",
    summary: "Part 1 - Deadlift Strength + Part 2 - Conditioning AMRAP",
    parts: [
      {
        title: "Part 1 - Deadlift Strength",
        lines: [
          "Duration & Intent: 15 min effective - Heavy Hinge priority.",
          "Build to heavy working sets:",
          "5 sets x 5 reps @ 140-150kg (80-82.5% 1RM)",
        ],
      },
      {
        title: "Part 2 - Conditioning AMRAP",
        lines: [
          "Duration & Intent: 10 min - Mixed modal engine.",
          "AMRAP 10 Minutes:",
          "10 Toes-to-Bar",
          "15 Box Jump-Overs",
          "20/16 Cal Row",
        ],
      },
    ],
    coachNotes:
      "הדגמה במבנה פרודקשן (Duration & Intent / format / bullets). בקשה: " +
      String(prompt || "").slice(0, 120),
  };
}

async function actionFeedback(body) {
  const sessionId = String(body.sessionId || "");
  const feedback = String(body.feedback || "").trim().slice(0, 4000);
  if (!feedback) return { status: 400, json: { error: "feedback required" } };
  const session = loadSession(sessionId);
  if (!session) return { status: 404, json: { error: "session not found" } };

  const note = {
    id: uid("note"),
    createdAt: new Date().toISOString(),
    sessionId: session.id,
    prompt: session.prompt,
    workout: session.workout,
    feedback: feedback,
    status: "awaiting_decision",
  };
  session.feedbacks.push({
    id: note.id,
    at: note.createdAt,
    feedback: feedback,
  });
  session.status = "awaiting_decision";
  session.pendingNoteId = note.id;
  saveSession(session);
  // hold in a temp pending-decision area inside session; decide moves to jsonl
  ensureDirs();
  fs.writeFileSync(
    path.join(ROOT, "awaiting-" + note.id + ".json"),
    JSON.stringify(note, null, 2),
    "utf8"
  );

  return {
    status: 200,
    json: {
      ok: true,
      noteId: note.id,
      question:
        "להטמיע את ההערה עכשיו, או להמתין ולשמור אותה ברשימה מסודרת?",
      options: [
        { id: "implement", label: "להטמיע עכשיו" },
        { id: "wait", label: "להמתין ולצבור" },
      ],
    },
  };
}

function loadAwaitingNote(noteId) {
  const safe = String(noteId || "").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 80);
  const file = path.join(ROOT, "awaiting-" + safe + ".json");
  if (!fs.existsSync(file)) return null;
  try {
    return { note: JSON.parse(fs.readFileSync(file, "utf8")), file: file };
  } catch (e) {
    return null;
  }
}

async function actionDecide(body) {
  const decision = String(body.decision || "").trim();
  if (decision !== "implement" && decision !== "wait") {
    return { status: 400, json: { error: "decision must be implement or wait" } };
  }
  const loaded = loadAwaitingNote(body.noteId);
  if (!loaded) return { status: 404, json: { error: "note not found" } };
  const note = loaded.note;
  note.decidedAt = new Date().toISOString();
  note.status = decision === "implement" ? "implemented" : "pending";
  note.decision = decision;
  appendJsonl(decision === "implement" ? IMPLEMENTED_FILE : PENDING_FILE, note);
  try {
    fs.unlinkSync(loaded.file);
  } catch (e) {}

  if (decision === "implement") {
    // Keep a human-readable digest for later policy sync (manual / post-hotfix)
    const digestPath = path.join(ROOT, "READY-TO-INJECT.txt");
    const line =
      "[" +
      note.decidedAt +
      "] " +
      String(note.feedback || "").replace(/\s+/g, " ").slice(0, 500) +
      "\n";
    fs.appendFileSync(digestPath, line, "utf8");
  }

  return {
    status: 200,
    json: {
      ok: true,
      decision: decision,
      message:
        decision === "implement"
          ? "נשמר להטמעה (רשימת הטמעה). כשיגיע הזמן נכניס לכללי המאמן."
          : "נשמר ברשימת ההמתנה. אפשר להמשיך לצבור הערות.",
    },
  };
}

async function actionLearn(body) {
  const note = String(body.note || "").trim().slice(0, 2000);
  const text = String(body.text || "").trim().slice(0, 8000);
  let imageBase64 = body.imageBase64 ? String(body.imageBase64) : "";
  const mimeType = String(body.mimeType || "image/jpeg").slice(0, 40);
  if (imageBase64.length > MAX_IMAGE_CHARS) {
    return { status: 400, json: { error: "image too large" } };
  }
  if (!text && !imageBase64) {
    return { status: 400, json: { error: "text or image required" } };
  }

  const userText =
    "Founder shared an example workout to learn from / add to warehouse.\n" +
    (note ? "Founder note: " + note + "\n" : "") +
    (text ? "Workout text:\n" + text + "\n" : "") +
    (imageBase64 ? "A whiteboard/photo of the workout is attached — extract structure carefully.\n" : "");

  let rawText;
  try {
    rawText = await callGemini({
      system: LEARN_SYSTEM,
      userText: userText,
      imageBase64: imageBase64 || null,
      mimeType: imageBase64 ? mimeType : null,
    });
  } catch (e) {
    if (e.code === "no_key") {
      const item = {
        id: uid("wh"),
        createdAt: new Date().toISOString(),
        source: imageBase64 ? "image_demo" : "text_demo",
        founderNote: note,
        workout: {
          title: "Example (demo — no API key)",
          summary: "Part 1 - Captured Session",
          parts: [
            {
              title: "Part 1 - Captured Session",
              lines: [
                "Duration & Intent: from whiteboard / text capture.",
                "Notes:",
                String(text || "תמונה התקבלה — חבר Gemini לפיענוח").slice(0, 500),
              ],
            },
          ],
          lessons: ["Demo only — connect GEMINI_API_KEY for real learning"],
          tags: ["demo"],
        },
      };
      ensureDirs();
      fs.writeFileSync(
        path.join(WAREHOUSE_DIR, item.id + ".json"),
        JSON.stringify(item, null, 2),
        "utf8"
      );
      const learnNote = {
        id: uid("note"),
        createdAt: new Date().toISOString(),
        type: "warehouse_learn",
        warehouseId: item.id,
        feedback:
          note ||
          "למד מהמבנה של האימון שנוסף למחסן: " + String(item.workout.title || item.id),
        workout: item.workout,
        status: "awaiting_decision",
      };
      fs.writeFileSync(
        path.join(ROOT, "awaiting-" + learnNote.id + ".json"),
        JSON.stringify(learnNote, null, 2),
        "utf8"
      );
      return {
        status: 200,
        json: {
          ok: true,
          demo: true,
          item: item,
          noteId: learnNote.id,
          question:
            "האימון נכנס למחסן. להטמיע את הלקחים עכשיו, או להמתין ולצבור?",
          options: [
            { id: "implement", label: "להטמיע עכשיו" },
            { id: "wait", label: "להמתין ולצבור" },
          ],
          message: "נשמר במחסן (מצב הדגמה). עם מפתח Gemini הפיענוח יהיה מלא.",
        },
      };
    }
    return { status: 502, json: { error: "learn_failed", detail: String(e.message || e) } };
  }

  const parsed = extractJsonBlock(rawText) || {
    title: "Learned workout",
    summary: note || "from founder",
    parts: [{ title: "Session", lines: [rawText.slice(0, 1000)] }],
    lessons: [],
    tags: [],
  };

  const item = {
    id: uid("wh"),
    createdAt: new Date().toISOString(),
    source: imageBase64 ? "image" : "text",
    founderNote: note,
    originalText: text,
    workout: parsed,
  };
  ensureDirs();
  fs.writeFileSync(
    path.join(WAREHOUSE_DIR, item.id + ".json"),
    JSON.stringify(item, null, 2),
    "utf8"
  );

  // Also queue a pending learning note so founder can choose implement/wait
  const learnNote = {
    id: uid("note"),
    createdAt: new Date().toISOString(),
    type: "warehouse_learn",
    warehouseId: item.id,
    feedback:
      note ||
      "למד מהמבנה של האימון שנוסף למחסן: " + String(parsed.title || item.id),
    workout: parsed,
    status: "awaiting_decision",
  };
  fs.writeFileSync(
    path.join(ROOT, "awaiting-" + learnNote.id + ".json"),
    JSON.stringify(learnNote, null, 2),
    "utf8"
  );

  return {
    status: 200,
    json: {
      ok: true,
      item: item,
      noteId: learnNote.id,
      question:
        "האימון נכנס למחסן. להטמיע את הלקחים עכשיו, או להמתין ולצבור?",
      options: [
        { id: "implement", label: "להטמיע עכשיו" },
        { id: "wait", label: "להמתין ולצבור" },
      ],
    },
  };
}

function listWarehouse(limit) {
  ensureDirs();
  const files = fs.readdirSync(WAREHOUSE_DIR).filter(function (f) {
    return f.endsWith(".json");
  });
  const items = [];
  for (let i = 0; i < files.length; i++) {
    try {
      items.push(JSON.parse(fs.readFileSync(path.join(WAREHOUSE_DIR, files[i]), "utf8")));
    } catch (e) {}
  }
  items.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  return items.slice(0, limit || 30);
}

function listAwaiting() {
  ensureDirs();
  const files = fs.readdirSync(ROOT).filter(function (f) {
    return f.indexOf("awaiting-") === 0 && f.endsWith(".json");
  });
  const out = [];
  for (let i = 0; i < files.length; i++) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(ROOT, files[i]), "utf8")));
    } catch (e) {}
  }
  return out;
}

async function actionCoachNote(body) {
  const note = String(body.note || body.feedback || "").trim().slice(0, 4000);
  if (!note) return { status: 400, json: { error: "note required" } };
  const athleteId = String(body.athleteId || "").slice(0, 80);
  const dayKey = String(body.dayKey || body.dateKey || "").slice(0, 40);
  const workout = body.workout && typeof body.workout === "object" ? body.workout : null;
  const contextLine = [
    athleteId ? "athlete=" + athleteId : "",
    dayKey ? "day=" + dayKey : "",
    workout && workout.title ? "workout=" + String(workout.title).slice(0, 80) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const learnNote = {
    id: uid("note"),
    createdAt: new Date().toISOString(),
    type: "coach_learning_note",
    athleteId: athleteId || null,
    dayKey: dayKey || null,
    prompt: contextLine || "Founder learning note from admin",
    workout: workout || {
      title: "Learning note",
      summary: contextLine || note.slice(0, 120),
      parts: [],
    },
    feedback: note,
    status: "awaiting_decision",
  };
  ensureDirs();
  fs.writeFileSync(
    path.join(ROOT, "awaiting-" + learnNote.id + ".json"),
    JSON.stringify(learnNote, null, 2),
    "utf8"
  );
  return {
    status: 200,
    json: {
      ok: true,
      noteId: learnNote.id,
      question: "להטמיע את ההערה ללימוד המאמן עכשיו, או להמתין ולצבור?",
      options: [
        { id: "implement", label: "להטמיע עכשיו" },
        { id: "wait", label: "להמתין ולצבור" },
      ],
    },
  };
}

async function actionList() {
  return {
    status: 200,
    json: {
      ok: true,
      pending: readJsonl(PENDING_FILE, 40),
      implemented: readJsonl(IMPLEMENTED_FILE, 40),
      awaitingDecision: listAwaiting(),
      warehouse: listWarehouse(20),
    },
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Password, X-Admin-Token"
  );
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    if (!checkAdminAuth(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const rl = checkRateLimit(req, { name: "admin-sandbox-get", limit: 60, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);
    const result = await actionList();
    return res.status(result.status).json(result.json);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body;
  try {
    body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  req.body = body;

  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const rl = checkRateLimit(req, { name: "admin-sandbox-post", limit: 30, windowMs: 60_000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  const action = String(body.action || "").trim();
  let result;
  if (action === "build") result = await actionBuild(body);
  else if (action === "feedback") result = await actionFeedback(body);
  else if (action === "decide") result = await actionDecide(body);
  else if (action === "learn") result = await actionLearn(body);
  else if (action === "coach_note") result = await actionCoachNote(body);
  else if (action === "list") result = await actionList();
  else return res.status(400).json({ error: "Unknown action" });

  return res.status(result.status).json(result.json);
};
