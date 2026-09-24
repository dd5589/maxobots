import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getNextTransition,
  getQuestionById,
  getScenario,
  getScenarioResult,
} from '../src/bot/scenarios/engine.js';
import { getScenarios } from '../src/services/scenarios.js';
import { getReasons, findReasonById } from '../src/services/reasons.js';
import { matchReasons } from '../src/services/matcher.js';

const GUIDED_SCENARIOS = getScenarios().filter((scenario) => scenario.engine === 'guided');

function terminalPaths(scenarioId) {
  const scenario = getScenario(scenarioId);
  const results = new Map();
  const visited = new Set();

  function walk(questionId, path = []) {
    const stateKey = `${questionId}|${path.map((item) => item.value).join(',')}`;
    if (visited.has(stateKey)) return;
    visited.add(stateKey);

    const question = getQuestionById(scenarioId, questionId);
    assert.ok(question, `${scenarioId}: вопрос ${questionId} существует`);

    if (question.type === 'text') {
      const transition = getNextTransition(scenarioId, questionId, 'тестовый ответ из интеграционного теста');
      assert.ok(transition, `${scenarioId}: текстовый вопрос ${questionId} должен иметь переход`);
      assert.equal(transition.type, 'result');
      results.set(transition.resultId, [...path, { questionId, value: 'text' }]);
      return;
    }

    for (const option of question.options ?? []) {
      const value = typeof option === 'object' ? String(option.value) : String(option);
      const transition = getNextTransition(scenarioId, questionId, value);
      assert.ok(transition, `${scenarioId}: нет перехода для ${questionId}=${value}`);

      if (transition.type === 'result') {
        results.set(transition.resultId, [...path, { questionId, value }]);
        continue;
      }

      walk(transition.questionId, [...path, { questionId, value }]);
    }
  }

  const firstQuestion = scenario.questions?.[0]?.id;
  assert.ok(firstQuestion, `${scenarioId}: нет первого вопроса`);
  walk(firstQuestion);

  return results;
}

for (const scenario of GUIDED_SCENARIOS) {
  test(`${scenario.title}: все конечные результаты достижимы`, () => {
    const paths = terminalPaths(scenario.id);
    const expected = Object.keys(scenario.results ?? {});

    assert.ok(paths.size > 0, `${scenario.id}: нет достижимых результатов`);
    assert.deepEqual(
      [...paths.keys()].sort(),
      expected.sort(),
    );

    for (const resultId of expected) {
      const result = getScenarioResult(scenario.id, resultId);
      assert.ok(result?.title, `${scenario.id}: ${resultId} должен иметь title`);
      assert.ok(Array.isArray(result.actions), `${scenario.id}: ${resultId} должен иметь actions[]`);
    }
  });
}

test('каждый из четырёх сценариев имеет хотя бы одну проверяемую точку результата', () => {
  assert.equal(getScenarios().length, 4);
  assert.ok(getScenarios().every((scenario) => scenario.engine));
});

test('каждый reason родительского сценария можно вызвать тестовым сигналом', () => {
  for (const reason of getReasons()) {
    if (reason.id === 'other') continue;

    const signalKey = Object.keys(reason.signals ?? {}).find(
      (key) => key !== 'refusalTextMatch',
    );

    if (signalKey) {
      const result = matchReasons({ [signalKey]: 'Да' });
      assert.equal(
        result[0]?.reason.id,
        reason.id,
        `signal ${signalKey} не приводит к ${reason.id}`,
      );
      continue;
    }

    const keyword = reason.keywords?.at(-1);
    assert.ok(keyword, `${reason.id}: нет fallback keyword`);
    const result = matchReasons({ refusalText: keyword });
    assert.equal(
      result[0]?.reason.id,
      reason.id,
      `keyword ${keyword} не приводит к ${reason.id}`,
    );
  }
});

test('fallback родительского сценария существует и содержит объяснение', () => {
  const reason = findReasonById('other');
  assert.ok(reason);
  assert.ok(reason.explanation);
  assert.ok(Array.isArray(reason.actions));
});
