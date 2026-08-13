/**
 * Admin intake parity + sync contract (HARD).
 * Run: node scripts/admin-intake-parity.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const CoachIntakeSync = require("../lib/coach-intake-sync-contract");

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
ok("packet has schedule", /Training days: Sun, Mon, Wed, Fri/.test(packet));
ok("packet has lifts", /Back Squat: 120 kg/.test(packet));
ok("packet has goals", /Engine \+ strength/.test(packet));

const profile = CoachIntakeSync.normalizeIntakeProfile(sample);
ok("normalized has fixedIntakePacket", /^FIXED INTAKE COMPLETE/i.test(profile.fixedIntakePacket));
ok("skillsSummary non-empty", !!profile.skillsSummary);

const apiProfile = CoachIntakeSync.athleteProfileForGenerateBlock(sample);
ok("generate profile has fixedIntakePacket", !!apiProfile.fixedIntakePacket);
ok("generate profile intakeComplete", apiProfile.intakeComplete === true);
ok("generate preferredLanguage en", apiProfile.preferredLanguage === "en");

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
ok("admin fixed intake normalizes block", /NormalizePprogBlock\.normalize/.test(fixedJs));
ok("handoff stores lastHandoffPath", /lastHandoffPath/.test(handoff));
ok("admin create sends intake mail", /sendAdminIntakeCompleteMail/.test(handoff));
ok("handoff panel in athlete tab", /ath-handoff-panel/.test(adminHtml) && /renderHandoffSectionBody/.test(adminHtml));
ok("admin loads fixed intake", /admin-fixed-intake\.js/.test(adminHtml));
ok("admin version 1.5.10", /DUCK-WOD Admin · 1\.5\.10/.test(adminHtml));
ok("admin wired to coach 2.3.13", /LIVE_COACH_VERSION = "2\.3\.13"/.test(adminHtml));
ok("app coach 2.3.13", /COACH_VERSION = "2\.3\.13"/.test(index));
ok(
  "admin shows Admin + Coach versions",
  /Admin 1\.5\.10/.test(adminHtml) &&
    /ver-coach/.test(adminHtml) &&
    /syncAdminVersionLabels/.test(adminHtml) &&
    /ADMIN_UI_VERSION = "1\.5\.10"/.test(adminHtml)
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
ok("admin Build plan timeout+retry", /180000/.test(fixedJs) && /retryLeft/.test(fixedJs));
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
ok("claim uses adminApiUrl", /function adminApiUrl/.test(claimHtml) && /fetch\(adminApiUrl\("\/api\/admin-handoff/.test(claimHtml));
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
  "join email after admin create",
  /sendAdminIntakeCompleteMail/.test(handoff)
);
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

console.log("All admin intake parity / sync checks passed.");
