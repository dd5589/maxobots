import { test } from 'node:test';
import assert from 'node:assert/strict';

import { categoryKeyboard, scenarioKeyboard, choiceKeyboard } from '../src/bot/keyboards.js';
import { getScenarios } from '../src/services/scenarios.js';
import { getQuestionForScenario } from '../src/bot/scenarios/engine.js';

const MAX_SAFE_BUTTON_TEXT_LENGTH = 30;

function allButtons(keyboard) {
  return keyboard.payload.buttons.flat();
}

test('все кнопки категорий полностью помещаются в безопасный лимит длины', () => {
  const buttons = allButtons(categoryKeyboard());
  assert.equal(buttons.length, 4);
  assert.ok(buttons.every((button) => button.text.length <= MAX_SAFE_BUTTON_TEXT_LENGTH));
  assert.ok(buttons.every((button) => !button.text.includes('\n')));
});

test('кнопки сценариев используют короткие подписи вместо обрезания длинных заголовков', () => {
  for (const scenario of getScenarios()) {
    const buttons = allButtons(scenarioKeyboard(scenario.categoryId));
    const scenarioButton = buttons.find((button) => button.payload === `scenario:${scenario.id}`);
    assert.ok(scenarioButton);
    assert.ok(scenarioButton.text.length <= MAX_SAFE_BUTTON_TEXT_LENGTH);
    assert.notEqual(scenarioButton.text, scenario.title);
  }
});

test('кнопки ответов идут по одной в строке и не содержат заведомо обрезаемых длинных подписей', () => {
  for (const scenario of getScenarios()) {
    for (const question of scenario.questions ?? []) {
      if (question.type !== 'choice') continue;
      const keyboard = choiceKeyboard(scenario.id, question);
      assert.equal(keyboard.payload.buttons.length, question.options.length);
      assert.ok(keyboard.payload.buttons.every((row) => row.length === 1));
      assert.ok(allButtons(keyboard).every((button) => button.text.length <= MAX_SAFE_BUTTON_TEXT_LENGTH));
    }
  }
});

test('callback payload сохраняет исходный индекс варианта', () => {
  const scenarioId = 'student_social_scholarship_refusal';
  const question = getQuestionForScenario(scenarioId, 0);
  const keyboard = choiceKeyboard(scenarioId, question);

  assert.deepEqual(
    keyboard.payload.buttons.map((row) => row[0].payload),
    question.options.map((_, index) => `answer:${scenarioId}:${question.id}:${index}`),
  );
});
