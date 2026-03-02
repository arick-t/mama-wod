# בדיקה בנייד (Mobile testing)

כדי לראות את האפליקציה כמו משתמש קצה – על המכשיר הנייד – **בלי לדחוף ל-Git**.  
מחשב ונייד חייבים להיות **באותו WiFi**.

---

## מומלץ: שרת Python (עובד תמיד מהנייד)

Live Server ב-VS לרוב מאזין רק על `127.0.0.1`, אז מהנייד לא תגיע לאתר.  
**הדרך האמינה:** להריץ שרת שמאזין על `0.0.0.0` (כל הממשקים).

1. **פתח טרמינל (PowerShell)** בתיקיית הפרויקט:
   ```powershell
   cd "c:\Users\User\Documents\GitHubRepos\mama-wod"
   .\serve-mobile.ps1
   ```
2. הסקריפט ידפיס כתובת כמו `http://192.168.1.105:8080` – **זו הכתובת לפתוח בדפדפן בנייד**.
3. אם בנייד מתקבל "לא ניתן להתחבר" / connection refused:
   - **Windows:** אפשר ל-Python גישה ב-Firewall (Private network):  
     Settings → Privacy & Security → Windows Security → Firewall → Allow an app → Python.
   - או הרץ את PowerShell **כמנהל** פעם אחת והרץ שוב את `.\serve-mobile.ps1`.
4. אחרי שינוי בקוד – רענן את הדף בנייד (אין Live Reload אוטומטי בשרת הזה).

כך אתה עובד על קוד **לוקאלי** ורואה את התוצאה בפלאפון בלי לעלות גרסה ל-Git.

---

## אופציה: Live Server (אם מוגדר Local IP)

בפרויקט מוגדר `liveServer.settings.useLocalIp: true` (ב־`.vscode/settings.json`).

1. Right‑click על `index.html` → **Open with Live Server** (או "Go Live").
2. אם נפתחת כתובת בסגנון `http://192.168.x.x:5500` – פתח **אותה כתובת** בדפדפן בנייד.
3. אם נפתחת רק `http://127.0.0.1:5500` – Live Server לא מאזין על הרשת; השתמש בשרת Python למעלה.

---

## דיבוג מהמחשב (Remote debugging)

- **Android + Chrome:** במחשב פתח Chrome ונווט ל־`chrome://inspect`. הפעל בדיקת מכשיר (USB debugging). אחרי שהנייד מחובר, יופיע הדף ואפשר לפתוח DevTools עליו.
- **iPhone + Safari:** ב־Mac: Safari → Preferences → Advanced → "Show Develop menu". חבר את האייפון, הפעל "Web Inspector" על המכשיר, ובחר את הדף.

זה מאפשר לראות קונסול, רשת ובאגים כמו על דסקטופ.
