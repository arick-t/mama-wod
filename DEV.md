# בדיקה בנייד (Mobile testing)

כדי לראות את האפליקציה כמו משתמש קצה – על המכשיר הנייד – יש שתי דרכים.

## 1. Live Server ב־VS Code / Cursor

בפרויקט מוגדר ש־Live Server משתמש ב־**Local IP** (ראה `.vscode/settings.json`).

1. חבר את המחשב והנייד **לאותו רשת WiFi**.
2. ב־VS/Cursor: **Right‑click על `index.html` → Open with Live Server** (או כפתור "Go Live").
3. בדרך כלל ייפתח דפדפן עם כתובת כמו `http://127.0.0.1:5500`.  
   עם `useLocalIp: true` ייתכן שהכתובת תהיה כבר בסגנון `http://192.168.x.x:5500` – **זו הכתובת לפתוח בנייד**.
4. אם לא: בדוק את ה־IP של המחשב:
   - **Windows:** `ipconfig` בטרמינל, חפש **IPv4 Address** תחת ה־WiFi (למשל `192.168.1.105`).
   - **Mac/Linux:** `ifconfig` או `ip addr`, חפש את ה־IP של `en0` / WiFi.
5. בנייד פתח בדפדפן: **`http://<ה-IP-שלך>:5500`**  
   לדוגמה: `http://192.168.1.105:5500`.

שינויים בקוד יתעדכנו אוטומטית גם בנייד (Live Reload).

---

## 2. שרת Python (אם Live Server לא נותן גישה מהרשת)

ב־PowerShell או CMD מתיקיית הפרויקט:

```powershell
python -m http.server 8080 --bind 0.0.0.0
```

אז:
- לבדוק את ה־IP של המחשב (`ipconfig`).
- בנייד לפתוח: **`http://<ה-IP>:8080`**.

או הרץ את הסקריפט (מדפיס את ה־IP ומפעיל שרת):

```powershell
.\serve-mobile.ps1
```

---

## דיבוג מהמחשב (Remote debugging)

- **Android + Chrome:** במחשב פתח Chrome ונווט ל־`chrome://inspect`. הפעל בדיקת מכשיר (USB debugging). אחרי שהנייד מחובר, יופיע הדף ואפשר לפתוח DevTools עליו.
- **iPhone + Safari:** ב־Mac: Safari → Preferences → Advanced → "Show Develop menu". חבר את האייפון, הפעל "Web Inspector" על המכשיר, ובחר את הדף.

זה מאפשר לראות קונסול, רשת ובאגים כמו על דסקטופ.
