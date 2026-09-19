# Готовые файлы для замены

Этот файл содержит полный текст всех изменённых исходников и конфигурации.


## `.env.example`

```
# ---------- MAX ----------
BOT_TOKEN=
MINIAPP_URL=https://your-domain.example/

# ---------- API ----------
PORT=3000
TZ=Europe/Moscow
MAX_INIT_DATA_MAX_AGE_SECONDS=3600
ALLOW_DEV_AUTH=false
CORS_ORIGIN=*

# ---------- Local persistent storage ----------
DATA_DIR=./runtime

```


## `.github/workflows/ci.yml`

```
name: CI

on:
  push:
    branches:
      - main
      - master
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20.19.0
          cache: npm

      - name: Install backend dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Syntax check
        run: npm run lint

  mini-app:
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: mini-app

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20.19.0
          cache: npm
          cache-dependency-path: mini-app/package-lock.json

      - name: Install mini-app dependencies
        run: npm ci

      - name: Build mini-app
        run: npm run build

  docker:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Build backend image
        run: docker build -t maxbot-backend:ci .

      - name: Build mini-app image
        run: docker build -t maxbot-mini-app:ci ./mini-app

```


## `.gitignore`

```
node_modules/
mini-app/node_modules/
mini-app/dist/
.env
.env.*
!.env.example
*.log
.DS_Store
coverage/
.vscode/*
!.vscode/settings.json
!.vscode/launch.json
!.vscode/extensions.json
runtime/

```


## `Dockerfile`

```
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data


FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Moscow
ENV DATA_DIR=/app/runtime

RUN apk add --no-cache tini wget \
    && mkdir -p /app/runtime \
    && chown -R node:node /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/data ./data
COPY package*.json ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3   CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/bot/index.js"]

```


## `README.md`

````
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

Для запуска бота на сервере токен храните в секретах или переменных окружения, а не в Git.

## Важное

Токен MAX, который когда-либо попал в публичный архив или Git, необходимо перевыпустить.

````


## `docker-compose.yml`

```
services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NODE_ENV: production
      TZ: ${TZ:-Europe/Moscow}
      PORT: 3000
      DATA_DIR: /app/runtime
      MAX_INIT_DATA_MAX_AGE_SECONDS: ${MAX_INIT_DATA_MAX_AGE_SECONDS:-3600}
      ALLOW_DEV_AUTH: "false"
      CORS_ORIGIN: ${CORS_ORIGIN:-*}
    ports:
      - "3000:3000"
    volumes:
      - botdata:/app/runtime
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  miniapp:
    build:
      context: ./mini-app
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      bot:
        condition: service_healthy

volumes:
  botdata:

```


## `mini-app/Dockerfile`

```
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3   CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

```


## `mini-app/nginx.conf`

```
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location ^~ /api/ {
        proxy_pass http://bot:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    autoindex off;
}

```


## `mini-app/src/App.jsx`

```
import { useEffect, useRef, useState } from 'react';
import { getStartParam, getRawInitData, prepareWebApp } from './api/bridge.js';
import { api } from './api/backend.js';
import Home from './screens/Home.jsx';
import Reason from './screens/Reason.jsx';
import Checklist from './screens/Checklist.jsx';
import Loader from './components/Loader.jsx';
import ErrorState from './components/ErrorState.jsx';

export default function App() {
  const [screen, setScreen] = useState({ name: 'home' });
  const [reason, setReason] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initData, setInitData] = useState('');
  const [initialReasonId, setInitialReasonId] = useState('');

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    initialized.current = true;

    try {
      prepareWebApp();

      const raw = getRawInitData();
      const startParam = getStartParam();

      setInitData(raw);
      setInitialReasonId(startParam);

      if (startParam) {
        void openReason(startParam, raw);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  async function openReason(id, authInitData = initData) {
    if (!id) {
      setError('Не указана причина отказа.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [reasonData, checklistData] = await Promise.all([
        api.getReason(id, authInitData),
        api.getChecklist(id, authInitData),
      ]);

      setReason(reasonData);
      setChecklist(checklistData);
      setScreen({ name: 'reason', id });
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    if (initialReasonId) {
      void openReason(initialReasonId, initData);
      return;
    }

    setError(null);
  }

  if (loading) {
    return <Loader label="Готовим разбор…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  if (screen.name === 'reason' && reason && checklist) {
    return (
      <Reason
        reason={reason}
        onOpenChecklist={() => setScreen({ name: 'checklist', id: reason.id })}
        onBack={() => setScreen({ name: 'home' })}
      />
    );
  }

  if (screen.name === 'checklist' && checklist) {
    return (
      <Checklist
        checklist={checklist}
        onBack={() => setScreen({ name: 'reason', id: checklist.reasonId })}
        onClose={() => window.WebApp?.close?.()}
      />
    );
  }

  return <Home onOpenReason={(id) => void openReason(id)} />;
}

```


## `mini-app/src/api/backend.js`

```
const BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, { method = 'GET', body, initData } = {}) {
  const headers = {
    Accept: 'application/json',
  };

  if (body != null) {
    headers['Content-Type'] = 'application/json';
  }

  if (initData) {
    headers['X-Max-Init-Data'] = initData;
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    const message =
      typeof data === 'string'
        ? data
        : data?.reason || data?.error || `HTTP ${response.status}`;

    throw new Error(`API ${path}: ${message}`);
  }

  return data;
}

export const api = {
  getMeta: () => request('/api/meta'),
  getReason: (id, initData) =>
    request(`/api/reason/${encodeURIComponent(id)}`, { initData }),
  getChecklist: (id, initData) =>
    request(`/api/checklist/${encodeURIComponent(id)}`, { initData }),
};

```


## `mini-app/src/api/bridge.js`

```
function getWebApp() {
  return window.WebApp ?? null;
}

export function getRawInitData() {
  return getWebApp()?.initData ?? '';
}

function normalizeStartParam(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    return value.payload ?? value.value ?? value.id ?? '';
  }

  return '';
}

export function getStartParam() {
  const webApp = getWebApp();

  if (webApp) {
    const value = normalizeStartParam(webApp.initDataUnsafe?.start_param);

    if (value) {
      return value;
    }
  }

  const url = new URL(window.location.href);

  return (
    url.searchParams.get('startapp') ||
    url.searchParams.get('start_param') ||
    ''
  );
}

export function getUser() {
  return getWebApp()?.initDataUnsafe?.user ?? null;
}

export function prepareWebApp() {
  const webApp = getWebApp();

  if (!webApp) {
    return;
  }

  webApp.ready?.();
}

```


## `mini-app/src/api/devBridge.js`

```
export function installDevBridge() {
  if (typeof window === 'undefined' || window.WebApp) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const startParam =
    params.get('startapp') ||
    params.get('start_param') ||
    '';

  window.WebApp = {
    __dev: true,
    initData: 'dev-init-data',
    initDataUnsafe: {
      user: {
        id: 'dev-user',
        first_name: 'Dev',
      },
      start_param: startParam,
    },
    platform: 'web',
    version: 'dev',
    close: () => console.log('[devBridge] close()'),
    openLink: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    ready: () => {},
  };

  console.warn(
    '[devBridge] Активирован dev-режим. Для API включите ALLOW_DEV_AUTH=true на backend.'
  );
}

```


## `mini-app/src/main.jsx`

```
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { installDevBridge } from './api/devBridge.js';

installDevBridge();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

```


## `mini-app/vite.config.js`

```
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

```


## `package.json`

```
{
  "name": "edinoe-posobie-bot",
  "version": "1.0.0",
  "description": "Чат-бот для разбора отказа в едином пособии на детей (MAX)",
  "type": "module",
  "main": "src/bot/index.js",
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "start": "node src/bot/index.js",
    "dev": "node --watch src/bot/index.js",
    "test": "node --test \"tests/*.test.js\"",
    "test:watch": "node --test --watch \"tests/*.test.js\"",
    "lint": "node --check src/bot/index.js && node --check src/api/server.js && node --check src/services/matcher.js"
  },
  "dependencies": {
    "@maxhub/max-bot-api": "0.3.1",
    "dotenv": "^16.4.5",
    "node-cron": "^3.0.3"
  }
}

```


## `src/api/server.js`

```
import http from 'node:http';
import { config } from '../config.js';
import { getMeta, findReasonById } from '../services/reasons.js';
import { validateInitData } from './validation.js';

const CORS = {
  'Access-Control-Allow-Origin': config.corsOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Max-Init-Data',
};

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS,
  });
  res.end(JSON.stringify(data));
}

function requireAuth(req, res) {
  const initData = req.headers['x-max-init-data'];

  if (
    config.allowDevAuth &&
    process.env.NODE_ENV !== 'production' &&
    initData === 'dev-init-data'
  ) {
    return {
      user_id: 'dev-user',
      first_name: 'Dev',
    };
  }

  const result = validateInitData(
    initData,
    config.botToken,
    {
      maxAgeSeconds: config.maxInitDataMaxAgeSeconds,
    }
  );

  if (!result.valid) {
    json(res, 401, {
      error: 'invalid_init_data',
      reason: result.error,
    });
    return null;
  }

  if (!result.user) {
    json(res, 401, {
      error: 'invalid_init_data',
      reason: 'user_missing',
    });
    return null;
  }

  return result.user;
}

function sendNotFound(res) {
  return json(res, 404, { error: 'not_found' });
}

export function startApiServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { status: 'ok' });
    }

    if (req.method === 'GET' && url.pathname === '/api/meta') {
      return json(res, 200, getMeta());
    }

    const reasonMatch = url.pathname.match(/^\/api\/reason\/([^/]+)$/);
    const checklistMatch = url.pathname.match(/^\/api\/checklist\/([^/]+)$/);

    if (reasonMatch || checklistMatch) {
      const user = requireAuth(req, res);

      if (!user) {
        return;
      }

      const id = decodeURIComponent(
        (reasonMatch ?? checklistMatch)[1]
      );

      const reason = findReasonById(id);

      if (!reason) {
        return sendNotFound(res);
      }

      if (reasonMatch) {
        return json(res, 200, reason);
      }

      return json(res, 200, {
        reasonId: reason.id,
        title: reason.title,
        steps: reason.actions.map((text, index) => ({
          id: `s${index + 1}`,
          text,
          done: false,
        })),
        documents: reason.documents.map((text, index) => ({
          id: `d${index + 1}`,
          text,
          done: false,
        })),
        whereToApply: reason.whereToApply,
        legalRef: reason.legalRef,
      });
    }

    return json(res, 404, { error: 'not_found' });
  });

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`[api] http://0.0.0.0:${config.port}`);
  });

  return server;
}

```


## `src/api/validation.js`

```
import crypto from 'node:crypto';

function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const entries = [...params.entries()];

  const hashEntries = entries.filter(([key]) => key === 'hash');

  if (hashEntries.length !== 1) {
    return {
      ok: false,
      error: 'invalid_hash_count',
    };
  }

  const hash = hashEntries[0][1];

  params.delete('hash');

  const launchParams = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  return {
    ok: true,
    params,
    hash,
    launchParams,
  };
}

function timingSafeHexEqual(expectedHex, actualHex) {
  if (!/^[0-9a-f]{64}$/i.test(expectedHex)) {
    return false;
  }

  if (!/^[0-9a-f]{64}$/i.test(actualHex)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');

  return crypto.timingSafeEqual(expected, actual);
}

export function validateInitData(
  initData,
  botToken,
  {
    maxAgeSeconds = 3600,
    nowSeconds = Math.floor(Date.now() / 1000),
  } = {}
) {
  if (!initData || typeof initData !== 'string') {
    return {
      valid: false,
      error: 'empty_init_data',
    };
  }

  if (!botToken || typeof botToken !== 'string') {
    return {
      valid: false,
      error: 'empty_bot_token',
    };
  }

  let parsed;

  try {
    parsed = parseInitData(initData);
  } catch {
    return {
      valid: false,
      error: 'malformed_init_data',
    };
  }

  if (!parsed.ok) {
    return {
      valid: false,
      error: parsed.error,
    };
  }

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(parsed.launchParams)
    .digest('hex');

  if (!timingSafeHexEqual(calculatedHash, parsed.hash)) {
    return {
      valid: false,
      error: 'bad_signature',
    };
  }

  const authDate = Number(parsed.params.get('auth_date'));

  if (!Number.isFinite(authDate)) {
    return {
      valid: false,
      error: 'bad_auth_date',
    };
  }

  if (maxAgeSeconds > 0) {
    const age = Math.abs(nowSeconds - authDate);

    if (age > maxAgeSeconds) {
      return {
        valid: false,
        error: 'expired_init_data',
      };
    }
  }

  let user = null;

  const userRaw = parsed.params.get('user');

  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      return {
        valid: false,
        error: 'bad_user_json',
      };
    }
  }

  return {
    valid: true,
    user,
    authDate,
    startParam: parsed.params.get('start_param') ?? '',
  };
}

```


## `src/bot/api.js`

```
import { config, assertBotToken } from '../config.js';

const API_BASE = 'https://platform-api2.max.ru';

async function request(path, { method = 'GET', body } = {}) {
  assertBotToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: config.botToken,
        'Content-Type': 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();

    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    if (!response.ok) {
      throw new Error(
        `MAX API ${response.status}: ${
          typeof data === 'string' ? data : JSON.stringify(data)
        }`
      );
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const maxApi = {
  async sendMessage({ userId, text, format = 'markdown', attachments }) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const body = {
      text,
      format,
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      body.attachments = attachments;
    }

    return request(`/messages?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body,
    });
  },

  async getMe() {
    return request('/me');
  },
};

```


## `src/bot/commands.js`

```
import { storage } from '../services/storage.js';
import { askNext } from './handlers/quiz.js';

function getUserId(ctx) {
  return ctx.user?.user_id ?? null;
}

export function registerCommands(bot) {
  bot.command('start', async (ctx) => {
    const userId = getUserId(ctx);

    if (!userId) {
      return ctx.reply('Не удалось определить пользователя MAX. Попробуйте ещё раз.');
    }

    storage.reset(userId);
    storage.set(userId, {
      step: 0,
      answers: {},
      done: false,
      awaitingReminder: false,
    });

    await ctx.reply(
      'Здравствуйте! Я помогу разобраться, почему пришёл отказ ' +
      'в едином пособии на детей, и что делать дальше.\n\n' +
      'Отвечу на несколько вопросов — это займёт 2–3 минуты.\n\n' +
      'Чтобы начать заново в любой момент — /restart'
    );

    await askNext(bot, ctx, userId);
  });

  bot.command('restart', async (ctx) => {
    const userId = getUserId(ctx);

    if (!userId) {
      return ctx.reply('Не удалось определить пользователя MAX. Попробуйте ещё раз.');
    }

    storage.reset(userId);
    storage.set(userId, {
      step: 0,
      answers: {},
      done: false,
      awaitingReminder: false,
    });

    await ctx.reply('Начинаем заново.');
    await askNext(bot, ctx, userId);
  });

  bot.command('help', (ctx) => {
    return ctx.reply(
      'Я помогаю разобрать отказ в едином пособии на детей.\n' +
      'Команды: /start — начать, /restart — заново, /help — помощь.'
    );
  });

  bot.api?.setMyCommands?.([
    { name: 'start', description: 'Начать разбор отказа' },
    { name: 'restart', description: 'Начать заново' },
    { name: 'help', description: 'Помощь' },
  ]).catch((error) => {
    console.warn('[commands] setMyCommands:', error.message);
  });
}

```


## `src/bot/handlers/message.js`

```
import { storage } from '../../services/storage.js';
import { getQuestion, totalQuestions } from '../scenarios/quiz.js';
import { askNext, finish } from './quiz.js';
import { handleReminderAnswer } from './reminder.js';

export function registerMessageHandler(bot) {
  bot.on('message_created', async (ctx) => {
    const userId = ctx.user?.user_id;
    const text = ctx.message?.body?.text?.trim();

    if (!userId || !text) {
      return;
    }

    const state = storage.get(userId);

    if (!state) {
      await ctx.reply('Напишите /start, чтобы начать.');
      return;
    }

    if (state.awaitingReminder) {
      await handleReminderAnswer(ctx, userId, text);
      return;
    }

    if (text.toLowerCase() === 'готово') {
      await handleReminderAnswer(ctx, userId, text);
      return;
    }

    const q = getQuestion(state.step);

    if (!q) {
      await finish(bot, ctx, userId);
      return;
    }

    const answers = {
      ...state.answers,
      [q.id]: text,
    };

    const nextStep = state.step + 1;

    storage.update(userId, {
      answers,
      step: nextStep,
    });

    if (nextStep >= totalQuestions()) {
      await finish(bot, ctx, userId);
      return;
    }

    await askNext(bot, ctx, userId);
  });
}

```


## `src/bot/handlers/quiz.js`

```
import { storage } from '../../services/storage.js';
import { getQuestion, totalQuestions } from '../scenarios/quiz.js';
import { matchReasons, formatReasonCard } from '../../services/matcher.js';
import { config } from '../../config.js';
import { miniAppKeyboard } from '../keyboards.js';

export async function askNext(bot, ctx, userId) {
  const state = storage.get(userId);
  if (!state) return;

  const q = getQuestion(state.step);
  if (!q) {
    return finish(bot, ctx, userId);
  }

  let text = `Вопрос ${state.step + 1} из ${totalQuestions()}:\n\n${q.text}`;

  if (q.type === 'choice' && Array.isArray(q.options)) {
    text += '\n\nВарианты:\n' + q.options.map((option, index) => `${index + 1}. ${option}`).join('\n');
  }

  await ctx.reply(text);
}

export async function finish(bot, ctx, userId) {
  const state = storage.get(userId);
  if (!state) return;

  const results = matchReasons(state.answers);
  const topResult = results[0];

  if (!topResult?.reason) {
    throw new Error('Не удалось определить причину отказа');
  }

  const top = topResult.reason;

  await ctx.reply('Спасибо! Я проанализировал ваши ответы.');

  await ctx.reply(formatReasonCard(top), {
    format: 'markdown',
  });

  if (results.length > 1) {
    const others = results
      .slice(1, 3)
      .map((item) => `• ${item.reason.title}`)
      .join('\n');

    await ctx.reply(
      'Также возможные причины:\n' +
      others +
      '\n\n' +
      'Если хотите разобрать другую — /restart.'
    );
  }

  if (config.miniAppUrl) {
    await ctx.reply('Откройте чек-лист в мини-приложении:', {
      attachments: [miniAppKeyboard(config.miniAppUrl, top.id)],
    });
  }

  await ctx.reply(
    '📌 Что делать дальше:\n' +
    '1. Подготовьте документы из списка.\n' +
    '2. Подайте заявление повторно через «Госуслуги».\n' +
    '3. При повторном отказе — запросите письменное разъяснение в СФР.\n\n' +
    'Напомнить о подаче через 3 дня? Напишите «да» или «нет».'
  );

  storage.update(userId, {
    done: true,
    awaitingReminder: true,
    topReasonId: top.id,
    topReasonTitle: top.title,
  });
}

```


## `src/bot/index.js`

```
import { Bot } from '@maxhub/max-bot-api';
import { config, assertBotToken } from '../config.js';
import { registerCommands } from './commands.js';
import { registerMessageHandler } from './handlers/message.js';
import { startScheduler, stopScheduler } from '../services/scheduler.js';
import { startApiServer } from '../api/server.js';

assertBotToken();

const bot = new Bot(config.botToken);

registerCommands(bot);
registerMessageHandler(bot);

startScheduler({ expression: '* * * * *' });
const apiServer = startApiServer();

const shutdown = async (signal) => {
  console.log(`[bot] Получен ${signal}, останавливаюсь...`);

  try {
    stopScheduler();
    apiServer.close();
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

bot.start();
console.log('[bot] Запущен');

```


## `src/bot/keyboards.js`

```
import { Keyboard } from '@maxhub/max-bot-api';

export function miniAppKeyboard(url, payload) {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.openApp(
        'Открыть чек-лист',
        url,
        undefined,
        payload,
      ),
    ],
  ]);
}

```


## `src/bot/scenarios/quiz.js`

```
export const QUESTIONS = [
  {
    id: 'region',
    text: 'В каком регионе вы подавали заявление?',
    type: 'text',
  },
  {
    id: 'childrenCount',
    text: 'Сколько у вас детей?',
    type: 'choice',
    options: ['1', '2', '3', '4 и более'],
  },
  {
    id: 'maritalStatus',
    text: 'Вы замужем / единственный родитель?',
    type: 'choice',
    options: ['Замужем', 'Единственный родитель'],
  },
  {
    id: 'hasIrregularIncome',
    text:
      'Были ли у вас за последние 12 месяцев разовые поступления ' +
      '(единовременные выплаты, возврат налога, продажа имущества)?',
    type: 'choice',
    options: ['Да', 'Нет', 'Не знаю'],
  },
  {
    id: 'hasNoIncome',
    text:
      'Были ли у вас или супруга периоды без официального дохода?',
    type: 'choice',
    options: ['Да', 'Нет'],
  },
  {
    id: 'hasExtraProperty',
    text:
      'Есть ли у семьи вторая квартира, автомобиль или другой актив, ' +
      'который мог повлиять на проверку имущественной обеспеченности?',
    type: 'choice',
    options: ['Да', 'Нет', 'Не знаю'],
  },
  {
    id: 'previousRefusal',
    text:
      'Получали ли вы раньше отказ по этому пособию ' +
      'или по предыдущему заявлению?',
    type: 'choice',
    options: ['Да', 'Нет'],
  },
  {
    id: 'missingDocs',
    text:
      'Было ли в отказе указано, что не хватает документов ' +
      'или сведений?',
    type: 'choice',
    options: ['Да', 'Нет'],
  },
  {
    id: 'selfEmployed',
    text:
      'Вы или супруг зарегистрированы как самозанятый или ИП?',
    type: 'choice',
    options: ['Да', 'Нет'],
  },
  {
    id: 'childAgeIssue',
    text:
      'Мог ли отказ быть связан с возрастом ребёнка ' +
      '(например, ребёнку уже исполнилось 17 лет)?',
    type: 'choice',
    options: ['Да', 'Нет'],
  },
  {
    id: 'nonCitizen',
    text:
      'Есть ли у заявителя иностранное гражданство ' +
      'или временный статус пребывания в РФ?',
    type: 'choice',
    options: ['Да', 'Нет', 'Не знаю'],
  },
  {
    id: 'previousApplication',
    text:
      'Подавали ли вы уже другое заявление на этот же период ' +
      'или получаете ли сейчас ту же выплату?',
    type: 'choice',
    options: ['Да', 'Нет', 'Не знаю'],
  },
  {
    id: 'rightsTerminated',
    text:
      'Были ли обстоятельства, из-за которых право на выплату ' +
      'могло прекратиться (например, изменение статуса ребёнка ' +
      'или родительских прав)?',
    type: 'choice',
    options: ['Да', 'Нет', 'Не знаю'],
  },
  {
    id: 'refusalText',
    text:
      'Напишите 1–2 предложения из текста отказа. ' +
      'Чем ближе к оригинальной формулировке, тем точнее будет разбор.',
    type: 'text',
  },
];

export function getQuestion(index) {
  return QUESTIONS[index] ?? null;
}

export function totalQuestions() {
  return QUESTIONS.length;
}

```


## `src/config.js`

```
import 'dotenv/config';

function optionalNumber(name, fallback) {
  const raw = process.env[name];

  if (raw == null || raw === '') {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`[config] Переменная ${name} должна быть числом`);
  }

  return value;
}

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  miniAppUrl: process.env.MINIAPP_URL || '',
  port: optionalNumber('PORT', 3000),
  tz: process.env.TZ || 'Europe/Moscow',
  maxInitDataMaxAgeSeconds: optionalNumber(
    'MAX_INIT_DATA_MAX_AGE_SECONDS',
    3600
  ),
  allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dataDir: process.env.DATA_DIR || './runtime',
};

export function assertBotToken() {
  if (!config.botToken) {
    throw new Error(
      '[config] BOT_TOKEN не задан. Укажите BOT_TOKEN в .env или окружении.'
    );
  }

  return config.botToken;
}

```


## `src/services/matcher.js`

```
import { getReasons } from './reasons.js';

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\\s+/g, ' ');
}

function isPositiveAnswer(value) {
  if (value === true) {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return ['да', 'yes', 'true', '1'].includes(normalizeText(value));
}

function keywordSpecificity(keyword) {
  const normalized = normalizeText(keyword);
  return {
    chars: normalized.length,
    words: normalized ? normalized.split(' ').length : 0,
  };
}

function findBestKeywordMatch(text, keywords = []) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return null;
  }

  const matches = keywords
    .filter((keyword) => normalizedText.includes(normalizeText(keyword)))
    .map((keyword) => ({
      keyword,
      ...keywordSpecificity(keyword),
    }))
    .sort((a, b) => b.words - a.words || b.chars - a.chars);

  return matches[0] ?? null;
}

function buildResults(answers, reasons) {
  const refusalText = answers?.refusalText ?? '';

  return reasons.map((reason) => {
    let score = 0;
    const matchedSignals = [];

    for (const [signalKey, signalWeight] of Object.entries(reason.signals ?? {})) {
      const weight = Number(signalWeight);

      if (!Number.isFinite(weight) || weight <= 0) {
        continue;
      }

      if (signalKey === 'refusalTextMatch') {
        const match = findBestKeywordMatch(refusalText, reason.keywords);

        if (match) {
          score += weight;
          matchedSignals.push({
            key: signalKey,
            weight,
            keyword: match.keyword,
          });
        }

        continue;
      }

      if (isPositiveAnswer(answers?.[signalKey])) {
        score += weight;
        matchedSignals.push({
          key: signalKey,
          weight,
        });
      }
    }

    return {
      reason,
      score,
      matchedSignals,
    };
  });
}

function sortResults(results) {
  return [...results].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.matchedSignals.length !== a.matchedSignals.length) {
      return b.matchedSignals.length - a.matchedSignals.length;
    }

    if (Number(b.reason.weight) !== Number(a.reason.weight)) {
      return Number(b.reason.weight) - Number(a.reason.weight);
    }

    return a.reason.id.localeCompare(b.reason.id);
  });
}

export function matchReasons(answers = {}) {
  const reasons = getReasons();
  const results = sortResults(buildResults(answers, reasons));
  const matched = results.filter((item) => item.score > 0);

  if (matched.length > 0) {
    return matched;
  }

  const fallback = reasons.find((reason) => reason.id === 'other');

  if (!fallback) {
    return [];
  }

  return [
    {
      reason: fallback,
      score: 0,
      matchedSignals: [],
    },
  ];
}

export function formatReasonCard(reason) {
  const lines = [
    `*${reason.title}*`,
    '',
    reason.explanation,
    '',
    '*Что делать:*',
  ];

  for (const action of reason.actions ?? []) {
    lines.push(`• ${action}`);
  }

  lines.push(
    '',
    `*Куда обращаться:* ${reason.whereToApply ?? 'СФР, «Госуслуги»'}`,
    `*Основание:* ${reason.legalRef ?? 'Уточните в СФР'}`
  );

  if (Array.isArray(reason.documents) && reason.documents.length > 0) {
    lines.push('', '*Документы:*');

    for (const document of reason.documents) {
      lines.push(`• ${document}`);
    }
  }

  return lines.join('\\n');
}

export { isPositiveAnswer };

```


## `src/services/reminders.js`

```
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const filePath = path.resolve(config.dataDir, 'reminders.json');

function ensureFile() {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readAll() {
  ensureFile();

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[reminders] Не удалось прочитать reminders.json:', error.message);
    return {};
  }
}

function writeAll(data) {
  ensureFile();

  const tempPath = `${filePath}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

const reminders = readAll();

function genId(userId) {
  return `rem_${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`;
}

export const remindersStore = {
  schedule({
    userId,
    type,
    daysFromNow = 3,
    timezone = config.tz,
    payload = {},
  }) {
    const existing = Object.values(reminders).find(
      (reminder) =>
        reminder.userId === String(userId) &&
        reminder.type === type &&
        reminder.status === 'pending'
    );

    if (existing) {
      return existing;
    }

    const now = Date.now();

    const reminder = {
      id: genId(userId),
      userId: String(userId),
      type,
      dueAt: now + daysFromNow * DAY_MS,
      timezone,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      createdAt: now,
      sentAt: null,
    };

    reminders[reminder.id] = reminder;
    writeAll(reminders);

    return reminder;
  },

  getDue(now = Date.now()) {
    return Object.values(reminders).filter(
      (reminder) =>
        reminder.status === 'pending' &&
        reminder.dueAt <= now
    );
  },

  markSent(id) {
    const reminder = reminders[id];

    if (!reminder) {
      return null;
    }

    reminder.status = 'sent';
    reminder.sentAt = Date.now();

    writeAll(reminders);

    return reminder;
  },

  markFailed(id, error) {
    const reminder = reminders[id];

    if (!reminder) {
      return null;
    }

    reminder.attempts += 1;
    reminder.lastError = String(error?.message ?? error);

    if (reminder.attempts >= reminder.maxAttempts) {
      reminder.status = 'failed';
    } else {
      reminder.dueAt = Date.now() + 5 * 60 * 1000;
    }

    writeAll(reminders);

    return reminder;
  },

  cancel(id) {
    const reminder = reminders[id];

    if (!reminder) {
      return null;
    }

    reminder.status = 'cancelled';
    writeAll(reminders);

    return reminder;
  },

  cancelByUser(userId, type) {
    let count = 0;

    for (const reminder of Object.values(reminders)) {
      if (
        reminder.userId === String(userId) &&
        (!type || reminder.type === type) &&
        reminder.status === 'pending'
      ) {
        reminder.status = 'cancelled';
        count += 1;
      }
    }

    if (count > 0) {
      writeAll(reminders);
    }

    return count;
  },

  listByUser(userId) {
    return Object.values(reminders).filter(
      (reminder) => reminder.userId === String(userId)
    );
  },

  stats() {
    const all = Object.values(reminders);

    return {
      total: all.length,
      pending: all.filter((reminder) => reminder.status === 'pending').length,
      sent: all.filter((reminder) => reminder.status === 'sent').length,
      failed: all.filter((reminder) => reminder.status === 'failed').length,
      cancelled: all.filter((reminder) => reminder.status === 'cancelled').length,
    };
  },

  _reset() {
    for (const key of Object.keys(reminders)) {
      delete reminders[key];
    }

    writeAll(reminders);
  },
};

export function formatReminderText(reminder) {
  const { reasonTitle } = reminder.payload;

  const lines = [
    '⏰ Напоминание',
    '',
    'Вы планировали подать заявление повторно.',
  ];

  if (reasonTitle) {
    lines.push(`Причина, которую разбирали: *${reasonTitle}*.`);
  }

  lines.push(
    '',
    'Проверьте, что подготовили документы:',
    '• Справки от ведомства',
    '• Копию предыдущего заявления',
    '• Копию отказа',
    '',
    'Подать заявление: https://www.gosuslugi.ru/',
    '',
    'Если уже подали — напишите «готово».',
    'Если неактуально — «отмена».'
  );

  return lines.join('\n');
}

```


## `src/services/scheduler.js`

```
import cron from 'node-cron';
import { remindersStore, formatReminderText } from './reminders.js';
import { maxApi } from '../bot/api.js';

let task = null;
let running = false;

async function tick() {
  if (running) {
    return;
  }

  running = true;

  try {
    const due = remindersStore.getDue();

    for (const reminder of due) {
      try {
        await maxApi.sendMessage({
          userId: reminder.userId,
          text: formatReminderText(reminder),
          format: 'markdown',
        });

        remindersStore.markSent(reminder.id);

        console.log(
          `[scheduler] Отправлено ${reminder.id} → ${reminder.userId}`
        );
      } catch (error) {
        remindersStore.markFailed(reminder.id, error);

        console.error(
          `[scheduler] Ошибка ${reminder.id}:`,
          error.message
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startScheduler({ expression = '* * * * *' } = {}) {
  if (task) {
    return task;
  }

  if (!cron.validate(expression)) {
    throw new Error(`Некорректное cron-выражение: ${expression}`);
  }

  task = cron.schedule(expression, tick, {
    timezone: 'UTC',
  });

  console.log(`[scheduler] Запущен: ${expression}`);

  return task;
}

export function stopScheduler() {
  if (task) {
    task.stop();
    task = null;

    console.log('[scheduler] Остановлен');
  }
}

export const _tick = tick;

```


## `src/services/storage.js`

```
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const filePath = path.resolve(config.dataDir, 'users.json');

function ensureFile() {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readAll() {
  ensureFile();

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[storage] Не удалось прочитать users.json:', error.message);
    return {};
  }
}

function writeAll(data) {
  ensureFile();

  const tempPath = `${filePath}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

const users = readAll();

export const storage = {
  get(userId) {
    return users[String(userId)] ?? null;
  },

  set(userId, state) {
    users[String(userId)] = state;
    writeAll(users);
  },

  update(userId, patch) {
    const key = String(userId);
    const current = users[key] ?? {};
    const next = { ...current, ...patch };

    users[key] = next;
    writeAll(users);

    return next;
  },

  reset(userId) {
    delete users[String(userId)];
    writeAll(users);
  },

  _reset() {
    for (const key of Object.keys(users)) {
      delete users[key];
    }

    writeAll(users);
  },
};

```


## `src/services/timezone.js`

```
export function nextLocalMorning(fromMs, timezone, hour = 10) {
  const date = new Date(fromMs);

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value])
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  const asUTC = Date.UTC(
    year,
    month - 1,
    day,
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  const offsetMs = asUTC - fromMs;

  const targetAsUTC = Date.UTC(
    year,
    month - 1,
    day,
    Number(hour),
    0,
    0,
  );

  return targetAsUTC - offsetMs;
}

```


## `tests/matcher.test.js`

```
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { matchReasons } from '../src/services/matcher.js';
import { _resetCache } from '../src/services/reasons.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'cases.json'), 'utf8')
);

for (const testCase of cases) {
  test(`Кейс: ${testCase.name}`, () => {
    _resetCache();

    const results = matchReasons(testCase.answers);

    assert.ok(results.length > 0, 'должен быть хотя бы один результат');
    assert.equal(results[0].reason.id, testCase.expectedTop);
  });
}

test('Fallback: пустые ответы → other', () => {
  _resetCache();

  assert.equal(matchReasons({})[0].reason.id, 'other');
});

test('Ответ "Нет" не должен считаться положительным сигналом', () => {
  _resetCache();

  const results = matchReasons({
    hasExtraProperty: 'Нет',
    hasIrregularIncome: 'Нет',
    hasNoIncome: 'Нет',
    refusalText: 'иное',
  });

  assert.equal(results[0].reason.id, 'other');
});

test('Веса: причина с дополнительным подтверждающим сигналом выше', () => {
  _resetCache();

  const results = matchReasons({
    refusalText: 'неполные данные',
    previousRefusal: true,
    hasExtraProperty: true,
  });

  assert.equal(results[0].reason.id, 'smv_error');
});

test('Текст отказа "превышение дохода" не должен превращаться в property', () => {
  _resetCache();

  const results = matchReasons({
    refusalText: 'превышение дохода',
  });

  assert.equal(results[0].reason.id, 'income_calc');
});

```


## `tests/validation.test.js`

```
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { validateInitData } from '../src/api/validation.js';

const BOT_TOKEN = 'test-token-123';

function sign(params, token) {
  const launchParams = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();

  return crypto
    .createHmac('sha256', secretKey)
    .update(launchParams)
    .digest('hex');
}

function buildInitData({
  authDate = Math.floor(Date.now() / 1000),
  user = { id: 1, first_name: 'Иван' },
  startParam = 'smv_error',
} = {}) {
  const params = new URLSearchParams();

  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(authDate));
  params.set('start_param', startParam);
  params.set('hash', sign(params, BOT_TOKEN));

  return params.toString();
}

test('валидная подпись проходит', () => {
  const initData = buildInitData();

  const result = validateInitData(initData, BOT_TOKEN);

  assert.equal(result.valid, true);
  assert.equal(result.user.id, 1);
  assert.equal(result.startParam, 'smv_error');
});

test('подделанная подпись отклоняется', () => {
  const initData = buildInitData();

  const params = new URLSearchParams(initData);
  params.set('hash', 'deadbeef');

  const result = validateInitData(
    params.toString(),
    BOT_TOKEN
  );

  assert.equal(result.valid, false);
  assert.equal(result.error, 'bad_signature');
});

test('просроченные данные отклоняются', () => {
  const oldAuthDate = Math.floor(Date.now() / 1000) - 7200;
  const initData = buildInitData({ authDate: oldAuthDate });

  const result = validateInitData(
    initData,
    BOT_TOKEN,
    { maxAgeSeconds: 3600 }
  );

  assert.equal(result.valid, false);
  assert.equal(result.error, 'expired_init_data');
});

test('пустая строка отклоняется', () => {
  assert.equal(
    validateInitData('', BOT_TOKEN).valid,
    false
  );

  assert.equal(
    validateInitData(null, BOT_TOKEN).valid,
    false
  );
});

```
