import {
  getQuestionForScenario,
  getScenarioQuestions,
  getScenario,
  getScenarioResult,
  getInitialQuestion,
  getQuestionById,
  totalQuestions as scenarioQuestionCount,
} from '../scenarios/engine.js';
import { storage } from '../../services/storage.js';
import { matchReasons, formatReasonCard } from '../../services/matcher.js';
import { choiceKeyboard, categoryKeyboard, scenarioKeyboard } from '../keyboards.js';

export function getQuestion(state) {
  if (!state?.scenarioId) return null;

  const scenario = getScenario(state.scenarioId);
  if (scenario?.engine === 'guided') {
    return state.questionId
      ? getQuestionById(state.scenarioId, state.questionId)
      : getInitialQuestion(state.scenarioId);
  }

  return getQuestionForScenario(state.scenarioId, state.step);
}

export function totalQuestions(scenarioId) {
  return scenarioQuestionCount(scenarioId);
}

export async function askCategories(ctx) {
  await ctx.reply(
    'Выберите категорию:',
    { attachments: [categoryKeyboard()] }
  );
}

export async function askScenarios(ctx, categoryId) {
  await ctx.reply(
    'Выберите сценарий:',
    { attachments: [scenarioKeyboard(categoryId)] }
  );
}

export async function askNext(bot, ctx, userId) {
  const state = storage.get(userId);
  if (!state) return;

  const q = getQuestion(state);
  if (!q) {
    return finish(bot, ctx, userId);
  }

  let text = `Вопрос ${state.step + 1} из ${totalQuestions(state.scenarioId)}:\n\n${q.text}`;

  if (q.type === 'text') {
    text += '\n\nНапишите ответ одним сообщением.';
    await ctx.reply(text);
    return;
  }

  // Choice questions are button-only: no numeric menu is printed and users do not
  // need to type 1/2/3 in the chat.
  await ctx.reply(text, {
    attachments: [choiceKeyboard(state.scenarioId, q)],
  });
}

export async function finish(bot, ctx, userId) {
  const state = storage.get(userId);
  if (!state) return;

  const scenario = getScenario(state.scenarioId);
  if (!scenario) {
    throw new Error('Не удалось определить сценарий');
  }

  if (scenario.engine === 'reason_matcher') {
    const results = matchReasons(state.answers);
    const topResult = results[0];

    if (!topResult?.reason) {
      throw new Error('Не удалось определить причину отказа');
    }

    const top = topResult.reason;

    storage.update(userId, {
      done: true,
      awaitingReminder: false,
      topReasonId: top.id,
      lastScenarioId: scenario.id,
    });
    storage.clearAnswers(userId);

    await ctx.reply('Спасибо! Я проанализировал ваши ответы.');
    await ctx.reply(formatReasonCard(topResult), { format: 'markdown' });

    if (results.length > 1) {
      const others = results
        .slice(1, 3)
        .map((item) => `• ${item.reason.title}`)
        .join('\n');

      await ctx.reply(
        'Также возможные причины:\n' +
        others +
        '\n\n' +
        'Чтобы начать другой сценарий — нажмите «Выбрать сценарий».'
      );
    }


    await ctx.reply(
      '📌 Что делать дальше:\n' +
      '1. Подготовьте документы из списка.\n' +
      '2. Подайте заявление повторно, если такой порядок предусмотрен.\n' +
      '3. При повторном отказе — запросите письменное разъяснение.\n\n' +
      'Выберите другую категорию или сценарий:',
      { attachments: [categoryKeyboard()] }
    );
    return;
  }

  const result = getScenarioResult(scenario.id, state.resultId) ?? {};
  storage.update(userId, {
    done: true,
    lastScenarioId: scenario.id,
    scenarioResult: result,
    resultId: undefined,
    questionId: undefined,
    awaitingReminder: false,
  });
  storage.clearAnswers(userId);

  await ctx.reply(
    [
      `Готово. ${result.title ?? scenario.title}`,
      '',
      result.explanation ?? scenario.description,
      '',
      '*Что проверить:*',
      ...(result.actions ?? []).map((action) => `• ${action}`),
      '',
      `*Куда обращаться:* ${result.whereToApply ?? 'Уточните по месту назначения меры'}`,
      `*Основание:* ${result.legalRef ?? 'Проверить по правилам конкретной меры поддержки'}`,
      '',
      'Это информационная подсказка, а не официальное решение ведомства.',
      '',
      '*Документы:*',
      ...(result.documents ?? []).map((document) => `• ${document}`),
      '',
      'Чтобы выбрать другую категорию или сценарий, используйте кнопки ниже.'
    ].join('\n'),
    { format: 'markdown', attachments: [categoryKeyboard()] }
  );
}
