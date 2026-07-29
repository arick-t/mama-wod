const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const md = fs.readFileSync(path.join(root, "experiments/personal-coach/hamamen-system-prompt.md"), "utf8");
const m = md.match(/```\r?\n([\s\S]*?)\r?\n```/);
if (!m) {
  console.error("No fenced prompt block found");
  process.exit(1);
}
const body = m[1].replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
fs.writeFileSync(path.join(root, "api/hamamen-prompt.js"), "module.exports = " + JSON.stringify(body) + ";\n");
console.log("synced", body.length, "chars");
