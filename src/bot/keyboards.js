import { Keyboard } from '@maxhub/max-bot-api';
import { getCategories, getScenariosByCategory } from '../services/scenarios.js';
import { getOptions } from './scenarios/engine.js';

const MAX_SAFE_BUTTON_TEXT_LENGTH = 30;

function assertButtonText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Текст кнопки не может быть пустым');
  }
  if (text.includes('\n')) {
    throw new Error(`Текст кнопки не должен содержать переносы: ${text}`);
  }
  if (text.length > MAX_SAFE_BUTTON_TEXT_LENGTH) {
    throw new Error(`Слишком длинный текст кнопки (${text.length} > ${MAX_SAFE_BUTTON_TEXT_LENGTH}): ${text}`);
  }
  return text;
}

function callbackButton(text, payload) {
  return Keyboard.button.callback(assertButtonText(text), payload);
}

export function categoryKeyboard() {
  const categories = getCategories();
  return Keyboard.inlineKeyboard(
    categories.map((category) => [
      callbackButton(category.title, `category:${category.id}`),
    ])
  );
}

export function scenarioKeyboard(categoryId) {
  const scenarios = getScenariosByCategory(categoryId);

  return Keyboard.inlineKeyboard([
    ...scenarios.map((scenario) => [
      callbackButton(scenario.buttonTitle ?? scenario.title, `scenario:${scenario.id}`),
    ]),
    [callbackButton('← Все категории', 'categories')],
  ]);
}

export function choiceKeyboard(scenarioId, question) {
  const buttons = getOptions(question).map((option, index) =>
    callbackButton(
      option.label,
      `answer:${scenarioId}:${question.id}:${index}`
    )
  );

  // Один вариант на строку даёт каждой кнопке всю доступную ширину MAX.
  return Keyboard.inlineKeyboard(buttons.map((button) => [button]));
}
