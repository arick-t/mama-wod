/**
 * The B2B terms text is the owner's, reproduced verbatim.
 * Run: node scripts/client-terms.test.js
 *
 * This file exists so nobody — including a future me tidying up — can reword,
 * reflow, soften or drop a clause without the suite going red. Each assertion
 * quotes a load-bearing phrase from the owner's final v3.4-legal text.
 */
const assert = require("assert");
const T = require("../lib/client-terms.js");
const A = require("../lib/client-access.js");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* --- version wiring ------------------------------------------------------ */

ok("terms version is v3.4-legal", T.TERMS_VERSION === "v3.4-legal");
ok(
  "the access layer signs against this exact version",
  A.CLIENT_TERMS_VERSION === T.TERMS_VERSION
);
/* The athlete terms are a different document for a different audience. */
ok("the B2B version is not the athlete version", T.TERMS_VERSION !== "v2.0-legal");

/* --- headings ------------------------------------------------------------ */

ok("title is the owner's", T.TITLE_EN === "BAR-VAZ / MAMA WOD — B2B COACHING & PROGRAMMING TERMS");
ok("subtitle marks English as binding", /Official Legal Binding Text/.test(T.SUBTITLE_EN));
ok("the Hebrew block says English binds", /הטקסט המחייב הוא באנגלית/.test(T.SUBTITLE_HE));

ok("there are five English clauses", T.SECTIONS_EN.length === 5);
ok("there are five Hebrew clauses", T.SECTIONS_HE.length === 5);

const EN_HEADINGS = [
  "1. SCOPE OF SERVICES & INDEPENDENT PROFESSIONAL RESPONSIBILITY",
  "2. AI TECHNOLOGY TRANSPARENCY & SOLE OPERATOR OVERSIGHT",
  "3. ABSOLUTE WAIVER OF CLAIMS, RELEASE OF LIABILITY & FULL INDEMNIFICATION",
  "4. MEDICAL CLEARANCES & HEALTH DECLARATIONS OF END-TRAINEES",
  "5. ACCEPTANCE OF TERMS",
];
EN_HEADINGS.forEach(function (h, i) {
  ok('clause ' + (i + 1) + ' heading is verbatim', T.SECTIONS_EN[i].heading === h);
});

/* --- the clauses that actually carry the liability ---------------------- */

const en = T.SECTIONS_EN.map(function (s) {
  return s.body;
});

ok(
  "1 · services are design and consulting only",
  /consist solely of workout program design, consulting recommendations, and training blueprints/.test(en[0])
);
ok(
  "1 · the provider is not a party to training in the field",
  /The Provider is not a party to the physical training conducted in the field/.test(en[0])
);
ok(
  "1 · responsibility rests with the operator, medical clearances included",
  /including valid medical clearances—rests entirely with you/.test(en[0])
);
ok("1 · no liability for injury", /assumes no liability whatsoever for any injury/.test(en[0]));

ok("2 · AI use is disclosed", /generated using automated technology and artificial intelligence \(AI\) tools/.test(en[1]));
ok(
  "2 · review before use rests exclusively on the coach",
  /rests entirely and exclusively upon you \(the Coach, Academy, Studio, or Gym\)/.test(en[1])
);
ok(
  "2 · programs must not be relied on without human oversight",
  /must not be relied upon without your independent human professional oversight/.test(en[1])
);

ok("3 · claims are waived and released", /explicitly waive, release, and discharge/.test(en[2]));
ok("3 · third-party claims include end-trainees", /any third party \(including end-trainees\)/.test(en[2]));
ok(
  "3 · indemnification covers attorney fees",
  /indemnify, defend, and hold harmless the Provider from any costs, damages, expenses, or attorney fees/.test(en[2])
);

ok(
  "4 · the coach warrants every trainee's clearance",
  /every end-trainee under your supervision possesses a valid medical clearance and a signed health declaration/.test(en[3])
);
/* This clause is only true because our architecture never touches end-trainees. */
ok(
  "4 · we hold no end-trainee medical records",
  /The Provider does not review, store, or have access to the medical records of end-trainees/.test(en[3])
);

ok(
  "5 · acceptance can also happen by written notice",
  /confirmation via text message\/written notice constitutes your full, binding agreement/.test(en[4])
);

/* --- the Hebrew translation keeps the same five promises ---------------- */

const he = T.SECTIONS_HE.map(function (s) {
  return s.body;
});
ok("1 · Hebrew: provider is not a party in the field", /אינו צד לאימונים המתבצעים בשטח/.test(he[0]));
ok("2 · Hebrew: AI is disclosed", /בינה מלאכותית/.test(he[1]));
ok("3 · Hebrew: full waiver and indemnity", /ויתור מוחלט|מתחייב לקחת על עצמך את מלוא הטיפול המשפטי/.test(he[2]));
ok("4 · Hebrew: no access to medical records", /אינו בודק את התיקים הרפואיים/.test(he[3]));
ok("5 · Hebrew: acceptance by message counts", /אישור התנאים בהודעה/.test(he[4]));

/* --- the checkbox and the button --------------------------------------- */

ok(
  "the confirmation label is verbatim",
  T.CONFIRM_LABEL ===
    "I confirm that I have read, understood, and agreed to the B2B Coaching Terms of Service and Liability Waiver."
);
ok("the button is verbatim", T.AGREE_BUTTON === "Agree & continue");

/* --- nothing empty, nothing truncated ---------------------------------- */

ok(
  "no English clause is empty or stubbed",
  T.SECTIONS_EN.every(function (s) {
    return s.heading.length > 5 && s.body.length > 150;
  })
);
ok(
  "no Hebrew clause is empty or stubbed",
  T.SECTIONS_HE.every(function (s) {
    return s.heading.length > 3 && s.body.length > 100;
  })
);
ok(
  "no clause was left with a TODO or placeholder",
  !/TODO|TBD|placeholder|לורם|\.\.\.$/i.test(JSON.stringify(T.SECTIONS_EN) + JSON.stringify(T.SECTIONS_HE))
);

/* --- and a standing reminder in the source ----------------------------- */

const src = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "client-terms.js"), "utf8");
ok("the file warns against editing the wording", /DO NOT EDIT THE WORDING/.test(src));
ok("the file records that a text change forces a re-sign", /re-sign/.test(src));

console.log("All client terms checks passed.");
