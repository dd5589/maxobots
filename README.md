# Забота о людях — MAX-бот социальной поддержки

Финальная release-сборка для трека «Забота о людях».

Решение реализовано **только как чат-бот в MAX**, без собственного API и без обязательного Mini App. Это разрешённый формат хакатона: чат-бот может быть самостоятельным решением.

## Что делает бот

Бот помогает пользователю пройти один из 4 сценариев:

1. Родитель — разбор отказа в едином пособии на ребёнка.
2. Студент — разбор отказа в государственной социальной стипендии.
3. Пенсионер — разбор отказа в социальной доплате к пенсии.
4. СВО / ветеран / семья — разбор отказа в мере поддержки.

В результате пользователь получает возможную причину, что проверить, какие документы подготовить и куда обратиться. Ответ является информационной подсказкой и не заменяет официальное решение ведомства.

## Почему нет DATA-API.yaml и OpenAPI

В этой версии **нет собственного API продукта**. Бот взаимодействует с MAX Bot API и получает события через platform Webhook. Собственные HTTP(S)-методы приложения не предоставляются.

Поэтому `DATA-API.yaml` и `openapi.yaml` в релизе не нужны.

## Архитектура

```text
Пользователь
    │
    ▼
   MAX
    │
    │ HTTPS Webhook
    ▼
Node.js bot runtime
    │
    ├── 4 сценария
    ├── scenario engine
    ├── matcher для единого пособия
    ├── временное состояние диалога
    └── MAX Bot API
```

Публичного API для Mini App или внешних клиентов нет.

## Основной пользовательский путь

```text
/start
  ↓
Категория
  ↓
Сценарий
  ↓
Вопросы
  ↓
Ответы кнопками / текстом
  ↓
Результат
  ↓
Действия + документы + куда обратиться
```

Основной сценарий полностью проходит внутри MAX.

## Кнопки MAX

MAX обрезает слишком длинный текст кнопки, когда он не помещается в доступную ширину. Поэтому release использует короткие подписи, которые помещаются целиком, и располагает варианты по одному на строку.

Полный контекст ответа содержится непосредственно в тексте вопроса. Это не ограничение проекта, а особенность отображения клавиатуры MAX.

На каждый callback сохраняется исходный индекс варианта, поэтому сокращение подписи не меняет логику сценария.

## Требования

- Node.js 20.19+;
- npm;
- Docker + Docker Compose для воспроизводимого локального запуска;
- реальный токен выданного MAX-бота.

Для online-проверки нужен любой внешний managed web-hosting с публичным HTTPS endpoint. Управлять собственным сервером и собственным API не требуется. Например, можно использовать Render Web Service: сервис получает `onrender.com` URL и управляемый TLS. Для периода проверки выбирайте постоянно работающий план; бесплатный экземпляр Render может автоматически выключаться после простоя и терять локальные файлы. ([Render Web Services](https://render.com/docs/web-services))

## Локальный запуск через Docker

Создайте `.env`:

```bash
cp .env.example .env
```

Для локальной разработки:

```text
NODE_ENV=development
BOT_TRANSPORT=polling
BOT_TOKEN=<ваш MAX token>
```

Единая команда из ТЗ:

```bash
docker compose up --build
```

Остановка:

```bash
docker compose down
```

Повторный запуск:

```bash
docker compose up --build
```

## Production через managed hosting

Поскольку бот должен оставаться доступным весь период проверки, полностью без runtime-хостинга обойтись нельзя. При этом отдельный собственный API, собственный VPS и собственный домен не нужны: достаточно managed web service с публичным HTTPS URL.


Production использует только Webhook. Long Polling оставлен для локальной разработки.

### Вариант Render

В корне есть `render.yaml`. Render может собрать этот Dockerfile напрямую и автоматически выдаёт публичный HTTPS `onrender.com` URL. Переменная `RENDER_EXTERNAL_URL` автоматически доступна приложению и используется как `MAX_WEBHOOK_DOMAIN`. ([Render default environment variables](https://render.com/docs/environment-variables))

Создайте Web Service из GitHub repository. Blueprint задаёт:

- Docker runtime;
- region Frankfurt;
- `BOT_TRANSPORT=webhook`;
- `BOT_TOKEN` как secret;
- случайный `MAX_WEBHOOK_SECRET`;
- порт `10000`.

После deploy в логах должно появиться:

```text
[bot] Webhook mode: https://<service>.onrender.com/webhook
[bot] Запущен, transport=webhook
```

MAX требует Webhook по HTTPS/443; внешний URL Render соответствует этому требованию, а само приложение внутри сервиса слушает внутренний порт `10000`. MAX передаёт секрет в `X-Max-Bot-Api-Secret`. ([MAX Webhook requirements](https://dev.max.ru/docs-api/methods/POST/subscriptions))

### После первого deploy

Получите username бота через:

```bash
curl -X GET "https://platform-api2.max.ru/me" \
  -H "Authorization: <BOT_TOKEN>"
```

Найдите выданного бота в MAX и проверьте `/start`.

## Live-проверка MAX

На компьютере с доступом к интернету:

```bash
export BOT_TOKEN='<MAX token>'
export PUBLIC_BASE_URL='https://<service>.onrender.com'
export MAX_WEBHOOK_SECRET='<secret из deployment>'
export MAX_WEBHOOK_PATH='/webhook'

npm ci
npm run max:live-check
```

Live-check проверяет:

1. `GET /me` в реальном MAX Bot API;
2. наличие активной Webhook-подписки на нужный URL;
3. неправильный secret → `404`;
4. правильный secret → `200`.

Синтетическое событие не отправляется реальному пользователю.

## Автотесты

### Все тесты

```bash
npm ci
npm test
```

`npm test` запускает все unit и integration test-файлы, без shell-glob, который ранее ломал GitHub Actions.

### Только сценарии

```bash
npm run test:scenarios
```

### Только интеграционные проверки

```bash
npm run test:integration
```

Набор включает:

- все 4 сценария;
- достижимость всех конечных результатов трёх guided-сценариев;
- все причины parent-сценария;
- безопасность и формат кнопок;
- реальный Webhook HTTP server из `@maxhub/max-bot-api` с синтетическими MAX API responses;
- проверку secret → `404/200`;
- callback payload mapping;
- восстановление пользовательского состояния.

## Зависимости

Backend использует только:

- `@maxhub/max-bot-api`;
- `dotenv`;

версии зафиксированы в `package-lock.json`.

## Данные

Сценарии и причины находятся в:

```text
data/scenarios.json
data/reasons.json
```

Используются заранее подготовленные данные. Реальные государственные информационные системы в MVP не имитируются.

В проекте не используются реальные персональные или медицинские данные.

Состояние текущей сессии хранится во временном runtime-файле и автоматически очищается по TTL. Ответы удаляются после завершения сценария. Данные не нужны для демонстрации и не являются долговременным хранилищем пользователя.

## Официальные источники

Источники для содержимого сценариев собраны в `docs/SOURCES.md`.

В материалах проекта прямо разделяются:

- официальные нормы и источники;
- логика сопоставления ответа;
- информационная подсказка;
- модельные/подготовленные данные.

## Ограничения MVP

- Бот не принимает официальное решение ведомства.
- Бот не имеет прямой интеграции с ЕГИССО, СФР, МВД или Госуслугами.
- Результат нужно сверять с официальным решением и текущими правилами соответствующей организации.
- Сценарии основаны на подготовленных правилах и не заменяют юридическую консультацию.
- Локальное состояние сессии является временным и может быть потеряно при перезапуске процесса.

## Проверка соответствия формату сдачи

В релизе есть:

- работающий чат-бот в MAX;
- зафиксированная версия Git;
- подробный README;
- `package-lock.json`;
- `Dockerfile`;
- `docker-compose.yml`;
- `.dockerignore`;
- `.env.example` без секретов;
- четыре рабочих сценария;
- unit + integration tests;
- release audit;
- Render Blueprint для managed deployment.

`DATA-API.yaml` не включён, потому что собственный API продукта отсутствует.

## Финальный freeze

Перед отправкой в личный кабинет:

```bash
npm ci
npm test
npm run test:scenarios
npm run lint
npm run check:repo
npm run release:audit
docker compose config

git status
git diff --check
git rev-parse HEAD
git tag --points-at HEAD
```

После этого commit/hash и SHA-256 архива фиксируются в сдаче.

## Команды

```bash
npm start
npm run test
npm run test:scenarios
npm run test:integration
npm run lint
npm run check:repo
npm run release:audit
npm run max:live-check
```

## Официальные правила MAX

Актуальная документация MAX рекомендует Webhook для production и указывает HTTPS/443 как требование для Webhook endpoint. ([MAX events](https://dev.max.ru/docs-api/use-cases/event-notifications))
