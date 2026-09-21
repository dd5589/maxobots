import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_PATH = join(__dirname, '..', '..', 'data', 'scenarios.json');

let cache = null;

function validateQuestion(question, scenarioId) {
  if (!question || typeof question !== 'object') {
    throw new Error(`scenarios.json: некорректный вопрос в "${scenarioId}"`);
  }

  if (!question.id || !question.text || !['text', 'choice'].includes(question.type)) {
    throw new Error(`scenarios.json: некорректный вопрос "${question.id}" в "${scenarioId}"`);
  }

  if (question.type === 'choice') {
    if (!Array.isArray(question.options) || question.options.length === 0) {
      throw new Error(`scenarios.json: у choice-вопроса "${question.id}" нет options`);
    }
    if (question.options.some((option) => {
      if (typeof option === 'string') return false;
      return !(option && typeof option === 'object' && (option.label || option.value));
    })) {
      throw new Error(`scenarios.json: options "${question.id}" должны быть строками или объектами с label/value`);
    }
  }
}

function validate(data) {
  if (!data || typeof data !== 'object') throw new Error('scenarios.json: не объект');
  if (!Array.isArray(data.categories) || data.categories.length === 0) {
    throw new Error('scenarios.json: categories пуст');
  }
  if (!Array.isArray(data.scenarios) || data.scenarios.length === 0) {
    throw new Error('scenarios.json: scenarios пуст');
  }

  const categoryIds = new Set();
  for (const category of data.categories) {
    if (!category?.id || !category?.title || categoryIds.has(category.id)) {
      throw new Error(`scenarios.json: некорректная категория "${category?.id ?? ''}"`);
    }
    categoryIds.add(category.id);
  }

  const scenarioIds = new Set();
  for (const scenario of data.scenarios) {
    if (
      !scenario?.id ||
      !scenario?.categoryId ||
      !scenario?.title ||
      !scenario?.description ||
      !scenario?.engine ||
      scenarioIds.has(scenario.id)
    ) {
      throw new Error(`scenarios.json: некорректный сценарий "${scenario?.id ?? ''}"`);
    }

    if (!categoryIds.has(scenario.categoryId)) {
      throw new Error(
        `scenarios.json: сценарий "${scenario.id}" ссылается на неизвестную категорию "${scenario.categoryId}"`
      );
    }

    if (scenario.questionsRef === 'parent_unified_allowance' || Array.isArray(scenario.questions)) {
      for (const question of scenario.questions ?? []) {
        validateQuestion(question, scenario.id);
      }

      const questionIds = new Set((scenario.questions ?? []).map((question) => question.id));
      const resultIds = new Set(Object.keys(scenario.results ?? {}));

      for (const question of scenario.questions ?? []) {
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
          if (typeof transition !== 'string') continue;
          if (transition.startsWith('result:')) {
            const resultId = transition.slice('result:'.length);
            if (!resultIds.has(resultId)) {
              throw new Error(`scenarios.json: сценарий "${scenario.id}" ссылается на неизвестный результат "${resultId}"`);
            }
          } else if (!questionIds.has(transition)) {
            throw new Error(`scenarios.json: сценарий "${scenario.id}" ссылается на неизвестный вопрос "${transition}"`);
          }
        }
      }
    }

    scenarioIds.add(scenario.id);
  }

  const parent = data.scenarios.find((scenario) => scenario.id === 'parent_unified_allowance_refusal');
  if (!parent || parent.engine !== 'reason_matcher') {
    throw new Error('scenarios.json: должен существовать базовый parent-сценарий');
  }

  return data;
}

export function loadScenarios() {
  if (cache) return cache;
  const raw = readFileSync(SCENARIOS_PATH, 'utf8');
  cache = validate(JSON.parse(raw));
  return cache;
}

export function getCategories() {
  return loadScenarios().categories;
}

export function getScenarios() {
  return loadScenarios().scenarios;
}

export function getScenariosByCategory(categoryId) {
  return getScenarios().filter((scenario) => scenario.categoryId === categoryId);
}

export function findCategoryById(id) {
  return getCategories().find((category) => category.id === id) ?? null;
}

export function findScenarioById(id) {
  return getScenarios().find((scenario) => scenario.id === id) ?? null;
}

export function _resetCache() {
  cache = null;
}
