# Release checklist

## Repository

- [ ] `npm ci` без ошибок
- [ ] `npm test` зелёный
- [ ] `npm run test:scenarios` зелёный
- [ ] `npm run lint` зелёный
- [ ] `npm run check:repo` зелёный
- [ ] `npm run release:audit` зелёный
- [ ] `docker compose config` зелёный
- [ ] `docker build` зелёный
- [ ] нет `DATA-API.yaml`, потому что собственного API нет
- [ ] нет `openapi.yaml`, потому что собственного API нет
- [ ] нет Mini App в релизе

## MAX

- [ ] токен выданного бота добавлен только как secret
- [ ] Webhook подписан на публичный HTTPS URL
- [ ] Webhook secret сохранён только в deployment secrets
- [ ] `/start` отвечает
- [ ] категория → сценарий работает
- [ ] 4 сценария проходят от старта до результата
- [ ] длинные подписи кнопок не обрезаются в типовом MAX UI
- [ ] повторное нажатие устаревшей кнопки обрабатывается корректно
- [ ] `/restart` восстанавливает сценарий
- [ ] Web + Mobile MAX проверены

## Submission

- [ ] зафиксирован commit hash
- [ ] создан архив именно этого commit
- [ ] SHA-256 архива записан
- [ ] в README указано, что собственного API нет
- [ ] ссылка/способ доступа к работающему MAX-боту указаны в презентации
