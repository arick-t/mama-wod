#!/usr/bin/env bash
# Called from .github/workflows/weekly-analytics-report.yml — keeps the workflow YAML short.
# Sends via Brevo (BREVO_API_KEY). HTML body (RTL + bold sections) + plain-text fallback.
set -euo pipefail
REPORT_PERIOD="${REPORT_PERIOD:-last_week}"
REPORT_FROM_DATE="${REPORT_FROM_DATE:-}"

if [[ "${USE_SAMPLE_DATA:-false}" == "true" ]] && [[ -f data/analytics_sample_last_week.jsonl ]]; then
  cp data/analytics_sample_last_week.jsonl data/analytics.jsonl
elif [[ "${USE_SAMPLE_DATA:-false}" == "true" ]]; then
  echo "Sample file data/analytics_sample_last_week.jsonl not in repo. Proceeding without sample."
fi

if [[ ! -f data/analytics.jsonl ]] || [[ ! -s data/analytics.jsonl ]]; then
  {
    echo '🦆 דו"ח ניתור משתמשים'
    echo ""
    echo "עדיין אין נתונים בקובץ data/analytics.jsonl."
    echo "הפעל את הניתור (ANALYTICS_ENDPOINT) וצבור כניסות ואירועי Find Workout – אחר כך תקבל כאן סיכום אמיתי."
  } > report.txt
  {
    echo '<!DOCTYPE html><html lang="he" dir="rtl"><body style="direction:rtl;text-align:right;font-family:Arial,sans-serif;background:#111;color:#f2f2f2;padding:16px;">'
    echo '<p style="font-weight:700;font-size:20px;">🦆 דו"ח ניתור משתמשים</p>'
    echo '<p style="font-weight:400;">עדיין אין נתונים בקובץ data/analytics.jsonl.</p>'
    echo '</body></html>'
  } > report.html
elif [[ -f scripts/analytics-summary.js ]]; then
  node scripts/analytics-summary.js > report.txt 2>&1
  REPORT_FORMAT=html node scripts/analytics-summary.js > report.html 2>&1
else
  {
    echo '🦆 דו"ח ניתור – השבוע האחרון'
    echo ""
    echo "סקריפט scripts/analytics-summary.js חסר ב-repo."
  } > report.txt
  cp report.txt report.html
fi

TO="${EMAIL_TO_OVERRIDE:-}"
if [[ -n "$TO" ]]; then
  :
elif [[ -z "${ANALYTICS_TO_SECRET:-}" ]]; then
  TO="contact.duckwod@gmail.com"
else
  TO="$ANALYTICS_TO_SECRET"
fi

case "$REPORT_PERIOD" in
  last_day) SUB="🦆 ניתור משתמשים – 24 שעות אחרונות" ;;
  yesterday_today) SUB="🦆 ניתור משתמשים – אתמול והיום" ;;
  last_week) SUB="🦆 ניתור משתמשים – שבוע אחרון" ;;
  *) SUB="🦆 ניתור משתמשים – דוח" ;;
esac
if [[ "${USE_SAMPLE_DATA:-false}" == "true" ]]; then
  SUB="🦆 דוגמה — ${SUB#🦆 }"
fi

TEXT_BODY=$(jq -Rs . report.txt)
HTML_BODY=$(jq -Rs . report.html)

if [[ -z "${BREVO_API_KEY:-}" ]]; then
  echo "No BREVO_API_KEY — cannot send email." >&2
  exit 1
fi

SENDER_EMAIL="${BREVO_SENDER_EMAIL:-contact.duckwod@gmail.com}"
SENDER_NAME="${BREVO_SENDER_NAME:-DUCK-WOD}"
jq -n \
  --arg email "$SENDER_EMAIL" \
  --arg name "$SENDER_NAME" \
  --arg to "$TO" \
  --arg sub "$SUB" \
  --argjson text "$TEXT_BODY" \
  --argjson html "$HTML_BODY" \
  '{sender:{email:$email,name:$name}, to:[{email:$to}], subject:$sub, textContent:$text, htmlContent:$html}' > payload.json
curl -sS -f -X POST https://api.brevo.com/v3/smtp/email \
  -H "accept: application/json" \
  -H "content-type: application/json" \
  -H "api-key: ${BREVO_API_KEY}" \
  -d @payload.json
echo ""
echo "Sent via Brevo → ${TO}"
