import { setTimeout as sleep } from 'node:timers/promises';
import { Bot } from '@maxhub/max-bot-api';
import { config, assertRuntimeConfig } from '../config.js';
import { registerCommands } from './commands.js';
import { registerMessageHandler } from './handlers/message.js';
import { registerScenarioHandlers } from './handlers/scenarios.js';

export const MAX_WEBHOOK_ALLOWED_UPDATES = [
  'bot_started',
  'message_created',
  'message_callback',
];

export function createBot({ token = config.botToken, clientOptions } = {}) {
  const bot = new Bot(token, clientOptions ? { clientOptions } : undefined);

  registerCommands(bot);
  registerMessageHandler(bot);
  registerScenarioHandlers(bot);

  return bot;
}

export async function startBot(bot) {
  assertRuntimeConfig();

  if (config.botTransport === 'webhook') {
    let lastError;

    for (let attempt = 1; attempt <= config.maxWebhookStartRetries; attempt += 1) {
      try {
        await bot.start({
          mode: 'webhook',
          options: {
            domain: config.maxWebhookDomain,
            path: config.maxWebhookPath,
            secret: config.maxWebhookSecret,
            port: config.maxWebhookPort,
            allowedUpdates: config.maxWebhookUpdateTypes ?? MAX_WEBHOOK_ALLOWED_UPDATES,
          },
        });

        console.log(
          `[bot] Webhook mode: ${config.maxWebhookDomain}${config.maxWebhookPath}`
        );
        return;
      } catch (error) {
        lastError = error;
        console.error(`[bot] Webhook startup attempt ${attempt}/${config.maxWebhookStartRetries} failed:`, error);
        if (attempt < config.maxWebhookStartRetries) {
          await sleep(config.maxWebhookRetryDelayMs);
        }
      }
    }

    throw lastError;
  }

  await bot.start({
    mode: 'polling',
    options: {
      allowedUpdates: MAX_WEBHOOK_ALLOWED_UPDATES,
      retry: true,
    },
  });

  console.log('[bot] Polling mode (development only)');
}

export async function stopBot(bot) {
  if (config.botTransport === 'webhook') {
    await bot.stopWebhook();
    return;
  }

  bot.stopPolling();
}
