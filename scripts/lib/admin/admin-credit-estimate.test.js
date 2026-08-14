/**
 * Admin credit estimate unit tests — 0 network, 0 AI.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  estimateIlsFromUsage,
  pickUsageMeta,
  priceForModel,
  publicCreditView,
  resolveEmptyLedgerSeedIls,
} = require("./admin-credit-estimate");

function assert(cond, label) {
  if (!cond) throw new Error("FAIL " + label);
}

function almost(a, b, eps) {
  return Math.abs(a - b) <= (eps == null ? 0.02 : eps);
}

function run() {
  assert(estimateIlsFromUsage("x", null) === 0, "no usage = 0");
  assert(estimateIlsFromUsage("gemini-2.5-flash", { promptTokens: 0, outputTokens: 0 }) === 0, "zero tokens");

  const flash = priceForModel("gemini-2.5-flash");
  const lite = priceForModel("gemini-2.5-flash-lite");
  assert(lite.inPerM < flash.inPerM || lite.outPerM < flash.outPerM, "lite cheaper");

  /* 1M in + 1M out flash @ 0.15/0.60 * 3.7 * 1.2 = (0.75)*3.7*1.2 = 3.33 */
  const oneM = estimateIlsFromUsage("gemini-2.5-flash", {
    promptTokens: 1_000_000,
    outputTokens: 1_000_000,
  });
  assert(almost(oneM, 3.33, 0.05), "1M flash pricing got " + oneM);

  const liteCost = estimateIlsFromUsage("gemini-2.5-flash-lite", {
    promptTokens: 1_000_000,
    outputTokens: 1_000_000,
  });
  assert(liteCost < oneM, "lite estimate lower");

  const smallChat = estimateIlsFromUsage("gemini-2.5-flash-lite", {
    promptTokens: 8000,
    outputTokens: 400,
  });
  assert(smallChat > 0, "small chat must not round to 0 ILS");

  const view = publicCreditView({
    balanceManual: 57.25,
    balanceUpdatedAt: "2026-08-10T10:00:00.000Z",
    spentSinceUpdateEstimated: 2.25,
  });
  assert(view.estimated === true, "estimated flag");
  assert(view.labelHe === "משוער", "hebrew label");
  assert(view.remainingEstimated === 55, "remaining");
  assert(view.display === "₪55.00", "display " + view.display);
  assert(String(view.disclaimerHe).indexOf("משוער") >= 0, "disclaimer");
  assert("lastFlushAt" in view, "lastFlushAt on public view");

  const thoughts = pickUsageMeta({
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 5,
      cachedContentTokenCount: 40,
      totalTokenCount: 125,
    },
  });
  assert(thoughts && thoughts.promptTokens === 100, "cached not double-counted on prompt");
  assert(thoughts.outputTokens === 25, "thoughts billed as output got " + thoughts.outputTokens);

  const totalOnly = pickUsageMeta({ usageMetadata: { totalTokenCount: 100 } });
  assert(totalOnly && totalOnly.promptTokens === 70 && totalOnly.outputTokens === 30, "totalTokens fallback split");

  const prevSeed = process.env.ADMIN_CREDIT_SEED_ILS;
  delete process.env.ADMIN_CREDIT_SEED_ILS;
  assert(resolveEmptyLedgerSeedIls() === 57.25, "default morning seed");
  process.env.ADMIN_CREDIT_SEED_ILS = "off";
  assert(resolveEmptyLedgerSeedIls() === null, "seed off");
  process.env.ADMIN_CREDIT_SEED_ILS = "60.5";
  assert(resolveEmptyLedgerSeedIls() === 60.5, "seed override");
  if (prevSeed == null) delete process.env.ADMIN_CREDIT_SEED_ILS;
  else process.env.ADMIN_CREDIT_SEED_ILS = prevSeed;

  const creditSrc = fs.readFileSync(path.join(__dirname, "admin-credit-estimate.js"), "utf8");
  assert(/await flushPendingSpend\(true\)/.test(creditSrc), "flush is awaited");
  assert(!/flushPendingSpend\(false\)\.catch/.test(creditSrc), "no fire-and-forget flush");
  assert(/async function recordCoachUsageSpend/.test(creditSrc), "recordCoachUsageSpend is async");

  const pc = fs.readFileSync(path.join(__dirname, "../../../api/personal-coach.js"), "utf8");
  assert(/async function logCoachUsage/.test(pc), "logCoachUsage is async");
  assert(/await logCoachUsage/.test(pc), "call paths await logCoachUsage");
  assert(/await recordCoachUsageSpend/.test(pc), "coach awaits spend persist");

  const gw = fs.readFileSync(path.join(__dirname, "../../../api/generate-workout.js"), "utf8");
  assert(/recordGeminiSpendSafe/.test(gw), "generate-workout records Gemini spend");

  const adminHtml = fs.readFileSync(path.join(__dirname, "../../../admin.html"), "utf8");
  assert(/נשרף מאז/.test(adminHtml), "admin pill explains spend since update");
  assert(/lastFlushAt/.test(adminHtml), "admin pill shows last flush");

  console.log("admin-credit-estimate test passed");
}

function reloadCreditModule() {
  [
    require.resolve("./admin-paths"),
    require.resolve("./admin-json-store"),
    require.resolve("./admin-credit-estimate"),
  ].forEach(function (p) {
    delete require.cache[p];
  });
  return require("./admin-credit-estimate");
}

async function runPersistence() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "credit-est-"));
  const prev = {
    ADMIN_DATA_ROOT: process.env.ADMIN_DATA_ROOT,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
    BLOB_STORE_ID: process.env.BLOB_STORE_ID,
    VERCEL: process.env.VERCEL,
    ADMIN_CREDIT_SEED_ILS: process.env.ADMIN_CREDIT_SEED_ILS,
    ADMIN_CREDIT_BALANCE_ILS: process.env.ADMIN_CREDIT_BALANCE_ILS,
  };
  process.env.ADMIN_DATA_ROOT = dir;
  process.env.ADMIN_CREDIT_SEED_ILS = "off";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.BLOB_STORE_ID;
  delete process.env.VERCEL;
  delete process.env.ADMIN_CREDIT_BALANCE_ILS;

  try {
    const mod1 = reloadCreditModule();
    await mod1.setManualBalance(57.23, "test baseline");
    const ils = await mod1.recordCoachUsageSpend(
      "gemini-2.5-flash",
      { promptTokens: 100000, outputTokens: 20000 },
      "generateContent"
    );
    assert(ils > 0.05, "recorded spend " + ils);

    /* New isolate: module memory is gone; only the durable file remains. */
    const mod2 = reloadCreditModule();
    const view = await mod2.getCreditEstimate();
    assert(view.balanceManual === 57.23, "manual baseline survived reload");
    assert(view.spentSinceUpdateEstimated > 0, "spent persisted across isolate, got " + view.spentSinceUpdateEstimated);
    assert(view.remainingEstimated < 57.23, "remaining dropped after persist, got " + view.remainingEstimated);
    assert(view.lastFlushAt, "lastFlushAt set after flush");
    console.log("admin-credit-estimate persistence test passed");
  } finally {
    Object.keys(prev).forEach(function (k) {
      if (prev[k] == null) delete process.env[k];
      else process.env[k] = prev[k];
    });
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
    reloadCreditModule();
  }
}

run();
runPersistence().catch(function (e) {
  console.error(e);
  process.exit(1);
});
