/**
 * Done finish-signal learning unit tests.
 * Run: node scripts/coach-finish-signals.test.js
 */
const assert = require("assert");
const path = require("path");
const fs = require("fs");

const {
  OTHER_MAX_CHARS,
  THRESHOLD_SAME_DIRECTION,
  recordFinishFeedback,
  emptyFinishLearning,
  countableTrainingParts,
  detectSafety,
  truncateNote,
  paidSlotAvailable,
  markPaidAdaptationUsed,
  buildFinishSignalsInjectBlock,
  formatFinishSignalCard,
  buildFinishMicroBiasUserMessage,
  INJECT_MAX_CHARS,
} = require("../lib/coach-finish-signals.js");

let passed = 0;
function ok(name, cond, detail) {
  if (!cond) {
    console.error("FAIL:", name, detail || "");
    process.exitCode = 1;
    throw new Error(name);
  }
  passed++;
  console.log("ok —", name);
}

function testParts() {
  const parts = countableTrainingParts([
    { title: "Warm-up" },
    { title: "Back Squat 5x5" },
    { title: "AMRAP 12 — Bike" },
  ]);
  ok("warmup excluded", parts.length === 2);
  ok("strength inferred", parts[0].part_role === "strength");
  ok("metcon inferred", parts[1].part_role === "metcon");
}

function testThreshold() {
  let fl = emptyFinishLearning();
  const base = {
    part_role: "metcon",
    part_title: "AMRAP 12",
    session_date: "2026-08-01",
    brick_week: 2,
    weekday: "Fri",
  };
  let r1 = recordFinishFeedback(fl, Object.assign({}, base, { rating: "too_hard", session_date: "2026-08-01" }));
  fl = r1.finishLearning;
  ok("first too_hard accumulate", r1.action_allowed === "accumulate_only");
  ok("no paid yet", r1.shouldAttemptPaidMicroBias === false);

  let r2 = recordFinishFeedback(fl, Object.assign({}, base, { rating: "too_hard", session_date: "2026-08-05" }));
  fl = r2.finishLearning;
  ok("second still accumulate", r2.action_allowed === "accumulate_only");
  ok("count 2", r2.event.count_same_direction_14d === 2);

  let r3 = recordFinishFeedback(fl, Object.assign({}, base, { rating: "too_hard", session_date: "2026-08-10" }));
  fl = r3.finishLearning;
  ok("third crosses threshold", r3.action_allowed === "micro_bias_next");
  ok("count 3", r3.event.count_same_direction_14d === 3);
  ok("THRESHOLD is 3", THRESHOLD_SAME_DIRECTION === 3);
  ok("paid attempt offered", r3.shouldAttemptPaidMicroBias === true);

  markPaidAdaptationUsed(fl, "2026-08");
  ok("slot used", !paidSlotAvailable(fl, "2026-08"));

  let r4 = recordFinishFeedback(fl, Object.assign({}, base, { rating: "too_hard", session_date: "2026-08-12" }));
  ok("4th still micro_bias flag", r4.action_allowed === "micro_bias_next");
  ok("but no paid after cap", r4.shouldAttemptPaidMicroBias === false);
}

function testJustRight() {
  const r = recordFinishFeedback(emptyFinishLearning(), {
    rating: "just_right",
    session_date: "2026-08-07",
  });
  ok("just_right accumulate", r.action_allowed === "accumulate_only");
  ok("has static reply", !!r.staticReply);
}

function testOtherSafety() {
  const safe = recordFinishFeedback(emptyFinishLearning(), {
    rating: "other",
    note: "Sharp knee pain during lunges",
    session_date: "2026-08-07",
  });
  ok("safety detected", safe.safety_flag === true);
  ok("safety_review", safe.action_allowed === "safety_review");
  ok("no paid on safety", safe.shouldAttemptPaidMicroBias === false);
  ok("detectSafety helper", detectSafety("chest pain") === true);

  const long = "x".repeat(300);
  ok("truncate 160", truncateNote(long).length === OTHER_MAX_CHARS);

  const other = recordFinishFeedback(emptyFinishLearning(), {
    rating: "other",
    note: "Night shift — tired",
    session_date: "2026-08-07",
  });
  ok("other accumulate", other.action_allowed === "accumulate_only");
  ok("labels include recovery or schedule", other.event.labels.length >= 1);
}

function testInject() {
  let fl = emptyFinishLearning();
  for (let i = 0; i < 3; i++) {
    const r = recordFinishFeedback(fl, {
      rating: "too_hard",
      part_role: "metcon",
      part_title: "AMRAP",
      session_date: "2026-08-0" + (1 + i),
    });
    fl = r.finishLearning;
  }
  const block = buildFinishSignalsInjectBlock(fl, { paidMicroBias: true });
  ok("inject has coach rule", block.indexOf("[FINISH_SIGNAL_COACH_RULE]") >= 0);
  ok("inject has finish signal", block.indexOf("[ATHLETE_FINISH_SIGNAL]") >= 0);
  ok("inject roughly capped", block.length <= INJECT_MAX_CHARS + 120);
  const card = formatFinishSignalCard(fl.events[fl.events.length - 1]);
  ok("card has rating", card.indexOf("rating: too_hard") >= 0);
  const msg = buildFinishMicroBiasUserMessage(fl.events[fl.events.length - 1], ["2026-08-11"]);
  ok("micro bias msg surgical", msg.indexOf("finish_micro_bias") >= 0);
}

function testLibPresent() {
  const p = path.join(__dirname, "..", "lib", "coach-finish-signals.js");
  ok("lib file exists", fs.existsSync(p));
}

testLibPresent();
testParts();
testThreshold();
testJustRight();
testOtherSafety();
testInject();
console.log("\nAll finish-signal tests passed:", passed);
