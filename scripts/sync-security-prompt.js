const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "experiments", "security-coach", "security-system-prompt.md");
const dest = path.join(root, "lib", "security-prompt.js");

if (!fs.existsSync(src)) {
  console.error("Missing", src);
  process.exit(1);
}

const md = fs.readFileSync(src, "utf8");
const m = md.match(/```\r?\n([\s\S]*?)\r?\n```/);
if (!m) {
  console.error("No fenced prompt block found");
  process.exit(1);
}

const body = m[1].replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
fs.writeFileSync(dest, "module.exports = " + JSON.stringify(body) + ";\n");
console.log("synced security-prompt.js", body.length, "chars");
