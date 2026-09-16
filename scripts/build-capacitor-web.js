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
copyDir("assets");
/* The ONE shared file the app itself needs. Added 2026-09-14 with the equipment catalogue:
   index.html stopped carrying its own copy of the movement list, and without this line the
   phone build would load nothing and match no workout to anyone's equipment - silently.
   Deliberately one file and not the whole of lib/: the rest is admin and coach code, and it
   has no business inside an athlete's bundle. */
copyFile("lib/equipment-catalog.js");

console.log("Built Capacitor web assets in /web");
