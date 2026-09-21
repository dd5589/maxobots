import { Bot } from '@maxhub/max-bot-api';
import { config, assertBotToken } from '../config.js';
import { registerCommands } from './commands.js';
import { registerMessageHandler } from './handlers/message.js';
import { registerScenarioHandlers } from './handlers/scenarios.js';
import { startScheduler, stopScheduler } from '../services/scheduler.js';
import { startApiServer } from '../api/server.js';

assertBotToken();

const bot = new Bot(config.botToken);

registerCommands(bot);
registerMessageHandler(bot);
registerScenarioHandlers(bot);

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
