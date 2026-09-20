import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { storage } from '../src/services/storage.js';

beforeEach(() => {
  storage._reset();
});

test('storage сохраняет состояние пользователя', () => {
  const state = storage.set('u1', {
    step: 1,
    answers: { region: 'Тестовый регион' },
    done: false,
  });

  assert.equal(state.step, 1);
  assert.equal(storage.get('u1').answers.region, 'Тестовый регион');
  assert.ok(state.createdAt);
  assert.ok(state.updatedAt);
});

test('storage удаляет чувствительные ответы после завершения сценария', () => {
  storage.set('u1', {
    step: 14,
    answers: {
      region: 'Тестовый регион',
      refusalText: 'синтетические данные',
    },
  });

  storage.update('u1', {
    done: true,
    answers: undefined,
  });

  assert.equal(storage.get('u1').answers, undefined);
  assert.equal(storage.get('u1').done, true);
});

test('storage удаляет протухшую незавершённую сессию', () => {
  const expired = storage.set('u-expired', {
    step: 3,
    answers: { refusalText: 'синтетические данные' },
  });
  expired.updatedAt = '2000-01-01T00:00:00.000Z';

  assert.equal(storage.get('u-expired'), null);
});

test('storage-файл существует вне Git runtime', () => {
  assert.equal(fs.existsSync(storage._filePath), true);
});
