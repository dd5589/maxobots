import { Keyboard } from '@maxhub/max-bot-api';
import { getCategories, getScenariosByCategory } from '../services/scenarios.js';
import { getOptions } from './scenarios/engine.js';

function rows(items, makeButton, perRow = 2) {
  const result = [];
  for (let i = 0; i < items.length; i += perRow) {
    result.push(items.slice(i, i + perRow).map(makeButton));
  }
  return result;
}

export function categoryKeyboard() {
  const categories = getCategories();
  return Keyboard.inlineKeyboard(
    rows(categories, (category) =>
      Keyboard.button.callback(category.title, `category:${category.id}`)
    )
  );
}

export function scenarioKeyboard(categoryId) {
  const scenarios = getScenariosByCategory(categoryId);

  return Keyboard.inlineKeyboard([
    ...scenarios.map((scenario) => [
      Keyboard.button.callback(scenario.title, `scenario:${scenario.id}`),
    ]),
    [Keyboard.button.callback('← Все категории', 'categories')],
  ]);
}

export function choiceKeyboard(scenarioId, question) {
  const buttons = getOptions(question).map((option, index) =>
    Keyboard.button.callback(option.label, `answer:${scenarioId}:${question.id}:${index}`)
  );

  return Keyboard.inlineKeyboard(rows(buttons, (button) => button, 2));
}

export function miniAppKeyboard(url, payload) {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.openApp(
        'Открыть чек-лист',
        url,
        undefined,
        payload,
      ),
    ],
  ]);
}
