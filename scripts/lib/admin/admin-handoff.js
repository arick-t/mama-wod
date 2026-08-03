/**
 * Admin one-time handoff (download link)
 * POST /api/admin-handoff  (admin auth)
 *   action: create_athlete | create_link | reset_intake | list_links
 * GET/POST /api/admin-handoff?token=... OR body { action: "redeem", token }
 *   Public redeem — burns the token and returns a phone package once.
 *
 * Storage: data/admin-claims/*.json + data/admin-snapshots/
 * After redeem, athlete lives on device localStorage — not on the server.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { checkRateLimit, sendRateLimit } = require("../../../api/rate-limit");

const SNAPSHOTS_DIR = path.join(process.cwd(), "data", "admin-snapshots");
const CLAIMS_DIR = path.join(process.cwd(), "data", "admin-claims");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const MAX_PACKAGE_BYTES = 256 * 1024;
const CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function ensureDirs() {
  [SNAPSHOTS_DIR, CLAIMS_DIR].forEach(function (d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function safeId(raw) {
  return String(raw || "")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .slice(0, 80);
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

function readSnap(athleteId) {
  const file = path.join(SNAPSHOTS_DIR, athleteId + ".json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
}

function writeSnap(athleteId, data) {
  ensureDirs();
  const file = path.join(SNAPSHOTS_DIR, athleteId + ".json");
  const str = JSON.stringify(data);
  if (str.length > MAX_PACKAGE_BYTES) throw new Error("Snapshot too large");
  fs.writeFileSync(file, str, "utf8");
}

function makeToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function claimPath(token) {
  const safe = String(token || "").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 64);
  return path.join(CLAIMS_DIR, safe + ".json");
}

function starterBlock(_displayName) {
  const start = new Date();
  // Align to Sunday
  const day = start.getDay();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - day);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  const blockStart = y + "-" + m + "-" + d;
  // Shape matches production Personal Coach day cards:
  // overview focus → summary box; part lines → Duration & Intent / format / work bullets.
  return {
    summaryLine: "Week 1 / 5 · Foundation & Baseline Power Output",
    blockStart: blockStart,
    weeks: [
      {
        weekIndex: 1,
        weekStart: blockStart,
        phase: "build",
        theme: "Foundation & Baseline Power Output",
        summaryLine: "Week 1 · Foundation & Baseline Power Output",
        overview: [
          {
            day: "sun",
            label: "Sun",
            focus: "Part 1 - Squats + Part 2 - Core Finish",
          },
          {
            day: "mon",
            label: "Mon",
            focus: "Part 1 - Deadlift Strength + Part 2 - Conditioning AMRAP",
          },
          { day: "tue", label: "Tue", focus: "Rest" },
          {
            day: "wed",
            label: "Wed",
            focus: "Part 1 - Pull Strength + Part 2 - Mixed Modal",
          },
          {
            day: "thu",
            label: "Thu",
            focus: "Part 1 - Short Engine",
          },
          { day: "fri", label: "Fri", focus: "Rest" },
          { day: "sat", label: "Sat", focus: "Rest" },
        ],
        days: {
          sun: {
            parts: [
              {
                id: "sun-a",
                title: "Part 1 - Squats",
                lines: [
                  "Duration & Intent: 15 min - Knee-dominant strength.",
                  "Build to heavy working sets:",
                  "Back Squat 5 sets x 5 @ RPE 7",
                ],
              },
              {
                id: "sun-b",
                title: "Part 2 - Core Finish",
                lines: [
                  "Duration & Intent: 8 min - Midline quality.",
                  "3 rounds for quality:",
                  "12 Sit-ups",
                  "20s Hollow hold",
                ],
              },
            ],
          },
          mon: {
            parts: [
              {
                id: "mon-a",
                title: "Part 1 - Deadlift Strength",
                lines: [
                  "Duration & Intent: 15 min effective - Heavy Hinge priority.",
                  "Build to heavy working sets:",
                  "5 sets x 5 reps @ RPE 7-8",
                ],
              },
              {
                id: "mon-b",
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
          },
          tue: { parts: [{ id: "tue-rest", title: "REST DAY", lines: ["Rest"] }] },
          wed: {
            parts: [
              {
                id: "wed-a",
                title: "Part 1 - Pull Strength",
                lines: [
                  "Duration & Intent: 12 min - Vertical pull volume.",
                  "Build to solid working sets:",
                  "5 sets x 5-8 Pull-ups / Ring Rows",
                ],
              },
              {
                id: "wed-b",
                title: "Part 2 - Mixed Modal",
                lines: [
                  "Duration & Intent: 8-12 min - Classic couplet.",
                  "For Time:",
                  "21-15-9 Thrusters + Pull-ups (scaled as needed)",
                ],
              },
            ],
          },
          thu: {
            parts: [
              {
                id: "thu-a",
                title: "Part 1 - Short Engine",
                lines: [
                  "Duration & Intent: 12 min - Light aerobic punch.",
                  "AMRAP 12 Minutes:",
                  "9 Thrusters",
                  "12 Sit-ups",
                ],
              },
            ],
          },
          fri: { parts: [{ id: "fri-rest", title: "REST DAY", lines: ["Rest"] }] },
          sat: { parts: [{ id: "sat-rest", title: "REST DAY", lines: ["Rest"] }] },
        },
      },
    ],
  };
}

function buildPhonePackage(snap) {
  const athleteId = snap.athleteId;
  const block = snap.currentBlock || null;
  const week0 = block && block.weeks && block.weeks[0] ? block.weeks[0] : null;
  const prefs = [];
  if (snap.coachDirectives) {
    prefs.push("Admin directive: " + String(snap.coachDirectives).slice(0, 300));
  }
  return {
    version: 2,
    userId: athleteId,
    athleteId: athleteId,
    displayName: String(snap.displayName || "").slice(0, 80),
    gender: String(snap.gender || "").slice(0, 20),
    preferredLanguage: String(snap.preferredLanguage || "he").slice(0, 10),
    email: String(snap.email || "").slice(0, 120),
    skills: {},
    lifts: {},
    legalAcceptedAt: new Date().toISOString(),
    legalAcceptedVersion: 1,
    intakeComplete: true,
    profileNotes: String(snap.intakeSummary || "").slice(0, 800),
    coachPrefs: prefs,
    chat: [
      {
        role: "coach",
        text:
          "Welcome" +
          (snap.displayName ? ", " + snap.displayName : "") +
          ". Your plan was installed from your coach. No need to repeat intake.",
      },
    ],
    currentWeek: week0,
    currentBlock: block,
    activeWeekIndex: 0,
    partModificationEvents: [],
    modificationRulesNotified: {},
    pastBlocks: Array.isArray(snap.pastBlocks) ? snap.pastBlocks : [],
    autoNextTriggeredForBlockStart: null,
    intakeNotifySent: true,
    intakeNotifySentAt: new Date().toISOString(),
    handoffInstalledAt: new Date().toISOString(),
  };
}

/** Keep plan on phone; force Personal Coach intake to run again. */
function buildResetIntakePackage(snap) {
  const base = buildPhonePackage(snap);
  return Object.assign({}, base, {
    intakeComplete: false,
    profileNotes: "",
    skills: {},
    lifts: {},
    chat: [],
    coachPrefs: Array.isArray(base.coachPrefs) ? base.coachPrefs : [],
    intakeNotifySent: false,
    intakeNotifySentAt: null,
    adminIntakeResetAt: new Date().toISOString(),
    handoffInstalledAt: undefined,
  });
}

function createAthlete(body) {
  const displayName = String(body.displayName || "").trim().slice(0, 80);
  if (!displayName) return { status: 400, json: { error: "displayName required" } };
  const email = String(body.email || "").trim().slice(0, 120);
  const gender = String(body.gender || "").trim().slice(0, 20);
  const intakeSummary = String(body.intakeSummary || "").trim().slice(0, 800);
  const coachDirectives = String(body.coachDirectives || "").trim().slice(0, 1000);
  const preferredLanguage = String(body.preferredLanguage || "he").trim().slice(0, 10);

  let athleteId = safeId(body.athleteId);
  if (!athleteId) {
    athleteId = "a_" + crypto.randomBytes(6).toString("hex");
  }

  if (readSnap(athleteId)) {
    return { status: 409, json: { error: "athlete already exists", athleteId: athleteId } };
  }

  const now = new Date().toISOString();
  const snapshot = {
    athleteId: athleteId,
    displayName: displayName,
    email: email,
    gender: gender,
    preferredLanguage: preferredLanguage,
    skillsSummary: String(body.skillsSummary || "").slice(0, 400),
    intakeSummary: intakeSummary,
    coachDirectives: coachDirectives,
    joinedAt: now,
    workoutAdjustmentsCount: 0,
    coachDebriefsCount: 0,
    currentBlock: body.currentBlock || starterBlock(displayName),
    pastBlocks: [],
    createdAt: now,
    updatedAt: now,
    createdByAdmin: true,
  };
  try {
    writeSnap(athleteId, snapshot);
  } catch (e) {
    return { status: 500, json: { error: "Could not save athlete", detail: String(e.message) } };
  }
  return { status: 200, json: { ok: true, snapshot: snapshot } };
}

function createLink(body) {
  const athleteId = safeId(body.athleteId);
  if (!athleteId) return { status: 400, json: { error: "athleteId required" } };
  const snap = readSnap(athleteId);
  if (!snap) return { status: 404, json: { error: "Athlete not found" } };
  if (!snap.currentBlock) {
    return { status: 400, json: { error: "No training block yet — add a block before creating a link" } };
  }

  const purpose = String(body.purpose || body.mode || "handoff").trim() || "handoff";
  const isReset = purpose === "reset_intake";
  const token = makeToken();
  const now = Date.now();
  const pkg = isReset ? buildResetIntakePackage(snap) : buildPhonePackage(snap);
  const claim = {
    token: token,
    athleteId: athleteId,
    displayName: snap.displayName || athleteId,
    purpose: isReset ? "reset_intake" : "handoff",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CLAIM_TTL_MS).toISOString(),
    usedAt: null,
    package: pkg,
  };
  const str = JSON.stringify(claim);
  if (str.length > MAX_PACKAGE_BYTES) {
    return { status: 500, json: { error: "Package too large" } };
  }
  ensureDirs();
  fs.writeFileSync(claimPath(token), str, "utf8");

  // Remember last link meta on snapshot (not the secret package)
  snap.lastHandoffTokenPrefix = token.slice(0, 8);
  snap.lastHandoffCreatedAt = claim.createdAt;
  snap.lastHandoffExpiresAt = claim.expiresAt;
  if (isReset) {
    snap.intakeSummary = "";
    snap.skillsSummary = "";
    snap.intakeResetAt = claim.createdAt;
    snap.intakeResetPending = true;
  }
  snap.updatedAt = claim.createdAt;
  try {
    writeSnap(athleteId, snap);
  } catch (e) {}

  return {
    status: 200,
    json: {
      ok: true,
      token: token,
      purpose: claim.purpose,
      path: "/claim.html?t=" + encodeURIComponent(token),
      expiresAt: claim.expiresAt,
      athleteId: athleteId,
      displayName: claim.displayName,
      oneTime: true,
      message: isReset
        ? "לינק איפוס תחקור — כשהמתאמן יפתח אותו, התחקור יתחיל מחדש והתוכנית נשארת"
        : undefined,
    },
  };
}

function createResetIntakeLink(body) {
  return createLink(Object.assign({}, body, { purpose: "reset_intake" }));
}

function redeemToken(tokenRaw) {
  const token = String(tokenRaw || "").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 64);
  if (!token) return { status: 400, json: { error: "token required" } };
  const file = claimPath(token);
  if (!fs.existsSync(file)) {
    return { status: 404, json: { error: "link_invalid", message: "הלינק לא תקף או כבר לא קיים" } };
  }
  let claim;
  try {
    claim = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return { status: 500, json: { error: "corrupt_claim" } };
  }
  if (claim.usedAt) {
    return {
      status: 410,
      json: { error: "link_used", message: "הלינק כבר נוצל. אפשר לבקש לינק חדש מהמאמן." },
    };
  }
  if (claim.expiresAt && Date.parse(claim.expiresAt) < Date.now()) {
    return {
      status: 410,
      json: { error: "link_expired", message: "פג תוקף הלינק. אפשר לבקש לינק חדש מהמאמן." },
    };
  }
  claim.usedAt = new Date().toISOString();
  // Burn: rewrite without the heavy package after first successful read
  const burned = {
    token: claim.token,
    athleteId: claim.athleteId,
    displayName: claim.displayName,
    purpose: claim.purpose || "handoff",
    createdAt: claim.createdAt,
    expiresAt: claim.expiresAt,
    usedAt: claim.usedAt,
    burned: true,
  };
  const pkg = claim.package;
  fs.writeFileSync(file, JSON.stringify(burned, null, 2), "utf8");

  // Clear pending flag on snapshot once redeemed
  if ((claim.purpose || "") === "reset_intake" && claim.athleteId) {
    const snap = readSnap(claim.athleteId);
    if (snap) {
      snap.intakeResetPending = false;
      snap.intakeResetRedeemedAt = claim.usedAt;
      snap.updatedAt = claim.usedAt;
      try {
        writeSnap(claim.athleteId, snap);
      } catch (e) {}
    }
  }

  return {
    status: 200,
    json: {
      ok: true,
      athleteId: claim.athleteId,
      displayName: claim.displayName,
      purpose: claim.purpose || "handoff",
      store: pkg,
      storeKey: "duck-wod-personal-coach-v1",
      uidKey: "dw_uid",
    },
  };
}

function listLinksForAthlete(athleteId) {
  ensureDirs();
  const id = safeId(athleteId);
  const files = fs.readdirSync(CLAIMS_DIR).filter(function (f) {
    return f.endsWith(".json");
  });
  const out = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const c = JSON.parse(fs.readFileSync(path.join(CLAIMS_DIR, files[i]), "utf8"));
      if (id && c.athleteId !== id) continue;
      out.push({
        tokenPrefix: String(c.token || "").slice(0, 8),
        athleteId: c.athleteId,
        displayName: c.displayName,
        createdAt: c.createdAt,
        expiresAt: c.expiresAt,
        usedAt: c.usedAt || null,
        burned: !!c.burned,
      });
    } catch (e) {}
  }
  out.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  return out.slice(0, 40);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Password, X-Admin-Token"
  );
  if (req.method === "OPTIONS") return res.status(204).end();

  const query = req.query || {};
  const tokenFromQuery = query.token || query.t || "";

  // Public redeem via GET ?token=
  if (req.method === "GET" && tokenFromQuery) {
    const rl = checkRateLimit(req, { name: "admin-handoff-redeem", limit: 30, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);
    const result = redeemToken(tokenFromQuery);
    return res.status(result.status).json(result.json);
  }

  if (req.method === "GET") {
    if (!checkAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });
    const rl = checkRateLimit(req, { name: "admin-handoff-get", limit: 60, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);
    return res.status(200).json({
      ok: true,
      links: listLinksForAthlete(query.athleteId || ""),
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const action = String(body.action || "").trim();

  // Public redeem via POST
  if (action === "redeem" || body.token) {
    const rl = checkRateLimit(req, { name: "admin-handoff-redeem", limit: 30, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);
    const result = redeemToken(body.token || tokenFromQuery);
    return res.status(result.status).json(result.json);
  }

  if (!checkAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });
  const rl = checkRateLimit(req, { name: "admin-handoff-post", limit: 40, windowMs: 60_000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  let result;
  if (action === "create_athlete") result = createAthlete(body);
  else if (action === "create_link") result = createLink(body);
  else if (action === "reset_intake") result = createResetIntakeLink(body);
  else if (action === "list_links") {
    result = { status: 200, json: { ok: true, links: listLinksForAthlete(body.athleteId || "") } };
  } else {
    return res.status(400).json({ error: "Unknown action" });
  }
  return res.status(result.status).json(result.json);
};
