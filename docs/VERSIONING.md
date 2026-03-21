# גרסאות (DUCK-WOD)

## מספר אחד בלבד

| מה | איפה | דוגמה |
|----|------|--------|
| **גרסת מוצג** (באתר / כותרת) | `index.html` — `<title>` + `.header-sub` | `v19.8` |
| **גרסת npm / Capacitor** | `package.json` → `version` | `19.8.0` (= major.minor.patch) |
| **עותק מהיר** | קובץ `VERSION` בשורש | `19.8.0` |

**כל שחרור משמעותי:** העלה את `minor` או `patch` ביחד בכל המקומות האלה + עדכון `CHANGELOG.md`.

## עותקים ל־Capacitor

אחרי שינוי `index.html` בשורש:

```bash
npm run build:cap:web
npx cap sync
```

או עדכן ידנית גם את `web/index.html`, `ios/App/App/public/index.html`, `android/app/src/main/assets/public/index.html` כדי שיהיו זהים לשורש (או לסמוך על `build:cap:web` שמעתיק ל־`web/`).

## סביבת פיתוח (Capacitor)

- **Node.js 22+** (דרישת Capacitor CLI 8). אם `cap sync` נכשל — בדוק `node -v`.

## לא לבלבל עם

- `v1.1.0` היה מספר npm ישן שלא תאם ל־`v19.x` — עכשיו **הכול מסונכרן ל־19.x.y**.
