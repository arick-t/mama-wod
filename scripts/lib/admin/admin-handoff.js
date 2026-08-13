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

const crypto = require("crypto");
const { checkRateLimit, sendRateLimit } = require("../../../lib/rate-limit");
const {
  resolveAdminPassword,
  checkAdminAuth: sharedCheckAdminAuth,
} = require("./admin-auth");
const { putJson, getJson, listJson, putJsonExclusive, assertDurableStorage } = require("./admin-json-store");
const { makeWriteKey, hashWriteKey } = require("./admin-ownership");
const { appendAdminAudit } = require("./admin-audit");
const { applyCors } = require("../../../lib/cors-allowlist");
const CoachIntakeSync = require("../../../lib/coach-intake-sync-contract");
const NormalizePprogBlock = require("../../../lib/normalize-pprog-block");

const ADMIN_PASSWORD = resolveAdminPassword();
const MAX_PACKAGE_BYTES = 256 * 1024;
const CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const SNAP_PREFIX = "admin-snapshots/";
const CLAIM_PREFIX = "admin-claims/";

function checkAdminAuth(req) {
  return sharedCheckAdminAuth(req, ADMIN_PASSWORD);
}

function safeId(raw) {
  return String(raw || "")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .slice(0, 80);
}

function snapKey(athleteId) {
  return SNAP_PREFIX + athleteId + ".json";
}

function claimKey(token) {
  const safe = String(token || "").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 64);
  return CLAIM_PREFIX + safe + ".json";
}

async function readSnap(athleteId) {
  const id = safeId(athleteId);
  if (!id) return null;
  return getJson(snapKey(id));
}

async function writeSnap(athleteId, data) {
  const id = safeId(athleteId);
  if (!id) throw new Error("athleteId required");
  const str = JSON.stringify(data);
  if (str.length > MAX_PACKAGE_BYTES) throw new Error("Snapshot too large");
  await putJson(snapKey(id), data);
}

function makeToken() {
  return crypto.randomBytes(24).toString("base64url");
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

function buildPhonePackage(snap, writeKeyPlain) {
  const athleteId = snap.athleteId;
  const block = snap.currentBlock || null;
  const week0 = block && block.weeks && block.weeks[0] ? block.weeks[0] : null;
  const prefs = [];
  if (snap.coachDirectives) {
    prefs.push("Admin directive: " + String(snap.coachDirectives).slice(0, 300));
  }
  const intakeProfile = CoachIntakeSync.normalizeIntakeProfile(
    snap.intakeProfile || {
      displayName: snap.displayName,
      gender: snap.gender,
      preferredLanguage: snap.preferredLanguage || "en",
      profileNotes: snap.intakeSummary,
      skillsSummary: snap.skillsSummary,
      intakeComplete: true,
    }
  );
  let pkg = {
    version: 2,
    userId: athleteId,
    athleteId: athleteId,
    displayName: String(snap.displayName || intakeProfile.displayName || "").slice(0, 80),
    gender: String(snap.gender || intakeProfile.gender || "").slice(0, 20),
    preferredLanguage: String(
      intakeProfile.preferredLanguage || snap.preferredLanguage || "en"
    ).slice(0, 10),
    email: String(snap.email || "").slice(0, 120),
    skills: {},
    lifts: {},
    /* Athlete must sign Terms on first open of the handoff link — do NOT pre-accept. */
    legalAcceptedAt: null,
    legalAcceptedVersion: 0,
    pendingAthleteLegal: true,
    intakeComplete: true,
    profileNotes: String(intakeProfile.profileNotes || snap.intakeSummary || "").slice(0, 2500),
    coachPrefs: prefs,
    chat: [
      {
        role: "coach",
        text:
          "Welcome" +
          (snap.displayName || intakeProfile.displayName
            ? ", " + (snap.displayName || intakeProfile.displayName)
            : "") +
          ". Your coach prepared your plan. Accept the Terms on this device to unlock it — no need to repeat intake.",
      },
    ],
    currentWeek: week0,
    currentBlock: block,
    activeWeekIndex: 0,
    partModificationEvents: [],
    modificationRulesNotified: {},
    pastBlocks: Array.isArray(snap.pastBlocks) ? snap.pastBlocks : [],
    autoNextTriggeredForBlockStart: null,
    /* Join mail waits for on-device Terms — do not pretend it was already sent. */
    intakeNotifySent: false,
    intakeNotifySentAt: null,
    handoffInstalledAt: new Date().toISOString(),
  };
  pkg = CoachIntakeSync.applyIntakeProfileToPhoneStore(pkg, intakeProfile);
  /* Re-assert after merge — applyIntakeProfile must never invent a signature. */
  pkg.legalAcceptedAt = null;
  pkg.legalAcceptedVersion = 0;
  pkg.pendingAthleteLegal = true;
  if (writeKeyPlain) pkg.writeKey = String(writeKeyPlain).slice(0, 128);
  return pkg;
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

async function createAthlete(body) {
  const intakeProfile = CoachIntakeSync.normalizeIntakeProfile(
    body.intakeProfile || {
      displayName: body.displayName,
      gender: body.gender,
      preferredLanguage: body.preferredLanguage || "en",
      skills: body.skills,
      lifts: body.lifts,
      age: body.age,
      bodyweight: body.bodyweight,
      experience: body.experience,
      trainingDays: body.trainingDays,
      scheduleNotes: body.scheduleNotes,
      activeRecoveryPref: body.activeRecoveryPref,
      activeRecoveryDay: body.activeRecoveryDay,
      trainingSetup: body.trainingSetup,
      trainingLocations: body.trainingLocations,
      trainingLocationOther: body.trainingLocationOther,
      sessionLimits: body.sessionLimits,
      injuries: body.injuries,
      goals: body.goals,
      fixedIntakePacket: body.fixedIntakePacket,
      profileNotes: body.profileNotes || body.intakeSummary,
      intakeComplete: true,
    }
  );
  const displayName = String(intakeProfile.displayName || body.displayName || "")
    .trim()
    .slice(0, 80);
  if (!displayName) return { status: 400, json: { error: "displayName required" } };
  const email = String(body.email || "").trim().slice(0, 120);
  const gender = String(intakeProfile.gender || body.gender || "").trim().slice(0, 20);
  const intakeSummary = String(
    body.intakeSummary || intakeProfile.profileNotes || ""
  )
    .trim()
    .slice(0, 800);
  const coachDirectives = String(body.coachDirectives || "").trim().slice(0, 1000);
  const preferredLanguage = String(
    intakeProfile.preferredLanguage || body.preferredLanguage || "en"
  )
    .trim()
    .slice(0, 10);

  let athleteId = safeId(body.athleteId);
  if (!athleteId) {
    athleteId = "a_" + crypto.randomBytes(6).toString("hex");
  }

  if (await readSnap(athleteId)) {
    return { status: 409, json: { error: "athlete already exists", athleteId: athleteId } };
  }

  const blockRaw = body.currentBlock;
  if (!blockRaw || !Array.isArray(blockRaw.weeks) || !blockRaw.weeks.length) {
    return {
      status: 400,
      json: {
        error: "currentBlock required",
        message:
          "חייב לבנה אמיתית מ־generate_block (weeks לא ריק) — לא נשמר stub / starterBlock.",
      },
    };
  }
  const block = NormalizePprogBlock.normalize(blockRaw, null);
  if (!intakeProfile.fixedIntakePacket || !/^FIXED INTAKE COMPLETE/i.test(intakeProfile.fixedIntakePacket)) {
    return {
      status: 400,
      json: {
        error: "fixedIntakePacket required",
        message: "תחקור חייב להיות זהה לאפליקציה (FIXED INTAKE COMPLETE packet).",
      },
    };
  }

  const now = new Date().toISOString();
  const deviceWriteKey = makeWriteKey();
  let coachVer = "";
  try {
    const pcSrc = require("fs").readFileSync(
      require("path").join(__dirname, "../../../api/personal-coach.js"),
      "utf8"
    );
    const m = pcSrc.match(/const COACH_VERSION = "([^"]+)"/);
    if (m) coachVer = m[1];
  } catch (eCv) {}
  const blockWithVer =
    block && typeof block === "object"
      ? Object.assign({}, block, coachVer ? { coachVersion: coachVer } : {})
      : block;
  const snapshot = {
    athleteId: athleteId,
    displayName: displayName,
    email: email,
    gender: gender,
    preferredLanguage: preferredLanguage,
    skillsSummary: String(
      body.skillsSummary || intakeProfile.skillsSummary || ""
    ).slice(0, 400),
    intakeSummary: intakeSummary,
    intakeProfile: intakeProfile,
    coachDirectives: coachDirectives,
    joinedAt: now,
    workoutAdjustmentsCount: 0,
    coachDebriefsCount: 0,
    currentBlock: blockWithVer,
    planCoachVersion: coachVer || null,
    pastBlocks: [],
    createdAt: now,
    updatedAt: now,
    createdByAdmin: true,
    coachTier: 2,
    writeKeyHash: hashWriteKey(deviceWriteKey),
    clientWritesLocked: false,
    intakeNotifySent: false,
  };
  try {
    await writeSnap(athleteId, snapshot);
    await appendAdminAudit({
      action: "create_athlete",
      athleteId: athleteId,
      actor: "admin",
      ok: true,
    });
  } catch (e) {
    return {
      status: 500,
      json: { error: "לא הצלחנו לשמור מתאמן", detail: String(e.message) },
    };
  }

  /* Join email waits until the athlete signs Terms on the device (admin-snapshot write). */

  let linkJson = null;
  if (body.autoCreateLink !== false) {
    try {
      const linkRes = await createLink({ athleteId: athleteId, purpose: "handoff" });
      if (linkRes && linkRes.status === 200) linkJson = linkRes.json;
    } catch (eLink) {
      linkJson = null;
    }
  }

  let responseSnap = snapshot;
  try {
    responseSnap = (await readSnap(athleteId)) || snapshot;
  } catch (eFresh) {}

  return {
    status: 200,
    json: {
      ok: true,
      snapshot: Object.assign({}, responseSnap, { writeKeyHash: undefined }),
      writeKey: (linkJson && linkJson.writeKey) || deviceWriteKey,
      handoff: linkJson,
      message: linkJson
        ? "נשמר + לינק מסירה חד־פעמי מוכן."
        : "נשמר. צרו לינק מסירה מהכרטיס.",
    },
  };
}

async function createLink(body) {
  const athleteId = safeId(body.athleteId);
  if (!athleteId) return { status: 400, json: { error: "athleteId required" } };
  const snap = await readSnap(athleteId);
  if (!snap) return { status: 404, json: { error: "Athlete not found" } };
  if (!snap.currentBlock) {
    return {
      status: 400,
      json: { error: "No training block yet — add a block before creating a link" },
    };
  }

  const purpose = String(body.purpose || body.mode || "handoff").trim() || "handoff";
  const isReset = purpose === "reset_intake";
  const token = makeToken();
  const now = Date.now();
  // Rotate device ownership onto the redeeming phone (admin-issued link).
  const deviceWriteKey = makeWriteKey();
  snap.writeKeyHash = hashWriteKey(deviceWriteKey);
  snap.clientWritesLocked = false;
  snap.seeded = false;
  const pkg = isReset
    ? Object.assign({}, buildResetIntakePackage(snap), { writeKey: deviceWriteKey })
    : buildPhonePackage(snap, deviceWriteKey);
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
  await putJson(claimKey(token), claim);

  snap.lastHandoffTokenPrefix = token.slice(0, 8);
  snap.lastHandoffCreatedAt = claim.createdAt;
  snap.lastHandoffExpiresAt = claim.expiresAt;
  snap.lastHandoffPath = "/claim.html?t=" + encodeURIComponent(token);
  if (isReset) {
    snap.intakeSummary = "";
    snap.skillsSummary = "";
    snap.intakeResetAt = claim.createdAt;
    snap.intakeResetPending = true;
  }
  snap.updatedAt = claim.createdAt;
  try {
    await writeSnap(athleteId, snap);
  } catch (e) {}
  await appendAdminAudit({
    action: isReset ? "create_reset_link" : "create_handoff_link",
    athleteId: athleteId,
    actor: "admin",
    ok: true,
    detail: token.slice(0, 8),
  });

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
      writeKey: deviceWriteKey,
      message: isReset
        ? "לינק איפוס תחקור — כשהמתאמן יפתח אותו, התחקור יתחיל מחדש והתוכנית נשארת"
        : undefined,
    },
  };
}

function createResetIntakeLink(body) {
  return createLink(Object.assign({}, body, { purpose: "reset_intake" }));
}

async function redeemToken(tokenRaw) {
  try {
    assertDurableStorage();
  } catch (e) {
    return {
      status: 503,
      json: {
        error: "blob_required",
        message: e.message || "שמירה לא זמינה",
      },
    };
  }
  const token = String(tokenRaw || "").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 64);
  if (!token) return { status: 400, json: { error: "token required" } };

  const lockKey = CLAIM_PREFIX + token + ".took.json";
  try {
    await putJsonExclusive(lockKey, {
      token: token,
      tookAt: new Date().toISOString(),
    });
  } catch (e) {
    return {
      status: 410,
      json: {
        error: "link_used",
        message: "הלינק כבר נוצל או בטיפול. אפשר לבקש לינק חדש מהמאמן.",
      },
    };
  }

  const claim = await getJson(claimKey(token));
  if (!claim) {
    return { status: 404, json: { error: "link_invalid", message: "הלינק לא תקף או כבר לא קיים" } };
  }
  if (claim.usedAt || claim.burned) {
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
  await putJson(claimKey(token), burned);

  if ((claim.purpose || "") === "reset_intake" && claim.athleteId) {
    const snap = await readSnap(claim.athleteId);
    if (snap) {
      snap.intakeResetPending = false;
      snap.intakeResetRedeemedAt = claim.usedAt;
      snap.updatedAt = claim.usedAt;
      try {
        await writeSnap(claim.athleteId, snap);
      } catch (e) {}
    }
  }

  await appendAdminAudit({
    action: "redeem_handoff",
    athleteId: claim.athleteId || "",
    actor: "public",
    ok: true,
    detail: token.slice(0, 8),
  });

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
      writeKey: pkg && pkg.writeKey ? pkg.writeKey : undefined,
    },
  };
}

async function listLinksForAthlete(athleteId) {
  const id = safeId(athleteId);
  const rows = await listJson(CLAIM_PREFIX);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i].data || {};
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
  }
  out.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  return out.slice(0, 40);
}

module.exports = async function handler(req, res) {
  applyCors(req, res, {
    methods: "GET,POST,OPTIONS",
    headers: "Content-Type, X-Admin-Password, X-Admin-Token",
  });
  if (req.method === "OPTIONS") return res.status(204).end();

  const query = req.query || {};
  const tokenFromQuery = query.token || query.t || "";

  // Public redeem via GET ?token=
  if (req.method === "GET" && tokenFromQuery) {
    const rl = checkRateLimit(req, { name: "admin-handoff-redeem", limit: 30, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);
    const result = await redeemToken(tokenFromQuery);
    return res.status(result.status).json(result.json);
  }

  if (req.method === "GET") {
    if (!checkAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });
    const rl = checkRateLimit(req, { name: "admin-handoff-get", limit: 60, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);
    return res.status(200).json({
      ok: true,
      links: await listLinksForAthlete(query.athleteId || ""),
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
    const result = await redeemToken(body.token || tokenFromQuery);
    return res.status(result.status).json(result.json);
  }

  if (!checkAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });
  const rl = checkRateLimit(req, { name: "admin-handoff-post", limit: 40, windowMs: 60_000 });
  if (!rl.ok) return sendRateLimit(res, rl);

  let result;
  if (action === "create_athlete") result = await createAthlete(body);
  else if (action === "create_link") result = await createLink(body);
  else if (action === "reset_intake") result = await createResetIntakeLink(body);
  else if (action === "list_links") {
    result = {
      status: 200,
      json: { ok: true, links: await listLinksForAthlete(body.athleteId || "") },
    };
  } else {
    return res.status(400).json({ error: "Unknown action" });
  }
  return res.status(result.status).json(result.json);
};
