# Managed deployment без собственного API

Проект не предоставляет собственного API. Для production всё равно нужен постоянно работающий runtime бота, потому что MAX должен доставлять события на Webhook, а бот должен оставаться доступным на протяжении периода проверки.

Команда не обязана администрировать собственный VPS или публиковать REST API. В репозитории есть `render.yaml` для managed Web Service. Render выдаёт публичный `onrender.com` URL и TLS; приложение использует автоматически доступный `RENDER_EXTERNAL_URL` как адрес MAX Webhook.

## 1. Создать сервис

Подключите GitHub repository к Render как Web Service. Blueprint `render.yaml` указывает Docker runtime и production Webhook.

Рекомендуемый plan в Blueprint — `starter`, потому что бесплатные web services Render могут простаивать и терять локальную файловую систему; для непрерывной проверки нужен постоянно работающий экземпляр. ([Render free services](https://render.com/docs/free))

## 2. Секреты

На первом создании сервиса Render попросит заполнить `BOT_TOKEN` и `MAX_WEBHOOK_SECRET`.

Сгенерируйте secret, совместимый с MAX, например:

```bash
openssl rand -hex 32
```

Он содержит только `0-9a-f` и подходит под ограничения MAX. Не помещайте эти значения в Git. ([MAX Webhook](https://dev.max.ru/docs-api/methods/POST/subscriptions))

## 3. После deploy

В логе должен появиться адрес вида:

```text
[bot] Webhook mode: https://<service>.onrender.com/webhook
[bot] Запущен, transport=webhook
```

## 4. Проверка

```bash
export BOT_TOKEN='<MAX token>'
export PUBLIC_BASE_URL='https://<service>.onrender.com'
export MAX_WEBHOOK_SECRET='<тот же secret>'

npm ci
npm run max:live-check
```

Проверка обращается к реальному `platform-api2.max.ru`, проверяет `/me`, активную подписку и HTTP-валидацию secret на Webhook.

## 5. Бот в MAX

Получите username через:

```bash
curl -X GET 'https://platform-api2.max.ru/me' \
  -H 'Authorization: <MAX token>'
```

Откройте найденного бота в MAX Web и MAX Mobile и пройдите `/start` → категорию → сценарий → вопросы → результат.

MAX официально требует для production Webhook по HTTPS/443 и рекомендует Webhook вместо Long Polling. ([MAX events](https://dev.max.ru/docs-api/use-cases/event-notifications))
