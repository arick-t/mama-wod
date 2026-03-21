const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "web");

function safeRm(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(relPath) {
  const src = path.join(root, relPath);
  const dst = path.join(outDir, relPath);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(relPath) {
  const src = path.join(root, relPath);
  const dst = path.join(outDir, relPath);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

safeRm(outDir);
fs.mkdirSync(outDir, { recursive: true });

copyFile("index.html");
copyDir("data");

console.log("Built Capacitor web assets in /web");
