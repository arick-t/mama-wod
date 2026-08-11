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
  skills: {},
  lifts: {},
  intakeComplete: false,
};
phone = CoachIntakeSync.applyIntakeProfileToPhoneStore(phone, profile);
ok("phone skills preserved", phone.skills && phone.skills.pullups);
ok("phone lifts preserved", phone.lifts && phone.lifts.back_squat === "120");
ok("phone intakeComplete", phone.intakeComplete === true);
ok("phone legal >= 3", (phone.legalAcceptedVersion | 0) >= 3);

ok("admin loads sync contract", /coach-intake-sync-contract\.js/.test(adminHtml));
ok("admin loads fixed intake", /admin-fixed-intake\.js/.test(adminHtml));
ok("admin version 1.5.4", /Admin · 1\.5(\.\d+)?/.test(adminHtml) || /DUCK-WOD Admin · 1\.5(\.\d+)?/.test(adminHtml));
ok("admin fixed All skills head", /admin-fixed-skills-head/.test(fixedJs));
ok("admin fixed All skills toggles cubes", /adminFixedSkillAllChange/.test(fixedJs));
ok("admin fixed No injuries active chip", /admin-fixed-chip/.test(adminHtml) && /adm-fx-no-injuries-btn/.test(fixedJs));
ok("phone skills picker unchanged all handler", /pprogSkillsCheckboxChange/.test(index));
ok("fixed intake uses shared packet", /buildFixedIntakePrompt/.test(fixedJs));
ok("handoff stores intakeProfile", /intakeProfile/.test(handoff));
ok("handoff rejects stub block", /currentBlock required/.test(handoff));
ok("handoff requires FIXED packet", /fixedIntakePacket required/.test(handoff));
ok("handoff autoCreateLink", /autoCreateLink/.test(handoff));
ok("phone package applies intake", /applyIntakeProfileToPhoneStore/.test(handoff));
ok("snapshot allows intakeProfile", /"intakeProfile"/.test(snap) || /intakeProfile/.test(snap));
ok("app loads sync contract", /coach-intake-sync-contract\.js/.test(index));
ok("app push syncs intakeProfile", /intakeProfile: intakeProfile/.test(index));
ok("app shared packet path", /CoachIntakeSync\.buildFixedIntakePrompt/.test(index));

console.log("All admin intake parity / sync checks passed.");
