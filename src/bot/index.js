import { assertRuntimeConfig, config } from '../config.js';
import { createBot, startBot, stopBot } from './runtime.js';

async function main() {
  assertRuntimeConfig();

  const bot = createBot();

  const shutdown = async (signal) => {
    console.log(`[bot] Получен ${signal}, останавливаюсь...`);
    try {
      await stopBot(bot);
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await startBot(bot);
  console.log(`[bot] Запущен, transport=${config.botTransport}`);
}

main().catch((error) => {
  console.error('[bot] Критическая ошибка запуска:', error);
  process.exit(1);
});
