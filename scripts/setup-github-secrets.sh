#!/bin/bash
# הגדרת כל ה-Secrets הנדרשים לדוח השבועי באימייל.
# דרוש: GitHub CLI (gh) מותקן ומחובר: https://cli.github.com/
# הרצה: מתוך שורש הפרויקט: bash scripts/setup-github-secrets.sh

set -e

echo "=== הגדרת Secrets ל־GitHub Actions (דוח ניתור שבועי) ==="
echo ""

if ! command -v gh &>/dev/null; then
  echo "נדרש להתקין GitHub CLI (gh). הורדה: https://cli.github.com/"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "נדרש להתחבר ל־GitHub. הרץ: gh auth login"
  exit 1
fi

echo "מגדיר SMTP_HOST..."
gh secret set SMTP_HOST --body "smtp.protonmail.ch"

echo "מגדיר SMTP_PORT..."
gh secret set SMTP_PORT --body "587"

echo ""
echo "עכשיו יופיע prompt להזנת SMTP_PASSWORD (הסיסמה של duck_wood1@protonmail.com)."
echo "הדבק את הסיסמה והקש Enter."
echo ""
gh secret set SMTP_PASSWORD

echo ""
echo "ההגדרה הושלמה. כל שלושת ה-Secrets נשמרו ב־GitHub."
echo "בדיקה: Actions -> Weekly Analytics Report -> Run workflow (עם דוח דוגמה)."
