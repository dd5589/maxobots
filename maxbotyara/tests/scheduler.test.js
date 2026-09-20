import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { remindersStore } from '../src/services/reminders.js';
import { _tick } from '../src/services/scheduler.js';
import { maxApi } from '../src/bot/api.js';

beforeEach(() => {
  remindersStore._reset();
});

test('tick отправляет due-напоминания и помечает sent', async () => {
  const sent = [];
  mock.method(maxApi, 'sendMessage', async ({ userId, text }) => {
    sent.push({ userId, text });
    return { ok: true };
  });

  const r = remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  const raw = remindersStore.listByUser('u1')[0];
  raw.dueAt = Date.now() - 1000;

  await _tick();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].userId, 'u1');
  assert.match(sent[0].text, /Напоминание/);
  assert.equal(remindersStore.listByUser('u1')[0].status, 'sent');

  mock.restoreAll();
});

test('tick не падает при ошибке MAX API', async () => {
  mock.method(maxApi, 'sendMessage', async () => {
    throw new Error('boom');
  });

  const r = remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  const raw = remindersStore.listByUser('u1')[0];
  raw.dueAt = Date.now() - 1000;

  await _tick();

  const updated = remindersStore.listByUser('u1')[0];
  assert.equal(updated.attempts, 1);
  assert.equal(updated.status, 'pending');

  mock.restoreAll();
});