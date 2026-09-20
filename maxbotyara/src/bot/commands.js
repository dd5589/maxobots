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
