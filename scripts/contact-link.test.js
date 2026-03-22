/**
 * בדיקת לינק קונטקט – וידוא ש־index.html מכיל mailto תקין לכתובת יצירת הקשר.
 * רץ ב־npm test וב־CI (Analytics Logic Tests).
 */
const fs = require("fs");
const path = require("path");

const CONTACT_EMAIL = "contact.duckwod@gmail.com";

function run() {
  const pkgPath = path.join(__dirname, "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const version = pkg.version || "unknown";

  const htmlPath = path.join(__dirname, "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const hrefPattern = new RegExp(
    'href=["\']mailto:' +
      CONTACT_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      '["\']',
    "gi"
  );
  const matches = html.match(hrefPattern);
  if (!matches || matches.length < 2) {
    throw new Error(
      "בדיקת לינק קונטקט: צפויים לפחות שני קישורי mailto:" +
        CONTACT_EMAIL +
        " ב־index.html (מצאתי " +
        (matches ? matches.length : 0) +
        ")"
    );
  }

  console.log(
    "בדיקת לינק קונטקט passed (mailto → " +
      CONTACT_EMAIL +
      ", גרסה " +
      version +
      ")"
  );
}

run();
