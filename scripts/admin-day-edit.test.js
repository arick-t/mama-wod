/**
 * T4 admin day edit — 0 LLM lock / quality / apply.
 * Run: node scripts/admin-day-edit.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const AdminDayEdit = require("../lib/admin-day-edit");
const NormalizePprogBlock = require("../lib/normalize-pprog-block");

const root = path.join(__dirname, "..");
const snap = fs.readFileSync(path.join(root, "scripts/lib/admin/admin-snapshot.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const week = {
  overview: [
    { day: "sun", focus: "Rest" },
    { day: "mon", focus: "Squat" },
    { day: "tue", focus: "Engine" },
  ],
  days: {
    sun: { parts: [{ id: "sun-0", title: "REST DAY", lines: ["Rest"] }] },
    mon: {
      parts: [
        {
          id: "mon-0",
          title: "Strength",
          lines: ["Intent: squat pattern", "5x5 Back Squat:", "5 x 80kg"],
        },
      ],
    },
    tue: {
      parts: [{ id: "tue-0", title: "Engine", lines: ["AMRAP 12", "Row 250m"] }],
      finishFeedback: { rating: "good" },
    },
  },
};

ok("training part is saveable", AdminDayEdit.partsAreSaveable(week.days.mon.parts).ok);
ok(
  "empty parts rejected",
  !AdminDayEdit.partsAreSaveable([]).ok && AdminDayEdit.partsAreSaveable([]).error === "empty"
);
ok(
  "intent-only orphan rejected",
  !AdminDayEdit.partHasRealContent({ title: "Strength", lines: ["Intent: squat"] })
);
ok(
  "title + format accepted",
  AdminDayEdit.partHasRealContent({ title: "Metcon", lines: ["AMRAP 12"] })
);
ok(
  "title + work accepted without note",
  AdminDayEdit.partHasRealContent({ title: "Strength", lines: ["Back squat 5x5"] })
);

/* 21.7 reversed this on purpose. A rest day is a PLAN, not a fact — replacing it
 * with a session is one of the most ordinary edits there is, and the old lock meant
 * the pencil either never appeared or appeared and then refused to save.
 *
 * The assertion is kept rather than deleted, inverted, so if anyone re-locks rest
 * days this fails and says why. */
ok(
  "a rest day is EDITABLE (21.7) — no lock",
  AdminDayEdit.lockReason("sun", week.days.sun, week, "2026-08-16", "2026-08-13", "save") === null
);
ok(
  "canEditDay agrees a rest day is editable",
  AdminDayEdit.canEditDay("sun", week.days.sun, week, "2026-08-16", "2026-08-13") === true
);
ok(
  "past day locked",
  AdminDayEdit.lockReason("mon", week.days.mon, week, "2026-08-12", "2026-08-13", "save").code ===
    "past"
);
ok(
  "done day locked",
  AdminDayEdit.lockReason("tue", week.days.tue, week, "2026-08-16", "2026-08-13", "apply").code ===
    "done"
);
ok(
  "logged extra locked",
  AdminDayEdit.lockReason(
    "mon",
    { parts: week.days.mon.parts, loggedExtraSession: true },
    week,
    "2026-08-16",
    "2026-08-13",
    "apply"
  ).code === "logged"
);
ok("today training unlocked", !AdminDayEdit.lockReason("mon", week.days.mon, week, "2026-08-13", "2026-08-13", "save"));
ok(
  "finishFeedback locks edit",
  AdminDayEdit.lockReason(
    "mon",
    { parts: week.days.mon.parts, finishFeedback: { rating: "just_right" } },
    week,
    "2026-08-16",
    "2026-08-13",
    "save"
  ).code === "done"
);

const sanitized = AdminDayEdit.sanitizeParts(
  [{ title: "Strength", lines: ["Back squat 3x5 90kg"] }],
  week.days.mon.parts,
  "mon"
);
ok("preserve existing part id", sanitized[0].id === "mon-0");

const pending = AdminDayEdit.buildPending({
  athleteId: "a1",
  weekIndex: 0,
  dayKey: "mon",
  dayIso: "2026-08-16",
  parts: sanitized,
  modifiedPartKinds: { strength: true },
});
ok("pending starts pending", pending.status === "pending" && /^ade_/.test(pending.id));

const applied = AdminDayEdit.applyPendingToDay(
  {
    parts: week.days.mon.parts,
    preTalk: "knees",
    debrief: "",
    lastPreReply: "ok",
  },
  pending,
  { week: week, dayKey: "mon", todayIso: "2026-08-13" }
);
ok("apply writes parts", applied.ok && applied.day.parts[0].lines[0].indexOf("90kg") >= 0);
ok("apply replaces full parts array", applied.day.parts.length === 1 && applied.day.parts[0].title === "Strength");
const three = AdminDayEdit.applyPendingToDay(
  { parts: week.days.mon.parts },
  AdminDayEdit.buildPending({
    athleteId: "a1",
    weekIndex: 0,
    dayKey: "mon",
    dayIso: "2026-08-16",
    parts: [
      { id: "mon-0", title: "Strength", lines: ["Back squat 3x5"] },
      { id: "mon-1", title: "Skill", lines: ["HSPU practice"] },
      { id: "mon-2", title: "Metcon", lines: ["AMRAP 12"] },
    ],
  }),
  { week: week, dayKey: "mon", todayIso: "2026-08-13" }
);
ok("apply 2→3 writes three parts", three.ok && three.day.parts.length === 3 && three.day.parts[2].title === "Metcon");
ok("apply keeps athlete preTalk", applied.day.preTalk === "knees" && applied.day.lastPreReply === "ok");
ok("apply sets coach notice", applied.day.coachUpdatedNotice === "המאמן עדכן את האימון");
ok(
  "human apply does not stamp MODIFIED",
  !applied.day.modifiedPartKinds || !applied.day.modifiedPartKinds.strength
);
ok(
  "pending save is already synced copy",
  AdminDayEdit.statusMessage(pending) === "סונכרן"
);

const conflict = AdminDayEdit.applyPendingToDay(
  {
    parts: week.days.mon.parts,
    athleteDayUpdatedAt: "2026-08-13T12:00:00.000Z",
  },
  Object.assign({}, pending, { at: "2026-08-13T11:00:00.000Z" }),
  { week: week, dayKey: "mon", todayIso: "2026-08-13" }
);
ok(
  "athlete revise after stamp blocks apply",
  !conflict.ok && conflict.reason === "athlete_updated"
);

/* Applying onto a rest day now works (21.7) — and it must ALSO move the week's
 * overview focus, or the day holds real programming and still renders as rest.
 * That is the trap lib/day-rest-toggle.js exists to prevent, so it is asserted
 * here against the renderer's own rest test rather than against our own data. */
const RestToggle = require("../lib/day-rest-toggle.js");
const Normalize = require("../lib/normalize-pprog-block.js");
ok(
  "sunday starts as a rest day",
  Normalize.isRestDay("sun", week.days.sun, week) === true
);
/* Build a pending FOR sunday — applyPendingToDay takes its day key from the pending
   itself, so reusing the monday pending here would silently test the wrong day. */
const sundayPending = AdminDayEdit.buildPending({
  athleteId: "a1",
  weekIndex: 0,
  dayKey: "sun",
  dayIso: "2026-08-16",
  parts: sanitized,
});
const restApply = AdminDayEdit.applyPendingToDay(week.days.sun, sundayPending, {
  week: week,
  dayKey: "sun",
  todayIso: "2026-08-13",
});
ok("applying onto a rest day is allowed", restApply.ok === true);
ok("the session content landed", (restApply.day.parts || []).length > 0);
ok("a focus change was reported", typeof restApply.focusHint === "string" && restApply.focusHint.length > 0);
ok(
  "the week's overview focus moved off Rest",
  RestToggle.isRestFocusText(RestToggle.overviewFocus(week, "sun")) === false
);
ok(
  "and the renderer now calls it a session",
  Normalize.isRestDay("sun", restApply.day, week) === false
);

const protectedBlock = AdminDayEdit.protectPendingDayParts(
  { weeks: [{ days: { mon: { parts: sanitized } } }] },
  { weeks: [{ days: { mon: { parts: week.days.mon.parts, preTalk: "from-phone" } } }] },
  pending
);
ok(
  "protect keeps admin parts while pending",
  protectedBlock.weeks[0].days.mon.parts[0].lines[0].indexOf("90kg") >= 0 &&
    protectedBlock.weeks[0].days.mon.preTalk === "from-phone"
);

const norm = NormalizePprogBlock.normalizeWeek(
  {
    days: {
      mon: {
        parts: sanitized,
        athleteDayUpdatedAt: "2026-08-13T12:00:00.000Z",
        coachUpdatedNotice: "המאמן עדכן את האימון",
        preTalk: "keep-me",
      },
    },
  },
  week,
  "2026-08-09",
  { weekIndex: 1 }
);
ok(
  "normalize keeps athlete stamp + notice + preTalk",
  norm.days.mon.athleteDayUpdatedAt === "2026-08-13T12:00:00.000Z" &&
    norm.days.mon.coachUpdatedNotice === "המאמן עדכן את האימון" &&
    norm.days.mon.preTalk === "keep-me"
);

ok("admin_save_day still 0 LLM", !/generate_block|generate_week_detail|revise_day|revise_week/.test(
  snap.slice(snap.indexOf('action === "admin_save_day"'), snap.indexOf('action === "admin_member_status"'))
));
ok("snapshot write can drop pastBlocks if oversized", /pastBlocks: \[\]/.test(snap) && /Snapshot too large/.test(snap));
ok(
  "admin_save_day does not stamp MODIFIED",
  /modifiedPartKinds:\s*\{\}/.test(
    snap.slice(snap.indexOf('action === "admin_save_day"'), snap.indexOf('action === "admin_member_status"'))
  ) && !/detectModifiedPartKinds/.test(
    snap.slice(snap.indexOf('action === "admin_save_day"'), snap.indexOf('action === "admin_member_status"'))
  )
);
ok("pull returns pendingAdminDayEdit", /pendingAdminDayEdit: AdminDayEdit\.publicPending/.test(snap));
ok("resolve admin day edit action", /athlete_resolve_admin_day_edit/.test(snap));
ok("preserve pendingAdminDayEdit on snapshot write", /pendingAdminDayEdit: existing\.pendingAdminDayEdit/.test(snap));
ok("device pull applies pending", /pprogApplyPendingAdminDayEdit/.test(index));
ok("device stamps athleteDayUpdatedAt on chat revise", /athleteDayUpdatedAt: pprogNowIso/.test(index));
ok("admin save does not convert rest", !/REST DAY", lines: \["Rest"\]/.test(admin));
ok("no generate from pencil save", !/generate_block|generate_week_detail|revise_day/.test(
  admin.slice(admin.indexOf("function adminPprogEditSave"), admin.indexOf("function changeBlockMonth"))
));
ok("save toast is synced", /נשמר וסונכרן/.test(admin) && !/ממתין לסנכרון למכשיר/.test(admin));

console.log("All admin-day-edit T4 checks passed.");
