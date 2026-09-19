import { storage } from '../../services/storage.js';
import { getQuestion, totalQuestions } from '../scenarios/quiz.js';
import { askNext, finish } from './quiz.js';
import { handleReminderAnswer } from './reminder.js';

export function registerMessageHandler(bot) {
  bot.on('message_created', async (ctx) => {
    const userId = ctx.user?.user_id;
    const text = ctx.message?.body?.text?.trim();

    if (!userId || !text) {
      return;
    }

    const state = storage.get(userId);

    if (!state) {
      await ctx.reply('Напишите /start, чтобы начать.');
      return;
    }

    if (state.awaitingReminder) {
      await handleReminderAnswer(ctx, userId, text);
      return;
    }

    if (text.toLowerCase() === 'готово') {
      await handleReminderAnswer(ctx, userId, text);
      return;
    }

    const q = getQuestion(state.step);

    if (!q) {
      await finish(bot, ctx, userId);
      return;
    }

    const answers = {
      ...state.answers,
      [q.id]: text,
    };

    const nextStep = state.step + 1;

    storage.update(userId, {
      answers,
      step: nextStep,
    });

    if (nextStep >= totalQuestions()) {
      await finish(bot, ctx, userId);
      return;
    }

    await askNext(bot, ctx, userId);
  });
}
