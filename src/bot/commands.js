import { storage } from '../services/storage.js';
import { categoryKeyboard } from './keyboards.js';
import { askCategories } from './handlers/quiz.js';

function getUserId(ctx) {
  return ctx.user?.user_id ?? null;
}

function resetSession(userId) {
  storage.reset(userId);
  storage.set(userId, {
    mode: 'category',
    step: 0,
    answers: {},
    done: false,
  });
}

export function registerCommands(bot) {
  bot.command('start', async (ctx) => {
    const userId = getUserId(ctx);

    if (!userId) {
      return ctx.reply('Не удалось определить пользователя MAX. Попробуйте ещё раз.');
    }

    resetSession(userId);

    await ctx.reply(
      'Здравствуйте! Я помогу пройти один из 4 сценариев по социальной поддержке.\n\n' +
      'Сначала выберите категорию, затем конкретный сценарий. ' +
      'Вопросы с вариантами ответа теперь выбираются кнопками.'
    );

    await askCategories(ctx);
  });

  bot.command('restart', async (ctx) => {
    const userId = getUserId(ctx);

    if (!userId) {
      return ctx.reply('Не удалось определить пользователя MAX. Попробуйте ещё раз.');
    }

    resetSession(userId);
    await ctx.reply('Начинаем заново.');
    await askCategories(ctx);
  });

  bot.command('help', (ctx) => {
    return ctx.reply(
      'Я помогаю пройти сценарии по социальной поддержке.\n' +
      'Команды: /start — выбрать категорию и сценарий, ' +
      '/restart — начать заново, /help — помощь.'
    );
  });

  bot.api?.setMyCommands?.([
    { name: 'start', description: 'Выбрать категорию и сценарий' },
    { name: 'restart', description: 'Начать заново' },
    { name: 'help', description: 'Помощь' },
  ]).catch((error) => {
    console.warn('[commands] setMyCommands:', error.message);
  });
}
