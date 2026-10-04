/**
 * THE END-USER DECLARATION — that it is the app's own words, to the character.
 *
 * lib/end-user-terms.js was not retyped from the app; it was extracted by running the app's
 * own pprogLegalBodyHtml(). This test re-runs that extraction and compares. If anyone edits
 * either copy, the two stop matching and this fails — which is the only way legal wording
 * should ever be allowed to change: on purpose, in both places, by the owner.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const Terms = require("../lib/end-user-terms.js");
const B2B = require("../lib/client-terms.js");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ── the text is the app's, verbatim ──────────────────────────────────────── */

const start = indexHtml.indexOf("function pprogLegalBodyHtml()");
const end = indexHtml.indexOf("function pprogLegalAllChecked()");
ok("the app still carries the declaration", start > 0 && end > start);

const fromApp = new Function(
  "PPROG_LEGAL_TERMS_ID",
  indexHtml.slice(start, end) + "; return pprogLegalBodyHtml();"
)(Terms.TERMS_VERSION);

ok("and the shared module holds exactly it", Terms.BODY_HTML === fromApp);

/* ── the version the audit row is written under ───────────────────────────── */

ok("the terms id matches the app's", /var PPROG_LEGAL_TERMS_ID = "v2\.0-legal"/.test(indexHtml));
ok("and so does the record version", /var PPROG_LEGAL_VERSION = 3/.test(indexHtml));
ok("the module agrees", Terms.TERMS_VERSION === "v2.0-legal" && Terms.LEGAL_VERSION === 3);

/* ── what the document actually says ──────────────────────────────────────── */

ok("it is the liability waiver, not the B2B terms", /COMPLETE LIABILITY WAIVER/.test(Terms.BODY_HTML));
ok("and never names the signer as an operator", !/active operator/i.test(Terms.BODY_HTML));
ok("English is the binding version", /Official Legal Binding Text/.test(Terms.BODY_HTML));
ok("and the Hebrew says it is a translation", /הטקסט המחייב הוא באנגלית/.test(Terms.BODY_HTML));
ok("all six clauses are there", (Terms.BODY_HTML.match(/<h4>/g) || []).length === 6);
ok("the age clause is in it", /at least 18 years of age/.test(Terms.BODY_HTML));
ok("so is the one about AI not being a professional", /NOT certified personal trainers/.test(Terms.BODY_HTML));
ok("and the one about third-party processing", /Google Gemini/.test(Terms.BODY_HTML));

/* ── three acknowledgements, and all of them required ─────────────────────── */

ok("there are three", Terms.FLAGS.length === 3);
ok("named as the app has always named them",
  Terms.flagIds().join(",") === "age18,aiResponsibility,termsPrivacy");
ok("each says something in both languages", Terms.FLAGS.every(function (f) {
  return f.en && f.he && f.clause >= 1;
}));
ok("none alone is an acceptance", Terms.flagIds().every(function (id) {
  const one = {};
  one[id] = true;
  return !Terms.allAccepted(one);
}));
ok("two of three is not either", !Terms.allAccepted({ age18: true, aiResponsibility: true }));
ok("all three is", Terms.allAccepted({ age18: true, aiResponsibility: true, termsPrivacy: true }));
ok("and a non-true value never counts", !Terms.allAccepted({ age18: "yes", aiResponsibility: 1, termsPrivacy: true }));

/* ── who signs which, and what gets written down ──────────────────────────── */

const api = fs.readFileSync(path.join(root, "api", "client-program.js"), "utf8");
const page = fs.readFileSync(path.join(root, "client.html"), "utf8");
const Access = require("../lib/client-access.js");

ok("there is ONE answer to which document a kind signs", /function termsPlanFor\(clientKind\)/.test(api));
ok("a gym client signs the end-user declaration", /=== "gym"[\s\S]{0,160}kind: "end_user"/.test(api));
ok("and everyone else keeps the B2B one", /return \{ kind: "b2b", version: Terms.TERMS_VERSION/.test(api));
ok("the gate measures against THAT document", /Access\.isSignedForCurrentTerms\(accessRow, plan\.version\)/.test(api));
ok("and the 403 says which one is owed", /termsKind: plan\.kind/.test(api));
ok("so does the answer to a claim, before the first screen is drawn", /termsKind: claimPlan\.kind/.test(api));
ok("an incomplete declaration is refused", /FLAGS_REQUIRED/.test(api));
ok("and the refusal names what is missing", /missing: EndUserTerms\.flagIds\(\)\.filter/.test(api));

/* The kind is stamped by the SERVER from the client's own record. A page that could choose
   its own document could sign the cheaper one on the harder client's behalf. */
ok("the document is stamped server-side", /termsVersion: plan\.version,[\s\S]{0,120}termsKind: plan\.kind/.test(api));
ok("and never taken from the request", !/termsKind: body\./.test(api));

/* What the row has to be able to say a year from now. */
const sig = Access.recordSignature(null, {
  programId: "p_test",
  accepted: true,
  deviceId: "d_1",
  termsVersion: Terms.TERMS_VERSION,
  termsKind: "end_user",
  flags: { age18: true, aiResponsibility: true, termsPrivacy: true },
}).signature;
ok("the record says which document", sig.termsKind === "end_user");
ok("and under which version", sig.termsVersion === "v2.0-legal");
ok("and keeps the three answers apart", Object.keys(sig.flags).sort().join(",") === "age18,aiResponsibility,termsPrivacy");
ok("and still carries the device, the time and the browser",
  !!sig.deviceId && !!sig.signedAt && "ua" in sig && "ip" in sig);

/* A non-true value must never be stored as consent. */
const coerced = Access.recordSignature(null, {
  programId: "p_test", accepted: true, deviceId: "d_1", termsKind: "end_user",
  flags: { age18: "yes", aiResponsibility: 1, termsPrivacy: true },
}).signature;
ok("a value that is not true is written as false", coerced.flags.age18 === false && coerced.flags.aiResponsibility === false);

/* A B2B signature is untouched by any of this. */
const b2b = Access.recordSignature(null, { programId: "p_test", accepted: true, deviceId: "d_1" }).signature;
ok("a B2B signature gains no flags", !("flags" in b2b));
ok("and no document label it never had", !("termsKind" in b2b));

/* ── the page ─────────────────────────────────────────────────────────────── */

ok("the client page loads the declaration", /<script src="lib\/end-user-terms\.js"><\/script>/.test(page));
ok("it draws one row per confirmation", /t\.FLAGS\.map\(function \(f\)/.test(page));
ok("in both languages", /esc\(f\.en\)[\s\S]{0,80}esc\(f\.he\)/.test(page));
ok("and sends each answer separately", /flags\[id\] = b\.checked === true;/.test(page));
ok("the page is told which document, never guesses", /if \(r\.body\.termsKind\) termsKind = String\(r\.body\.termsKind\);/.test(page));

console.log("\nההצהרה של מתאמן הקצה — מילה במילה כמו באפליקציה, ושלוש הסכמות נפרדות.");
