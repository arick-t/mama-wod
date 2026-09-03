/**
 * Admin intake parity + sync contract (HARD).
 * Run: node scripts/admin-intake-parity.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const CoachIntakeSync = require("../lib/coach-intake-sync-contract");
const JoinMail = require("../lib/admin-intake-complete-mail");

const root = path.join(__dirname, "..");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const handoff = fs.readFileSync(path.join(root, "scripts/lib/admin/admin-handoff.js"), "utf8");
const snap = fs.readFileSync(path.join(root, "scripts/lib/admin/admin-snapshot.js"), "utf8");
const fixedJs = fs.readFileSync(path.join(root, "admin-fixed-intake.js"), "utf8");
const claimHtml = fs.readFileSync(path.join(root, "claim.html"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const sample = {
  displayName: "Ariel",
  gender: "male",
  preferredLanguage: "en",
  age: "34",
  bodyweight: "82",
  experience: "4 years CF",
  trainingLocations: { functional_gym: true },
  trainingSetup: "Well-equipped functional training gym",
  trainingDays: ["sun", "mon", "wed", "fri"],
  scheduleNotes: "sessions ~60 min",
  activeRecoveryPref: "no",
  lifts: { back_squat: "120", deadlift: "140", clean_jerk: "", snatch: "", run_2000: "8.5" },
  skills: { pullups: true, toes_to_bar: true },
  sessionLimits: "Max 55 min",
  injuries: "No injuries",
  goals: "Engine + strength",
  intakeComplete: true,
};

const packet = CoachIntakeSync.buildFixedIntakePrompt(sample);
ok("packet starts FIXED INTAKE COMPLETE", /^FIXED INTAKE COMPLETE/i.test(packet));
/* --- four weeks, and the deload is a fact we hand over ------------------
 * Settled by the owner on 2026-09-02 and written into the coach's layers: a brick is a
 * MONTH. The deload runs on an absolute week counter across months, so it can land on
 * week 2 of one block and week 4 of the next — which means the coach must be TOLD where
 * it is. "A deload week is given to you. Never choose one yourself."
 */
ok("the packet asks for four weeks", /build a full 4-week training brick/.test(packet));
ok("and says exactly four", /exactly 4 weeks/.test(packet));
ok("nothing asks for a fifth week any more", !/5-week|exactly 5 weeks|Week 5/.test(packet));
const wk4 = CoachIntakeSync.buildFixedIntakePrompt(Object.assign({}, sample, { blockStartWeek: 1, deloadEveryWeeks: 4 }));
ok("the deload is stated as a position", /^DELOAD: week 4 of this 4-week block/m.test(wk4));
ok("and the coach is told not to move it", /Do NOT choose a different one, and do NOT add a fifth week/.test(wk4));
const wk2 = CoachIntakeSync.buildFixedIntakePrompt(Object.assign({}, sample, { blockStartWeek: 3, deloadEveryWeeks: 4 }));
ok("a block that starts mid-cadence carries the deload where it really lands", /^DELOAD: week 2 of/m.test(wk2));
const none = CoachIntakeSync.buildFixedIntakePrompt(Object.assign({}, sample, { blockStartWeek: 1, deloadEveryWeeks: 6 }));
ok("a block with no deload in it says so", /^DELOAD: no deload week falls inside this block/m.test(none));
ok("block 1 of a monthly cadence deloads in week 4", CoachIntakeSync.deloadWeekIndexForBlock(1, 4) === 4);
ok("so does block 2, counted absolutely", CoachIntakeSync.deloadWeekIndexForBlock(5, 4) === 4);
ok("a cadence of six leaves a four-week block clean", CoachIntakeSync.deloadWeekIndexForBlock(1, 6) === null);
ok("no cadence means no deload", CoachIntakeSync.deloadWeekIndexForBlock(1, 0) === null);

/* The coach asked for both as FIELDS: reading them out of prose is one substring away
   from being wrong, and was (coach agent, 2026-09-02). */
const gen = CoachIntakeSync.athleteProfileForGenerateBlock(
  Object.assign({}, sample, { competitor: true }),
  { blockStartWeek: 5, deloadEveryWeeks: 4 }
);
ok("the profile states competitor as a boolean", gen.competitor === true);
ok("the profile states the block length", gen.blockWeeks === 4);
ok("and where the deload is", gen.deloadWeekIndex === 4);
ok("packet has schedule", /Training days: Sun, Mon, Wed, Fri/.test(packet));
ok("packet has lifts", /Back Squat: 120 kg/.test(packet));
ok("packet has goals", /Engine \+ strength/.test(packet));
/* Competing changes what a block is for, so the coach is told in as many words rather
   than left to notice it inside free text (owner, 2026-09-02). */
ok("packet states whether the athlete competes", /^COMPETITOR: no —/m.test(packet));
ok(
  "and says so plainly when they do",
  /^COMPETITOR: YES/m.test(CoachIntakeSync.buildFixedIntakePrompt(Object.assign({}, sample, { competitor: true })))
);
/* --- the four marks the coach asked for on 2026-09-02 ------------------
 * Its argument, and it is right: the intake is remarkably precise about what an athlete
 * CAN do — fourteen lifts in kg, fourteen skills as marks — and free text in the two
 * things that actually LIMIT a prescription: what load is available, and what movement
 * is forbidden. Every answer that carries a decision now gets its own tagged line, in
 * both directions, each carrying the instruction for when there is no answer.
 */
const marked = CoachIntakeSync.buildFixedIntakePrompt(
  Object.assign({}, sample, {
    improveFocus: { max_strength: true, gymnastics: true },
    avoidMovements: { deep_squat: true, jumping: true },
    heaviestImplementKg: 24,
    avoidInProgram: "No burpees, ever.",
  })
);
const unmarked = CoachIntakeSync.buildFixedIntakePrompt(sample);
ok("what to improve is stated", /^IMPROVE FOCUS: Max strength/m.test(marked));
ok("and stated when nothing was chosen", /^IMPROVE FOCUS: none selected/m.test(unmarked));
ok("what to program around is stated", /^AVOID: Deep squat/m.test(marked));
ok("and stated when nothing was marked", /^AVOID: none marked\.$/m.test(unmarked));
ok("the heaviest implement is a number", /^HEAVIEST IMPLEMENT: 24 kg\.$/m.test(marked));
/* --- and the line reads the ROOM, not the value ------------------------
 * In a proper box the question is never asked, so a zero there means "no ceiling", not
 * "unknown". The old wording told the coach "never by a kg figure" for an athlete who
 * had just reported fourteen lifts in kg — it would have cancelled the %1RM table for
 * most of them (coach agent, 2026-09-03).
 */
const fullGym = CoachIntakeSync.buildFixedIntakePrompt(
  Object.assign({}, sample, { trainingLocations: { functional_gym: true }, heaviestImplementKg: 0 })
);
const smallRoom = CoachIntakeSync.buildFixedIntakePrompt(
  Object.assign({}, sample, { trainingLocations: { other_home: true }, heaviestImplementKg: 0 })
);
ok("a full gym is told to prescribe by %1RM", /^HEAVIEST IMPLEMENT: full gym loading available/m.test(fullGym));
ok("and is never told to avoid kg figures", !/never by a kg figure/.test(fullGym));
ok("a limited room carries the ceiling warning", /^HEAVIEST IMPLEMENT: not stated/m.test(smallRoom) && /never by a kg figure/.test(smallRoom));
/* Older profiles carry only the sentence, not the map — and an explicit map always wins
   over the sentence, which is why this one is built without one. */
const legacyRoom = Object.assign({}, sample);
delete legacyRoom.trainingLocations;
legacyRoom.trainingSetup = "Other - home or limited equipment";
legacyRoom.heaviestImplementKg = 0;
ok(
  "a legacy profile is read from its setup text",
  /never by a kg figure/.test(CoachIntakeSync.buildFixedIntakePrompt(legacyRoom))
);

/* The box under the movement families reached the coach nowhere at all. */
ok(
  "what else to program around has a line of its own",
  /^AVOID \(also\): no burpees after the knee$/m.test(
    CoachIntakeSync.buildFixedIntakePrompt(Object.assign({}, sample, { avoidMovementsOther: "no burpees after the knee" }))
  )
);
ok("and it is there when empty too", /^AVOID \(also\): nothing else stated\.$/m.test(unmarked));
ok("what he does not want is stated", /^DOES NOT WANT: No burpees, ever\.$/m.test(marked));
ok("and stated when nothing was said", /^DOES NOT WANT: nothing stated\.$/m.test(unmarked));

/* Keys, not prose — the same reason competitor became a key. */
const withMarks = CoachIntakeSync.athleteProfileForGenerateBlock(
  Object.assign({}, sample, {
    improveFocus: { engine: true },
    avoidMovements: { running: true },
    heaviestImplementKg: "32",
    avoidInProgram: "no burpees",
  })
);
ok("improveFocus is a field", withMarks.improveFocus && withMarks.improveFocus.engine === true);
ok("avoidMovements is a field", withMarks.avoidMovements && withMarks.avoidMovements.running === true);
ok("heaviestImplementKg is a number", withMarks.heaviestImplementKg === 32);
ok("avoidInProgram is a field", withMarks.avoidInProgram === "no burpees");
ok("an unanswered heaviest implement is 0, not empty", CoachIntakeSync.athleteProfileForGenerateBlock(sample).heaviestImplementKg === 0);
/* The ids ARE the contract: they map one-to-one onto the coach's substitution matrix,
   so renaming one silently would break it. */
ok(
  "the avoid families are exactly the seven agreed",
  CoachIntakeSync.AVOID_MOVEMENT_DEFS.map(function (d) { return d.id; }).join(",") ===
    "deep_squat,hinge_deadlift,overhead_press,hanging_bar,kipping,jumping,running"
);
ok(
  "and the improve focuses are the six agreed",
  CoachIntakeSync.IMPROVE_FOCUS_DEFS.map(function (d) { return d.id; }).join(",") ===
    "max_strength,engine,gymnastics,olympic_lifting,general_fitness,specific_skill"
);

/* --- the studio's own packet ------------------------------------------
 * Its twin, and deliberately NOT briefFor(): that one is a reminder for the owner while
 * he writes by hand, and a string serving two masters follows neither rule. */
const StudioIntake = require("../lib/client-intake.js");
const studioPacket = StudioIntake.buildStudioIntakePrompt({
  scheduleMode: "session_count",
  sessionsPerWeek: 3,
  sessionsDiffer: true,
  sessionTypes: ["long strength + short metcon", "partner metcon, one part only", "stations"],
  stations: "6 barbells, 3 ergs",
  population: "CrossFit class 12-20",
  sessionMinutes: 60,
  deloadWeek: true,
  deloadEveryWeeks: 4,
});
ok("the studio packet exists and asks for four weeks", /^STUDIO INTAKE COMPLETE/.test(studioPacket) && /exactly 4 weeks/.test(studioPacket));
ok("it states the stations", /^STATIONS: 6 barbells, 3 ergs$/m.test(studioPacket));
ok("the session types arrive in order", /1\. long strength \+ short metcon[\s\S]*2\. partner metcon[\s\S]*3\. stations/.test(studioPacket));
ok("and it says there are no weekdays in this mode", /WEEKDAYS: none/.test(studioPacket));
const emptyStudio = StudioIntake.buildStudioIntakePrompt({});
ok("an unstated room carries the instruction", /^STATIONS: not stated/m.test(emptyStudio) && /sharing and rotation/.test(emptyStudio));
ok("briefFor stays a human reminder, not a prompt", !/BLOCK_JSON/.test(StudioIntake.briefFor({})));

ok("the tick box is on the Goals step", /id="adm-fx-competitor"/.test(fixedJs));
/* The improve list belongs to that tick box (owner, 2026-09-03): for someone training
   for general fitness the answer is the balance itself, and asking invites an answer
   that narrows a plan nobody wanted narrowed. The packet still carries the line in both
   directions, so nothing downstream changes shape. */
ok("the improve list is hidden until he says he competes", /id="adm-fx-improve-wrap"' \+ \(st\.competitor === true \? "" : " hidden"\)/.test(fixedJs));
ok("ticking it opens the list", /adminFixedCompetitorChanged/.test(fixedJs));
ok("and unticking drops what was marked", /intakeState\.improveFocus = intakeState\.competitor === true \? improveMap : \{\}/.test(fixedJs));
ok("and it is carried on the profile", CoachIntakeSync.normalizeIntakeProfile(Object.assign({}, sample, { competitor: true })).competitor === true);

const profile = CoachIntakeSync.normalizeIntakeProfile(sample);
ok("normalized has fixedIntakePacket", /^FIXED INTAKE COMPLETE/i.test(profile.fixedIntakePacket));
ok("skillsSummary non-empty", !!profile.skillsSummary);

ok(
  "join mail not ready on create (no Terms)",
  !JoinMail.snapshotReadyForJoinMail({
    currentBlock: { blockStart: "2026-08-09", weeks: [{ theme: "W1" }] },
    intakeNotifySent: false,
  })
);
ok(
  "join mail not ready without blockStart",
  !JoinMail.snapshotReadyForJoinMail({
    currentBlock: { weeks: [{ theme: "W1" }] },
    declarationAcceptedAt: "2026-08-13T12:00:00.000Z",
    intakeNotifySent: false,
  })
);
ok(
  "join mail ready after Terms + real block",
  JoinMail.snapshotReadyForJoinMail({
    currentBlock: { blockStart: "2026-08-09", weeks: [{ theme: "W1" }] },
    declarationAcceptedAt: "2026-08-13T12:00:00.000Z",
    intakeNotifySent: false,
  })
);
ok(
  "join mail skipped if already sent",
  !JoinMail.snapshotReadyForJoinMail({
    currentBlock: { blockStart: "2026-08-09", weeks: [{ theme: "W1" }] },
    declarationAcceptedAt: "2026-08-13T12:00:00.000Z",
    joinMailSent: true,
  })
);

const apiProfile = CoachIntakeSync.athleteProfileForGenerateBlock(sample);
ok("generate profile has fixedIntakePacket", !!apiProfile.fixedIntakePacket);
ok("generate profile intakeComplete", apiProfile.intakeComplete === true);
ok("generate preferredLanguage en", apiProfile.preferredLanguage === "en");
const billed = CoachIntakeSync.athleteProfileForGenerateBlock(sample, {
  athleteId: "a_testuid1234",
  costCaps: { monthlyUnits: { "2026-08": 8 } },
  israelToday: "2026-08-13",
});
ok("generate profile carries athleteId", billed.athleteId === "a_testuid1234");
ok("generate profile monthlyUnitsUsed from map", billed.monthlyUnitsUsed === 8);
ok("newAthleteId format", /^a_[0-9a-f]{12}$/.test(CoachIntakeSync.newAthleteId()));
ok("brick fill units match cost lib", CoachIntakeSync.BRICK_FILL_UNITS === 8);

let phone = {
  legalAcceptedVersion: 1,
  legalAcceptedAt: "2026-01-01T00:00:00.000Z",
  skills: {},
  lifts: {},
  intakeComplete: false,
};
phone = CoachIntakeSync.applyIntakeProfileToPhoneStore(phone, profile);
ok("phone skills preserved", phone.skills && phone.skills.pullups);
ok("phone lifts preserved", phone.lifts && phone.lifts.back_squat === "120");
ok("phone intakeComplete", phone.intakeComplete === true);
ok("phone legal not auto-stamped", (phone.legalAcceptedVersion | 0) === 1);
ok("phone legalAcceptedAt preserved", phone.legalAcceptedAt === "2026-01-01T00:00:00.000Z");

ok("admin loads sync contract", /coach-intake-sync-contract\.js/.test(adminHtml));
ok("admin loads normalize block lib", /normalize-pprog-block\.js/.test(adminHtml));
ok("admin loads shared pprog display", /pprog-display\.js/.test(adminHtml));
ok("admin normalizes snapshot on list", /NormalizePprogBlock\.normalize/.test(adminHtml));
ok("admin block uses shared brick view", /PprogDisplay\.renderBrickView/.test(adminHtml));
ok("admin block render is read-only", /readOnly:\s*true/.test(adminHtml));
ok("admin fixed intake normalizes block", /NormalizePprogBlock\.normalize/.test(fixedJs));
ok("handoff stores lastHandoffPath", /lastHandoffPath/.test(handoff));
ok("admin create does not send join mail", !/sendAdminIntakeCompleteMail/.test(handoff));
ok("handoff inline in athlete card", /renderHandoffInline/.test(adminHtml) && /ath-handoff-inline/.test(adminHtml));
/* --- a click beside the box is not a decision ------------------------
 * He was two steps into an intake, clicked next to it by accident, and lost everything
 * he had typed (owner, 2026-09-03). */
ok("the intake box does not close on an outside click", !/id="intake-modal" onclick/.test(adminHtml));
ok("nor does the kind chooser", !/id="client-kind-modal" onclick/.test(adminHtml));
ok("and closing it on purpose asks first", /לצאת מהתחקור\? מה שהוקלד יימחק\./.test(fixedJs));
ok("but only while something is actually being filled in", /intakeState\.fixedActive && !intakeState\.intakeComplete/.test(fixedJs));

ok("admin loads fixed intake", /admin-fixed-intake\.js/.test(adminHtml));
ok("admin version 3.1.0", /DUCK-WOD Admin · 3\.1\.0/.test(adminHtml));
ok("admin wired to coach 2.3.14", /LIVE_COACH_VERSION = "2\.3\.14"/.test(adminHtml));
ok("app coach 2.3.14", /COACH_VERSION = "2\.3\.14"/.test(index));
ok(
  "admin shows Admin + Coach versions",
  /Admin 3\.1\.0/.test(adminHtml) &&
    /ver-coach/.test(adminHtml) &&
    /syncAdminVersionLabels/.test(adminHtml) &&
    /ADMIN_UI_VERSION = "3\.1\.0"/.test(adminHtml)
);
ok(
  "admin intake uses pprog classes 1:1",
  /pprog-fixed-intake/.test(fixedJs) &&
    (/pprog-lifts-row/.test(fixedJs) || /renderFixedLiftsRowsHtml/.test(fixedJs))
);
ok(
  "shared numeric keyboard contract",
  /renderFixedLiftsRowsHtml/.test(
    fs.readFileSync(path.join(root, "lib", "coach-intake-sync-contract.js"), "utf8")
  ) &&
    /bindIntakeNumericKeyboards/.test(
      fs.readFileSync(path.join(root, "lib", "coach-intake-sync-contract.js"), "utf8")
    ) &&
    /renderFixedLiftsRowsHtml/.test(fixedJs) &&
    /bindIntakeNumericKeyboards/.test(fixedJs)
);
ok(
  "admin intake fixed lang en",
  /id="intake-fixed" lang="en" dir="ltr"/.test(adminHtml)
);
ok("admin skills vertical like app", /pprog-skills-picker/.test(fixedJs) && /adminFixedSkillAllChange/.test(fixedJs));
ok("admin No injuries chip", /pprog-fixed-chip/.test(fixedJs) && /adm-fx-no-injuries-btn/.test(fixedJs));
ok("admin build overlay uses coach video", /adminIntakeBuildOverlay/.test(adminHtml) && /coach-thinking\.mp4/.test(adminHtml));
ok("admin build restores goals on fail", /restoreAdminFixedGoals/.test(fixedJs));
ok("admin Build plan sends admin auth", /adminAuthHeaders\(\)/.test(fixedJs) && /adminProgramming:\s*true/.test(fixedJs));
ok("admin Build plan timeout kept", /180000/.test(fixedJs));
ok("admin does not auto-retry abort/timeout", /אל תלחץ Build שוב מיד/.test(fixedJs));
/* A session token IS being logged in. Gating Build on the raw password refused every
   build after an ordinary login — the login is what clears the password, so logging in
   again could not help (owner, 2026-09-02). */
ok("Build plan accepts a session, not only a password", /adminIsAuthed\(\)/.test(fixedJs));
ok("and it never gates on the password alone", !/if \(typeof adminPw !== "undefined" && !String\(adminPw \|\| ""\)\.trim\(\)\)/.test(fixedJs));
ok("admin generate_block sends athleteId", /athleteId: intakeState.athleteId/.test(fixedJs));
ok("admin records brick_fill on UID", /recordBrickFill/.test(fixedJs));
ok("handoff snapshot stores costCaps", /costCaps:/.test(handoff) && /cloneCostCaps/.test(handoff));
ok("handoff phone package inherits costCaps", /costCaps: CoachIntakeSync.cloneCostCaps\(snap.costCaps\)/.test(handoff));
ok("admin Build plan sends password body", /withAdminPassword\(payload\)/.test(fixedJs));
ok(
  "admin build error not blanket 503 gemini",
  /admin_not_configured/.test(adminHtml) &&
    /function friendlyCoachError[\s\S]*&& status === 503[\s\S]*GEMINI/.test(adminHtml) &&
    !/function friendlyCoachError[\s\S]*\|\| status === 503/.test(adminHtml)
);
ok("admin Build my plan CTA", /Build my plan/.test(fixedJs));
ok(
  "admin api base for GitHub Pages",
  /function getAdminApiBase/.test(adminHtml) &&
    /function adminApiUrl/.test(adminHtml) &&
    /fetch\(adminApiUrl\("\/api\//.test(adminHtml) &&
    !/fetch\("\/api\//.test(adminHtml)
);
ok("admin fixed intake uses adminApiUrl", /adminApiUrl\("\/api\/personal-coach"\)/.test(fixedJs));
/* The claim page builds its URL before fetching it — it may carry a code now. */
ok("claim uses adminApiUrl", /function adminApiUrl/.test(claimHtml) && /adminApiUrl\("\/api\/admin-handoff/.test(claimHtml));
ok("admin hides FAB during intake", /admin-intake-open/.test(adminHtml) && /setAdminIntakeModalOpen/.test(adminHtml) && /adminChatFabWrap[\s\S]*hidden/.test(adminHtml));
ok("admin recovery nested under Yes", /pprog-fixed-recovery-branch/.test(fixedJs) && /Under Yes/.test(fixedJs));
ok("admin recovery no Thu default", /activeRecoveryDay:\s*""/.test(fixedJs));
ok("phone recovery nested under Yes", /pprog-fixed-recovery-branch/.test(index));
ok("snapshot delete uses tombstone", /tombstone/.test(snap) && /isDeletedSnapshot/.test(snap));
ok("handoff package does not pre-accept legal", /pendingAthleteLegal:\s*true/.test(handoff) && /legalAcceptedVersion:\s*0/.test(handoff));
ok("app gates plan until legal", /pendingAthleteLegal/.test(index) && /pprogEnsureLegalAccepted/.test(index));
ok("phone skills picker unchanged all handler", /pprogSkillsCheckboxChange/.test(index));
ok("fixed intake uses shared packet", /buildFixedIntakePrompt/.test(fixedJs));
ok("handoff stores intakeProfile", /intakeProfile/.test(handoff));
ok("handoff rejects stub block", /currentBlock required/.test(handoff));
ok("handoff requires FIXED packet", /fixedIntakePacket required/.test(handoff));
ok("handoff autoCreateLink", /autoCreateLink/.test(handoff));
ok("phone package applies intake", /applyIntakeProfileToPhoneStore/.test(handoff));
ok("snapshot allows intakeProfile", /"intakeProfile"/.test(snap) || /intakeProfile/.test(snap));
ok("app loads sync contract", /coach-intake-sync-contract\.js/.test(index));
ok("app loads normalize block lib", /normalize-pprog-block\.js/.test(index));
ok("app push syncs intakeProfile", /intakeProfile: intakeProfile/.test(index));
ok("app shared packet path", /CoachIntakeSync\.buildFixedIntakePrompt/.test(index));
ok(
  "phone keeps same athleteId on reclaim",
  /reclaimSameAthlete:\s*true/.test(index) && !/pprogMintNewAthleteIdentity/.test(index)
);
ok(
  "join email after Terms on snapshot write",
  /sendAdminIntakeCompleteMail/.test(snap) &&
    /snapshotReadyForJoinMail/.test(snap) &&
    /declarationAcceptedAt/.test(fs.readFileSync(path.join(root, "lib", "admin-intake-complete-mail.js"), "utf8"))
);
ok("phone package does not pre-mark join mail", /intakeNotifySent:\s*false/.test(handoff) && /Join mail waits/.test(handoff));
ok("app join mail requires Terms", /if \(!store\.legalAcceptedAt\) return/.test(index));
ok("admin remembers session token not password", /pw-remember/.test(adminHtml) && /persistAdminSession/.test(adminHtml) && /tryRestoreAdminSession/.test(adminHtml) && /dw_admin_session/.test(adminHtml) && /clearLegacyAdminPasswordStore/.test(adminHtml));
/* ------------------------------------------------------------------------
 * THE POLL MUST NOT COST THE WHOLE LIST.
 *
 * It used to: every twenty seconds the admin downloaded every athlete in full, training
 * blocks and all, because building the list means fetching each object. Roughly 2,300
 * object reads and tens of megabytes an hour, per open tab. On 2026-09-02 Vercel
 * suspended the Blob store for the month and the whole product went dark — production
 * included.
 *
 * A poll asks one small question now. These assertions are the reason it stays that way.
 * --------------------------------------------------------------------- */
ok("there is still a live poll", /startAdminLivePoll/.test(adminHtml));
ok("it asks for a stamp, not the list", /pollAdminListStamp\(\);/.test(adminHtml) && /action: "admin_list_stamp"/.test(adminHtml));
ok("the poll does NOT fetch the list directly", !/\}, ADMIN_POLL_MS\);[\s\S]{0,80}loadAthletes/.test(adminHtml));
ok("only a changed stamp pays for the list", /if \(!stamp \|\| stamp === lastAdminListStamp\) return;/.test(adminHtml));
ok("returning to the tab asks the cheap question too", /if \(!document\.hidden && adminIsAuthed\(\)\) pollAdminListStamp\(\)/.test(adminHtml));
ok("the interval is not faster than it was", /ADMIN_POLL_MS = 45000/.test(adminHtml));
ok("the page remembers what it is holding", /lastAdminListStamp = String\(/.test(adminHtml));

/* The server side of the same promise. */
ok("the stamp is its own action", /body\.action === "admin_list_stamp"/.test(snap));
ok("it reads an index, not every athlete", /async function readSnapshotStamp/.test(snap) && /getJson\(SNAP_INDEX_KEY\)/.test(snap));
ok("the index is kept true on every write", /await touchSnapshotIndex\(id, payload\)/.test(snap));
ok("a full list still carries the stamp to compare against", /stamp: stampFromRows\(listed\.rows\)/.test(snap));
/* Rebuilding is the expensive path and must stay off the poll. */
ok("a rebuild only happens when there is no index at all", /if \(!idx \|\| !Array\.isArray\(idx\.rows\)\) idx = await rebuildSnapshotIndex\(\)/.test(snap));
ok("admin_list mints session token header", /mintAdminSessionToken/.test(snap) && /X-Admin-Session-Token/.test(snap));
ok("admin 401 forces logout", /forceAdminLogout/.test(adminHtml) && /loadAthletes[\s\S]{0,900}status === 401/.test(adminHtml));
ok("admin session uses ADMIN_SESSION_SECRET", /ADMIN_SESSION_SECRET/.test(fs.readFileSync(path.join(root, "scripts/lib/admin/admin-auth.js"), "utf8")));
ok(
  "snapshot does not stamp declaration from joinedAt",
  /declarationAcceptedAt: String\(/.test(snap) &&
    /existing\.declarationAcceptedAt \|\|\s*""/.test(snap)
);
ok("snapshot size fits full brick", /MAX_SNAPSHOT_BYTES = 256 \* 1024/.test(snap));
ok("admin_save_day pendingAdminDayEdit", /admin_save_day/.test(snap) && /pendingAdminDayEdit/.test(snap) && /function adminPprogEditSave/.test(adminHtml));
ok("admin edit pencil wired", /allowEdit:\s*true/.test(adminHtml) && /pprog-edit-btn/.test(adminHtml));
ok("T4 pull on existing offer", /pendingAdminDayEdit/.test(snap) && /athlete_pull_push_offer/.test(snap) && /pprogApplyPendingAdminDayEdit/.test(index));
ok("fill all missing weeks", /Fill every week that still lacks real parts/.test(index));
ok("push snapshot after week fill", /pprogPushAdminSnapshotDebounced\(s2, "week_fill"\)/.test(index));
ok(
  "snapshot reclaim same id",
  /snapshot_reclaim/.test(snap) && /allowUnboundBind/.test(snap)
);
ok(
  "fresh Terms each new intake sitting",
  /pprogRequireFreshLegalForNewIntakeSitting/.test(index) &&
    /intakeSittingLegalOk/.test(index)
);
ok(
  "admin gets declarationAcceptedAt from device",
  /declarationAcceptedAt:\s*store\.legalAcceptedAt/.test(index) &&
    /declarationAcceptedAt/.test(snap) &&
    /CLIENT_ALLOWED_KEYS[\s\S]*declarationAcceptedAt/.test(snap)
);

/* ------------------------------------------------------------------------
 * Scheduling limits folded into the weekly schedule.
 *
 * They were two steps asking one question — when do you train, and for how long — four
 * steps apart, which is how an athlete ends up describing their week differently in each
 * half. The owner merged them on 2026-09-02, in the shape the studio intake already
 * uses: a number, and a tick box for the case a number cannot say it ("45 minutes, but
 * Friday can be 90").
 *
 * THREE files hold this questionnaire and all three have to agree.
 * --------------------------------------------------------------------- */
const contractSrc = fs.readFileSync(path.join(root, "lib", "coach-intake-sync-contract.js"), "utf8");

ok("the contract has eight steps, not nine", /"skills",\s*\n\s*"injuries",/.test(contractSrc));
ok("there is no limits step left", !/"limits",/.test(contractSrc));
ok("the admin's copy has no limits step", !/key === "limits"/.test(fixedJs));
ok("the athlete's copy has no limits step either", !/key === "limits"/.test(index));

/* The number, asked identically on both sides. */
ok("the admin asks how long a session is", /id="adm-fx-minutes" type="number" min="20" max="120"/.test(fixedJs));
ok("the athlete is asked the same", /id="pprog-fx-minutes" type="number" min="20" max="120"/.test(index));
ok("the admin has the different-times box", /id="adm-fx-times-differ"/.test(fixedJs));
ok("the athlete has it too", /id="pprog-fx-times-differ"/.test(index));
ok("ticking it reveals the text, on both", /function adminFixedToggleTimes/.test(fixedJs) && /function pprogFixedToggleTimes/.test(index));

/* An answer nobody gave must not be kept: text under an unticked box is discarded. */
ok("the admin drops text when the box is unticked", /intakeState\.sessionTimesDiffer && limEl/.test(fixedJs));
ok("so does the athlete", /store\.sessionTimesDiffer && limEl/.test(index));

/* And it is refused rather than guessed, exactly as the studio intake refuses it. */
ok("the admin refuses a session with no length", /How long is a session\?/.test(fixedJs));
ok("the athlete is refused too", /How long is a session\?/.test(index));

/* The point of asking: the coach has to be told. */
ok("the length reaches the coach's packet", /SESSION LENGTH:/.test(contractSrc));
ok("and the athlete's own prompt", /"Session length: "/.test(index));
ok("it travels with the rest of the intake", /"sessionMinutes",/.test(contractSrc));
ok("and onto the phone package", /pkg\.sessionMinutes = p\.sessionMinutes/.test(contractSrc));

/* ------------------------------------------------------------------------
 * A FAILED READ IS NOT AN EMPTY LIST.
 *
 * listSnapshots() used to turn any read failure into [], and the endpoint returned it
 * with ok:true. A storage hiccup therefore reached the owner as "you have no clients" —
 * no error, no logout, nothing to act on. On 2026-09-02 he sat looking at a strip that
 * said "0 לקוחות · 0 מתאמנים · 0 תוכניות" while his session, his header and his credit
 * balance all worked, and the only honest reading of that screen was that his data was
 * gone. It was not.
 * --------------------------------------------------------------------- */
ok(
  "a failed snapshot read is not swallowed into an empty list",
  !/if \(e && e\.code === "blob_required"\) throw e;\s*\n\s*return \[\];/.test(snap)
);
ok("the reason is written down where it happened", /indistinguishable from data loss/.test(snap));
/* Reporting it must not take the page down either — throwing turned the silent empty
   list into a 500 that would not open at all. The failure travels WITH the answer, so
   the admin still opens and still tells the truth about what it could not read. */
ok("a read failure is reported, not thrown", /listError: listed\.error \|\| undefined/.test(snap));
ok("the page refuses to believe an unreadable list", /לא הצלחתי לקרוא את רשימת המתאמנים/.test(adminHtml));
ok("and says nothing was deleted", /שום דבר לא נמחק/.test(adminHtml));

/* And the page must not present a failure as data. */
ok("a failed list refresh is always announced", /רענון הרשימה נכשל/.test(adminHtml));
/* The dangerous path was the one that answered "ok" with nothing in it — that one is
   never silent now. A dropped connection stays quiet on a background poll: a toast on
   every network blip is noise, and a blip never presented itself as data. */
ok(
  "a bad answer is announced even on a background poll",
  /showHdrToast\(\s*\n?\s*"רענון הרשימה נכשל"/.test(adminHtml)
);
ok("the page reads the server's own storage report", /function warnIfStorageIsNotDurable/.test(adminHtml));
ok("and says so plainly when it is not durable", /אחסון לא זמין בשרת/.test(adminHtml));
ok("the warning insists nothing was deleted", /שום דבר לא נמחק/.test(adminHtml));
ok("it is checked on both the restore and the refresh", (adminHtml.match(/warnIfStorageIsNotDurable\(/g) || []).length >= 3);

console.log("All admin intake parity / sync checks passed.");
