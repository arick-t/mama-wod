#!/usr/bin/env bash
# Called from .github/workflows/weekly-analytics-report.yml — keeps the workflow YAML short.
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
    echo "דוח ניתור משתמשים"
    echo ""
    echo "עדיין אין נתונים בקובץ data/analytics.jsonl."
    echo "הפעל את הניתור (ANALYTICS_ENDPOINT) וצבור כניסות ואירועי Find Workout – אחר כך תקבל כאן סיכום אמיתי."
  } > report.txt
elif [[ -f scripts/analytics-summary.js ]]; then
  node scripts/analytics-summary.js > report.txt 2>&1
else
  {
    echo "דוח ניתור – השבוע האחרון"
    echo ""
    echo "סקריפט scripts/analytics-summary.js חסר ב-repo."
  } > report.txt
fi

FROM="${RESEND_FROM_SECRET:-}"
[[ -z "$FROM" ]] && FROM="DUCK-WOD <onboarding@resend.dev>"
TO="${EMAIL_TO_OVERRIDE:-}"
if [[ -n "$TO" ]]; then
  :
elif [[ -z "${ANALYTICS_TO_SECRET:-}" ]]; then
  TO="ariel.tahan@gmail.com"
else
  TO="$ANALYTICS_TO_SECRET"
fi

case "$REPORT_PERIOD" in
  last_day) SUB="ניתור משתמשים – 24 שעות אחרונות" ;;
  yesterday_today) SUB="ניתור משתמשים – אתמול והיום" ;;
  last_week) SUB="ניתור משתמשים – שבוע אחרון" ;;
  *) SUB="ניתור משתמשים – דוח" ;;
esac

BODY=$(jq -Rs . report.txt)
jq -n \
  --arg from "$FROM" \
  --arg to "$TO" \
  --arg sub "$SUB" \
  --argjson text "$BODY" \
  '{from:$from, to:[$to], subject:$sub, text:$text}' > payload.json

curl -sS -f -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @payload.json
