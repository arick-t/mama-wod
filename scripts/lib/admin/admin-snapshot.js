/**
 * Admin Snapshot API
 * POST /api/admin-snapshot — athlete saves intake+block snapshot (called from index.html)
 * GET  /api/admin-snapshot — admin reads all snapshots (requires ADMIN_PASSWORD)
 * DELETE /api/admin-snapshot?id=athleteId — admin deletes a snapshot
 *
 * Storage: private Vercel Blob (admin-snapshots/*.json) with FS fallback for local/dev.
 * Stage A: device writeKey ownership; fail-closed without Blob on Vercel.
 */

const path = require("path");
const fs = require("fs");
const { checkRateLimit, sendRateLimit } = require("../../../lib/rate-limit");
const {
  resolveAdminPassword,
  checkAdminAuth: sharedCheckAdminAuth,
  adminAuthDenied,
  mintAdminSessionToken,
  adminAuthUsedPassword,
} = require("./admin-auth");
const {
  putJson,
  getJson,
  listJson,
  deleteJson,
  storageInfo,
  assertDurableStorage,
} = require("./admin-json-store");
const { assertSnapshotWriteAllowed, hashWriteKey } = require("./admin-ownership");
const { appendAdminAudit } = require("./admin-audit");
const { applyCors } = require("../../../lib/cors-allowlist");
const {
  sendAdminIntakeCompleteMail,
  snapshotReadyForJoinMail,
} = require("../../../lib/admin-intake-complete-mail");

const MAX_SNAPSHOT_BYTES = 256 * 1024;
const ADMIN_PASSWORD = resolveAdminPassword();
const SNAP_PREFIX = "admin-snapshots/";

const CLIENT_ALLOWED_KEYS = new Set([
  "athleteId",
  "userId",
  "writeKey",
  "displayName",
  "gender",
  "preferredLanguage",
  "skillsSummary",
  "intakeSummary",
  "intakeProfile",
  "age",
  "bodyweight",
  "experience",
  "trainingDays",
  "scheduleNotes",
  "activeRecoveryPref",
  "activeRecoveryDay",
  "trainingSetup",
  "skills",
  "lifts",
  "sessionLimits",
  "injuries",
  "goals",
  "fixedIntakePacket",
  "profileNotes",
  "joinedAt",
  "workoutAdjustmentsCount",
  "coachDebriefsCount",
  "currentBlock",
  "pastBlocks",
  "coachTier",
  "planCoachVersion",
  "declarationAcceptedAt",
  "legalAcceptedAt",
  "reclaimSameAthlete",
]);

const CoachIntakeSync = require("../../../lib/coach-intake-sync-contract");
const CoachPushUpgrade = require("../../../lib/coach-push-upgrade");

function safeAthleteId(raw) {
  return String(raw || "")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .slice(0, 80);
}

function snapKey(athleteId) {
  return SNAP_PREFIX + athleteId + ".json";
}

function safeCount(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function storageUnavailable(res, e) {
  const code = e && e.code === "blob_required" ? 503 : 500;
  return res.status(code).json({
    ok: false,
    error: (e && e.code) || "storage_error",
    message:
      (e && e.message) ||
      "שמירה לא זמינה כרגע. אם זה נמשך — בדקו הגדרת Blob ב־Vercel.",
  });
}

async function readSnapshot(athleteId) {
  const id = safeAthleteId(athleteId);
  if (!id) return null;
  return getJson(snapKey(id));
}

async function writeSnapshot(athleteId, data) {
  const id = safeAthleteId(athleteId);
  if (!id) throw new Error("athleteId required");
  const str = JSON.stringify(data);
  if (str.length > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot too large");
  await putJson(snapKey(id), data);
}

function publicSnapshot(row) {
  if (!row || typeof row !== "object") return row;
  const out = Object.assign({}, row);
  delete out.writeKeyHash;
  delete out.writeKey;
  return out;
}

function isDeletedSnapshot(row) {
  return !!(row && (row.deleted === true || row.revoked === true));
}

async function listSnapshots() {
  try {
    await ensureSeedAthletes();
    const rows = await listJson(SNAP_PREFIX);
    return rows
      .map((r) => publicSnapshot(r.data))
      .filter((row) => row && row.athleteId && !isDeletedSnapshot(row))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  } catch (e) {
    if (e && e.code === "blob_required") throw e;
    return [];
  }
}

function loadCoachMemberSeed() {
  try {
    const p = path.join(__dirname, "..", "..", "..", "data", "analytics-coach-members.json");
    if (!fs.existsSync(p)) return {};
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

async function ensureSeedAthletes() {
  const seed = loadCoachMemberSeed();
  const ids = Object.keys(seed || {});
  for (let i = 0; i < ids.length; i++) {
    const uid = safeAthleteId(ids[i]);
    if (!uid) continue;
    const existing = await readSnapshot(uid);
    /* Tombstone or live row — never re-seed after admin delete. */
    if (existing && (existing.athleteId || existing.deleted || existing.revoked)) continue;
    const row = seed[ids[i]] || {};
    const now = new Date().toISOString();
    await writeSnapshot(uid, {
      athleteId: uid,
      displayName: String(row.displayName || uid).slice(0, 80),
      email: "",
      gender: "",
      preferredLanguage: "he",
      skillsSummary: "",
      intakeSummary: "Seeded coach member (tier 2)",
      coachDirectives: "",
      joinedAt: now,
      workoutAdjustmentsCount: 0,
      coachDebriefsCount: 0,
      currentBlock: null,
      pastBlocks: [],
      coachTier: 2,
      seeded: true,
      writeKeyHash: null,
      clientWritesLocked: true,
      updatedAt: now,
      createdAt: now,
    });
  }
}

async function burnOpenClaimsForAthlete(athleteId) {
  const id = safeAthleteId(athleteId);
  if (!id) return 0;
  const CLAIM_PREFIX = "admin-claims/";
  let burned = 0;
  try {
    const rows = await listJson(CLAIM_PREFIX);
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i++) {
      const key = rows[i].key;
      const c = rows[i].data || {};
      if (safeAthleteId(c.athleteId) !== id) continue;
      if (c.burned || c.usedAt) continue;
      await putJson(key, Object.assign({}, c, {
        burned: true,
        usedAt: now,
        revokedByDelete: true,
        revokedAt: now,
      }));
      burned += 1;
    }
  } catch (e) {
    /* non-fatal — snapshot tombstone is the primary revoke */
  }
  return burned;
}

function checkAdminAuth(req) {
  return sharedCheckAdminAuth(req, ADMIN_PASSWORD);
}

function stripUnknownClientFields(body) {
  const out = {};
  Object.keys(body || {}).forEach((k) => {
    if (CLIENT_ALLOWED_KEYS.has(k)) out[k] = body[k];
  });
  return out;
}

module.exports = async function handler(req, res) {
  applyCors(req, res, {
    methods: "GET,POST,DELETE,OPTIONS",
    headers: "Content-Type, X-Admin-Password, X-Admin-Token, X-Athlete-Id, X-Write-Key",
  });
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    assertDurableStorage();
  } catch (e) {
    return storageUnavailable(res, e);
  }

  if (req.method === "POST") {
    const rl = checkRateLimit(req, { name: "admin-snap-post", limit: 20, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);

    let body;
    try {
      body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
    req.body = body;
    const isAdmin = checkAdminAuth(req);

    const athleteId = safeAthleteId(body.athleteId || body.userId);
    if (!athleteId && !(body.action === "admin_list" || body.list === true)) {
      return res.status(400).json({ error: "athleteId required" });
    }

    if (body.action === "admin_list" || body.list === true) {
      if (!isAdmin) return adminAuthDenied(res);
      const rlList = checkRateLimit(req, { name: "admin-snap-get", limit: 60, windowMs: 60_000 });
      if (!rlList.ok) return sendRateLimit(res, rlList);
      try {
        const snapshots = await listSnapshots();
        const json = { ok: true, snapshots, storage: storageInfo() };
        if (adminAuthUsedPassword(req, ADMIN_PASSWORD)) {
          json.adminSessionToken = mintAdminSessionToken(ADMIN_PASSWORD, {
            remember: !!(body.rememberMe || body.remember),
          });
        }
        return res.status(200).json(json);
      } catch (e) {
        return storageUnavailable(res, e);
      }
    }

    if (body.action === "admin_save_day") {
      if (!isAdmin) return adminAuthDenied(res);
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found" });
      }
      const wi = Math.max(0, Math.min(4, Number(body.weekIndex) || 0));
      const dayKey = String(body.dayKey || "")
        .toLowerCase()
        .slice(0, 3);
      const allowedDay = { sun: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1 };
      if (!allowedDay[dayKey]) {
        return res.status(400).json({ ok: false, error: "dayKey required" });
      }
      const block = existing.currentBlock;
      if (!block || !Array.isArray(block.weeks) || !block.weeks[wi]) {
        return res.status(400).json({ ok: false, error: "no_block" });
      }
      const rawParts = Array.isArray(body.parts) ? body.parts.slice(0, 12) : [];
      const parts = rawParts.map(function (p) {
        const title = String((p && p.title) || "Part")
          .trim()
          .slice(0, 160) || "Part";
        let lines = [];
        if (Array.isArray(p.lines)) {
          lines = p.lines
            .map(function (l) {
              return String(l || "").trim().slice(0, 400);
            })
            .filter(Boolean)
            .slice(0, 24);
        } else {
          (Array.isArray(p.notes) ? p.notes : []).forEach(function (n) {
            const t = String(n || "").trim().slice(0, 400);
            if (t) lines.push(t);
          });
          const fmt = String((p && p.format) || "").trim().slice(0, 200);
          if (fmt) lines.push(fmt);
          (Array.isArray(p.work) ? p.work : []).forEach(function (w) {
            const t = String(w || "").trim().slice(0, 400);
            if (t) lines.push(t);
          });
          lines = lines.slice(0, 24);
        }
        return { title: title, lines: lines };
      });
      const week = block.weeks[wi];
      if (!week.days || typeof week.days !== "object") week.days = {};
      week.days[dayKey] = Object.assign({}, week.days[dayKey] || {}, { parts: parts });
      if (parts.length && Array.isArray(week.overview)) {
        const blob0 = String(parts[0].title || "") + " " + (parts[0].lines || []).join(" ");
        const looksRest = parts.length === 1 && /\brest(\s*day)?\b/i.test(blob0);
        if (!looksRest) {
          const focus = String(parts[0].title || "Training")
            .replace(/^Part\s+[A-Z]\s*[—–-]\s*/i, "")
            .slice(0, 80);
          week.overview = week.overview.map(function (row) {
            if (!row || String(row.day || "").slice(0, 3) !== dayKey) return row;
            return Object.assign({}, row, { focus: focus || "Training" });
          });
        }
      }
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
        await appendAdminAudit({
          action: "admin_save_day",
          athleteId: athleteId,
          actor: "admin",
          ok: true,
          detail: "w" + (wi + 1) + "." + dayKey,
        });
      } catch (e) {
        return storageUnavailable(res, e);
      }
      return res.status(200).json({
        ok: true,
        currentBlock: existing.currentBlock,
        storage: storageInfo(),
      });
    }

    if (body.action === "admin_member_status") {
      if (!isAdmin) return adminAuthDenied(res);
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found — wait for first snapshot" });
      }
      if (body.membershipFrozen !== undefined) {
        existing.membershipFrozen = !!body.membershipFrozen;
      }
      if (body.declarationAcceptedAt !== undefined) {
        existing.declarationAcceptedAt = String(body.declarationAcceptedAt || "").slice(0, 40);
      }
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
        await appendAdminAudit({
          action: "set_member_status",
          athleteId: athleteId,
          actor: "admin",
          ok: true,
          detail: existing.membershipFrozen ? "frozen" : "active",
        });
      } catch (e) {
        return storageUnavailable(res, e);
      }
      return res.status(200).json({
        ok: true,
        membershipFrozen: !!existing.membershipFrozen,
        declarationAcceptedAt: existing.declarationAcceptedAt || null,
        storage: storageInfo(),
      });
    }

    if (body.action === "admin_append_chat") {
      if (!isAdmin) return adminAuthDenied(res);
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found — wait for first snapshot" });
      }
      let log = Array.isArray(existing.adminChatLog) ? existing.adminChatLog.slice() : [];
      if (!log.length && existing.coachDirectives) {
        String(existing.coachDirectives)
          .split(/\n+/)
          .map(function (line) {
            return String(line || "").trim();
          })
          .filter(Boolean)
          .forEach(function (line) {
            log.push({
              at: existing.updatedAt || existing.joinedAt || new Date().toISOString(),
              text: line.slice(0, 800),
              kind: "note",
            });
          });
      }
      const text = String(body.text || "").trim().slice(0, 800);
      if (!text) {
        return res.status(400).json({ ok: false, error: "text required" });
      }
      log.push({
        at: new Date().toISOString(),
        text: text,
        kind: String(body.kind || "note").slice(0, 20),
      });
      if (log.length > 80) log = log.slice(-80);
      existing.adminChatLog = log;
      if (body.coachDirectives !== undefined) {
        existing.coachDirectives = String(body.coachDirectives || "").slice(0, 1000);
      }
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
        await appendAdminAudit({
          action: "append_admin_chat",
          athleteId: athleteId,
          actor: "admin",
          ok: true,
        });
      } catch (e) {
        return storageUnavailable(res, e);
      }
      return res.status(200).json({
        ok: true,
        adminChatLog: existing.adminChatLog,
        storage: storageInfo(),
      });
    }

    /* Admin: push soft | remaining_rebuild offer to athlete coach chat (opt-in). */
    if (body.action === "admin_push_upgrade_offer") {
      if (!isAdmin) return adminAuthDenied(res);
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found — wait for first snapshot" });
      }
      if (!existing.currentBlock) {
        return res.status(400).json({
          ok: false,
          error: "no_block",
          message: "אין לבנה פעילה למתאמן — לא ניתן לשלוח עדכון בדחיפה.",
        });
      }
      const liveCoachVersion = String(
        body.targetCoachVersion || body.coachVersion || ""
      )
        .trim()
        .slice(0, 20);
      if (!liveCoachVersion) {
        return res.status(400).json({
          ok: false,
          error: "coach_version_required",
          message: "חסרה גרסת מח מאמן.",
        });
      }
      const planVer =
        existing.planCoachVersion ||
        (existing.currentBlock && existing.currentBlock.coachVersion) ||
        "";
      if (!CoachPushUpgrade.isCoachNewerThanPlan(liveCoachVersion, planVer)) {
        return res.status(400).json({
          ok: false,
          error: "no_newer_coach",
          message:
            "אין עדכון מח מאמן חדש למתאמן זה (הלבנה כבר על v" +
            (planVer || liveCoachVersion) +
            ").",
          liveCoachVersion: liveCoachVersion,
          planCoachVersion: planVer || null,
        });
      }
      if (
        existing.pendingPushUpgrade &&
        existing.pendingPushUpgrade.status === "pending"
      ) {
        return res.status(409).json({
          ok: false,
          error: "offer_pending",
          message: "כבר יש הצעת עדכון בדחיפה ממתינה למתאמן זה.",
          pendingPushUpgrade: CoachPushUpgrade.publicOffer(existing.pendingPushUpgrade),
        });
      }
      const offer = CoachPushUpgrade.buildPendingOffer({
        mode: body.mode,
        targetCoachVersion: liveCoachVersion,
      });
      if (!offer) {
        return res.status(400).json({
          ok: false,
          error: "invalid_mode",
          message: "בחר עדכון סופט או שכתוב מלא של הימים שנותרו.",
        });
      }
      existing.pendingPushUpgrade = offer;
      let log = Array.isArray(existing.adminChatLog) ? existing.adminChatLog.slice() : [];
      log.push({
        at: offer.createdAt,
        text:
          "עדכון בדחיפה · " +
          (offer.mode === "soft" ? "סופט" : "שכתוב מלא (נותר בלבנה)") +
          " → v" +
          offer.targetCoachVersion +
          " (ממתין לאישור מתאמן)",
        kind: "push_upgrade",
      });
      if (log.length > 80) log = log.slice(-80);
      existing.adminChatLog = log;
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
        await appendAdminAudit({
          action: "push_upgrade_offer",
          athleteId: athleteId,
          actor: "admin",
          ok: true,
          detail: offer.mode + "@" + offer.targetCoachVersion,
        });
      } catch (e) {
        return storageUnavailable(res, e);
      }
      return res.status(200).json({
        ok: true,
        pendingPushUpgrade: CoachPushUpgrade.publicOffer(offer),
        adminChatLog: existing.adminChatLog,
        storage: storageInfo(),
      });
    }

    /* Athlete device: pull pending push-upgrade offer (writeKey). */
    if (body.action === "athlete_pull_push_offer") {
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      const writeKey =
        body.writeKey ||
        (req.headers && (req.headers["x-write-key"] || req.headers["X-Write-Key"])) ||
        "";
      const gate = assertSnapshotWriteAllowed(existing, writeKey, false);
      if (!gate.ok) {
        return res.status(gate.status).json({
          ok: false,
          error: gate.error,
          message: gate.message,
        });
      }
      return res.status(200).json({
        ok: true,
        pendingPushUpgrade: CoachPushUpgrade.publicOffer(existing.pendingPushUpgrade),
        planCoachVersion:
          existing.planCoachVersion ||
          (existing.currentBlock && existing.currentBlock.coachVersion) ||
          null,
      });
    }

    /* Athlete device: accept / dismiss push-upgrade offer. */
    if (body.action === "athlete_resolve_push_offer") {
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      const writeKey =
        body.writeKey ||
        (req.headers && (req.headers["x-write-key"] || req.headers["X-Write-Key"])) ||
        "";
      const gate = assertSnapshotWriteAllowed(existing, writeKey, false);
      if (!gate.ok) {
        return res.status(gate.status).json({
          ok: false,
          error: gate.error,
          message: gate.message,
        });
      }
      const pending = existing.pendingPushUpgrade;
      const offerId = String(body.offerId || "").slice(0, 40);
      if (!pending || pending.status !== "pending" || pending.id !== offerId) {
        return res.status(409).json({
          ok: false,
          error: "offer_mismatch",
          message: "ההצעה לא ממתינה או כבר טופלה.",
        });
      }
      const resolution = String(body.resolution || "").toLowerCase();
      if (resolution !== "accepted" && resolution !== "dismissed") {
        return res.status(400).json({ ok: false, error: "invalid_resolution" });
      }
      existing.pendingPushUpgrade = Object.assign({}, pending, {
        status: resolution,
        resolvedAt: new Date().toISOString(),
      });
      if (resolution === "accepted") {
        existing.planCoachVersion = String(pending.targetCoachVersion || "").slice(0, 20);
        if (existing.currentBlock && typeof existing.currentBlock === "object") {
          existing.currentBlock = Object.assign({}, existing.currentBlock, {
            coachVersion: existing.planCoachVersion,
          });
        }
        existing.lastAcceptedPushUpgrade = {
          id: pending.id,
          mode: pending.mode,
          targetCoachVersion: pending.targetCoachVersion,
          at: existing.pendingPushUpgrade.resolvedAt,
        };
      }
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
        await appendAdminAudit({
          action: "resolve_push_upgrade",
          athleteId: athleteId,
          actor: "athlete",
          ok: true,
          detail: resolution + ":" + pending.mode,
        });
      } catch (e) {
        return storageUnavailable(res, e);
      }
      return res.status(200).json({
        ok: true,
        pendingPushUpgrade: existing.pendingPushUpgrade,
        planCoachVersion: existing.planCoachVersion || null,
        storage: storageInfo(),
      });
    }

    if (
      body.coachDirectives !== undefined &&
      Object.keys(body).filter(function (k) {
        return (
          body[k] !== undefined &&
          k !== "athleteId" &&
          k !== "userId" &&
          k !== "coachDirectives" &&
          k !== "adminPassword" &&
          k !== "password" &&
          k !== "writeKey"
        );
      }).length === 0
    ) {
      if (!isAdmin) return adminAuthDenied(res);
      const existing = (await readSnapshot(athleteId)) || {};
      if (!existing.athleteId && !existing.createdAt) {
        return res.status(404).json({ error: "Athlete not found — wait for first snapshot" });
      }
      existing.coachDirectives = String(body.coachDirectives || "").slice(0, 1000);
      existing.updatedAt = new Date().toISOString();
      try {
        await writeSnapshot(athleteId, existing);
        await appendAdminAudit({
          action: "set_directives",
          athleteId: athleteId,
          actor: "admin",
          ok: true,
        });
      } catch (e) {
        return storageUnavailable(res, e);
      }
      return res.status(200).json({ ok: true, storage: storageInfo() });
    }

    const existingRaw = (await readSnapshot(athleteId)) || {};
    const writeKey =
      body.writeKey ||
      (req.headers && (req.headers["x-write-key"] || req.headers["X-Write-Key"])) ||
      "";
    /* Same athleteId reclaim: tombstone → clear deleted flags in-memory so gate can re-bind. */
    let existing = existingRaw;
    let resurrecting = false;
    if (!isAdmin && isDeletedSnapshot(existingRaw)) {
      resurrecting = true;
      existing = Object.assign({}, existingRaw, {
        deleted: false,
        revoked: false,
        writeKeyHash: null,
        clientWritesLocked: false,
      });
    }
    const allowUnboundBind = !!(
      body.currentBlock ||
      body.intakeProfile ||
      body.fixedIntakePacket ||
      body.reclaimSameAthlete === true
    );
    const gate = assertSnapshotWriteAllowed(existing, writeKey, isAdmin, {
      allowUnboundBind: allowUnboundBind || resurrecting,
    });
    if (!gate.ok) {
      await appendAdminAudit({
        action: "snapshot_denied",
        athleteId: athleteId,
        actor: isAdmin ? "admin" : "client",
        ok: false,
        detail: gate.error,
      });
      return res.status(gate.status).json({
        ok: false,
        error: gate.error,
        message: gate.message,
      });
    }

    const clean = isAdmin ? body : stripUnknownClientFields(body);

    let intakeProfile = existing.intakeProfile || null;
    if (clean.intakeProfile || clean.fixedIntakePacket || clean.skills || clean.lifts) {
      intakeProfile = CoachIntakeSync.normalizeIntakeProfile(
        Object.assign({}, existing.intakeProfile || {}, clean.intakeProfile || {}, {
          displayName: clean.displayName || (existing.intakeProfile && existing.intakeProfile.displayName),
          gender: clean.gender || (existing.intakeProfile && existing.intakeProfile.gender),
          preferredLanguage:
            clean.preferredLanguage ||
            (existing.intakeProfile && existing.intakeProfile.preferredLanguage),
          age: clean.age,
          bodyweight: clean.bodyweight,
          experience: clean.experience,
          trainingDays: clean.trainingDays,
          scheduleNotes: clean.scheduleNotes,
          activeRecoveryPref: clean.activeRecoveryPref,
          activeRecoveryDay: clean.activeRecoveryDay,
          trainingSetup: clean.trainingSetup,
          skills: clean.skills,
          lifts: clean.lifts,
          sessionLimits: clean.sessionLimits,
          injuries: clean.injuries,
          goals: clean.goals,
          fixedIntakePacket: clean.fixedIntakePacket,
          profileNotes: clean.profileNotes || clean.intakeSummary,
          intakeComplete: true,
        })
      );
    }

    const snapshot = {
      athleteId,
      displayName: String(clean.displayName || existing.displayName || "").slice(0, 80),
      email: String((isAdmin ? clean.email : existing.email) || existing.email || "").slice(0, 120),
      gender: String(clean.gender || existing.gender || "").slice(0, 20),
      preferredLanguage: String(
        clean.preferredLanguage || existing.preferredLanguage || ""
      ).slice(0, 10),
      skillsSummary: String(
        clean.skillsSummary ||
          (intakeProfile && intakeProfile.skillsSummary) ||
          existing.skillsSummary ||
          ""
      ).slice(0, 400),
      intakeSummary: String(
        clean.intakeSummary ||
          (intakeProfile && intakeProfile.profileNotes) ||
          existing.intakeSummary ||
          ""
      ).slice(0, 800),
      intakeProfile: intakeProfile || existing.intakeProfile || undefined,
      coachDirectives: String(existing.coachDirectives || "").slice(0, 1000),
      joinedAt: String(
        clean.joinedAt || existing.joinedAt || existing.createdAt || new Date().toISOString()
      ).slice(0, 40),
      workoutAdjustmentsCount: safeCount(
        clean.workoutAdjustmentsCount,
        safeCount(existing.workoutAdjustmentsCount, 0)
      ),
      coachDebriefsCount: safeCount(
        clean.coachDebriefsCount,
        safeCount(existing.coachDebriefsCount, 0)
      ),
      currentBlock: clean.currentBlock || existing.currentBlock || null,
      pastBlocks: clean.pastBlocks || existing.pastBlocks || [],
      coachTier: existing.coachTier || clean.coachTier || 2,
      membershipFrozen:
        isAdmin && clean.membershipFrozen !== undefined
          ? !!clean.membershipFrozen
          : !!existing.membershipFrozen,
      declarationAcceptedAt: String(
        clean.declarationAcceptedAt ||
          clean.legalAcceptedAt ||
          existing.declarationAcceptedAt ||
          ""
      ).slice(0, 40),
      adminChatLog: Array.isArray(existing.adminChatLog) ? existing.adminChatLog : [],
      pendingPushUpgrade: existing.pendingPushUpgrade || null,
      planCoachVersion: (function () {
        /* Never invent from live COACH_VERSION — only explicit stamp (brick build / accepted push). */
        if (clean.planCoachVersion) return String(clean.planCoachVersion).slice(0, 20);
        if (existing.planCoachVersion) return String(existing.planCoachVersion).slice(0, 20);
        if (existing.currentBlock && existing.currentBlock.coachVersion) {
          return String(existing.currentBlock.coachVersion).slice(0, 20);
        }
        return null;
      })(),
      lastAcceptedPushUpgrade: existing.lastAcceptedPushUpgrade || null,
      createdByAdmin: !!(existing.createdByAdmin || (isAdmin && clean.createdByAdmin)),
      intakeNotifySent: !!(existing.intakeNotifySent || existing.joinMailSent),
      joinMailSent: !!(existing.intakeNotifySent || existing.joinMailSent),
      intakeNotifySentAt: existing.intakeNotifySentAt || existing.joinMailSentAt || null,
      lastHandoffPath: existing.lastHandoffPath,
      lastHandoffCreatedAt: existing.lastHandoffCreatedAt,
      lastHandoffExpiresAt: existing.lastHandoffExpiresAt,
      lastHandoffTokenPrefix: existing.lastHandoffTokenPrefix,
      writeKeyHash:
        existing.writeKeyHash ||
        gate.bindHash ||
        (isAdmin && clean.writeKey ? hashWriteKey(clean.writeKey) : null) ||
        null,
      seeded: !!existing.seeded && !gate.bindHash,
      clientWritesLocked: false,
      deleted: false,
      revoked: false,
      deletedAt: undefined,
      revokedAt: undefined,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
    };
    if (resurrecting) snapshot.reclaimedAt = new Date().toISOString();
    if (isAdmin && clean.createdByAdmin) snapshot.createdByAdmin = true;
    if (
      snapshot.planCoachVersion &&
      snapshot.currentBlock &&
      typeof snapshot.currentBlock === "object" &&
      !snapshot.currentBlock.coachVersion
    ) {
      snapshot.currentBlock = Object.assign({}, snapshot.currentBlock, {
        coachVersion: snapshot.planCoachVersion,
      });
    }

    try {
      await writeSnapshot(athleteId, snapshot);
      await appendAdminAudit({
        action: resurrecting
          ? "snapshot_reclaim"
          : existingRaw.athleteId
            ? "snapshot_update"
            : "snapshot_create",
        athleteId: athleteId,
        actor: isAdmin ? "admin" : "client",
        ok: true,
        detail: gate.reclaimed ? "unbound_bind" : undefined,
      });
    } catch (e) {
      return storageUnavailable(res, e);
    }

    let joinMailSent = !!(snapshot.intakeNotifySent || snapshot.joinMailSent);
    if (snapshotReadyForJoinMail(snapshot)) {
      try {
        const mailResult = await sendAdminIntakeCompleteMail(snapshot);
        if (mailResult && mailResult.sent) {
          const nowMail = new Date().toISOString();
          snapshot.intakeNotifySent = true;
          snapshot.joinMailSent = true;
          snapshot.intakeNotifySentAt = nowMail;
          snapshot.joinMailSentAt = nowMail;
          joinMailSent = true;
          try {
            await writeSnapshot(athleteId, snapshot);
          } catch (eFlag) {}
        }
      } catch (eMail) {}
    }

    return res.status(200).json({
      ok: true,
      storage: storageInfo(),
      joinMailSent: joinMailSent,
    });
  }

  if (req.method === "GET") {
    if (!checkAdminAuth(req)) {
      return adminAuthDenied(res);
    }
    const rl = checkRateLimit(req, { name: "admin-snap-get", limit: 60, windowMs: 60_000 });
    if (!rl.ok) return sendRateLimit(res, rl);
    try {
      const snapshots = await listSnapshots();
      return res.status(200).json({ ok: true, snapshots, storage: storageInfo() });
    } catch (e) {
      return storageUnavailable(res, e);
    }
  }

  if (req.method === "DELETE") {
    if (!checkAdminAuth(req)) {
      return adminAuthDenied(res);
    }
    const athleteId = safeAthleteId(req.query && req.query.id);
    if (!athleteId) return res.status(400).json({ error: "id required" });
    const existing = (await readSnapshot(athleteId)) || {};
    const now = new Date().toISOString();
    /* Tombstone (do not deleteJson) so ensureSeedAthletes cannot resurrect from analytics seed. */
    const tombstone = {
      athleteId: athleteId,
      displayName: String(existing.displayName || athleteId).slice(0, 80),
      deleted: true,
      revoked: true,
      deletedAt: now,
      revokedAt: now,
      writeKeyHash: null,
      clientWritesLocked: true,
      currentBlock: null,
      pastBlocks: [],
      pendingPushUpgrade: null,
      seeded: !!existing.seeded,
      createdAt: existing.createdAt || now,
      updatedAt: now,
      joinedAt: existing.joinedAt || existing.createdAt || now,
    };
    try {
      await writeSnapshot(athleteId, tombstone);
      const claimsBurned = await burnOpenClaimsForAthlete(athleteId);
      await appendAdminAudit({
        action: "snapshot_delete",
        athleteId: athleteId,
        actor: "admin",
        ok: true,
        detail: claimsBurned ? "tombstone+claims:" + claimsBurned : "tombstone",
      });
    } catch (e) {
      return storageUnavailable(res, e);
    }
    return res.status(200).json({ ok: true, deleted: true, revoked: true, storage: storageInfo() });
  }

  return res.status(405).json({ error: "Method not allowed" });
};

async function getCoachDirectives(athleteId) {
  const id = safeAthleteId(athleteId);
  if (!id) return "";
  const snap = await readSnapshot(id);
  if (!snap || !snap.coachDirectives) return "";
  return String(snap.coachDirectives).slice(0, 1000);
}

module.exports.getCoachDirectives = getCoachDirectives;
module.exports.readSnapshot = readSnapshot;
module.exports.writeSnapshot = writeSnapshot;
module.exports.listSnapshots = listSnapshots;
module.exports.safeAthleteId = safeAthleteId;
module.exports.hashWriteKey = hashWriteKey;
