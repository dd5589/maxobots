# Pre-release → Release 1.1.0

Release 1.1.0 is a chatbot-only version for the hackathon.

## Architecture decision

The final submission intentionally does not expose a product API and does not include a Mini App. The competition rules allow a standalone chatbot, and `DATA-API.yaml` is required only when a solution provides its own HTTP(S) methods.

The only inbound HTTP endpoint is the MAX platform Webhook callback. It is a transport endpoint required by MAX, not a product API.

## Deployment

The recommended operational model is a managed web service with HTTPS, such as a Render Web Service configured by `render.yaml`. The team does not need to administer a VPS or expose its own product API.

The application itself listens only for MAX Webhook traffic. No REST API is exposed.

## Release checks

Run:

```bash
npm ci
npm test
npm run test:scenarios
npm run lint
npm run check:repo
npm run release:audit
docker compose config
docker build -t maxobots:release .
```

Then deploy the exact Git commit and verify the live MAX Webhook with:

```bash
npm run max:live-check
```

## Important MAX UI note

MAX documents that button text is cropped when it does not fit the available width. The release therefore uses short, complete labels and one button per row. The complete meaning remains in the question text. This is tested automatically in `tests/keyboards.test.js`.
