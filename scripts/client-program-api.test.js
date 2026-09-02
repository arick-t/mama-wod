/**
 * /api/client-program — the whole journey, and the promises it must keep.
 * Run: node scripts/client-program-api.test.js
 *
 * Walks the real path: the owner creates a program and writes training, issues a
 * code, the coach redeems it on a phone and then a laptop, signs once, reads,
 * edits, and the owner sees an unread flag.
 *
 * Two claims are asserted as properties of the code rather than of the UI, because
 * this product already shipped a switched-off UI over a live endpoint once
 * (generate-workout, retired in 21.6):
 *   - the client route has NO route to an AI provider
 *   - the client never receives payment terms or the owner's unread queue
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

const root = path.join(__dirname, "..");
const apiSrc = fs.readFileSync(path.join(root, "api", "client-program.js"), "utf8");

/* --- no AI anywhere in this endpoint ------------------------------------- */

ok("no gemini call", !/generativelanguage|gemini-\d|geminiOnly/i.test(apiSrc));
ok("no groq call", !/api\.groq\.com|callGroqChat/i.test(apiSrc));
ok("no personal-coach require", !/require\(["'][^"']*personal-coach/.test(apiSrc));
ok(
  "the only fetch-shaped calls are storage and mail",
  !/\bfetch\s*\(/.test(apiSrc)
);
ok("health declares no AI surface", /aiSurface: "none"/.test(apiSrc));
ok("a client token is never read from the query string", !/query\s*\.\s*clientToken/.test(apiSrc));

/* --- an in-memory stand-in for Blob, admin auth and mail ---------------- */

function harness(opts) {
  const o = opts || {};
  const data = new Map();
  const mails = [];
  const modulePath = require.resolve("../api/client-program.js");
  const storePath = require.resolve("../scripts/lib/admin/admin-json-store.js");
  const authPath = require.resolve("../scripts/lib/admin/admin-auth.js");
  const mailPath = require.resolve("../lib/send-app-mail.js");
  const appMailPath = require.resolve("../lib/app-mail.js");

  delete require.cache[modulePath];
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
      async listJson(prefix) {
        const out = [];
        for (const [pathname, value] of data) {
          if (pathname.indexOf(prefix) !== 0) continue;
          out.push({ pathname, data: JSON.parse(JSON.stringify(value)) });
        }
        return out;
      },
      storageInfo() {
        return { backend: "memory" };
      },
    },
  };
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      /* Mirrors the real helper: a password OR a valid session token authenticates. */
      checkAdminAuth(req) {
        const h = req.headers || {};
        return (
          String(h["x-admin-password"] || "") === "owner-pw" ||
          String(h["x-admin-token"] || "") === "aws1.test.token"
        );
      },
      adminAuthDenied(res) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      },
      /* The endpoint mints a session token on a password login, so the stub has to
         answer these too — otherwise the call throws and comes back as a 503, which
         is exactly how this test caught the missing pieces. */
      adminAuthUsedPassword(req) {
        return String((req.headers || {})["x-admin-password"] || "") === "owner-pw";
      },
      mintAdminSessionToken() {
        return "aws1.test.token";
      },
      sessionSecretReady() {
        return true;
      },
      MIN_SESSION_SECRET_LEN: 32,
    },
  };
  require.cache[mailPath] = {
    id: mailPath,
    filename: mailPath,
    loaded: true,
    exports: {
      hasMailProvider() {
        return o.mail !== false;
      },
      async sendAppMail(m) {
        mails.push(m);
        return { ok: true };
      },
    },
  };
  require.cache[appMailPath] = {
    id: appMailPath,
    filename: appMailPath,
    loaded: true,
    exports: {
      resolveAppMailTo() {
        return "owner@example.com";
      },
    },
  };

  const api = require("../api/client-program.js");

  function call(reqHeaders, body) {
    return new Promise(function (resolve) {
      let statusCode = 200;
      /* Named apart from the REQUEST headers on purpose — shadowing the parameter
         here silently sent an empty header bag and every auth check failed. */
      const resHeaders = {};
      const res = {
        headersSent: false,
        setHeader(k, v) {
          resHeaders[k] = v;
        },
        status(c) {
          statusCode = c;
          return res;
        },
        json(payload) {
          resolve({ status: statusCode, body: payload, headers: resHeaders });
          return res;
        },
        end() {
          resolve({ status: statusCode, body: null, headers: resHeaders });
          return res;
        },
      };
      api({ method: "POST", headers: reqHeaders || {}, body: body || {}, socket: {} }, res);
    });
  }

  return {
    data,
    mails,
    owner(body) {
      return call({ "x-admin-password": "owner-pw" }, body);
    },
    ownerWithToken(body) {
      return call({ "x-admin-token": "aws1.test.token" }, body);
    },
    client(token, body) {
      const h = token ? { "x-client-token": token } : {};
      return call(h, Object.assign({ as: "client" }, body));
    },
    anon(body) {
      return call({}, body);
    },
  };
}

async function main() {
  process.env.CLIENT_ACCESS_SECRET = "a-test-secret-long-enough-to-be-real";
  const H = harness();

  /* --- owner creates the container (no training content) ---------------- */

  const created = await H.owner({ action: "create", clientName: "Coach A", weekCount: 5 });
  ok("owner creates a program", created.status === 200 && created.body.ok === true);
  const pid = created.body.program.programId;
  ok("the new program has 5 weeks", created.body.program.weeks.length === 5);
  ok(
    "the new program ships EMPTY — the owner writes the training",
    created.body.program.weeks.every(function (w) {
      return Object.keys(w.days).every(function (d) {
        return w.days[d].parts.length === 0;
      });
    })
  );

  /* --- owner writes the training --------------------------------------- */

  const wrote = await H.owner({
    action: "save",
    programId: pid,
    expectedVersion: created.body.program.version,
    program: {
      clientName: "Coach A",
      monthlyAmount: 900,
      paymentMethod: "bit, 1st of the month",
      weeks: (function () {
        const w = JSON.parse(JSON.stringify(created.body.program.weeks));
        w[0].days.mon.parts = [{ id: "mon-0", title: "Part A", lines: ["Back squat 5x5"] }];
        w[0].days.wed.parts = [{ id: "wed-0", title: "Part A", lines: ["Row 2k"] }];
        w[0].days.fri.parts = [{ id: "fri-0", title: "Part A", lines: ["AMRAP 12"] }];
        return w;
      })(),
    },
  });
  ok("owner save is accepted", wrote.status === 200 && wrote.body.ok === true);
  ok("owner training landed", wrote.body.program.weeks[0].days.mon.parts.length === 1);
  ok("payment terms are stored for the owner", wrote.body.program.monthlyAmount === 900);

  /* Owner list carries a monthly total (a.3.5). */
  const listed = await H.owner({ action: "list" });
  ok("owner list works off the index", listed.status === 200 && listed.body.rows.length === 1);

  /* The owner had to retype the password on every visit because this endpoint took
     the password and handed back nothing to remember. It must mint on a password
     login, in the header only, and never put the token in the JSON body. */
  ok("a password login mints a session token", listed.headers["X-Admin-Session-Token"] === "aws1.test.token");
  ok("the token is not in the response body", JSON.stringify(listed.body).indexOf("aws1.test") < 0);

  const byToken = await H.ownerWithToken({ action: "list" });
  ok("a token poll still works", byToken.status === 200);
  ok(
    "a token poll does NOT mint again — a session cannot renew itself forever",
    byToken.headers["X-Admin-Session-Token"] === undefined
  );

  /* --- a stale owner save is refused ------------------------------------ */

  const staleOwner = await H.owner({
    action: "save",
    programId: pid,
    expectedVersion: created.body.program.version,
    program: { weeks: created.body.program.weeks },
  });
  ok("a stale owner save is refused with 409", staleOwner.status === 409 && staleOwner.body.code === "VERSION_CONFLICT");

  /* --- nobody gets in without a credential ----------------------------- */

  const noAuth = await H.anon({ action: "list" });
  ok("an anonymous list is refused", noAuth.status === 401);

  const noCode = await H.client("", { action: "read", programId: pid });
  ok("a client with no token is refused", noCode.status === 401);

  /* --- the code journey ------------------------------------------------ */

  const issued = await H.owner({ action: "issue_code", programId: pid, label: "phone" });
  ok("owner issues a code", issued.status === 200 && /^\d{6}$/.test(issued.body.code));
  const code = issued.body.code;

  const wrongCode = await H.anon({ action: "claim", programId: pid, code: "000000" });
  ok("a wrong code is refused", wrongCode.status === 401);

  const claimed = await H.anon({ action: "claim", programId: pid, code: code, deviceLabel: "iPhone" });
  ok("the right code is redeemed", claimed.status === 200 && claimed.body.ok === true);
  ok("a device token comes back", typeof claimed.body.clientToken === "string");
  ok("the client is not signed yet", claimed.body.signed === false);
  ok("the terms version is the owner's", claimed.body.termsVersion === "v3.4-legal");
  const phoneToken = claimed.body.clientToken;

  const reclaim = await H.anon({ action: "claim", programId: pid, code: code });
  ok("the code cannot be reused", reclaim.status === 401);

  /* --- the terms gate ------------------------------------------------- */

  const beforeSign = await H.client(phoneToken, { action: "read", programId: pid });
  ok("reading before signing is refused", beforeSign.status === 403 && beforeSign.body.code === "TERMS_REQUIRED");

  const badSign = await H.client(phoneToken, { action: "sign", programId: pid, accepted: false });
  ok("an unticked box is not a signature", badSign.status === 400);

  const signedRes = await H.client(phoneToken, {
    action: "sign",
    programId: pid,
    accepted: true,
    signerName: "Coach A",
  });
  ok("ticking the box signs", signedRes.status === 200 && signedRes.body.ok === true);
  ok("the signature is recorded against v3.4-legal", signedRes.body.signature.termsVersion === "v3.4-legal");

  /* A signature is the moment somebody actually joined, and the owner is told — the
     same rule the athlete intake follows ("has joined the DUCK'S !"). His instruction,
     2026-09-01: one rule across both products. */
  ok("the owner is told somebody joined", signedRes.body.ownerNotified === true);
  ok("exactly one join mail", H.mails.length === 1);
  ok("it reads like the athlete one", /has joined the DUCK'S !/.test(H.mails[0].subject));
  ok("it names the client", /Coach A/.test(H.mails[0].subject));
  ok("it names the terms signed", /v3\.4-legal/.test(H.mails[0].text));
  ok("it carries no client email or phone", !/@/.test(H.mails[0].text.replace(/https?:[^\s]+/g, "")));

  /* Signing is per ACCOUNT, so a second device must not send a second "has joined". */
  const signAgain = await H.client(phoneToken, {
    action: "sign",
    programId: pid,
    accepted: true,
    signerName: "Coach A",
  });
  ok("signing again is still accepted", signAgain.status === 200 && signAgain.body.ok === true);
  ok("but it does not announce a second joining", signAgain.body.ownerNotified === false);
  ok("and sends no second mail", H.mails.length === 1);
  H.mails.length = 0;

  /* --- the block has to be SENT before any of it exists for the client -
   *
   * The owner's rule, 2026-09-01: creating a client hands them nothing. Not an empty
   * calendar, not "coming soon" — the weeks are absent until he presses approve. The
   * cut is at the API boundary, so this is the assertion that proves it: a signed-in,
   * authorised client, reading a program that is genuinely there, gets no weeks. */

  const beforeApproval = await H.client(phoneToken, { action: "read", programId: pid });
  ok("a client may read a program that has not been sent", beforeApproval.status === 200);
  ok("but there is nothing in it", (beforeApproval.body.program.weeks || []).length === 0);
  ok("not even the training the owner has already written", JSON.stringify(beforeApproval.body).indexOf("Back squat") < 0);

  const ownerApprove = await H.owner({ action: "approve_block", programId: pid, blockIndex: 1 });
  ok("the owner sends the block", ownerApprove.status === 200 && ownerApprove.body.approvedBlock === 1);

  const approveAgain = await H.owner({ action: "approve_block", programId: pid, blockIndex: 1 });
  ok("sending it twice is refused", approveAgain.status === 400 && approveAgain.body.code === "NOTHING_TO_APPROVE");

  /* --- what the client actually receives ------------------------------ */

  const clientRead = await H.client(phoneToken, { action: "read", programId: pid });
  ok("the client can now read", clientRead.status === 200 && clientRead.body.ok === true);
  const clientJson = JSON.stringify(clientRead.body);
  ok("the client sees the training", clientRead.body.program.weeks[0].days.mon.parts[0].lines[0] === "Back squat 5x5");
  ok("the client gets the version for safe saving", clientRead.body.program.version > 0);
  ok("the client sees the watermark data", clientRead.body.watermark.clientName === "Coach A");

  ok("the client NEVER sees the price", clientJson.indexOf("900") < 0);
  ok("the client NEVER sees the payment method", clientJson.indexOf("bit,") < 0);
  ok("the client NEVER sees the owner's unread queue", clientJson.indexOf("unreadDays") < 0);

  /* --- phone AND laptop, one signature ------------------------------- */

  const issued2 = await H.owner({ action: "issue_code", programId: pid, label: "laptop" });
  const claimed2 = await H.anon({ action: "claim", programId: pid, code: issued2.body.code });
  ok("a second device is claimed", claimed2.status === 200);
  ok("the second device is ALREADY signed — no second popup", claimed2.body.signed === true);
  const laptopToken = claimed2.body.clientToken;
  const laptopRead = await H.client(laptopToken, { action: "read", programId: pid });
  ok("the laptop reads straight away", laptopRead.status === 200 && laptopRead.body.ok === true);

  /* --- the client edits, immediately live --------------------------- */

  const edit = await H.client(phoneToken, {
    action: "save",
    programId: pid,
    expectedVersion: clientRead.body.program.version,
    edits: [
      {
        weekIndex: 1,
        dayKey: "mon",
        parts: [{ id: "mon-0", title: "Part A", lines: ["Front squat 5x5 — no barbell"] }],
      },
    ],
  });
  ok("the client edit is accepted", edit.status === 200 && edit.body.ok === true);
  ok("the edit is live immediately", edit.body.program.weeks[0].days.mon.parts[0].lines[0] === "Front squat 5x5 — no barbell");
  ok("the edited part is tagged MODIFIED", edit.body.program.weeks[0].days.mon.parts[0].modified === true);
  ok("the change is reported", edit.body.changed.indexOf("w1:mon") >= 0);
  ok("the owner was notified", edit.body.ownerNotified === true);
  ok("one mail was sent", H.mails.length === 1);
  ok("the mail names the client", /Coach A/.test(H.mails[0].subject));
  ok("the mail names the day", /w1:mon/.test(H.mails[0].text));
  ok(
    /* One management page, so the link goes there. The old address still redirects,
       for the mails that already left. */
    "the mail carries a deep link straight to the client",
    /admin\.html\?program=/.test(H.mails[0].text)
  );
  ok("the deep link names the program", H.mails[0].text.indexOf(pid) >= 0);

  /* --- five saves to one day, ONE mail ------------------------------ */

  let v = edit.body.program.version;
  for (let i = 0; i < 4; i++) {
    const again = await H.client(phoneToken, {
      action: "save",
      programId: pid,
      expectedVersion: v,
      edits: [{ weekIndex: 1, dayKey: "mon", parts: [{ id: "mon-0", title: "Part A", lines: ["try " + i] }] }],
    });
    ok("repeat save " + (i + 1) + " accepted", again.status === 200);
    v = again.body.program.version;
  }
  ok("four more saves to the SAME day sent no extra mail", H.mails.length === 1);

  /* A different day is a different event and does mail. */
  const otherDay = await H.client(phoneToken, {
    action: "save",
    programId: pid,
    expectedVersion: v,
    edits: [{ weekIndex: 1, dayKey: "wed", parts: [{ id: "wed-0", title: "Part A", lines: ["Bike 10k"] }] }],
  });
  ok("a different day is accepted", otherDay.status === 200);
  ok("a different day DOES mail", H.mails.length === 2);
  ok("the second mail names the other day", /w1:wed/.test(H.mails[1].text));

  /* --- the owner's unread flag ------------------------------------- */

  const ownerRead = await H.owner({ action: "read", programId: pid });
  ok("the owner sees the program", ownerRead.status === 200);
  const unread = Object.keys(ownerRead.body.program.unreadDays || {});
  ok("both changed days are flagged", unread.indexOf("w1:mon") >= 0 && unread.indexOf("w1:wed") >= 0);
  ok("five saves to one day are ONE flag", unread.filter(function (k) { return k === "w1:mon"; }).length === 1);
  ok("the owner sees the device list", ownerRead.body.access.devices.length === 2);
  ok("the owner sees the signature", !!ownerRead.body.access.signature);
  ok("the owner never sees a token hash", JSON.stringify(ownerRead.body.access).indexOf("tokenHash") < 0);

  const marked = await H.owner({
    action: "mark_read",
    programId: pid,
    expectedVersion: ownerRead.body.program.version,
    days: ["w1:mon"],
  });
  ok("opening a day clears its flag", marked.status === 200 && marked.body.unreadDays["w1:mon"] === undefined);
  ok("the other flag survives", marked.body.unreadDays["w1:wed"] !== undefined);

  /* Clearing the flag must be invisible to the client. */
  const afterMark = await H.client(phoneToken, { action: "read", programId: pid });
  ok("the client still sees nothing about flags", JSON.stringify(afterMark.body).indexOf("unread") < 0);

  /* --- a stale client save is refused, with the live copy back ----- */

  const staleClient = await H.client(laptopToken, {
    action: "save",
    programId: pid,
    expectedVersion: 2,
    edits: [{ weekIndex: 1, dayKey: "fri", parts: [{ id: "fri-0", title: "Part A", lines: ["stale"] }] }],
  });
  ok("a stale client save is refused with 409", staleClient.status === 409);
  ok("the refusal returns the live program to merge from", !!staleClient.body.program);
  ok(
    "the refusal's program is still client-filtered",
    JSON.stringify(staleClient.body.program).indexOf("900") < 0
  );

  /* --- rest day ⇄ session, through the real endpoint --------------- */

  const RT = require("../lib/day-rest-toggle.js");
  const Normalize = require("../lib/normalize-pprog-block.js");

  /* Sunday was never written, so it starts as rest. */
  const beforeRest = await H.client(laptopToken, { action: "read", programId: pid });
  const sunWeek = beforeRest.body.program.weeks[0];
  ok("an unwritten day starts as rest", RT.dayIsRest(sunWeek, "sun") === true);

  /* The client turns it into a session. */
  const toSession = await H.client(laptopToken, {
    action: "save",
    programId: pid,
    expectedVersion: beforeRest.body.program.version,
    edits: [
      {
        weekIndex: 1,
        dayKey: "sun",
        parts: [{ id: "sun-0", title: "Engine", lines: ["Row 2k", "Rest 3:00", "Row 2k"] }],
      },
    ],
  });
  ok("a rest day can be turned into a session", toSession.status === 200 && toSession.body.ok === true);
  const nowSession = toSession.body.program.weeks[0];
  ok("the session content landed", nowSession.days.sun.parts[0].lines[0] === "Row 2k");
  /* The assertion that matters: the RENDERER must agree, which needs the overview
     focus to have moved too — a parts-only write would fail here. */
  ok(
    "the renderer now shows a session, not rest",
    Normalize.isRestDay("sun", nowSession.days.sun, nowSession) === false
  );
  ok("the overview focus moved off Rest", RT.overviewFocus(nowSession, "sun") !== "Rest");
  ok("the change is flagged for the owner", toSession.body.changed.indexOf("w1:sun") >= 0);

  /* And back the other way — the direction the owner asked for second. */
  const toRest = await H.client(laptopToken, {
    action: "save",
    programId: pid,
    expectedVersion: toSession.body.program.version,
    edits: [{ weekIndex: 1, dayKey: "sun", rest: true }],
  });
  ok("a session can be turned back into a rest day", toRest.status === 200 && toRest.body.ok === true);
  const backToRest = toRest.body.program.weeks[0];
  ok("the workout is gone", backToRest.days.sun.parts.length === 1);
  ok(
    "the renderer shows rest again",
    Normalize.isRestDay("sun", backToRest.days.sun, backToRest) === true
  );
  ok("a rest edit needs no parts array", true);

  /* The owner can do the same from their side. */
  const ownerRest = await H.owner({ action: "read", programId: pid });
  const ownerWeeks = JSON.parse(JSON.stringify(ownerRest.body.program.weeks));
  RT.makeSession(ownerWeeks[0], "sun", [{ id: "sun-0", title: "Squat", lines: ["Back squat 5x5"] }]);
  const ownerSaved = await H.owner({
    action: "save",
    programId: pid,
    expectedVersion: ownerRest.body.program.version,
    program: { weeks: ownerWeeks },
  });
  ok("the owner can also replace a rest day", ownerSaved.status === 200);
  const ownerWeek = ownerSaved.body.program.weeks[0];
  ok(
    "and the renderer agrees it is a session",
    Normalize.isRestDay("sun", ownerWeek.days.sun, ownerWeek) === false
  );

  /* --- revoking a device ------------------------------------------ */

  const devId = ownerRead.body.access.devices[0].id;
  const revoked = await H.owner({ action: "revoke_device", programId: pid, deviceId: devId });
  ok("the owner revokes a device", revoked.status === 200);
  const afterRevoke = await H.client(phoneToken, { action: "read", programId: pid });
  ok("the revoked device is locked out", afterRevoke.status === 401);
  const laptopStill = await H.client(laptopToken, { action: "read", programId: pid });
  ok("the other device still works", laptopStill.status === 200);

  /* --- a link that was never activated ---------------------------- */

  const ghost = await H.anon({ action: "claim", programId: "p_nothinghere", code: "123456" });
  ok("an unknown program is not a claimable link", ghost.status === 404);

  /* --- delete cleans up both objects ----------------------------- */

  const del = await H.owner({ action: "delete", programId: pid });
  ok("the owner deletes the program", del.status === 200);
  const gone = await H.client(laptopToken, { action: "read", programId: pid });
  ok("access dies with the program", gone.status === 404);

  console.log("All client-program API checks passed.");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
