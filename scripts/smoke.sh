#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1"; exit 1; }

echo '== 1. release audit =='
npm run release:audit >/dev/null || fail 'release-audit'

echo '== 2. unit tests =='
npm run test:unit >/dev/null || fail 'unit tests'

echo '== 3. scenario tests =='
npm run test:scenarios >/dev/null || fail 'scenario tests'

echo '== 4. docker compose config =='
if command -v docker >/dev/null 2>&1; then
  docker compose config >/dev/null || fail 'docker compose config'
else
  echo 'SKIP: Docker не установлен в текущей среде'
fi

echo
echo '✅ Local release smoke checks passed'
