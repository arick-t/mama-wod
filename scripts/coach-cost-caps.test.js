/**
 * POL-COST hard-gate unit tests + pre-live regression checks.
 * Run: node scripts/coach-cost-caps.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const {
  evaluateCostCapGate,
  costCapHttpPayload,
  DAILY_CAP,
  MONTHLY_CAP,
} = require("../lib/coach-cost-caps.js");

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

function testGate() {
  /* Daily locked for sessionDate */
  const daily = evaluateCostCapGate(
    "revise_day",
    { sessionDate: "2026-08-03" },
    { costCaps: { dailyEdits: { "2026-08-03": 2 }, israelToday: "2026-08-03" } }
  );
  ok("daily cap blocks revise_day", daily && daily.code === "COST_CAP_DAILY");
  ok("daily payload has code", costCapHttpPayload(daily).code === "COST_CAP_DAILY");

  /* Other sessionDate still open */
  const other = evaluateCostCapGate(
    "revise_day",
    { sessionDate: "2026-08-10" },
    {
      costCaps: {
        dailyEdits: { "2026-08-03": 2 },
        israelToday: "2026-08-03",
        dailyLocked: true,
        sessionDate: "2026-08-03",
      },
    }
  );
  ok("other sessionDate not blocked by today's lock", other === null);

  /* Cap = 2 exactly still open at 1 */
  const one = evaluateCostCapGate(
    "revise_part",
    { sessionDate: "2026-08-03" },
    { costCaps: { dailyEdits: { "2026-08-03": 1 } } }
  );
  ok("one edit still allowed", one === null);
  ok("DAILY_CAP is 2", DAILY_CAP === 2);

  /* Lazy fills allowed under daily lock */
  ok(
    "generate_week_detail allowed under daily lock",
    evaluateCostCapGate(
      "generate_week_detail",
      { intakeComplete: true },
      { costCaps: { dailyEdits: { "2026-08-03": 2 }, dailyLocked: true } }
    ) === null
  );
  ok(
    "generate_block first brick allowed under daily lock",
    evaluateCostCapGate(
      "generate_block",
      { intakeComplete: true },
      { costCaps: { dailyEdits: { "2026-08-03": 2 }, dailyLocked: true } }
    ) === null
  );

  /* Monthly locks everything programming */
  const monthly = evaluateCostCapGate(
    "revise_day",
    { sessionDate: "2026-08-10" },
    { costCaps: { monthlyUnitsUsed: 40, monthlyCap: 40 } }
  );
  ok("monthly blocks revise", monthly && monthly.code === "COST_CAP_MONTHLY");
  ok(
    "monthly blocks week fill",
    evaluateCostCapGate("generate_week_detail", {}, { costCaps: { monthlyLocked: true } }) &&
      evaluateCostCapGate("generate_week_detail", {}, { costCaps: { monthlyLocked: true } }).code ===
        "COST_CAP_MONTHLY"
  );
  ok("MONTHLY_CAP is 40", MONTHLY_CAP === 40);

  /* Chat never blocked */
  ok(
    "chat never cost-blocked",
    evaluateCostCapGate("chat", {}, { costCaps: { monthlyLocked: true, dailyLocked: true } }) ===
      null
  );
  ok(
    "start_intake never cost-blocked",
    evaluateCostCapGate("start_intake", {}, { costCaps: { monthlyLocked: true } }) === null
  );

  /* Large rebuild window */
  const large = evaluateCostCapGate(
    "revise_week",
    { largeRebuild: true, israelToday: "2026-08-05" },
    { costCaps: { lastLargeRebuildAt: "2026-08-01", israelToday: "2026-08-05" } }
  );
  ok("large rebuild locked within 7d", large && large.code === "COST_CAP_LARGE");
  ok(
    "large rebuild open after 7d",
    evaluateCostCapGate(
      "revise_week",
      { largeRebuild: true, israelToday: "2026-08-10" },
      { costCaps: { lastLargeRebuildAt: "2026-08-01", israelToday: "2026-08-10" } }
    ) === null
  );
  ok(
    "surgical revise_week ok while large locked",
    evaluateCostCapGate(
      "revise_week",
      { israelToday: "2026-08-05" },
      { costCaps: { lastLargeRebuildAt: "2026-08-01", israelToday: "2026-08-05", dailyEdits: {} } }
    ) === null
  );

  /* Soft upgrade once/brick */
  const soft = evaluateCostCapGate(
    "revise_week",
    { softUpgrade: true },
    { costCaps: { softUpgradeUsedForBrick: true } }
  );
  ok("soft upgrade blocked second time", soft && soft.code === "COST_CAP_SOFT");

  /* Mid-brick generate_block as large rebuild */
  const mid = evaluateCostCapGate(
    "generate_block",
    { largeRebuild: true, israelToday: "2026-08-05" },
    { costCaps: { lastLargeRebuildAt: "2026-08-03", israelToday: "2026-08-05" } }
  );
  ok("mid-brick large generate_block blocked", mid && mid.code === "COST_CAP_LARGE");
}

function testSessionDateMath() {
  /* Mirror client: blockStart + wi*7 + dayIndex */
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  function addDaysIso(iso, n) {
    const p = String(iso).slice(0, 10).split("-");
    const dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  function sessionDate(blockStart, wi, dayKey) {
    return addDaysIso(blockStart, wi * 7 + DAY_KEYS.indexOf(dayKey));
  }
  ok("W0 sun = blockStart", sessionDate("2026-08-02", 0, "sun") === "2026-08-02");
  ok("W0 mon = +1", sessionDate("2026-08-02", 0, "mon") === "2026-08-03");
  ok("W1 wed = +10", sessionDate("2026-08-02", 1, "wed") === "2026-08-12");
  ok("W4 sat = +34", sessionDate("2026-08-02", 4, "sat") === "2026-09-05");
}

function testStaticRegressions() {
  const pc = fs.readFileSync(path.join(root, "api/personal-coach.js"), "utf8");
  const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const policy = fs.readFileSync(path.join(root, "api/coach-policy.js"), "utf8");
  const policyMd = fs.readFileSync(
    path.join(root, "experiments/personal-coach/coach-policy-rules.md"),
    "utf8"
  );
  const costLib = fs.readFileSync(path.join(root, "lib/coach-cost-caps.js"), "utf8");

  ok("gate module wired", pc.includes("evaluateCostCapGate") && pc.includes("costCapHttpPayload"));
  const termsIdx = pc.indexOf("TERMS_REQUIRED");
  const costIdx = pc.indexOf("evaluateCostCapGate(action");
  const secIdx = pc.indexOf("classifyCoachUserInput(getLastUserMessageText(earlyMessages))");
  const keyIdx = pc.indexOf("Missing AI API key");
  ok(
    "gate after TERMS before API key",
    termsIdx >= 0 && costIdx > termsIdx && secIdx > costIdx && keyIdx > secIdx
  );
  ok("geminiOnly programming", pc.includes("geminiOnly: true"));
  ok("no Groq for programming comment present", pc.includes("NO Groq for programming (POL-020)"));
  ok("day-by-day opt-in only", pc.includes('PERSONAL_COACH_DAY_BY_DAY || "").trim() === "1"'));
  ok("Layer2 only in programming core", pc.includes("COACH_LAYER2_OPS_BRIEF"));
  /* Chat system should not inject Layer 2 brief string concatenation outside PROGRAMMING_SYSTEM_CORE —
     verify chat return path has COST compact but Layer2 appears before chat return only via PROGRAMMING_SYSTEM_CORE */
  const chatReturn = pc.indexOf("return (\n    HAMAMEN_SYSTEM");
  ok("chat return uses HAMAMEN", chatReturn > 0);
  const chatChunk = pc.slice(chatReturn, chatReturn + 800);
  ok("chat has COST compact", chatChunk.includes("COST_GUARDRAILS_COMPACT"));
  ok("chat does not inject LAYER2 var", !chatChunk.includes("COACH_LAYER2_OPS_BRIEF"));

  /* Single compact — no POL-COST one-liner in language rule */
  const langIdx = pc.indexOf("LANGUAGE RULE (CHAT — HARD)");
  const langChunk = pc.slice(langIdx, langIdx + 1500);
  ok("no POL-COST one-liner in language rule", !langChunk.includes("- POL-COST:"));

  ok("POL-020 present", policy.includes("POL-020") && policyMd.includes("POL-020"));
  ok("POL-022 present", policyMd.includes("POL-022"));
  ok("POL-023 present", policyMd.includes("POL-023"));
  ok("POL-024 present", policyMd.includes("POL-024"));
  ok("POL-008 present", policyMd.includes("POL-008"));
  ok("POL-009 present", policyMd.includes("POL-009"));
  ok("POL-COST-001..010 in policy md", /POL-COST-001[\s\S]*POL-COST-010/.test(policyMd));
  ok("POL-COST-010 in synced policy js", policy.includes("POL-COST-010"));
  ok("sessionDate wording in POL-COST-003", policyMd.includes("sessionDate"));

  ok("client sessionDate helper", idx.includes("function pprogSessionDateForDay"));
  ok("client monthly cap 40", idx.includes("PPROG_COST_MONTHLY_CAP = 40"));
  ok("client daily cap 2", idx.includes("PPROG_COST_DAILY_CAP = 2"));
  ok("revise_day sends sessionDate", /action:\s*"revise_day"[\s\S]{0,200}sessionDate/.test(idx));
  ok("COST_CAP friendly errors", idx.includes("COST_CAP_DAILY") && idx.includes("COST_CAP_MONTHLY"));
  ok("lazy fill active+next only", idx.includes("only pre-fill active + next week"));
  ok("cost lib not under /api", !fs.existsSync(path.join(root, "api/coach-cost-caps.js")));
  ok("cost lib under lib/", fs.existsSync(path.join(root, "lib/coach-cost-caps.js")));
  ok("no premature comment close in cost lib", !costLib.includes("generate_*/revise_*"));

  /* Version alignment */
  const ver = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  ok("VERSION matches package", ver === pkg.version);
  ok("coachVersion 2.1 in API", pc.includes('const COACH_VERSION = "2.1"') || pc.includes("COACH_VERSION = \"2.1\""));
  ok(
    "app daily workouts subtitle on 21.3.x display line",
    /DAILY WORKOUTS · v21\.3(\.\d+)?/.test(idx) && !/DAILY WORKOUTS · v2\.1\b/.test(idx)
  );
  ok("coach subtitle 2.1", idx.includes('COACH_VERSION = "2.1"') || idx.includes("COACH · v2.1"));
}

function testModulesLoad() {
  require("../api/coach-policy.js");
  require("../api/personal-coach.js");
  require("../lib/coach-layer2-ops-brief.js");
  ok("modules load without throw", true);
}

async function testLivePreviewOptional() {
  const url =
    process.env.COST_PREFLIGHT_API_URL ||
    process.env.PERSONAL_COACH_STATUS_URL ||
    "https://mama-wod.vercel.app/api/personal-coach";
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(t);
    const j = await res.json().catch(() => null);
    ok("live GET personal-coach reachable", res.ok && j && j.ok === true);
    ok("live service is personal-coach", j.service === "personal-coach");
    if (j.coachVersion) {
      ok("live coachVersion present", String(j.coachVersion).length > 0);
    }
    console.log("    live version:", j.version, "coach:", j.coachVersion);
  } catch (e) {
    console.log("skip — live GET (network):", String(e && e.message ? e.message : e).slice(0, 120));
  }
}

async function testHandlerHardBlock() {
  const handler = require("../api/personal-coach.js");

  function mockReq(method, body) {
    return {
      method,
      headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: body || {},
    };
  }
  function mockRes() {
    const out = { statusCode: 200, body: null };
    out.status = function (c) {
      out.statusCode = c;
      return out;
    };
    out.json = function (obj) {
      out.body = obj;
      return out;
    };
    out.setHeader = function () {};
    out.end = function () {};
    return out;
  }
  async function post(action, profileExtra, bodyExtra) {
    const body = Object.assign(
      {
        action,
        messages: [],
        day: "mon",
        sessionDate: "2026-08-03",
        feedback: "shorten the metcon please",
        currentParts: [{ id: "a", title: "Part A", lines: ["AMRAP 12:", "10 thrusters"] }],
        athleteProfile: Object.assign(
          {
            intakeComplete: true,
            legalAcceptedVersion: 2,
            legalTermsId: "v2.0-legal",
            legalAcceptedAt: "2026-08-01T00:00:00.000Z",
          },
          profileExtra || {}
        ),
      },
      bodyExtra || {}
    );
    const res = mockRes();
    await handler(mockReq("POST", body), res);
    return res;
  }

  const daily = await post("revise_day", {
    costCaps: {
      israelToday: "2026-08-03",
      sessionDate: "2026-08-03",
      dailyEdits: { "2026-08-03": 2 },
      dailyEditsForSession: 2,
      dailyLocked: true,
      dailyCap: 2,
      monthlyUnitsUsed: 0,
      monthlyCap: 40,
    },
  });
  ok("handler daily hard-block 403", daily.statusCode === 403 && daily.body && daily.body.code === "COST_CAP_DAILY");

  const monthly = await post(
    "generate_week_detail",
    { costCaps: { monthlyUnitsUsed: 40, monthlyCap: 40, monthlyLocked: true } },
    { weekIndex: 1, intakeComplete: true }
  );
  ok(
    "handler monthly hard-block 403",
    monthly.statusCode === 403 && monthly.body && monthly.body.code === "COST_CAP_MONTHLY"
  );

  const terms = mockRes();
  await handler(
    mockReq("POST", {
      action: "revise_day",
      messages: [],
      athleteProfile: {
        intakeComplete: true,
        costCaps: { dailyEdits: { "2026-08-03": 2 }, dailyLocked: true },
      },
    }),
    terms
  );
  ok("handler terms before cost", terms.statusCode === 403 && terms.body && terms.body.code === "TERMS_REQUIRED");

  const chat = await post(
    "chat",
    {
      costCaps: {
        monthlyLocked: true,
        monthlyUnitsUsed: 40,
        monthlyCap: 40,
        dailyLocked: true,
      },
    },
    { messages: [{ role: "user", text: "Is my back position OK on deadlift?" }] }
  );
  ok(
    "handler chat not cost-blocked",
    !(chat.body && String(chat.body.code || "").startsWith("COST_CAP"))
  );
}

async function main() {
  console.log("\n=== Cost Guardrails pre-live tests ===\n");
  testGate();
  testSessionDateMath();
  testStaticRegressions();
  testModulesLoad();
  await testHandlerHardBlock();
  await testLivePreviewOptional();
  console.log("\nPassed:", passed);
  if (process.exitCode) {
    console.error("\nPRE-LIVE CHECKS FAILED");
    process.exit(1);
  }
  console.log("\nPRE-LIVE CHECKS PASSED");
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
