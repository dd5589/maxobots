import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { createJsonStore } from './jsonStore.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const store = createJsonStore(
  path.resolve(config.dataDir, 'reminders.json'),
  {
    fallback: {},
    label: 'reminders',
  }
);

const reminders = store.getAll();

function genId(userId) {
  return `rem_${crypto.randomUUID()}`;
}

function persist() {
  store.save();
}

export const remindersStore = {
  schedule({
    userId,
    type,
    daysFromNow = 3,
    timezone = config.tz,
  }) {
    const normalizedUserId = String(userId);
    const existing = Object.values(reminders).find(
      (reminder) =>
        reminder.userId === normalizedUserId &&
        reminder.type === type &&
        reminder.status === 'pending'
    );

    if (existing) {
      return existing;
    }

    const now = Date.now();

    const reminder = {
      id: genId(normalizedUserId),
      userId: normalizedUserId,
      type,
      dueAt: now + daysFromNow * DAY_MS,
      timezone,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      createdAt: now,
      sentAt: null,
    };

    reminders[reminder.id] = reminder;
    persist();

    return reminder;
  },

  getDue(now = Date.now()) {
    return Object.values(reminders).filter(
      (reminder) =>
        reminder.status === 'pending' &&
        reminder.dueAt <= now
    );
  },

  markSent(id) {
    const reminder = reminders[id];

    if (!reminder) {
      return null;
    }

    reminder.status = 'sent';
    reminder.sentAt = Date.now();

    persist();
    return reminder;
  },

  markFailed(id, error) {
    const reminder = reminders[id];

    if (!reminder) {
      return null;
    }

    reminder.attempts += 1;
    reminder.lastError = String(error?.message ?? error).slice(0, 500);

    if (reminder.attempts >= reminder.maxAttempts) {
      reminder.status = 'failed';
    } else {
      reminder.dueAt = Date.now() + 5 * 60 * 1000;
    }

    persist();
    return reminder;
  },

  cancel(id) {
    const reminder = reminders[id];

    if (!reminder) {
      return null;
    }

    reminder.status = 'cancelled';
    persist();
    return reminder;
  },

  cancelByUser(userId, type) {
    let count = 0;
    const normalizedUserId = String(userId);

    for (const reminder of Object.values(reminders)) {
      if (
        reminder.userId === normalizedUserId &&
        (!type || reminder.type === type) &&
        reminder.status === 'pending'
      ) {
        reminder.status = 'cancelled';
        count += 1;
      }
    }

    if (count > 0) {
      persist();
    }

    return count;
  },

  listByUser(userId) {
    const normalizedUserId = String(userId);
    return Object.values(reminders).filter(
      (reminder) => reminder.userId === normalizedUserId
    );
  },

  stats() {
    const all = Object.values(reminders);

    return {
      total: all.length,
      pending: all.filter((reminder) => reminder.status === 'pending').length,
      sent: all.filter((reminder) => reminder.status === 'sent').length,
      failed: all.filter((reminder) => reminder.status === 'failed').length,
      cancelled: all.filter((reminder) => reminder.status === 'cancelled').length,
    };
  },

  _reset() {
    for (const key of Object.keys(reminders)) {
      delete reminders[key];
    }

    persist();
  },

  _filePath: store.filePath,
};

export function formatReminderText(reminder) {
  const lines = [
    '⏰ Напоминание',
    '',
    'Вы планировали подать заявление повторно.',
  ];

  lines.push(
    '',
    'Проверьте, что подготовили документы:',
    '• Справки от ведомства',
    '• Копию предыдущего заявления',
    '• Копию отказа',
    '',
    'Подать заявление: https://www.gosuslugi.ru/',
    '',
    'Если уже подали — напишите «готово».',
    'Если неактуально — «отмена».',
  );

  return lines.join('\n');
}
