/**
 * Admin API base — GitHub Pages must reach Vercel, not github.io/api.
 * Run: node scripts/admin-api-base.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const claimHtml = fs.readFileSync(path.join(root, "claim.html"), "utf8");
const fixedJs = fs.readFileSync(path.join(root, "admin-fixed-intake.js"), "utf8");

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("admin defines getAdminApiBase", /function getAdminApiBase\(\)/.test(adminHtml));
ok("admin defines adminApiUrl", /function adminApiUrl\(path\)/.test(adminHtml));
ok("admin defines pagesAbsoluteUrl", /function pagesAbsoluteUrl\(path\)/.test(adminHtml));
ok(
  "github.io routes to mama-wod.vercel.app",
  /github\.io[\s\S]{0,200}mama-wod\.vercel\.app\/api\/event/.test(adminHtml)
);
ok("no bare fetch /api/ in admin.html", !/fetch\("\/api\//.test(adminHtml));
ok("fixed intake uses adminApiUrl for coach", /fetch\(adminApiUrl\("\/api\/personal-coach"\)/.test(fixedJs));
ok("fixed intake uses adminApiUrl for handoff", /fetch\(adminApiUrl\("\/api\/admin-handoff"\)/.test(fixedJs));
ok("claim uses adminApiUrl", /fetch\(adminApiUrl\("\/api\/admin-handoff/.test(claimHtml));
ok("athlete snapshot helper uses getApiBase", /function pprogAdminSnapshotUrl/.test(indexHtml) && /getApiBase\(\)/.test(indexHtml.slice(indexHtml.indexOf("function pprogAdminSnapshotUrl"), indexHtml.indexOf("function pprogAdminSnapshotUrl") + 400)));
ok("athlete snapshot push is not relative /api", !/fetch\("\/api\/admin-snapshot"/.test(indexHtml));
ok("athlete snapshot fetch uses helper", /fetch\(pprogAdminSnapshotUrl\(\)/.test(indexHtml));
ok(
  "handoff links use pagesAbsoluteUrl",
  /pagesAbsoluteUrl\(d\.path\)/.test(adminHtml) || /pagesAbsoluteUrl\(linkPath\)/.test(fixedJs)
);

console.log("All admin API base checks passed.");
