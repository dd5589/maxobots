import { storage } from '../../services/storage.js';
import { remindersStore } from '../../services/reminders.js';

export async function handleReminderAnswer(ctx, userId, text) {
  const state = storage.get(userId);
  if (!state) return false;

  const lower = text.toLowerCase();

  if (lower.startsWith('да')) {
    const r = remindersStore.schedule({
      userId,
      type: 'reapply',
      daysFromNow: 3,
      payload: {
        reasonId: state.topReasonId,
        reasonTitle: state.topReasonTitle,
      },
    });
    const due = new Date(r.dueAt).toLocaleString('ru-RU', {
      timeZone: r.timezone,
      day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
    });
    await ctx.reply(`Хорошо! Напомню ${due}.`);
    storage.update(userId, { awaitingReminder: false });
    return true;
  }

  if (lower.startsWith('нет')) {
    await ctx.reply('Понял. Если понадобится — /start.');
    storage.update(userId, { awaitingReminder: false });
    return true;
  }

  if (lower === 'готово') {
    const n = remindersStore.cancelByUser(userId, 'reapply');
    await ctx.reply(n > 0 ? 'Отлично! Напоминание снято.' : 'Рад, что получилось!');
    return true;
  }

  if (lower === 'отмена') {
    const n = remindersStore.cancelByUser(userId, 'reapply');
    await ctx.reply(n > 0 ? 'Напоминание отменено.' : 'Активных напоминаний нет.');
    return true;
  }

  await ctx.reply('Ответьте «да», «нет» или «отмена».');
  return true;
}