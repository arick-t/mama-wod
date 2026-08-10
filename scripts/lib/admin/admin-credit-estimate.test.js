/**
 * Admin credit estimate unit tests — 0 network, 0 AI.
 */
const {
  estimateIlsFromUsage,
  priceForModel,
  publicCreditView,
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

  console.log("admin-credit-estimate test passed");
}

run();
