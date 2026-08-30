/**
 * Coach reply parsing — hang guard + marker tolerance.
 * Run: node scripts/coach-json-extract.test.js
 *
 * Guards three real defects found on 2026-08-30:
 *   1. extractWeekJson / extractBlockJson spun forever on a truncated reply
 *      (lastIndexOf("{", -1) clamps to 0 and returns 0 again). The athlete saw
 *      an endless spinner until the serverless timeout, with Gemini already billed.
 *   2. Provider fetch/read failures threw past the handler as a raw 500.
 *   3. extractDayJson / extractPartJson used bare JSON.parse — a ```json fence,
 *      a truncated reply, or lowercase markers silently dropped a change the
 *      athlete had already confirmed ("Done." with nothing applied).
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const pcPath = path.join(root, "api", "personal-coach.js");
const pc = fs.readFileSync(pcPath, "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

/* ---------------------------------------------------------------------------
 * Load the extractors out of the module without invoking the handler.
 * personal-coach.js exports only the handler, so pull the helper functions by
 * evaluating the file's function declarations in a bare sandbox.
 * ------------------------------------------------------------------------- */
function loadExtractors() {
  const vm = require("vm");
  const names = [
    "sliceBalancedObject",
    "tryParseJsonObject",
    "coerceWeekFromParsed",
    "extractWeekJson",
    "extractBlockJson",
    "extractMarkerJson",
    "extractDayJson",
    "extractPartJson",
  ];
  const src = [];
  for (const n of names) {
    const re = new RegExp("^function " + n + "\\([\\s\\S]*?^}", "m");
    const m = pc.match(re);
    assert.ok(m, "could not locate function " + n + " in api/personal-coach.js");
    src.push(m[0]);
  }
  const sandbox = { module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(
    src.join("\n\n") + "\nmodule.exports = {" + names.join(",") + "};",
    sandbox
  );
  return sandbox.module.exports;
}

const X = loadExtractors();

/* --- 1. Hang guard ------------------------------------------------------- */

/* Each of these begins with "{" and never closes — the shape a Gemini reply
 * takes when maxOutputTokens cuts it off. Before the fix the walk-back loop
 * never terminated. A child process with a hard timeout is the only honest way
 * to assert "does not hang": an in-process infinite loop would hang the test. */
const HANG_INPUTS = [
  '{"weekIndex":1,"phase":"build","theme":"Engine + Squat","days":',
  '{"error":{"days":"unavailable"}}',
  '{"blockStart":"2026-09-06","weeks":',
  '{"note":"3 days logged","days":3}',
];

const probe = `
${Object.keys(X).length ? "" : ""}
const fs = require("fs");
const vm = require("vm");
const pc = fs.readFileSync(${JSON.stringify(pcPath)}, "utf8");
const names = ["sliceBalancedObject","tryParseJsonObject","coerceWeekFromParsed","extractWeekJson","extractBlockJson"];
const src = names.map(function (n) {
  return pc.match(new RegExp("^function " + n + "\\\\([\\\\s\\\\S]*?^}", "m"))[0];
});
const sandbox = { module: { exports: {} } };
vm.createContext(sandbox);
vm.runInContext(src.join("\\n\\n") + "\\nmodule.exports = {" + names.join(",") + "};", sandbox);
const inputs = ${JSON.stringify(HANG_INPUTS)};
for (const raw of inputs) {
  sandbox.module.exports.extractWeekJson(raw, 1);
  sandbox.module.exports.extractBlockJson(raw);
}
console.log("NO_HANG");
`;

let hangResult = "";
try {
  hangResult = execFileSync(process.execPath, ["-e", probe], {
    encoding: "utf8",
    timeout: 10000,
  });
} catch (e) {
  if (e && (e.killed || e.signal)) {
    assert.fail(
      "extractWeekJson/extractBlockJson HUNG on a truncated reply — the walk-back " +
        "loop is missing its start===0 guard (api/personal-coach.js)"
    );
  }
  throw e;
}
ok("truncated reply does not hang week/block extraction", /NO_HANG/.test(hangResult));
ok(
  "week walk-back loop keeps its start===0 guard",
  /if \(start === 0\) break;/.test(pc) && (pc.match(/if \(start === 0\) break;/g) || []).length === 2
);

/* Still returns null rather than a bogus week */
ok(
  "unparseable truncated reply yields null, not a fake week",
  X.extractWeekJson('{"error":{"days":"unavailable"}}', 1) === null
);

/* --- 2. Provider failures cannot escape as a raw crash ------------------- */

ok("interactions fetch is wrapped", /error: "Interactions fetch failed"/.test(pc));
ok("gemini fetch is wrapped", /error: "Gemini fetch failed"/.test(pc));
ok("gemini body read is wrapped", /error: "Gemini response read failed"/.test(pc));
ok(
  "handler has a last-resort net returning JSON",
  /return await coachHandler\(req, res\);/.test(pc) && /unhandled: true/.test(pc)
);
ok(
  "net does not double-send after headers are out",
  /if \(res && res\.headersSent\) return undefined;/.test(pc)
);
ok(
  "gemini url with the api key is never echoed into an error",
  !/detail:\s*url/.test(pc) && /never echo the URL/i.test(pc)
);

/* --- 3. DAY_JSON / PART_JSON tolerance ----------------------------------- */

const DAY_BODY = '{"day":"tue","parts":[{"id":"tue-0","title":"Part A","lines":["Back squat 5x5"]}]}';

ok(
  "canonical DAY_JSON still parses",
  X.extractDayJson("Updated.\n<<<DAY_JSON\n" + DAY_BODY + "\nDAY_JSON>>>").day === "tue"
);
ok(
  "DAY_JSON wrapped in a ```json fence parses",
  X.extractDayJson("<<<DAY_JSON\n```json\n" + DAY_BODY + "\n```\nDAY_JSON>>>").day === "tue"
);
ok(
  "DAY_JSON in <<<X>>> … <<<X>>> fence form parses",
  X.extractDayJson("<<<DAY_JSON>>>\n" + DAY_BODY + "\n<<<DAY_JSON>>>").day === "tue"
);
ok(
  "lowercase day_json marker parses",
  X.extractDayJson("<<<day_json\n" + DAY_BODY + "\nday_json>>>").day === "tue"
);

const truncatedDay = '<<<DAY_JSON\n{"day":"wed","parts":[{"id":"wed-0","title":"Part A","lines":["Row 2k"';
const salvagedDay = X.extractDayJson(truncatedDay);
ok("truncated DAY_JSON is salvaged, not dropped", !!salvagedDay && salvagedDay.day === "wed");
ok(
  "salvaged DAY_JSON keeps its parts",
  !!salvagedDay && Array.isArray(salvagedDay.parts) && salvagedDay.parts.length === 1
);

const PART_BODY = '{"id":"tue-1","title":"Part B","lines":["AMRAP 12"]}';
ok(
  "canonical PART_JSON still parses",
  X.extractPartJson("<<<PART_JSON\n" + PART_BODY + "\nPART_JSON>>>").id === "tue-1"
);
ok(
  "PART_JSON in a ```json fence parses",
  X.extractPartJson("<<<PART_JSON\n```json\n" + PART_BODY + "\n```\nPART_JSON>>>").id === "tue-1"
);

ok("no marker means no day change", X.extractDayJson("Sounds good — want me to change Tuesday?") === null);
ok("empty text means no day change", X.extractDayJson("") === null);

/* --- Non-regression: quality + cost rules untouched ---------------------- */

ok("programming stays Gemini-only (POL-020)", pc.includes("geminiOnly: true"));
ok("no Groq for programming", /NO Groq for programming/.test(pc));
ok(
  "day-by-day cascade stays opt-in (POL-COST-009)",
  pc.includes('PERSONAL_COACH_DAY_BY_DAY || "").trim() === "1"')
);
ok("template fill still refused (POL-020)", /Refusing offline template fill/.test(pc));

console.log("All coach JSON-extract / hang-guard checks passed.");
