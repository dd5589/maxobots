import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { formatReasonCard, matchReasons } from '../src/services/matcher.js';
import { _resetCache } from '../src/services/reasons.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'cases.json'), 'utf8')
);

for (const testCase of cases) {
  test(`Кейс: ${testCase.name}`, () => {
    _resetCache();

    const results = matchReasons(testCase.answers);

    assert.ok(results.length > 0, 'должен быть хотя бы один результат');
    assert.equal(results[0].reason.id, testCase.expectedTop);
  });
}

test('Fallback: пустые ответы → other', () => {
  _resetCache();

  assert.equal(matchReasons({})[0].reason.id, 'other');
});

test('Ответ "Нет" не должен считаться положительным сигналом', () => {
  _resetCache();

  const results = matchReasons({
    hasExtraProperty: 'Нет',
    hasIrregularIncome: 'Нет',
    hasNoIncome: 'Нет',
    refusalText: 'иное',
  });

  assert.equal(results[0].reason.id, 'other');
});

test('Веса: причина с дополнительным подтверждающим сигналом выше', () => {
  _resetCache();

  const results = matchReasons({
    refusalText: 'неполные данные',
    previousRefusal: true,
    hasExtraProperty: true,
  });

  assert.equal(results[0].reason.id, 'smv_error');
});

test('Текст отказа "превышение дохода" не должен превращаться в property', () => {
  _resetCache();

  const results = matchReasons({
    refusalText: 'превышение дохода',
  });

  assert.equal(results[0].reason.id, 'income_calc');
});


test('Карточка результата использует реальные переносы строк и маркирует результат как информационный', () => {
  _resetCache();

  const result = matchReasons({
    refusalText: 'превышение дохода',
  })[0];
  const card = formatReasonCard(result);

  assert.match(card, /Возможная причина/);
  assert.match(card, /\n/);
  assert.doesNotMatch(card, /\\n/);
  assert.match(card, /не официальное решение ведомства/);
});
