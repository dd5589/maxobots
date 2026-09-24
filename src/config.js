import 'dotenv/config';

function optionalNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`[config] ${name} должен быть числом`);
  return value;
}

function optionalList(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const defaultTransport = nodeEnv === 'production' ? 'webhook' : 'polling';

export const config = {
  nodeEnv,
  botToken: process.env.BOT_TOKEN || '',
  botTransport: process.env.BOT_TRANSPORT || defaultTransport,
  tz: process.env.TZ || 'Europe/Moscow',
  dataDir: process.env.DATA_DIR || './runtime',
  sessionTtlSeconds: optionalNumber('SESSION_TTL_SECONDS', 7200),
  maxAnswerLength: optionalNumber('MAX_ANSWER_LENGTH', 2000),
  maxWebhookDomain: process.env.MAX_WEBHOOK_DOMAIN || process.env.RENDER_EXTERNAL_URL || '',
  maxWebhookPath: process.env.MAX_WEBHOOK_PATH || '/webhook',
  maxWebhookSecret: process.env.MAX_WEBHOOK_SECRET || '',
  maxWebhookPort: optionalNumber('MAX_WEBHOOK_PORT', optionalNumber('PORT', 10000)),
  maxWebhookStartRetries: optionalNumber('MAX_WEBHOOK_START_RETRIES', 12),
  maxWebhookRetryDelayMs: optionalNumber('MAX_WEBHOOK_RETRY_DELAY_MS', 5000),
  maxWebhookUpdateTypes: optionalList('MAX_WEBHOOK_UPDATE_TYPES', [
    'bot_started',
    'message_created',
    'message_callback',
  ]),
};

function assertHttpsUrl(name, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('нужен HTTPS');
    return url;
  } catch {
    throw new Error(`[config] ${name} должен быть корректным HTTPS URL`);
  }
}

export function assertBotToken() {
  if (!config.botToken) {
    throw new Error('[config] BOT_TOKEN не задан. Укажите BOT_TOKEN в окружении.');
  }
  return config.botToken;
}

export function assertRuntimeConfig() {
  assertBotToken();

  if (!['polling', 'webhook'].includes(config.botTransport)) {
    throw new Error('[config] BOT_TRANSPORT должен быть polling или webhook');
  }

  if (!Number.isInteger(config.maxWebhookStartRetries) || config.maxWebhookStartRetries < 1) {
    throw new Error('[config] MAX_WEBHOOK_START_RETRIES должен быть целым числом >= 1');
  }

  if (!Number.isFinite(config.maxWebhookRetryDelayMs) || config.maxWebhookRetryDelayMs < 0) {
    throw new Error('[config] MAX_WEBHOOK_RETRY_DELAY_MS должен быть числом >= 0');
  }

  if (config.botTransport === 'webhook') {
    if (!config.maxWebhookDomain) {
      throw new Error('[config] Для Webhook нужен MAX_WEBHOOK_DOMAIN или RENDER_EXTERNAL_URL');
    }
    const webhookDomain = assertHttpsUrl('MAX_WEBHOOK_DOMAIN', config.maxWebhookDomain);
    if (webhookDomain.pathname !== '/' || webhookDomain.search || webhookDomain.hash) {
      throw new Error('[config] MAX_WEBHOOK_DOMAIN должен быть origin без path/query/fragment');
    }

    if (!config.maxWebhookPath.startsWith('/') || config.maxWebhookPath.includes('?') || config.maxWebhookPath.includes('#')) {
      throw new Error('[config] MAX_WEBHOOK_PATH должен быть путём вида /webhook без query/fragment');
    }

    if (!/^[A-Za-z0-9_-]{5,256}$/.test(config.maxWebhookSecret)) {
      throw new Error('[config] MAX_WEBHOOK_SECRET должен содержать 5–256 символов A-Z/a-z/0-9/_/-');
    }
  }

  if (config.nodeEnv === 'production' && config.botTransport !== 'webhook') {
    throw new Error('[config] В production разрешён только BOT_TRANSPORT=webhook');
  }
}
