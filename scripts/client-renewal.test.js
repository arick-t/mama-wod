#!/usr/bin/env node
/**
 * "This client's block is about to end."
 *
 * The owner asked for a week's notice, not three days — "כי זה לא מספיק" (2026-09-01).
 * A reminder that arrives too late is worse than none: he has already lost the week he
 * needed to write the next block in.
 *
 * Everything here runs against a fixed clock, because a test that asks the real
 * calendar what day it is passes in September and fails in October.
 *
 * 0 LLM. No network.
 */

"use strict";

const assert = require("assert");
const Renewal = require("../lib/client-renewal.js");
const Store = require("../lib/client-program-store.js");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok — " + name);
  passed++;
}

/** A program with one four-week block, starting on a known Sunday. */
function programOn(startIso) {
  const p = Store.emptyProgram({ programId: "p_test", weekCount: 4, clientName: "Studio A" });
  p.blockStart = startIso;
  return p;
}

const p = programOn("2026-08-02");
ok("a four-week block ends 27 days after it starts", Renewal.blockEndIso(p, p.blocks[0]) === "2026-08-29");

/* Nothing has been sent yet — there is no block to renew, and nagging about one the
   client has never seen would be nonsense. */
ok("an unsent block is not up for renewal", Renewal.renewalDue(p, "2026-08-25").reason === "nothing_sent_yet");

p.blocks[0].approvedAt = "2026-08-02T00:00:00.000Z";

ok("three weeks out, nothing is said", Renewal.renewalDue(p, "2026-08-08").due === false);
ok("eight days out, still nothing", Renewal.renewalDue(p, "2026-08-21").due === false);
/* The window opens exactly a week before the last day. */
ok("seven days out, the reminder is due", Renewal.renewalDue(p, "2026-08-22").due === true);
ok("the day before it ends, still due", Renewal.renewalDue(p, "2026-08-28").due === true);
/* Late is better than silent: a block that has already ended still asks to be renewed. */
ok("after it has ended, it is still due", Renewal.renewalDue(p, "2026-09-03").due === true);

const due = Renewal.renewalDue(p, "2026-08-22");
ok("it says how many days are left", due.daysLeft === 7);
ok("and which day it ends on", due.endsOn === "2026-08-29");

/* One mail per block. The stamp lives on the block, so opening the clients page ten
   times in a day sends one reminder, not ten. */
const stamped = programOn("2026-08-02");
stamped.blocks[0].approvedAt = "2026-08-02T00:00:00.000Z";
stamped.blocks[0].renewalMailedAt = "2026-08-22T06:00:00.000Z";
ok("a reminder already sent is not sent again", Renewal.renewalDue(stamped, "2026-08-25").reason === "already_mailed");

/* He has already done the thing the mail would ask him to do. */
const planned = programOn("2026-08-02");
planned.blocks[0].approvedAt = "2026-08-02T00:00:00.000Z";
planned.blocks.push({ blockIndex: 2, startWeek: 5, weekCount: 4, approvedAt: null });
ok(
  "no reminder once the next block is planned",
  Renewal.renewalDue(planned, "2026-08-25").reason === "next_block_already_planned"
);

/* The block being renewed is the one the client is training in — the LAST one sent, not
   the first one ever written. */
const twoBlocks = programOn("2026-08-02");
twoBlocks.weeks = twoBlocks.weeks.concat([5, 6, 7, 8].map(function (w) {
  return Store.emptyWeek(w, null, false);
}));
twoBlocks.blocks[0].approvedAt = "2026-08-02T00:00:00.000Z";
twoBlocks.blocks.push({
  blockIndex: 2, startWeek: 5, weekCount: 4, approvedAt: "2026-08-30T00:00:00.000Z",
});
const second = Renewal.renewalDue(twoBlocks, "2026-09-20");
ok("the second block is the one that matters", second.block.blockIndex === 2);
ok("and its end is counted from the program's start", second.endsOn === "2026-09-26");

/* A program with no start date cannot be reasoned about — say so rather than guess. */
const undated = programOn("");
undated.blocks[0].approvedAt = "2026-08-02T00:00:00.000Z";
ok("no dates means no guessing", Renewal.renewalDue(undated, "2026-08-25").reason === "no_dates");

/* What he actually reads. */
const mail = Renewal.renewalMail(p, due, "https://example.test/admin-clients.html?program=p_test");
ok("the subject names the client", /Studio A/.test(mail.subject));
ok("it says the block is ending", /עתידה להסתיים/.test(mail.subject));
ok("the body says when", /2026-08-29/.test(mail.text));
ok("and how long is left", /7 ימים/.test(mail.text));
ok("it tells him what to do", /כנס לתכנן לבנה חדשה/.test(mail.text));
ok("with a link straight to that client", /program=p_test/.test(mail.text));

/* An ended block reads as ended, not as "in -3 days". */
const late = Renewal.renewalMail(p, Renewal.renewalDue(p, "2026-09-03"), "u");
ok("a block already over says so", /הסתיימה/.test(late.text));

const source = require("fs").readFileSync(
  require("path").join(__dirname, "..", "lib", "client-renewal.js"),
  "utf8"
);
ok("the decision makes no network calls", !/\bfetch\s*\(/.test(source));
ok("and names no AI provider", !/gemini|groq|generativelanguage/i.test(source));

console.log("All client renewal checks passed (" + passed + " assertions).");
