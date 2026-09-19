#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-http://localhost:3000}"
MINI="${2:-http://localhost:8080}"

fail() { echo "FAIL: $1"; exit 1; }

echo "== 1. health =="
curl -fsS "$BASE/health" >/dev/null || fail "health"

echo "== 2. meta =="
curl -fsS "$BASE/api/meta" | grep -q '"version"' || fail "meta"

echo "== 3. reason без initData =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reason/smv_error")
[ "$code" = "401" ] || fail "ожидали 401, получили $code"

echo "== 4. checklist без initData =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/checklist/smv_error")
[ "$code" = "401" ] || fail "ожидали 401, получили $code"

echo "== 5. miniapp отвечает =="
curl -fsS "$MINI/" | grep -q '<div id="root">' || fail "miniapp"

echo
echo "✅ Все проверки пройдены"