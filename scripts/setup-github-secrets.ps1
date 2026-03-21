# הגדרת כל ה-Secrets הנדרשים לדוח השבועי באימייל.
# דרוש: GitHub CLI (gh) מותקן ומחובר: https://cli.github.com/
# הרצה: מתוך שורש הפרויקט: .\scripts\setup-github-secrets.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== הגדרת Secrets ל־GitHub Actions (דוח ניתור שבועי) ===" -ForegroundColor Cyan
Write-Host ""

# בדיקה ש-gh מותקן
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "נדרש להתקין GitHub CLI (gh). הורדה: https://cli.github.com/" -ForegroundColor Red
    exit 1
}

# בדיקה שמחוברים
$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "נדרש להתחבר ל־GitHub. הרץ: gh auth login" -ForegroundColor Red
    exit 1
}

Write-Host "מגדיר SMTP_HOST..." -ForegroundColor Green
gh secret set SMTP_HOST --body "smtp.protonmail.ch"

Write-Host "מגדיר SMTP_PORT..." -ForegroundColor Green
gh secret set SMTP_PORT --body "587"

Write-Host ""
Write-Host "עכשיו יופיע prompt להזנת SMTP_PASSWORD (הסיסמה של duck_wood1@protonmail.com)." -ForegroundColor Yellow
Write-Host "הדבק את הסיסמה והקש Enter (התווים לא יוצגו)." -ForegroundColor Yellow
Write-Host ""
gh secret set SMTP_PASSWORD

Write-Host ""
Write-Host "ההגדרה הושלמה. כל שלושת ה-Secrets נשמרו ב־GitHub." -ForegroundColor Green
Write-Host "בדיקה: Actions -> Weekly Analytics Report -> Run workflow (עם דוח דוגמה)." -ForegroundColor Cyan
