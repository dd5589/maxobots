import { storage } from '../../services/storage.js';
import {
  findCategoryById,
  findScenarioById,
} from '../../services/scenarios.js';
import {
  getScenario,
  getQuestionForScenario,
  getOption,
  getNextTransition,
  getQuestionById,
  totalQuestions,
} from '../scenarios/engine.js';
import { askNext, finish } from './quiz.js';
import { categoryKeyboard, scenarioKeyboard } from '../keyboards.js';

function getUserId(ctx) {
  return ctx.user?.user_id ?? null;
}

async function answerCallback(ctx) {
  try {
    await ctx.answerOnCallback?.({});
  } catch {
    // A stale callback should not break the scenario flow.
  }
}

export function registerScenarioHandlers(bot) {
  bot.action('categories', async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    await answerCallback(ctx);

    storage.update(userId, {
      mode: 'category',
      step: 0,
      answers: {},
      done: false,
      awaitingReminder: false,
      categoryId: undefined,
      scenarioId: undefined,
      questionId: undefined,
      resultId: undefined,
    });

    await ctx.reply('Выберите категорию:', {
      attachments: [categoryKeyboard()],
    });
  });

  bot.action(/^category:([^:]+)$/, async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    const categoryId = ctx.match?.[1];
    const category = findCategoryById(categoryId);
    if (!category) {
      await answerCallback(ctx);
      await ctx.reply('Категория не найдена. Откройте /start ещё раз.');
      return;
    }

    await answerCallback(ctx);

    storage.update(userId, {
      mode: 'scenario',
      categoryId,
      step: 0,
      answers: {},
      done: false,
      awaitingReminder: false,
      scenarioId: undefined,
      questionId: undefined,
      resultId: undefined,
    });

    await ctx.reply(`Категория: ${category.title}\n\nВыберите сценарий:`, {
      attachments: [scenarioKeyboard(categoryId)],
    });
  });

  bot.action(/^scenario:([^:]+)$/, async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    const scenarioId = ctx.match?.[1];
    const scenario = findScenarioById(scenarioId);
    if (!scenario) {
      await answerCallback(ctx);
      await ctx.reply('Сценарий не найден. Откройте /start ещё раз.');
      return;
    }

    await answerCallback(ctx);

    storage.update(userId, {
      mode: 'quiz',
      categoryId: scenario.categoryId,
      scenarioId,
      step: 0,
      answers: {},
      done: false,
      awaitingReminder: false,
      scenarioResult: undefined,
      questionId: scenario.engine === 'guided' ? (getQuestionForScenario(scenarioId, 0)?.id ?? null) : undefined,
      resultId: undefined,
    });

    await ctx.reply(
      `Сценарий:\n${scenario.title}\n\n${scenario.description}`
    );

    await askNext(bot, ctx, userId);
  });

  bot.action(/^answer:([^:]+):([^:]+):(\d+)$/, async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    const scenarioId = ctx.match?.[1];
    const questionId = ctx.match?.[2];
    const optionIndex = Number(ctx.match?.[3]);

    const state = storage.get(userId);
    const scenario = findScenarioById(scenarioId);
    const question = state
      ? (getQuestionById(state.scenarioId, state.questionId) ?? getQuestionForScenario(state.scenarioId, state.step))
      : null;
    const option = question?.options?.[optionIndex];
    const normalizedOption = question && option != null ? getOption(option, optionIndex) : null;

    if (
      !state ||
      state.mode !== 'quiz' ||
      state.scenarioId !== scenarioId ||
      !question ||
      question.id !== questionId ||
      question.type !== 'choice' ||
      !Number.isInteger(optionIndex) ||
      optionIndex < 0 ||
      optionIndex >= question.options.length
    ) {
      await answerCallback(ctx);
      await ctx.reply('Эта кнопка уже неактуальна. Нажмите /restart и начните сценарий заново.');
      return;
    }

    await answerCallback(ctx);

    const value = normalizedOption?.value ?? String(question.options[optionIndex]);
    const answers = {
      ...(state.answers ?? {}),
      [question.id]: value,
    };
    const nextStep = state.step + 1;

    if (scenario.engine === 'guided' && state.scenarioId && state.mode === 'quiz' && state.questionId) {
      const transition = getNextTransition(state.scenarioId, question.id, value);

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
