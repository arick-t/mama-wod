/**
 * A rehearsal must not cost him a mail quota.
 *
 * He tests joining, editing and renewal on the PREVIEW deployment, and every run was
 * sending real mail he had already verified worked (owner, 2026-09-02). Preview sends
 * nothing now.
 *
 * The other half of that promise matters just as much: PRODUCTION still sends. A
 * code-level "off" is exactly the switch that ships and gets discovered a week later,
 * when a client has signed and nobody was told.
 *
 * Run: node scripts/app-mail-suppress.test.js
 */
const assert = require("assert");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const Mail = require("../lib/send-app-mail.js");

function env(vercelEnv, forced) {
  if (vercelEnv === null) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
  if (forced === null) delete process.env.APP_MAIL_ENABLED;
  else process.env.APP_MAIL_ENABLED = forced;
}

/* --- who is silent and who is not --------------------------------------- */

env("preview", null);
ok("A PREVIEW DEPLOY SENDS NOTHING", Mail.mailSuppressedReason() === "preview_deploy_no_mail");

env("production", null);
ok("PRODUCTION STILL SENDS", Mail.mailSuppressedReason() === "");

env(null, null);
ok("local dev is not treated as preview", Mail.mailSuppressedReason() === "");

env("development", null);
ok("nor is a development deploy", Mail.mailSuppressedReason() === "");

/* --- the environment can force either answer ---------------------------- */

env("preview", "1");
ok("mail can be forced on for a preview", Mail.mailSuppressedReason() === "");
env("preview", "true");
ok("and it accepts a word, not only a digit", Mail.mailSuppressedReason() === "");
env("production", "0");
ok("mail can be forced off in production", Mail.mailSuppressedReason() === "mail_disabled_by_env");
env("production", "off");
ok("also by word", Mail.mailSuppressedReason() === "mail_disabled_by_env");

/* --- what a caller sees ------------------------------------------------- */

(async function () {
  env("preview", null);
  process.env.BREVO_API_KEY = "test-key-not-used";
  const res = await Mail.sendAppMail({ to: "a@b.co", subject: "Join", text: "hi" });
  ok("a suppressed send does not claim to have sent", res.sent === false);
  /* Suppressed and "no API key" are very different problems, so they do not share a
     reason — a missing key is something to fix, this is something we chose. */
  ok("it says it was suppressed, not that it failed", res.suppressed === true);
  ok("and names the reason", res.reason === "preview_deploy_no_mail");

  env("preview", null);
  delete process.env.BREVO_API_KEY;
  const noKey = await Mail.sendAppMail({ to: "a@b.co", subject: "Join", text: "hi" });
  ok("suppression is decided before the provider is even looked at", noKey.reason === "preview_deploy_no_mail");

  /* Every caller already treats {sent:false} as "no mail went" — that is why one gate
     covers join, edit, renewal, coach feedback and the weekly report. */
  const src = require("fs").readFileSync(require.resolve("../lib/send-app-mail.js"), "utf8");
  ok("the gate sits in the one place mail leaves from", /const suppressed = mailSuppressedReason\(\);/.test(src));

  env(null, null);
  console.log("app-mail-suppress.test.js passed");
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
