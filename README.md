# MAX bot + Mini App

Проект состоит из:
- MAX-бота на Node.js;
- HTTP API для Mini App;
- React/Vite Mini App;
- локального персистентного JSON-хранилища для состояния пользователей и напоминаний;
- Docker-конфигурации;
- unit-тестов;
- GitHub Actions CI.

## Локальный запуск backend

1. Скопируйте `.env.example` в `.env`.
2. Заполните `BOT_TOKEN`.
3. Для разработки можно использовать:
   `ALLOW_DEV_AUTH=true`
4. Запустите:

```bash
npm ci
npm test
npm start
```

Backend будет доступен на `http://localhost:3000`.

## Локальный запуск Mini App

В отдельном терминале:

```bash
cd mini-app
npm ci
npm run dev
```

Откройте:

```text
http://localhost:5173/?startapp=property
```

Для dev-режима Mini App автоматически передаст `dev-init-data`, а backend примет его только при `ALLOW_DEV_AUTH=true` и `NODE_ENV != production`.

## Production

Создайте `.env`:

```text
BOT_TOKEN=...
MINIAPP_URL=https://your-domain.example/
NODE_ENV=production
ALLOW_DEV_AUTH=false
```

Соберите:

```bash
docker compose build
docker compose up -d
```

Mini App будет доступен через nginx-контейнер на порту `8080`, а `/api/*` будет проксироваться в backend.

## GitHub

В репозитории достаточно хранить исходники без `.env` и `node_modules`.

CI автоматически запускает:
- `npm ci`
- `npm test`
- syntax check
- сборку Mini App
- `docker build` для backend
- `docker build` для Mini App

Реальный `BOT_TOKEN` для CI не нужен.
