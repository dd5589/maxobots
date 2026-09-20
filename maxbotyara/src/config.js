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
  sessionTtlSeconds: optionalNumber('SESSION_TTL_SECONDS', 7200),
  maxAnswerLength: optionalNumber('MAX_ANSWER_LENGTH', 2000),
};

export function assertBotToken() {
  if (!config.botToken) {
    throw new Error(
      '[config] BOT_TOKEN не задан. Укажите BOT_TOKEN в .env или окружении.'
    );
  }

  return config.botToken;
}
