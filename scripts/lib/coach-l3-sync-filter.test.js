/**
 * L3 sync filter — ensure L1/L2 never pass File Search sync.
 */
const { isExcludedFromL3Sync } = require("./coach-l3-sync-filter");
const { walkFiles } = require("./coach-brain-sync");
const path = require("path");
const fs = require("fs");
const os = require("os");

function assert(cond, label) {
  if (!cond) throw new Error("FAIL " + label);
}

function run() {
  assert(isExcludedFromL3Sync("living-knowledge/l1-l2-programming-foundation.md"), "l1-l2 md");
  assert(isExcludedFromL3Sync("layer2-programming-ops.md"), "layer2 ops");
  assert(isExcludedFromL3Sync("README.md"), "readme");
  assert(!isExcludedFromL3Sync("pro-coach-articles/what-makes-a-great-coach.md"), "l3 article");
  assert(!isExcludedFromL3Sync("Zone2-for-CF.pdf"), "l3 pdf");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "l3-sync-"));
  fs.mkdirSync(path.join(tmp, "living-knowledge"));
  fs.writeFileSync(path.join(tmp, "living-knowledge", "l1-l2-programming-foundation.md"), "# L1");
  fs.writeFileSync(path.join(tmp, "living-knowledge", "layer2-programming-ops.md"), "# L2");
  fs.writeFileSync(path.join(tmp, "ok-source.md"), "# L3 ok");
  const files = walkFiles(tmp, tmp, []);
  const rels = files.map(function (f) {
    return f.rel;
  });
  assert(rels.indexOf("ok-source.md") >= 0, "keeps L3");
  assert(rels.indexOf("living-knowledge/l1-l2-programming-foundation.md") < 0, "drops L1");
  assert(rels.indexOf("living-knowledge/layer2-programming-ops.md") < 0, "drops L2");

  console.log("coach-l3-sync-filter test passed");
}

run();
