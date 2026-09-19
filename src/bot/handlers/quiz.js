import { storage } from '../../services/storage.js';
import { getQuestion, totalQuestions } from '../scenarios/quiz.js';
import { matchReasons, formatReasonCard } from '../../services/matcher.js';
import { config } from '../../config.js';
import { miniAppKeyboard } from '../keyboards.js';

export async function askNext(bot, ctx, userId) {
  const state = storage.get(userId);
  if (!state) return;

  const q = getQuestion(state.step);
  if (!q) {
    return finish(bot, ctx, userId);
  }

  let text = `Вопрос ${state.step + 1} из ${totalQuestions()}:\n\n${q.text}`;

  if (q.type === 'choice' && Array.isArray(q.options)) {
    text += '\n\nВарианты:\n' + q.options.map((option, index) => `${index + 1}. ${option}`).join('\n');
  }

  await ctx.reply(text);
}

export async function finish(bot, ctx, userId) {
  const state = storage.get(userId);
  if (!state) return;

  const results = matchReasons(state.answers);
  const topResult = results[0];

  if (!topResult?.reason) {
    throw new Error('Не удалось определить причину отказа');
  }

  const top = topResult.reason;

  await ctx.reply('Спасибо! Я проанализировал ваши ответы.');

  await ctx.reply(formatReasonCard(top), {
    format: 'markdown',
  });

  if (results.length > 1) {
    const others = results
      .slice(1, 3)
      .map((item) => `• ${item.reason.title}`)
      .join('\n');

    await ctx.reply(
      'Также возможные причины:\n' +
      others +
      '\n\n' +
      'Если хотите разобрать другую — /restart.'
    );
  }

  if (config.miniAppUrl) {
    await ctx.reply('Откройте чек-лист в мини-приложении:', {
      attachments: [miniAppKeyboard(config.miniAppUrl, top.id)],
    });
  }

  await ctx.reply(
    '📌 Что делать дальше:\n' +
    '1. Подготовьте документы из списка.\n' +
    '2. Подайте заявление повторно через «Госуслуги».\n' +
    '3. При повторном отказе — запросите письменное разъяснение в СФР.\n\n' +
    'Напомнить о подаче через 3 дня? Напишите «да» или «нет».'
  );

  storage.update(userId, {
    done: true,
    awaitingReminder: true,
    topReasonId: top.id,
    topReasonTitle: top.title,
  });
}
