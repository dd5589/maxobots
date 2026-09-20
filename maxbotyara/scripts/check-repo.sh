#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1"; exit 1; }

for path in .env runtime node_modules mini-app/node_modules mini-app/dist; do
  if git ls-files --error-unmatch "$path" >/dev/null 2>&1 || git ls-files "$path/**" | grep -q .; then
    fail "запрещённый путь отслеживается Git: $path"
  fi
done

if [ -f .env ]; then
  git check-ignore -q .env || fail ".env существует локально, но не игнорируется Git"
fi

BOT_LINE=$(grep '^BOT_TOKEN=' .env.example || true)
[ "$BOT_LINE" = "BOT_TOKEN=" ] || fail ".env.example должен содержать пустой BOT_TOKEN"

if grep -R --exclude-dir=.git --exclude-dir=node_modules --exclude='*.lock' -nE 'BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}' . >/dev/null 2>&1; then
  fail "похоже на секрет/ключ в исходниках"
fi

echo '✅ Репозиторий не содержит рабочие секреты и runtime-зависимости в Git'
