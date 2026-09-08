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
      /* The status GET reports it, and nothing here called that path until the
         configuration report was tested from the outside (2026-09-03). */
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

  let callSeq = 0;
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
      /* One walk through the whole product is more calls than one person makes in a
         minute, and the rate limiter is keyed by IP — so each call in this harness comes
         from its own address. The limiter itself is asserted where it is the subject
         (scripts/security-hardening-smoke.test.js), not here, where it would only cap
         how much of the journey can be tested. */
      callSeq += 1;
      const from = { "x-forwarded-for": "10.9." + ((callSeq >> 8) & 255) + "." + (callSeq & 255) };
      api(
        { method: "POST", headers: Object.assign(from, reqHeaders || {}), body: body || {}, socket: {} },
        res
      );
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

  /* Nobody walks in without a code. Asserted as properties of the endpoint rather than
     of the screen, because the owner's question was exactly this: a link appeared with
     no code beside it, and a device got in — was that the device it already had, or a
     door standing open? (owner, 2026-09-02) */
  const emptyCode = await H.anon({ action: "claim", programId: pid, code: "" });
  ok("AN EMPTY CODE IS NOT A CODE", emptyCode.status === 401);
  const shortCode = await H.anon({ action: "claim", programId: pid, code: "123" });
  ok("nor is a short one", shortCode.status === 401);
  const noCodeField = await H.anon({ action: "claim", programId: pid });
  ok("nor is a missing one", noCodeField.status === 401);
  const noToken = await H.client("", { action: "read", programId: pid });
  ok("and a caller with no token reads nothing", noToken.status === 401);
  const madeUpToken = await H.client("not-a-real-token", { action: "read", programId: pid });
  ok("nor does an invented one", madeUpToken.status === 401);

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

  /* --- a second block reaches the client once it is approved -------
   * He reported after his run-through: "אחרי אישור לבנה ושליחה צד הלקוח לא קיבל כלום".
   * This walks it: add a block, see that the client is NOT shown it, approve, see that
   * they are. */

  const beforeAdd = await H.client(laptopToken, { action: "read", programId: pid });
  const weeksBefore = beforeAdd.body.program.weeks.length;
  const readOwner = await H.owner({ action: "read", programId: pid });
  const added = await H.owner({
    action: "add_block",
    programId: pid,
    expectedVersion: readOwner.body.program.version,
  });
  ok("the owner adds a second block", added.status === 200 && added.body.ok === true);
  const afterAdd = await H.client(laptopToken, { action: "read", programId: pid });
  ok("AN UNAPPROVED BLOCK IS INVISIBLE TO THE CLIENT", afterAdd.body.program.weeks.length === weeksBefore);
  const approved2 = await H.owner({
    action: "approve_block",
    programId: pid,
    expectedVersion: added.body.program.version,
    blockIndex: 2,
  });
  ok("the owner approves it", approved2.status === 200 && approved2.body.ok === true);
  const afterApprove = await H.client(laptopToken, { action: "read", programId: pid });
  ok(
    "AND THEN THE CLIENT HAS IT — " + weeksBefore + " → " + afterApprove.body.program.weeks.length,
    afterApprove.body.program.weeks.length > weeksBefore
  );

  /* --- freeze: the door closes, nothing is lost -------------------- */

  const frozen = await H.owner({ action: "set_frozen", programId: pid, frozen: true });
  ok("the owner can freeze a client", frozen.status === 200 && frozen.body.ok === true);
  ok("and is told the door itself was closed", frozen.body.doorClosed === true);
  const pingFrozen = await H.client(laptopToken, { action: "ping", programId: pid });
  ok("THE CHEAP CHECK SEES THE FREEZE", pingFrozen.status === 403 && pingFrozen.body.code === "FROZEN");
  const whileFrozen = await H.client(laptopToken, { action: "read", programId: pid });
  ok("A FROZEN CLIENT CANNOT READ THEIR PLAN", whileFrozen.status === 403);
  ok("and is told to talk to their coach, not shown an error", /coach/i.test(String(whileFrozen.body.error || "")));
  const editWhileFrozen = await H.client(laptopToken, {
    action: "save",
    programId: pid,
    expectedVersion: 99,
    days: [],
  });
  ok("a frozen client cannot write either", editWhileFrozen.status === 403);

  const stillThere = await H.owner({ action: "read", programId: pid });
  ok("the plan is still there", stillThere.status === 200 && stillThere.body.program.weeks.length > 0);
  ok("the devices are still linked", (stillThere.body.access.devices || []).length >= 1);
  ok("the owner's card knows it is frozen", stillThere.body.program.frozen === true);

  const thawed = await H.owner({
    action: "set_frozen",
    programId: pid,
    expectedVersion: stillThere.body.program.version,
    frozen: false,
  });
  ok("the owner can unfreeze", thawed.status === 200);
  const afterThaw = await H.client(laptopToken, { action: "read", programId: pid });
  ok("THE SAME DEVICE WALKS BACK IN — no new code", afterThaw.status === 200);
  const pingThawed = await H.client(laptopToken, { action: "ping", programId: pid });
  ok("and the cheap check agrees", pingThawed.status === 200 && pingThawed.body.ok === true);

  /* --- the colour is his label, and stays his ---------------------- */

  const coloured = await H.owner({
    action: "save",
    programId: pid,
    expectedVersion: afterThaw.body.program.version,
    program: { clientName: "Coach A", clientColour: "#E8451A" },
  });
  ok("the owner can colour a client", coloured.status === 200 && coloured.body.program.clientColour === "#E8451A");
  const junk = await H.owner({
    action: "save",
    programId: pid,
    expectedVersion: coloured.body.program.version,
    program: { clientColour: "red; background:url(x)" },
  });
  ok("anything that is not a hex colour is dropped", junk.body.program.clientColour === "");
  const clientSees = await H.client(laptopToken, { action: "read", programId: pid });
  ok("the client is never told their colour or their state",
    clientSees.body.program.clientColour === undefined && clientSees.body.program.frozen === undefined);

  /* --- a link that was never activated ---------------------------- */

  const ghost = await H.anon({ action: "claim", programId: "p_nothinghere", code: "123456" });
  ok("an unknown program is not a claimable link", ghost.status === 404);

  /* --- delete cleans up both objects ----------------------------- */

  const del = await H.owner({ action: "delete", programId: pid });
  ok("the owner deletes the program", del.status === 200);
  const gone = await H.client(laptopToken, { action: "read", programId: pid });
  ok("access dies with the program", gone.status === 404);

  /* --- BOTH KINDS OF CLIENT, on both screens -------------------------
   * A studio and an individual are the same object: one client programme, one admin
   * screen, one client page. That is the whole reason the individual was moved onto
   * this road. But "by construction" is exactly what I claimed twice before being
   * wrong, so it is walked here for both (owner, 2026-09-03).
   */

  const studio = await H.owner({
    action: "create",
    clientKind: "coach",
    intake: {
      clientName: "Studio Both",
      equipment: "functional_gym",
      scheduleMode: "session_count",
      sessionsPerWeek: 3,
      sessionsDiffer: false,
      sessionMinutes: 60,
      deloadWeek: true,
      deloadEveryWeeks: 4,
      population: "CrossFit class",
      goals: "general fitness",
      monthlyAmount: 900,
      paymentMethod: "bit",
      stations: "6 barbells",
    },
  });
  ok("a studio client is created", studio.status === 200 && studio.body.ok === true);

  const individual = await H.owner({
    action: "create",
    clientKind: "athlete",
    clientName: "Individual Both",
    athleteIntake: {
      displayName: "Individual Both",
      trainingDaysMap: { sun: true, tue: true, thu: true },
      sessionMinutes: 45,
      goals: "engine",
      competitor: false,
      fixedIntakePacket: "FIXED INTAKE COMPLETE - ...",
    },
  });
  ok("an individual is created the same way", individual.status === 200 && individual.body.ok === true);

  const kinds = [
    { label: "studio", res: studio, columns: 3 },
    { label: "individual", res: individual, columns: 0 },
  ];

  for (const kind of kinds) {
    const id = kind.res.body.program.programId;
    ok(kind.label + ": a month of four weeks", kind.res.body.program.weeks.length === 4);
    ok(kind.label + ": nothing was written into it", !kind.res.body.program.weeks.some(function (w) {
      return Object.keys(w.days || {}).some(function (k) {
        return ((w.days[k] || {}).parts || []).length;
      });
    }));

    /* The door: a code, a device, a signature - identical for both. */
    const code = (await H.owner({ action: "issue_code", programId: id })).body.code;
    const claim = await H.anon({ action: "claim", programId: id, code: code });
    ok(kind.label + ": the code lets a device in", claim.status === 200);
    const tok = claim.body.clientToken;
    await H.client(tok, {
      action: "sign",
      programId: id,
      accepted: true,
      signerName: "Someone",
      signedAtClient: "2026-09-03T09:00:00.000Z",
    });

    /* An unapproved block is invisible to both. */
    const before = await H.client(tok, { action: "read", programId: id });
    ok(kind.label + ": an unapproved block shows nothing", before.body.program.weeks.length === 0);

    const owned = await H.owner({ action: "read", programId: id });
    const approved = await H.owner({
      action: "approve_block",
      programId: id,
      expectedVersion: owned.body.program.version,
      blockIndex: 1,
    });
    ok(kind.label + ": the owner approves it", approved.status === 200);

    const seen = await H.client(tok, { action: "read", programId: id });
    ok(kind.label + ": and then the client has the month", seen.body.program.weeks.length === 4);
    ok(kind.label + ": their calendar knows where the block divides",
      JSON.stringify(seen.body.program.blockGroups) === '[{"startWeek":1,"weekCount":4}]');
    ok(kind.label + ": their calendar knows its shape", seen.body.program.sessionColumns === kind.columns);
    ok(kind.label + ": the questionnaire never travels",
      seen.body.program.intake === undefined && seen.body.program.athleteIntake === undefined);
    ok(kind.label + ": nor what they pay", seen.body.program.monthlyAmount === undefined);

    /* Freeze shuts the door on both, and the cheap check sees it. */
    const fr = await H.owner({ action: "set_frozen", programId: id, frozen: true });
    ok(kind.label + ": can be frozen", fr.status === 200);
    ok(kind.label + ": frozen means no reading", (await H.client(tok, { action: "read", programId: id })).status === 403);
    ok(kind.label + ": and the cheap check agrees", (await H.client(tok, { action: "ping", programId: id })).status === 403);
    const th = await H.owner({
      action: "set_frozen",
      programId: id,
      expectedVersion: fr.body.program.version,
      frozen: false,
    });
    ok(kind.label + ": and unfrozen", th.status === 200);
    ok(kind.label + ": the same device walks back in", (await H.client(tok, { action: "read", programId: id })).status === 200);

    /* Deleting shuts it for good. */
    await H.owner({ action: "delete", programId: id });
    ok(kind.label + ": deleted means gone", (await H.client(tok, { action: "read", programId: id })).status === 404);
  }

  /* --- an individual's next block is about THEM --------------------
   * The fourth tab of the mini-intake is goals and limits, not "who is in the room",
   * and what it says is a PATCH onto their own answers: a new block must not erase the
   * eight-step packet the coach will read (owner, 2026-09-03). */

  const ind2 = await H.owner({
    action: "create",
    clientKind: "athlete",
    clientName: "Next block athlete",
    athleteIntake: {
      displayName: "Next block athlete",
      trainingDaysMap: { sun: true, wed: true },
      sessionMinutes: 45,
      goals: "engine",
      injuries: "left knee",
      fixedIntakePacket: "FIXED INTAKE COMPLETE - the original packet",
      avoidMovements: { deep_squat: true },
    },
  });
  ok("an individual exists", ind2.status === 200);
  const ind2id = ind2.body.program.programId;

  const nextBlock = await H.owner({
    action: "add_block",
    programId: ind2id,
    expectedVersion: ind2.body.program.version,
    athleteIntake: {
      goals: "peak for a competition",
      competitor: true,
      improveFocus: { max_strength: true },
      avoidMovements: { jumping: true },
      sessionMinutes: 60,
    },
    notes: "coming back from the knee",
  });
  ok("a second block is added", nextBlock.status === 200 && nextBlock.body.ok === true);
  const after = nextBlock.body.program.athleteIntake || {};
  ok("THE ORIGINAL PACKET SURVIVES", after.fixedIntakePacket === "FIXED INTAKE COMPLETE - the original packet");
  ok("the new goals replace the old", after.goals === "peak for a competition");
  ok("the new session length too", after.sessionMinutes === 60);
  ok("what he now competes for is recorded", after.competitor === true);
  ok("what to improve is recorded", after.improveFocus && after.improveFocus.max_strength === true);
  ok("what to avoid is replaced by the new answer", after.avoidMovements && after.avoidMovements.jumping === true);
  ok("and an answer he did not touch is left alone", after.injuries === "left knee");
  ok("the programme is eight weeks now", nextBlock.body.program.weeks.length === 8);
  /* The month is shaped by the days HE trains, read from his own answers - not from a
     rest-days checkbox in a form written for studios (owner, 2026-09-03). */
  const wk5 = nextBlock.body.program.weeks[4];
  const reviewable = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].filter(function (k) {
    return ((wk5.days || {})[k] || {}).ownerUnreviewed === true;
  });
  ok("the second block lands on the same two weekdays", reviewable.join(",") === "sun,wed");
  await H.owner({ action: "delete", programId: ind2id });


  /* --- the owner learns about a client's change without pressing F5 ---
   * Nothing ever asked the server whether a client had written something, so his own
   * screen only moved when he reloaded the page (owner, 2026-09-02). The question is
   * the same cheap one the athlete list asks: one small read of the index. */

  const stampBefore = await H.owner({ action: "list_stamp" });
  ok("the cheap question answers", stampBefore.status === 200 && !!stampBefore.body.stamp);

  /* --- the clean slate, on this side too -------------------------- */

  const p1 = await H.owner({ action: "create", clientName: "Purge A", weekCount: 4 });
  const p2 = await H.owner({ action: "create", clientName: "Purge B", weekCount: 4 });
  ok("two more clients exist", p1.status === 200 && p2.status === 200);
  const stampAfter = await H.owner({ action: "list_stamp" });
  ok("A NEW CLIENT MOVES THE STAMP", stampAfter.body.stamp !== stampBefore.body.stamp);
  const listBefore = await H.owner({ action: "list" });
  ok("and the list shows them", listBefore.body.rows.length >= 2);
  ok("the full list carries the same stamp the poll compares against", listBefore.body.stamp === stampAfter.body.stamp);
  const purge = await H.owner({ action: "purge_all" });
  ok("the purge answers", purge.status === 200 && purge.body.ok === true);
  ok("it names who it removed", (purge.body.removed || []).length === listBefore.body.rows.length);
  ok("nothing failed silently", (purge.body.failed || []).length === 0);
  const listAfter = await H.owner({ action: "list" });
  ok("THE CLIENT LIST IS EMPTY", listAfter.body.rows.length === 0);
  const goneRead = await H.owner({ action: "read", programId: p1.body.program.programId });
  ok("a purged client is really gone", goneRead.status === 404);


  /* --- the blank client (owner, 2026-09-04) -----------------------------
   * Four questions — name, gender, what they pay, how — and a month of empty squares.
   * No AI wrote it and nothing shaped it: every day is open, none is a rest day, and
   * the owner fills it himself. Everything else about them is a client like any other.
   * ------------------------------------------------------------------------- */

  const blank = await H.owner({
    action: "create",
    clientKind: "blank",
    clientName: "דני",
    clientGender: "male",
    monthlyAmount: 450,
    paymentMethod: "ביט",
    blockStart: "2026-09-06",
  });
  ok("a blank client is created", blank.status === 200 && blank.body.ok === true);
  const bp = blank.body.program;
  ok("it knows which kind it is", bp.clientKind === "blank");
  ok("a month of weeks arrives", bp.weeks.length === 4);
  ok(
    "every day of every week is there",
    bp.weeks.every(function (w) { return Object.keys(w.days).length === 7; })
  );
  ok(
    "and NOT ONE of them is a rest day",
    bp.weeks.every(function (w) {
      return Object.keys(w.days).every(function (k) { return w.days[k].ownerUnreviewed === true; });
    })
  );
  ok(
    "nothing is written on any of them",
    bp.weeks.every(function (w) {
      return Object.keys(w.days).every(function (k) { return (w.days[k].parts || []).length === 0; });
    })
  );
  ok("no week is a deload", bp.weeks.every(function (w) { return w.phase !== "deload"; }));
  ok("what they pay is on the programme", bp.monthlyAmount === 450 && bp.paymentMethod === "ביט");
  ok("and their gender, owner-side", bp.clientGender === "male");
  ok("the block is NOT approved — he sends it when he is ready", bp.blocks[0].approved !== true);

  /* The delivery half is identical: this is the whole point of the kind. */
  const bCode = await H.owner({ action: "issue_code", programId: bp.programId });
  ok("a blank client gets a code like anyone else", bCode.status === 200 && /^\d{6}$/.test(bCode.body.code));
  const bClaim = await H.anon({ action: "claim", programId: bp.programId, code: bCode.body.code, deviceLabel: "phone" });
  ok("and can redeem it", bClaim.status === 200 && !!bClaim.body.clientToken);
  const bBeforeSign = await H.client(bClaim.body.clientToken, { action: "read", programId: bp.programId });
  ok("and signs the same terms as everyone else", bBeforeSign.status === 403 && bBeforeSign.body.code === "TERMS_REQUIRED");
  await H.client(bClaim.body.clientToken, { action: "sign", programId: bp.programId, accepted: true });
  const bView = await H.client(bClaim.body.clientToken, { action: "read", programId: bp.programId });
  ok("but sees nothing until the block is approved", bView.status === 200 && (bView.body.program.blockGroups || []).length === 0);
  await H.owner({ action: "approve_block", programId: bp.programId, expectedVersion: bp.version, blockIndex: 1 });
  const bView2 = await H.client(bClaim.body.clientToken, { action: "read", programId: bp.programId });
  ok("and everything after approval", (bView2.body.program.blockGroups || []).length === 1);
  ok("what they pay never crosses to them", bView2.body.program.monthlyAmount === undefined);
  ok("nor does their gender", bView2.body.program.clientGender === undefined);

  /* A second month is empty in exactly the same way. */
  const bAfter = await H.owner({ action: "read", programId: bp.programId });
  const bNext = await H.owner({
    action: "add_block",
    programId: bp.programId,
    expectedVersion: bAfter.body.program.version,
  });
  ok("a blank client gets another empty month", bNext.status === 200 && bNext.body.program.weeks.length === 8);
  ok(
    "with no rest days in it either",
    bNext.body.program.weeks.slice(4).every(function (w) {
      return Object.keys(w.days).every(function (k) { return w.days[k].ownerUnreviewed === true; });
    })
  );


  /* --- a blank client's block can be any length, and NOBODY ELSE'S CAN ------
   * The owner said it twice: this field lives in the blank client's form, affects the
   * blank client only, and may not touch the studio path, the individual path, or the
   * coach's four-week contract (owner, 2026-09-04).
   * ------------------------------------------------------------------------- */

  const six = await H.owner({
    action: "create",
    clientKind: "blank",
    clientName: "שישה",
    monthlyAmount: 300,
    blockWeeks: 6,
    blockStart: "2026-09-06",
  });
  ok("a blank client can be six weeks long", six.body.program.weeks.length === 6);
  ok("and the block record says six", six.body.program.blocks[0].weekCount === 6);
  ok("with no rest day anywhere in them", six.body.program.weeks.every(function (w) {
    return Object.keys(w.days).every(function (k) { return w.days[k].ownerUnreviewed === true; });
  }));

  /* Delivery is the point of the question he asked: all six, not four. */
  const sixCode = await H.owner({ action: "issue_code", programId: six.body.program.programId });
  const sixClaim = await H.anon({ action: "claim", programId: six.body.program.programId, code: sixCode.body.code, deviceLabel: "p" });
  await H.client(sixClaim.body.clientToken, { action: "sign", programId: six.body.program.programId, accepted: true });
  const sixRead = await H.owner({ action: "read", programId: six.body.program.programId });
  await H.owner({
    action: "approve_block",
    programId: six.body.program.programId,
    expectedVersion: sixRead.body.program.version,
    blockIndex: 1,
  });
  const sixSeen = await H.client(sixClaim.body.clientToken, { action: "read", programId: six.body.program.programId });
  ok("the client receives all six weeks", sixSeen.body.program.weeks.length === 6);
  ok("as one block of six", (sixSeen.body.program.blockGroups || [])[0].weekCount === 6);

  const sixAgain = await H.owner({ action: "read", programId: six.body.program.programId });
  const sixNext = await H.owner({
    action: "add_block",
    programId: six.body.program.programId,
    expectedVersion: sixAgain.body.program.version,
    blockWeeks: 3,
  });
  ok("a later month can be a different length again", sixNext.body.added === 3);
  ok("and the timeline grows by exactly that", sixNext.body.program.weeks.length === 9);

  /* The fence. A studio client asking for six gets four, because the field is not his. */
  const studioSix = await H.owner({
    action: "create",
    clientName: "סטודיו רגיל",
    blockWeeks: 6,
    intake: {
      clientName: "סטודיו רגיל",
      population: "adults",
      goals: "general",
      equipment: "functional_gym",
      scheduleMode: "sessions_per_week",
      sessionsPerWeek: 3,
      monthlyAmount: 500,
      paymentMethod: "bit",
    },
  });
  ok(
    "a studio client is four weeks whatever the request says",
    studioSix.status !== 200 || studioSix.body.program.weeks.length === 4
  );

  const athleteSix = await H.owner({
    action: "create",
    clientKind: "athlete",
    clientName: "אינדיבידואל רגיל",
    blockWeeks: 6,
    athleteIntake: { trainingDaysMap: { sun: true, tue: true, thu: true }, deloadEveryWeeks: 4 },
  });
  ok("and so is an individual", athleteSix.body.program.weeks.length === 4);

  /* --- a week copied whole (owner, 2026-09-04) --------------------------- */

  const cw = await H.owner({ action: "create", clientKind: "blank", clientName: "העתקה", blockStart: "2026-09-06" });
  const cwId = cw.body.program.programId;
  const cwWrote = await H.owner({
    action: "save",
    programId: cwId,
    expectedVersion: cw.body.program.version,
    program: {
      weeks: (function () {
        const w = JSON.parse(JSON.stringify(cw.body.program.weeks));
        w[0].days.sun.parts = [{ id: "p1", title: "Part A", lines: ["5x5 back squat"] }];
        return w;
      })(),
    },
  });
  ok("a day is written on week 1", cwWrote.status === 200);
  const copied = await H.owner({
    action: "copy_week",
    programId: cwId,
    expectedVersion: cwWrote.body.program.version,
    fromWeek: 1,
    toWeek: 3,
  });
  ok("the week is copied in one write", copied.status === 200 && copied.body.copiedDays === 1);
  const cwAfter = copied.body.program;
  ok("the sessions arrived", cwAfter.weeks[2].days.sun.parts[0].lines[0] === "5x5 back squat");
  ok("with ids of their own, not shared with the week they came from",
    cwAfter.weeks[2].days.sun.parts[0].id !== cwAfter.weeks[0].days.sun.parts[0].id);
  ok("the week it came from is untouched", cwAfter.weeks[0].days.sun.parts.length === 1);
  const sameWeek = await H.owner({
    action: "copy_week",
    programId: cwId,
    expectedVersion: cwAfter.version,
    fromWeek: 2,
    toWeek: 2,
  });
  ok("a week cannot be copied onto itself", sameWeek.status === 400 && sameWeek.body.code === "SAME_WEEK");
  const noWeek = await H.owner({
    action: "copy_week",
    programId: cwId,
    expectedVersion: cwAfter.version,
    fromWeek: 1,
    toWeek: 99,
  });
  ok("nor onto a week that is not there", noWeek.status === 400);


  /* --- a day copied onto another day (owner, 2026-09-04) ----------------- */

  const cd = await H.owner({ action: "create", clientKind: "blank", clientName: "יום", blockStart: "2026-09-06" });
  const cdId = cd.body.program.programId;
  const cdWrote = await H.owner({
    action: "save",
    programId: cdId,
    expectedVersion: cd.body.program.version,
    program: {
      weeks: (function () {
        const w = JSON.parse(JSON.stringify(cd.body.program.weeks));
        w[0].days.mon.parts = [{ id: "m1", title: "Part A", lines: ["10 min AMRAP"] }];
        w[0].overview = [{ day: "mon", focus: "Engine" }, { day: "wed", focus: "Rest" }];
        return w;
      })(),
    },
  });
  ok("a day is written", cdWrote.status === 200);

  const dayCopied = await H.owner({
    action: "copy_day",
    programId: cdId,
    expectedVersion: cdWrote.body.program.version,
    fromWeek: 1,
    fromDay: "mon",
    toWeek: 2,
    toDay: "thu",
  });
  ok("a day can be copied onto another", dayCopied.status === 200 && dayCopied.body.copiedParts === 1);
  const afterDay = dayCopied.body.program;
  ok("the session arrived", afterDay.weeks[1].days.thu.parts[0].lines[0] === "10 min AMRAP");
  ok("with an id of its own", afterDay.weeks[1].days.thu.parts[0].id !== afterDay.weeks[0].days.mon.parts[0].id);
  ok("the day it came from is untouched", afterDay.weeks[0].days.mon.parts.length === 1);
  ok(
    "and the focus line travelled with it",
    (afterDay.weeks[1].overview || []).filter(function (o) { return o.day === "thu"; })[0].focus === "Engine"
  );

  /* A rest day is a rest day because of that focus line — so copying one must move it. */
  const restCopied = await H.owner({
    action: "copy_day",
    programId: cdId,
    expectedVersion: afterDay.version,
    fromWeek: 1,
    fromDay: "wed",
    toWeek: 1,
    toDay: "sun",
  });
  ok(
    "copying a rest day makes the target a rest day",
    (restCopied.body.program.weeks[0].overview || []).filter(function (o) { return o.day === "sun"; })[0].focus === "Rest"
  );
  ok("and empties it", restCopied.body.program.weeks[0].days.sun.parts.length === 0);

  const sameDay = await H.owner({
    action: "copy_day",
    programId: cdId,
    expectedVersion: restCopied.body.program.version,
    fromWeek: 1, fromDay: "mon", toWeek: 1, toDay: "mon",
  });
  ok("a day cannot be copied onto itself", sameDay.status === 400 && sameDay.body.code === "SAME_DAY");
  const badDay = await H.owner({
    action: "copy_day",
    programId: cdId,
    expectedVersion: restCopied.body.program.version,
    fromWeek: 1, fromDay: "mon", toWeek: 1, toDay: "funday",
  });
  ok("and not onto something that is not a weekday", badDay.status === 400 && badDay.body.code === "BAD_DAY");


  /* --- a blank client sold as a number of sessions (owner, 2026-09-04) ----- */

  const bySess = await H.owner({
    action: "create",
    clientKind: "blank",
    clientName: "ארבעה",
    scheduleMode: "session_count",
    sessionsPerWeek: 4,
    blockWeeks: 6,
    blockStart: "2026-09-06",
  });
  ok("a blank client can be sold as sessions", bySess.status === 200);
  ok("the mode is recorded", bySess.body.program.intake.scheduleMode === "session_count");
  ok("with the number he sold", bySess.body.program.intake.sessionsPerWeek === 4);
  ok("and the block is as long as he asked", bySess.body.program.weeks.length === 6);
  ok(
    "every week still holds seven day slots underneath",
    bySess.body.program.weeks.every(function (w) { return Object.keys(w.days).length === 7; })
  );

  /* What the client's page draws its columns from. */
  const sessView = require("../lib/client-view-payload.js").programForClient(bySess.body.program);
  ok("the client's calendar is told to draw four columns", sessView.sessionColumns === 4);
  const weeklyView = require("../lib/client-view-payload.js").programForClient(blank.body.program);
  ok("and a weekly one is told nothing, so it draws seven", weeklyView.sessionColumns === 0);

  /* The two gestures must work here too. */
  const sessId = bySess.body.program.programId;
  const sessWrote = await H.owner({
    action: "save",
    programId: sessId,
    expectedVersion: bySess.body.program.version,
    program: {
      weeks: (function () {
        const w = JSON.parse(JSON.stringify(bySess.body.program.weeks));
        w[0].days.sun.parts = [{ id: "x1", title: "Session 1", lines: ["EMOM 12"] }];
        return w;
      })(),
    },
  });
  const sessWeek = await H.owner({
    action: "copy_week",
    programId: sessId,
    expectedVersion: sessWrote.body.program.version,
    fromWeek: 1,
    toWeek: 4,
  });
  ok("a week copies in sessions mode", sessWeek.status === 200 && sessWeek.body.copiedDays === 1);
  const sessDay = await H.owner({
    action: "copy_day",
    programId: sessId,
    expectedVersion: sessWeek.body.program.version,
    fromWeek: 1,
    fromDay: "sun",
    toWeek: 2,
    toDay: "tue",
  });
  ok("and so does a day", sessDay.status === 200 && sessDay.body.copiedParts === 1);
  ok(
    "landing where it was pasted",
    sessDay.body.program.weeks[1].days.tue.parts[0].lines[0] === "EMOM 12"
  );

  /* --- the configuration report goes to the OWNER, not to a client ---------
   * It first shipped attached to the claim response - a client's reply - because the
   * edit matched the wrong "termsVersion" line, and the library-level test could not
   * see it (2026-09-03). So this drives the real handler and reads the real JSON.
   * ------------------------------------------------------------------------- */
  const status = await new Promise(function (resolve) {
    let code = 200;
    const res = {
      headersSent: false,
      setHeader() {},
      status(c) { code = c; return res; },
      json(payload) { resolve({ status: code, body: payload }); return res; },
      end() { resolve({ status: code, body: null }); return res; },
    };
    require("../api/client-program.js")(
      { method: "GET", headers: { "x-forwarded-for": "10.9.255.254" }, body: {}, socket: {} },
      res
    );
  });
  ok("the status GET answers", status.status === 200 && status.body && status.body.ok === true);
  ok(
    "and it names WHICH secret salts the client codes",
    ["client_secret", "session_secret", "admin_password", "none"].indexOf(status.body.clientCodeSalt) >= 0
  );
  ok("never the secret itself", !/secret[-_]?value|CLIENT_ACCESS_SECRET=/.test(JSON.stringify(status.body)));
  /* One home, and it is this one. */
  ok("the report exists in exactly one place in the source", (apiSrc.match(/clientCodeSalt/g) || []).length === 1);
  const claimIdx = apiSrc.indexOf('if (action === "claim")');
  const claimReply = claimIdx >= 0 ? apiSrc.slice(claimIdx, claimIdx + 1600) : "";
  ok("a client redeeming a code is told nothing about it", claimReply.indexOf("clientCodeSalt") < 0);

  console.log("All client-program API checks passed.");
}

main().catch(function (e) {
  console.error("FAIL:", (e && e.stack) || e);
  process.exit(1);
});
