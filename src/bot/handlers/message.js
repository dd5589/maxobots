import { storage } from '../../services/storage.js';
import { config } from '../../config.js';
import {
  getQuestionForScenario,
  getNextTransition,
  getScenario,
  getQuestionById,
  totalQuestions,
} from '../scenarios/engine.js';
import { askNext, finish, askCategories, askScenarios } from './quiz.js';

export function registerMessageHandler(bot) {
  bot.on('message_created', async (ctx) => {
    const userId = ctx.user?.user_id;
    const text = ctx.message?.body?.text?.trim();

    if (!userId || !text) {
      return;
    }

    const state = storage.get(userId);

    if (!state) {
      await ctx.reply('Нажмите /start, чтобы выбрать категорию и сценарий.');
      return;
    }

    if (state.mode === 'category') {
      await askCategories(ctx);
      return;
    }

    if (state.mode === 'scenario') {
      await askScenarios(ctx, state.categoryId);
      return;
    }

    if (state.mode !== 'quiz' || !state.scenarioId) {
      await ctx.reply('Выберите категорию и сценарий с помощью кнопок: /start');
      return;
    }

    const scenario = getScenario(state.scenarioId);
    const q = scenario?.engine === 'guided' && state.questionId
      ? getQuestionById(state.scenarioId, state.questionId)
      : getQuestionForScenario(state.scenarioId, state.step);

    if (!q) {
      await finish(bot, ctx, userId);
      return;
    }

    if (q.type === 'choice') {
      await ctx.reply('Пожалуйста, выберите вариант кнопкой под вопросом.');
      return;
    }

    const safeText = text.slice(0, config.maxAnswerLength);
    const answers = {
      ...(state.answers ?? {}),
      [q.id]: safeText,
    };

    const nextStep = state.step + 1;

    if (scenario?.engine === 'guided' && state.questionId === q.id) {
      const transition = getNextTransition(state.scenarioId, q.id, safeText);

      if (transition?.type === 'result') {
        storage.update(userId, {
          answers,
          step: nextStep,
          questionId: undefined,
          resultId: transition.resultId,
        });
        await finish(bot, ctx, userId);
        return;
      }

      if (transition?.type === 'question') {
        storage.update(userId, {
          answers,
          step: nextStep,
          questionId: transition.questionId,
          resultId: undefined,
        });
        await askNext(bot, ctx, userId);
        return;
      }
    }

    storage.update(userId, {
      answers,
      step: nextStep,
      questionId: undefined,
    });

    if (nextStep >= totalQuestions(state.scenarioId)) {
      await finish(bot, ctx, userId);
      return;
    }

    await askNext(bot, ctx, userId);
  });
}
