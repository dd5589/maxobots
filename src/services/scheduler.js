import cron from 'node-cron';
import { remindersStore, formatReminderText } from './reminders.js';
import { storage } from './storage.js';
import { maxApi } from '../bot/api.js';

let task = null;
let running = false;

async function tick() {
  if (running) {
    return;
  }

  running = true;

  try {
    storage.pruneExpired();

    const due = remindersStore.getDue();

    for (const reminder of due) {
      try {
        await maxApi.sendMessage({
          userId: reminder.userId,
          text: formatReminderText(reminder),
          format: 'markdown',
        });

        remindersStore.markSent(reminder.id);

        console.log(
          `[scheduler] Отправлено ${reminder.id} → ${reminder.userId}`
        );
      } catch (error) {
        remindersStore.markFailed(reminder.id, error);

        console.error(
          `[scheduler] Ошибка ${reminder.id}:`,
          error.message
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startScheduler({ expression = '* * * * *' } = {}) {
  if (task) {
    return task;
  }

  if (!cron.validate(expression)) {
    throw new Error(`Некорректное cron-выражение: ${expression}`);
  }

  task = cron.schedule(expression, tick, {
    timezone: 'UTC',
  });

  console.log(`[scheduler] Запущен: ${expression}`);

  return task;
}

export function stopScheduler() {
  if (task) {
    task.stop();
    task = null;

    console.log('[scheduler] Остановлен');
  }
}

export const _tick = tick;
