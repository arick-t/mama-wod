#!/usr/bin/env node
/**
 * One way in, for everyone: a link AND a code.
 *
 * The studio side has worked this way since 21.7. The athlete side had a one-time link
 * on its own, which meant whoever saw the link had the programme — a link forwarded in a
 * family chat is a link anyone can spend. The owner's instruction on 2026-09-02: "כמו
 * סטודיו בדיוק — זה תהליך הבניה+שליחה החדש והאחיד שלנו לכולם".
 *
 * The handoff module reads and writes Blob storage directly, so what is pinned here is
 * the decisions rather than a round trip: which order things happen in, what is stored,
 * and what is refused. The order is the part that matters most — see below.
 *
 * 0 LLM. No network.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Access = require("../lib/client-access");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok — " + name);
  passed++;
}

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "scripts", "lib", "admin", "admin-handoff.js"), "utf8");
const claim = fs.readFileSync(path.join(root, "claim.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

/* --- the code is born with the link --------------------------------- */

ok("the code maths is the studio's, not a second copy", /require\("\.\.\/\.\.\/\.\.\/lib\/client-access"\)/.test(src));
ok("a code is generated when a link is", /Access\.generateCode\(\)/.test(src));
ok("only its hash is stored", /codeHash: Access\.hashValue\(accessCode\)/.test(src));
ok("the plaintext is never written to the claim", !/code: accessCode,\s*\n\s*codeAttempts/.test(src));
ok("it is handed back once, on the create response", /code: accessCode,/.test(src));
ok("the snapshot records that a code went out, not the code", /lastHandoffCodeAt/.test(src) && !/lastHandoffCode\s*=/.test(src));

/* --- THE ORDER. This is the assertion that matters ------------------
 *
 * The burn lock used to be taken before the claim was even read, which was fine when the
 * link was the only credential. With a code, taking the lock first would mean a wrong
 * guess destroys a link the athlete had every right to use — a self-inflicted denial of
 * service, one typo wide.
 */
const readAt = src.indexOf("const claim = await getJson(claimKey(token));");
const lockAt = src.indexOf("const lockKey = CLAIM_PREFIX + token");
const codeAt = src.indexOf("if (claim.codeHash) {");
ok("the claim is read first", readAt > 0);
ok("the code is checked before anything is burned", codeAt > readAt && codeAt < lockAt);
ok("and the burn comes last", lockAt > codeAt);

/* --- what a wrong code costs ---------------------------------------- */

ok("a wrong code is counted", /claim\.codeAttempts = \(Number\(claim\.codeAttempts\) \|\| 0\) \+ 1/.test(src));
ok("the count is persisted, or it is not a count", /await putJson\(claimKey\(token\), claim\)/.test(src));
ok("guesses run out", /MAX_CODE_ATTEMPTS/.test(src) && /code_locked/.test(src));
ok("five of them", /const MAX_CODE_ATTEMPTS = 5/.test(src));
ok("the athlete is told how many are left", /attemptsLeft/.test(src));
ok("a missing code is asked for rather than counted", /error: "code_required"/.test(src));

/* Comparison must be constant-time and hash-to-hash — never the plaintext. */
ok("the comparison is the studio's safe one", /Access\.safeEqual\(claim\.codeHash, Access\.hashValue\(submitted\)\)/.test(src));

/* --- links already in athletes' hands keep working ------------------ */

ok("a claim with no code hash is still redeemable", /if \(claim\.codeHash\) \{/.test(src));
ok("the reason is written down", /issued before codes existed/.test(src));

/* --- the claim page asks for it -------------------------------------- */

ok("the page has somewhere to type it", /id="code-input"/.test(claim));
ok("six digits, and a numeric keyboard on a phone", /maxlength="6"/.test(claim) && /inputmode="numeric"/.test(claim));
ok("it offers the one-time-code autofill", /autocomplete="one-time-code"/.test(claim));
ok("16px, or iOS zooms the page when the field is focused", /\.code-input\{[^}]*font-size:22px/.test(claim));
ok("it probes without a code first, so an older link still opens", /redeem\(""\)\.then\(handleRedeem\)/.test(claim));
ok("a link that wants a code asks instead of failing", /error === "code_required"/.test(claim));
ok("a wrong code says so and lets them try again", /error === "code_wrong"/.test(claim));
ok("the code travels on the request", /"&code=" \+ encodeURIComponent\(code\)/.test(claim));

/* --- and the owner sees it exactly once ------------------------------ */

ok("the code is shown when the link is made", /id="handoff-code"/.test(admin));
ok("it says it will not be shown again", /לא יוצג שוב/.test(admin));
ok("the owner is told to send both", /שלח את הלינק והקוד/.test(admin));
/* One button issues both, and pressing it again is how a second device gets in. */
ok("one button issues the pair", /צור לינק חדש|צור לינק/.test(admin));

/* --- the code itself, from the module that makes it ------------------ */

const code = Access.generateCode();
ok("six digits", /^\d{6}$/.test(code));
ok("never starts with a zero, so it reads cleanly aloud", code[0] !== "0");
ok("the hash is not the code", Access.hashValue(code) !== code);
ok("the same code hashes the same way", Access.hashValue(code) === Access.hashValue(code));
ok("a different code does not", Access.hashValue(code) !== Access.hashValue("000000"));
ok("comparison is safe against length games", Access.safeEqual("abc", "abcd") === false);

console.log("All handoff code checks passed (" + passed + " assertions).");
