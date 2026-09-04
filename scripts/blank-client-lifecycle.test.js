/**
 * A blank client's whole life, mail included.
 * Run: node scripts/blank-client-lifecycle.test.js
 *
 * The owner's last question before this ships: does everything the other kinds of
 * client get apply to this one too — the mail when they sign, the mail when they
 * change a workout, and the reminder when their block runs out (owner, 2026-09-04).
 *
 * Asserted by walking it: create, hand over a code, sign, approve, let the client
 * edit, then run the renewal check on a day past the end of a SIX-week block — which
 * is the length only this kind can ask for, and the one a four-week assumption would
 * get wrong.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log("ok —", name);
}

const root = path.join(__dirname, "..");
const modPath = require.resolve("../api/client-program.js");
const storePath = require.resolve("../scripts/lib/admin/admin-json-store.js");
const authPath = require.resolve("../scripts/lib/admin/admin-auth.js");
const mailPath = require.resolve("../lib/send-app-mail.js");

const data = new Map();
const mails = [];

delete require.cache[modPath];
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: {
    async getJson(k) {
      const hit = data.get(k);
      return hit === undefined ? null : JSON.parse(JSON.stringify(hit));
    },
    async putJson(k, v) {
      data.set(k, JSON.parse(JSON.stringify(v)));
      return { pathname: k };
    },
    async putJsonExclusive(k, v) {
      if (data.has(k)) {
        const e = new Error("already_exists");
        e.code = "already_exists";
        throw e;
      }
      data.set(k, JSON.parse(JSON.stringify(v)));
      return { pathname: k };
    },
    async deleteJson(k) {
      data.delete(k);
      return { pathname: k };
    },
    async listJson() {
      return [];
    },
    storageInfo() {
      return { backend: "memory", durable: true };
    },
  },
};
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    checkAdminAuth(req) {
      return String(((req && req.headers) || {})["x-admin-password"] || "") === "owner-pw";
    },
    adminAuthDenied(res) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    },
    adminAuthUsedPassword() {
      return true;
    },
    mintAdminSessionToken() {
      return "aws1.test.token";
    },
    sessionSecretReady() {
      return true;
    },
    sessionSecretSource() {
      return "configured";
    },
    MIN_SESSION_SECRET_LEN: 32,
  },
};
require.cache[mailPath] = {
  id: mailPath,
  filename: mailPath,
  loaded: true,
  exports: {
    async sendAppMail(opts) {
      mails.push(opts || {});
      return { sent: true };
    },
    hasMailProvider() {
      return true;
    },
    resolveAppMailTo() {
      return "owner@example.com";
    },
    mailSuppressedReason() {
      return "";
    },
  },
};

process.env.CLIENT_ACCESS_SECRET = "a-test-secret-long-enough-to-be-real";
process.env.APP_MAIL_TO = "owner@example.com";
process.env.BREVO_API_KEY = "test-key";

const handler = require("../api/client-program.js");

let seq = 0;
function call(headers, body) {
  return new Promise(function (resolve) {
    let code = 200;
    const res = {
      headersSent: false,
      setHeader() {},
      status(c) { code = c; return res; },
      json(payload) { resolve({ status: code, body: payload }); return res; },
      end() { resolve({ status: code, body: null }); return res; },
    };
    seq += 1;
    const from = { "x-forwarded-for": "10.7." + ((seq >> 8) & 255) + "." + (seq & 255) };
    handler(
      { method: "POST", headers: Object.assign(from, headers || {}), body: body || {}, socket: {} },
      res
    );
  });
}
const owner = function (body) {
  return call({ "x-admin-password": "owner-pw" }, body);
};
const client = function (token, body) {
  return call({ "x-client-token": token }, Object.assign({ as: "client" }, body));
};

async function main() {
  /* --- created with four answers and a length of his own ------------------ */

  const made = await owner({
    action: "create",
    clientKind: "blank",
    clientName: "דני",
    clientGender: "male",
    monthlyAmount: 400,
    paymentMethod: "ביט",
    blockWeeks: 6,
    blockStart: "2026-09-06",
  });
  const p = made.body.program;
  ok("a blank client is created", made.status === 200 && p.clientKind === "blank");
  ok("six weeks, because he asked for six", p.weeks.length === 6);

  /* --- handed over exactly like anyone else ------------------------------- */

  const code = await owner({ action: "issue_code", programId: p.programId });
  ok("a code is issued", /^\d{6}$/.test(code.body.code));
  const claimed = await call({}, {
    action: "claim",
    programId: p.programId,
    code: code.body.code,
    deviceLabel: "iPhone",
  });
  ok("and redeemed on a phone", claimed.status === 200 && !!claimed.body.clientToken);
  const token = claimed.body.clientToken;

  mails.length = 0;
  const signed = await client(token, { action: "sign", programId: p.programId, accepted: true });
  ok("the client signs the same terms", signed.status === 200);
  ok("and the owner is told they joined", mails.length === 1);
  ok("by name", String(mails[0].subject || "").indexOf("דני") >= 0 || String(mails[0].text || "").indexOf("דני") >= 0);
  ok("with a way straight to them", String(mails[0].text || "").indexOf(p.programId) >= 0);

  /* --- the owner writes, approves, and the client edits ------------------- */

  const readBack = await owner({ action: "read", programId: p.programId });
  const wrote = await owner({
    action: "save",
    programId: p.programId,
    expectedVersion: readBack.body.program.version,
    program: {
      weeks: (function () {
        const w = JSON.parse(JSON.stringify(readBack.body.program.weeks));
        w[0].days.sun.parts = [{ id: "s1", title: "Part A", lines: ["5x5 back squat"] }];
        return w;
      })(),
    },
  });
  ok("the owner writes a day", wrote.status === 200);
  const approved = await owner({
    action: "approve_block",
    programId: p.programId,
    expectedVersion: wrote.body.program.version,
    blockIndex: 1,
  });
  ok("and sends the block", approved.status === 200);

  const seen = await client(token, { action: "read", programId: p.programId });
  ok("the client sees all six weeks", seen.body.program.weeks.length === 6);

  mails.length = 0;
  const edited = await client(token, {
    action: "save",
    programId: p.programId,
    expectedVersion: seen.body.program.version,
    edits: [
      {
        weekIndex: 1,
        dayKey: "sun",
        parts: [{ id: "s1", title: "Part A", lines: ["5x5 back squat @ 80kg"] }],
      },
    ],
  });
  ok("the client can edit their own day", edited.status === 200);
  ok("and the owner is told about it", mails.length === 1 && /changed a workout/i.test(String(mails[0].subject || "")));

  /* --- the block runs out ------------------------------------------------- */

  const Renewal = require("../lib/client-renewal.js");
  const live = (await owner({ action: "read", programId: p.programId })).body.program;
  const endsOn = Renewal.blockEndIso(live, live.blocks[0]);
  ok("a six-week block ends six weeks out, not four", endsOn === "2026-10-17");

  mails.length = 0;
  const early = await owner({ action: "renewal_check", todayIso: "2026-09-20" });
  ok("nothing is sent in the middle of the block", early.status === 200 && mails.length === 0);

  mails.length = 0;
  const due = await owner({ action: "renewal_check", todayIso: "2026-10-15" });
  ok("the reminder goes out as it runs out", due.status === 200 && mails.length === 1);
  ok("and it names the client", String(mails[0].subject || "" ).indexOf("דני") >= 0 || String(mails[0].text || "").indexOf("דני") >= 0);

  mails.length = 0;
  await owner({ action: "renewal_check", todayIso: "2026-10-16" });
  ok("and it is sent once, not once a day", mails.length === 0);

  /* --- nothing about this kind is special where it must not be ------------ */

  const api = fs.readFileSync(path.join(root, "api", "client-program.js"), "utf8");
  const mailBlock = api.slice(api.indexOf("async function notifyOwnerOfSignature"));
  ok("no mail path asks what kind of client it is", mailBlock.indexOf("clientKind") < 0);
  const renewalSrc = fs.readFileSync(path.join(root, "lib", "client-renewal.js"), "utf8");
  ok("neither does the renewal", renewalSrc.indexOf("clientKind") < 0);
  ok("and the renewal reads the block's own length", /parseInt\(block\.weekCount, 10\)/.test(renewalSrc));

  console.log("\nAll blank-client lifecycle checks passed (" + passed + " assertions).");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
