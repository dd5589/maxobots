import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const filePath = path.resolve(config.dataDir, 'reminders.json');

function ensureFile() {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readAll() {
  ensureFile();

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[reminders] Не удалось прочитать reminders.json:', error.message);
    return {};
  }
}

function writeAll(data) {
  ensureFile();

  const tempPath = `${filePath}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

const reminders = readAll();

function genId(userId) {
  return `rem_${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`;
}

export const remindersStore = {
  schedule({
    userId,
    type,
    daysFromNow = 3,
    timezone = config.tz,
    payload = {},
  }) {
    const existing = Object.values(reminders).find(
      (reminder) =>
        reminder.userId === String(userId) &&
        reminder.type === type &&
        reminder.status === 'pending'
    );

    if (existing) {
      return existing;
    }

    const now = Date.now();

    const reminder = {
      id: genId(userId),
      userId: String(userId),
      type,
      dueAt: now + daysFromNow * DAY_MS,
      timezone,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      createdAt: now,
      sentAt: null,
    };

    reminders[reminder.id] = reminder;
    writeAll(reminders);

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

    writeAll(reminders);

    return reminder;
  },

  markFailed(id, error) {
    const reminder = reminders[id];

    if (!reminder) {
      return null;
    }

    reminder.attempts += 1;
    reminder.lastError = String(error?.message ?? error);

    if (reminder.attempts >= reminder.maxAttempts) {
      reminder.status = 'failed';
    } else {
      reminder.dueAt = Date.now() + 5 * 60 * 1000;
    }

    writeAll(reminders);

    return reminder;
  },

  cancel(id) {
    const reminder = reminders[id];

    if (!reminder) {
      return null;
    }

    reminder.status = 'cancelled';
    writeAll(reminders);

    return reminder;
  },

  cancelByUser(userId, type) {
    let count = 0;

    for (const reminder of Object.values(reminders)) {
      if (
        reminder.userId === String(userId) &&
        (!type || reminder.type === type) &&
        reminder.status === 'pending'
      ) {
        reminder.status = 'cancelled';
        count += 1;
      }
    }

    if (count > 0) {
      writeAll(reminders);
    }

    return count;
  },

  listByUser(userId) {
    return Object.values(reminders).filter(
      (reminder) => reminder.userId === String(userId)
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

    writeAll(reminders);
  },
};

export function formatReminderText(reminder) {
  const { reasonTitle } = reminder.payload;

  const lines = [
    '⏰ Напоминание',
    '',
    'Вы планировали подать заявление повторно.',
  ];

  if (reasonTitle) {
    lines.push(`Причина, которую разбирали: *${reasonTitle}*.`);
  }

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
    'Если неактуально — «отмена».'
  );

  return lines.join('\n');
}
