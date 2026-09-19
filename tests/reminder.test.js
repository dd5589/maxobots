import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { remindersStore } from '../src/services/reminders.js';
import { nextLocalMorning } from '../src/services/timezone.js';

beforeEach(() => {
  remindersStore._reset();
});

test('schedule создаёт pending-напоминание', () => {
  const r = remindersStore.schedule({
    userId: 'u1',
    type: 'reapply',
    daysFromNow: 3,
  });
  assert.equal(r.status, 'pending');
  assert.equal(r.userId, 'u1');
  assert.ok(r.dueAt > Date.now());
});

test('schedule не дублирует pending для одного пользователя и типа', () => {
  const a = remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  const b = remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  assert.equal(a.id, b.id);
});

test('getDue возвращает только просроченные pending', () => {
  const r = remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  const raw = remindersStore.listByUser('u1')[0];
  raw.dueAt = Date.now() - 1000;

  const due = remindersStore.getDue();
  assert.equal(due.length, 1);
  assert.equal(due[0].id, r.id);
});

test('markSent переводит в sent и фиксирует sentAt', () => {
  const r = remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  remindersStore.markSent(r.id);
  const updated = remindersStore.listByUser('u1')[0];
  assert.equal(updated.status, 'sent');
  assert.ok(updated.sentAt);
});

test('markFailed увеличивает attempts и переносит dueAt', () => {
  const r = remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  remindersStore.markFailed(r.id, new Error('network'));
  const updated = remindersStore.listByUser('u1')[0];
  assert.equal(updated.attempts, 1);
  assert.equal(updated.status, 'pending');
  assert.ok(updated.dueAt > Date.now());
});

test('после maxAttempts статус failed', () => {
  const r = remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  for (let i = 0; i < 3; i++) remindersStore.markFailed(r.id, new Error('e'));
  const updated = remindersStore.listByUser('u1')[0];
  assert.equal(updated.status, 'failed');
});

test('cancelByUser отменяет все pending', () => {
  remindersStore.schedule({ userId: 'u1', type: 'reapply' });
  remindersStore.schedule({ userId: 'u1', type: 'other' });
  const n = remindersStore.cancelByUser('u1');
  assert.equal(n, 2);
  assert.equal(remindersStore.stats().pending, 0);
});

test('nextLocalMorning даёт 10:00 по Москве', () => {
  const base = Date.UTC(2026, 8, 18, 12, 0, 0);
  const due = nextLocalMorning(base, 'Europe/Moscow', 10);
  const msk = new Date(due).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  assert.match(msk, /10:00/);
});