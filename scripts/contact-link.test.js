/**
 * בדיקת לינק קונטקט – וידוא ש־mailto לכתובת יצירת הקשר קיים.
 *
 * - **מקומי (ברירת מחדל):** קורא את `index.html` מה-repo – מתאים ל־`npm test` בלי רשת.
 * - **Vercel / אתר חי:** אם מוגדר `CONTACT_LINK_TEST_URL` (למשל `https://mama-wod.vercel.app`),
 *   מושך את ה־HTML מהפריסה ב־[Vercel](https://vercel.com/) ומוודא את אותו mailto – כמו שמשתמשים בניתור (ANALYTICS).
 *
 * ב־GitHub Actions מגדירים את ה־URL ב־workflow (לא צריך Resend לזה).
 */
const fs = require("fs");
const path = require("path");

const CONTACT_EMAIL = "contact.duckwod@gmail.com";

function assertMailtoInHtml(html, sourceLabel) {
  const hrefPattern = new RegExp(
    'href=["\']mailto:' +
      CONTACT_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      '["\']',
    "gi"
  );
  const matches = html.match(hrefPattern);
  if (!matches || matches.length < 2) {
    throw new Error(
      "בדיקת לינק קונטקט (" +
        sourceLabel +
        "): צפויים לפחות שני קישורי mailto:" +
        CONTACT_EMAIL +
        " (מצאתי " +
        (matches ? matches.length : 0) +
        ")"
    );
  }
}

async function fetchLiveHtml(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "mama-wod-contact-link-test/1" }
    });
    if (!res.ok) {
      throw new Error("בדיקת לינק קונטקט: HTTP " + res.status + " מ־" + url);
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function run() {
  const pkgPath = path.join(__dirname, "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const version = pkg.version || "unknown";

  const liveUrl = (process.env.CONTACT_LINK_TEST_URL || "").trim();

  const htmlPath = path.join(__dirname, "..", "index.html");
  const localHtml = fs.readFileSync(htmlPath, "utf8");
  assertMailtoInHtml(localHtml, "index.html מקומי");

  if (liveUrl) {
    const remoteHtml = await fetchLiveHtml(liveUrl);
    assertMailtoInHtml(remoteHtml, "אתר חי: " + liveUrl);
    console.log(
      "בדיקת לינק קונטקט passed (מקומי + Vercel/חי: " +
        liveUrl +
        ", גרסה " +
        version +
        ")"
    );
  } else {
    console.log(
      "בדיקת לינק קונטקט passed (mailto → " +
        CONTACT_EMAIL +
        ", גרסה " +
        version +
        "; ללא CONTACT_LINK_TEST_URL – רק קובץ מקומי)"
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
