import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCategories,
  getScenarios,
  getScenariosByCategory,
  findScenarioById,
  _resetCache,
} from '../src/services/scenarios.js';
import {
  getScenarioQuestions,
  getQuestionForScenario,
  totalQuestions,
  getNextTransition,
  getScenarioResult,
} from '../src/bot/scenarios/engine.js';

afterEach(() => {
  _resetCache();
});

test('движок содержит 4 категории', () => {
  const categories = getCategories();
  assert.equal(categories.length, 4);
  assert.deepEqual(
    categories.map((item) => item.id),
    ['parent', 'student', 'pensioner', 'svo_veteran_family']
  );
});

test('каждая категория содержит сценарий', () => {
  for (const category of getCategories()) {
    assert.ok(getScenariosByCategory(category.id).length > 0, category.id);
  }
});

test('родительский сценарий подключает существующий matcher', () => {
  const scenario = findScenarioById('parent_unified_allowance_refusal');
  assert.equal(scenario.engine, 'reason_matcher');
  assert.equal(scenario.questionsRef, 'parent_unified_allowance');

  const questions = getScenarioQuestions(scenario.id);
  assert.ok(questions.length >= 10);
  assert.equal(getQuestionForScenario(scenario.id, 0).id, 'region');
  assert.ok(totalQuestions(scenario.id) === questions.length);
});

test('новые сценарии задаются данными, без отдельного кода на сценарий', () => {
  const ids = [
    'student_social_scholarship_refusal',
    'pensioner_social_supplement_refusal',
    'svo_veteran_family_support_refusal',
  ];

  for (const id of ids) {
    const scenario = findScenarioById(id);
    assert.equal(scenario.engine, 'guided');
    assert.ok(Array.isArray(scenario.questions));
    assert.ok(scenario.questions.length >= 4);
    assert.ok(Object.keys(scenario.results ?? {}).length > 0);
  }
});

test('всего 4 сценария', () => {
  assert.equal(getScenarios().length, 4);
});


test('категории и ответы строятся через inline-кнопки, а не номера', async () => {
  const { categoryKeyboard, scenarioKeyboard, choiceKeyboard } = await import('../src/bot/keyboards.js');
  const categories = categoryKeyboard();
  assert.equal(categories.type, 'inline_keyboard');
  assert.ok(categories.payload.buttons.flat().every((button) => button.type === 'callback'));
  assert.ok(categories.payload.buttons.flat().every((button) => !/^\d+[.)]\s/.test(button.text)));

  const scenarios = scenarioKeyboard('student');
  assert.ok(scenarios.payload.buttons.flat().some((button) => button.payload === 'scenario:student_social_scholarship_refusal'));

  const question = getQuestionForScenario('student_social_scholarship_refusal', 0);
  const choices = choiceKeyboard('student_social_scholarship_refusal', question);
  assert.equal(choices.payload.buttons[0][0].payload, 'answer:student_social_scholarship_refusal:studyForm:0');
});

test('callback ответа принимает camelCase id вопроса', () => {
  const callback = 'answer:student_social_scholarship_refusal:studyForm:0';
  const match = callback.match(/^answer:([^:]+):([^:]+):(\d+)$/);
  assert.deepEqual(match?.slice(1), ['student_social_scholarship_refusal', 'studyForm', '0']);
});



test('ветвящийся студентский сценарий переводит очного бюджетника к проверке основания', () => {
  const transition = getNextTransition('student_social_scholarship_refusal', 'studyForm', 'full_time');
  assert.deepEqual(transition, { type: 'question', questionId: 'fundingSource', resultId: null });
});

test('ветвящийся сценарий имеет отдельные результаты', () => {
  const result = getScenarioResult('pensioner_social_supplement_refusal', 'above_pm');
  assert.match(result.title, /Проверьте/);
  assert.ok(result.actions.length > 0);
});

test('все переходы новых сценариев ссылаются на существующие вопросы или результаты', () => {
  for (const scenario of getScenarios().filter((item) => item.engine === 'guided')) {
    const questionIds = new Set(scenario.questions.map((question) => question.id));
    const resultIds = new Set(Object.keys(scenario.results ?? {}));
    for (const question of scenario.questions) {
      const transitions = [];
      if (question.next) transitions.push(question.next);
      for (const value of Object.values(question.nextByValue ?? {})) transitions.push(value);
      for (const option of question.options ?? []) {
        if (option && typeof option === 'object') {
          if (option.next) transitions.push(option.next);
          if (option.resultId) transitions.push(`result:${option.resultId}`);
        }
      }
      for (const transition of transitions) {
        if (String(transition).startsWith('result:')) {
          assert.ok(resultIds.has(String(transition).slice(7)));
        } else {
          assert.ok(questionIds.has(transition));
        }
      }
    }
  }
});
